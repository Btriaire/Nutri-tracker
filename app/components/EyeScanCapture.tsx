"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconX, IconLoader2, IconArrowUp } from "@tabler/icons-react";
import { getVideoLandmarker } from "@/app/lib/face-landmarker";
import { acquisitionQuality, acquisitionStats, analyzePlr, computeConjunctiva, computeEyeMetrics, mergeEyeMetrics, type Conjunctiva, type EyeMetrics, type EyeSideId, type PlrResult, type PlrSample } from "@/app/lib/eye-metrics";
import type { PixelReader } from "@/app/lib/face-metrics";
import { canthalRollDeg } from "@/app/lib/eye-structures";
import { drawEyeOverlay, EYE_LID_POINTS } from "@/app/lib/eye-overlay";
import { tapToImage } from "@/app/lib/eye-tap";
import { EyeChoiceScreen, EyeDoneScreen } from "./EyeScanStep";

export interface EyeCaptureResult {
  metrics: EyeMetrics;
  /** Reprise d'un seul oeil : metrics ne contient que cet oeil fiable, le parent complete avec le scan precedent. */
  only?: EyeSideId;
  plr: PlrResult | null;
  conjunctiva: Conjunctiva | null;
  mbiS: number | null;
  image: string | null;
  imageA: string | null;
  imageB: string | null;
}

type Phase = "loading" | "eyes-R" | "eyes-L" | "eye-done" | "choose" | "plr-dark" | "plr-flash" | "conj-ready" | "conj" | "mbi-ready" | "mbi" | "error";

const EYE_MS = 6000, DARK_MS = 1300, FLASH_MS = 2300, CONJ_WAIT_MS = 3000, CONJ_MS = 1500, MBI_MAX_MS = 40_000;
const EYE_GIVE_UP_MS = 15_000;          // au-dela, sans prise correcte : on arrete et on explique
const MIN_OPEN = 0.45;                  // ouverture minimale (hauteur de fente / iris) pour retenir une image
const MIN_QUALITY = 60;                 // score de prise de vue minimal pour retenir une image
const STABLE_FRAMES = 2;                // evaluations consecutives sans mouvement avant de retenir
const BURST = 5;                        // photos minimales par oeil ; la meilleure est gardee
const BURST_MAX = 12;                   // on continue a ajouter des candidats pendant la duree minimale
const MIN_DWELL_MS = 4500;              // duree minimale par oeil (acquisition lisible, pas trop rapide)
const DONE_MS = 1600;                   // ecran de confirmation "oeil capture"
const INNER_OUTER = { A: [133, 33], B: [362, 263] } as const;   // coins de l'oeil (interne, externe) pour le redressement
const EVAL_MS = 100;                    // intervalle entre deux photos du rafale
const ZOOM = 2;                         // zoom d'affichage et, si la camera le permet, zoom optique
const EYE_PTS = [33, 133, 159, 145, 263, 362, 386, 374, 468, 473];
const BLINK: Record<EyeSideId, string> = { A: "eyeBlinkRight", B: "eyeBlinkLeft" };   // A = oeil droit de la personne
const IRIS: Record<EyeSideId, number> = { A: 468, B: 473 };
const LABEL: Record<EyeSideId, string> = { A: "ŒIL DROIT", B: "ŒIL GAUCHE" };
// Centre du cadre de guidage (en % de la largeur) : image miroir, oeil droit a gauche
const EYE_X: Record<EyeSideId, number> = { A: 31, B: 69 };

/** Scan guide de l'oeil : oeil droit puis gauche (zoom, ouverture, qualite en direct), reflexe pupillaire, conjonctive, secheresse. */
export default function EyeScanCapture({ onDone, onCancel, only }: { onDone: (r: EyeCaptureResult) => void; onCancel: () => void; only?: EyeSideId }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState("");
  const [face, setFace] = useState(false);
  const [left, setLeft] = useState(0);
  const [quality, setQuality] = useState<{ score: number; issue: string | null }>({ score: 0, issue: null });
  const [shots, setShots] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [dwell, setDwell] = useState(0);                       // progression de la duree minimale (0-100)
  const [doneInfo, setDoneInfo] = useState<{ label: string; image: string | null; score: number } | null>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const manualRef = useRef<Partial<Record<EyeSideId, { x: number; y: number }>>>({});
  const manualDirty = useRef<EyeSideId | null>(null);
  const [manualSides, setManualSides] = useState<Partial<Record<EyeSideId, boolean>>>({});
  const finishNow = useRef<(() => void) | null>(null);
  const startAdvanced = useRef<(() => void) | null>(null);
  const [mbiElapsed, setMbiElapsed] = useState(0);
  const phaseRef = useRef<Phase>("loading");
  const startMbi = useRef<(() => void) | null>(null);
  const skipMbi = useRef<(() => void) | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0, stopped = false;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    const go = (p: Phase) => { phaseRef.current = p; setPhase(p); };

    type Best = { m: EyeMetrics; q: number; image: string | null; eye: string | null };
    const best: Partial<Record<EyeSideId, Best>> = {};
    const cands: Partial<Record<EyeSideId, Best[]>> = {};   // rafale de la passe en cours
    const plrSamples: PlrSample[] = [];
    let conj: Conjunctiva | null = null;
    let mbiS: number | null = null;
    let phaseStart = 0, flashT = 0, lastEval = 0, eyesClosedSince = 0;
    let prevIris: { x: number; y: number } | null = null, stable = 0;   // stabilisateur : mouvement de l'iris entre evaluations
    const resetSide = () => { prevIris = null; stable = 0; phaseStart = 0; };

    const finish = () => {
      if (stopped) return;
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
      if (only) {
        const b = best[only];
        if (!b) { setError("Œil non bien ouvert : ouvre-le grand, fixe le point, et refais la prise."); go("error"); return; }
        onDone({ metrics: b.m, only, plr: null, conjunctiva: null, mbiS: null, image: b.image,
          imageA: only === "A" ? b.eye : null, imageB: only === "B" ? b.eye : null });
        return;
      }
      if (!best.A || !best.B) { setError("Yeux non mesurés : rapproche le téléphone (25-30 cm), bien en face, et ouvre les yeux."); go("error"); return; }
      onDone({
        metrics: mergeEyeMetrics(best.A.m, best.B.m), plr: analyzePlr(plrSamples, flashT), conjunctiva: conj, mbiS,
        image: best.A.image, imageA: best.A.eye, imageB: best.B.eye,
      });
    };

    // Choix apres les deux yeux : terminer tout de suite (sans PLR ni conjonctive) ou lancer les analyses avancees
    let afterDone: (() => void) | null = null;
    finishNow.current = () => finish();
    startAdvanced.current = () => { go("plr-dark"); phaseStart = performance.now(); };
    startMbi.current = () => { go("mbi"); phaseStart = performance.now(); eyesClosedSince = 0; };
    skipMbi.current = () => { mbiS = null; finish(); };

    (async () => {
      try {
        const [lm, s] = await Promise.all([
          getVideoLandmarker(),
          navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false }),
        ]);
        stream = s;
        if (stopped) { s.getTracks().forEach((t) => t.stop()); return; }
        // Zoom optique si l'appareil le permet (sinon le zoom reste d'affichage, l'analyse se fait sur la zone des yeux)
        const track = s.getVideoTracks()[0];
        const zoomCap = (track?.getCapabilities?.() as { zoom?: { max: number } } | undefined)?.zoom;
        if (zoomCap) track.applyConstraints({ advanced: [{ zoom: Math.min(zoomCap.max, ZOOM) } as MediaTrackConstraintSet] }).catch(() => {});
        const video = videoRef.current!;
        video.srcObject = s;
        await video.play();
        canvas.width = video.videoWidth; canvas.height = video.videoHeight;
        if (overlayRef.current) { overlayRef.current.width = video.videoWidth; overlayRef.current.height = video.videoHeight; }
        go(only === "B" ? "eyes-L" : "eyes-R");
        phaseStart = 0;
        let lastVideoTime = -1;

        const tick = () => {
          if (stopped) return;
          raf = requestAnimationFrame(tick);
          if (video.currentTime === lastVideoTime) return;
          lastVideoTime = video.currentTime;
          const now = performance.now();
          const res = lm.detectForVideo(video, now);
          const pts = res.faceLandmarks?.[0];
          setFace(!!pts);
          const p = phaseRef.current;
          // Confirmation et choix : pas besoin du visage pour avancer ; le dessin des structures est efface
          if (p !== "eyes-R" && p !== "eyes-L") overlayRef.current?.getContext("2d")?.clearRect(0, 0, overlayRef.current.width, overlayRef.current.height);
          if (p === "eye-done") { if (now - phaseStart >= DONE_MS) afterDone?.(); return; }
          if (p === "choose") return;
          if (!pts) { if (p === "eyes-R" || p === "eyes-L") { phaseStart = 0; prevIris = null; stable = 0; } return; }
          const bs = res.faceBlendshapes?.[0]?.categories ?? [];
          const blinkOf = (side: EyeSideId) => bs.find((c) => c.categoryName === BLINK[side])?.score ?? 0;
          const blink = (blinkOf("A") + blinkOf("B")) / 2;

          // Lecture des pixels : zone des yeux + joues (cernes)
          const w = canvas.width, h = canvas.height;
          const xs = EYE_PTS.map((i) => pts[i].x * w), ys = EYE_PTS.map((i) => pts[i].y * h);
          const span = Math.max(...xs) - Math.min(...xs);
          const x0 = Math.max(0, Math.floor(Math.min(...xs) - span * 0.25)), x1 = Math.min(w, Math.ceil(Math.max(...xs) + span * 0.25));
          const y0 = Math.max(0, Math.floor(Math.min(...ys) - span * 0.25)), y1 = Math.min(h, Math.ceil(Math.max(...ys) + span * 0.9));
          const read = (): { reader: PixelReader; crop: () => string | null; cropEye: (center: { x: number; y: number }, irisPx: number, eye: EyeSideId) => string | null } => {
            ctx.drawImage(video, 0, 0, w, h);
            const rw = x1 - x0, rh = y1 - y0;
            const { data } = ctx.getImageData(x0, y0, rw, rh);
            return {
              reader: (x, y) => {
                const xi = x - x0, yi = y - y0;
                if (xi < 0 || yi < 0 || xi >= rw || yi >= rh) return [0, 0, 0];
                const k = (yi * rw + xi) * 4;
                return [data[k], data[k + 1], data[k + 2]];
              },
              crop: () => {
                const out = document.createElement("canvas");
                const scale = Math.min(1, 360 / rw);
                out.width = Math.round(rw * scale); out.height = Math.round(rh * scale);
                out.getContext("2d")!.drawImage(canvas, x0, y0, rw, rh, 0, 0, out.width, out.height);
                return out.toDataURL("image/jpeg", 0.8);
              },
              // Un oeil isole : carre de 3 diametres d'iris centre exactement sur le centre calcule de l'iris
              cropEye: (center: { x: number; y: number }, irisPx: number, eye: EyeSideId) => {
                const side = irisPx * 3;
                if (!(side > 8)) return null;
                const cx = center.x, cy = center.y;
                const out = document.createElement("canvas");
                out.width = 320; out.height = 320;
                const g = out.getContext("2d")!;
                g.fillStyle = "#000"; g.fillRect(0, 0, 320, 320);
                // Redressement : l'axe des coins de l'oeil est remis a l'horizontale (photos comparables d'un scan a l'autre)
                const [inn, outr] = INNER_OUTER[eye];
                const roll = (canthalRollDeg({ x: pts[inn].x * w, y: pts[inn].y * h }, { x: pts[outr].x * w, y: pts[outr].y * h }) * Math.PI) / 180;
                g.translate(160, 160); g.rotate(-roll);
                g.drawImage(canvas, cx - side / 2, cy - side / 2, side, side, -160, -160, 320, 320);
                return out.toDataURL("image/jpeg", 0.85);
              },
            };
          };

          if (p === "eyes-R" || p === "eyes-L") {
            // Un oeil a la fois : on garde la prise de meilleure qualite, stable et ouverte
            const side: EyeSideId = p === "eyes-R" ? "A" : "B";
            if (!phaseStart) phaseStart = now;
            if (manualDirty.current === side) { manualDirty.current = null; cands[side] = []; setShots(0); setBestScore(0); resetSide(); phaseStart = now; }
            if (blinkOf(side) < 0.3 && now - lastEval > EVAL_MS) {
              lastEval = now;
              const { reader, crop, cropEye } = read();
              const m = computeEyeMetrics({ landmarks: pts, width: w, height: h, read: reader, manualCenters: manualRef.current });
              if (m) {
                const center = m[side].irisCenter ?? { x: pts[IRIS[side]].x * w, y: pts[IRIS[side]].y * h };
                const cx = center.x, cy = center.y;
                const ipd = Math.hypot((pts[263].x - pts[33].x) * w, (pts[263].y - pts[33].y) * h);
                const motion = prevIris ? Math.hypot(cx - prevIris.x, cy - prevIris.y) / ipd : 0;
                stable = prevIris && motion < 0.012 ? stable + 1 : 0;
                prevIris = { x: cx, y: cy };
                const open = m[side].fenteRatio ?? 0;
                const { sharp, light } = acquisitionStats(reader, cx, cy, m[side].irisPx);
                const q = acquisitionQuality({ open, dist: ipd / w, motion, sharp, light });
                setQuality(q);
                // Structures detectees dessinees en direct (iris, pupille, paupieres, anneau de visee)
                const ov = overlayRef.current?.getContext("2d");
                if (ov) {
                  const [lt, lb] = EYE_LID_POINTS[side];
                  drawEyeOverlay(ov, m[side], { top: { x: pts[lt].x * w, y: pts[lt].y * h }, bottom: { x: pts[lb].x * w, y: pts[lb].y * h } }, q.score >= MIN_QUALITY, manualRef.current[side] ?? null);
                }
                const list = (cands[side] ??= []);
                if (open >= MIN_OPEN && q.score >= MIN_QUALITY && stable >= STABLE_FRAMES && list.length < BURST_MAX) {
                  list.push({ m, q: q.score, image: crop(), eye: cropEye(center, m[side].irisPx, side) });
                  setShots(list.length);
                  setBestScore(Math.max(...list.map((c) => c.q)));
                }
              }
            }
            const list = cands[side] ?? [];
            const el = now - phaseStart;
            setLeft(Math.max(0, Math.ceil((Math.max(EYE_MS, MIN_DWELL_MS) - el) / 1000)));
            setDwell(Math.min(100, (el / MIN_DWELL_MS) * 100));
            if ((el >= MIN_DWELL_MS && list.length >= BURST) || (el >= EYE_MS && list.length)) {
              // Algo de choix : la photo de meilleure qualite de la rafale
              best[side] = list.reduce((a, b) => (b.q > a.q ? b : a));
              // Confirmation "oeil capture" (vignette de la meilleure image), puis oeil suivant ou choix des analyses
              const chosen = best[side]!;
              setDoneInfo({ label: side === "A" ? "Œil droit" : "Œil gauche", image: chosen.eye, score: chosen.q });
              go("eye-done"); phaseStart = now;
              afterDone = only ? () => finish() : side === "A" ? () => { setShots(0); setBestScore(0); setDwell(0); go("eyes-L"); resetSide(); } : () => go("choose");
            } else if (el >= EYE_GIVE_UP_MS && !list.length) {
              setError("Œil non bien ouvert : ouvre-le grand, fixe le point, et refais la prise.");
              go("error"); stopped = true; cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop());
            }
          } else if (p === "plr-dark" || p === "plr-flash") {
            if (blink < 0.4) {
              const { reader } = read();
              const m = computeEyeMetrics({ landmarks: pts, width: w, height: h, read: reader });
              const pm = m ? [m.A.pupilMm, m.B.pupilMm].filter((v): v is number => v !== null) : [];
              plrSamples.push({ t: now, pupilMm: pm.length ? pm.reduce((a, b) => a + b, 0) / pm.length : null });
            }
            if (p === "plr-dark" && now - phaseStart >= DARK_MS) { go("plr-flash"); flashT = now; phaseStart = now; }
            else if (p === "plr-flash" && now - phaseStart >= FLASH_MS) { go("conj-ready"); phaseStart = now; }
          } else if (p === "conj-ready") {
            setLeft(Math.ceil((CONJ_WAIT_MS - (now - phaseStart)) / 1000));
            if (now - phaseStart >= CONJ_WAIT_MS) { go("conj"); phaseStart = now; }
          } else if (p === "conj") {
            if (now - lastEval > 120) {
              lastEval = now;
              const { reader } = read();
              const c = computeConjunctiva({ landmarks: pts, width: w, height: h, read: reader });
              if (c && (!conj || c.bandMm > conj.bandMm)) conj = c;
            }
            if (now - phaseStart >= CONJ_MS) go("mbi-ready");
          } else if (p === "mbi") {
            const el = now - phaseStart;
            setMbiElapsed(el);
            if (blink > 0.5) { if (!eyesClosedSince) eyesClosedSince = now; else if (now - eyesClosedSince > 80 && el > 500) { mbiS = Math.round((eyesClosedSince - phaseStart) / 100) / 10; finish(); } }
            else eyesClosedSince = 0;
            if (el >= MBI_MAX_MS) { mbiS = MBI_MAX_MS / 1000; finish(); }
          }
        };
        raf = requestAnimationFrame(tick);
      } catch (e) {
        setError(e instanceof DOMException && e.name === "NotAllowedError"
          ? "Accès à la caméra refusé : autorise-le dans les réglages du navigateur."
          : "Impossible de démarrer le scan (caméra ou modèle indisponible).");
        go("error");
      }
    })();

    return () => { stopped = true; cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()); };
    // onDone exclu volontairement : le scan ne doit pas redemarrer si le parent se re-rend
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // L'ecran sert d'eclairage : blanc pendant les mesures, noir puis blanc pour le reflexe pupillaire
  const dark = phase === "plr-dark";
  const bg = dark ? "#000" : phase === "error" || phase === "loading" ? "#000" : "#fff";
  const fg = bg === "#fff" ? "#111" : "#fff";
  const side: EyeSideId | null = phase === "eyes-R" ? "A" : phase === "eyes-L" ? "B" : null;
  const handleTap = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!side || !boxRef.current || !videoRef.current || videoRef.current.videoWidth === 0) {
      return;
    }

    const rect = boxRef.current.getBoundingClientRect();
    const point = tapToImage(
      { x: e.clientX - rect.left, y: e.clientY - rect.top },
      {
        cw: rect.width,
        ch: rect.height,
        vw: videoRef.current.videoWidth,
        vh: videoRef.current.videoHeight,
        zoom: ZOOM,
        originX: EYE_X[side] / 100,
        originY: 0.42,
        posX: 0.5,
        posY: 0.38,
        mirror: true,
      }
    );

    manualRef.current[side] = point;
    manualDirty.current = side;
    setManualSides((prev) => ({ ...prev, [side]: true }));
  };

  const clearManual = () => {
    if (!side) {
      return;
    }

    delete manualRef.current[side];
    manualDirty.current = side;
    setManualSides((prev) => ({ ...prev, [side]: false }));
  };

  const hasManual = side ? !!manualSides[side] : false;
  const qColor = quality.score >= MIN_QUALITY ? "var(--ok)" : "var(--warn)";
  const eyeMessage = !face ? "Place ton visage à 25-30 cm, de face"
    : quality.issue ?? `Parfait, reste immobile · photo ${shots}/${BURST_MAX} · meilleure ${bestScore} %`;
  const message: Record<Phase, string> = {
    loading: "Préparation de la caméra…",
    "eyes-R": eyeMessage,
    "eyes-L": eyeMessage,
    "eye-done": "",
    choose: "",
    "plr-dark": "Continue de fixer le point…",
    "plr-flash": "Flash : fixe le point, ne cligne pas",
    "conj-ready": `Tire doucement ta paupière inférieure vers le bas et regarde la flèche en haut · ${Math.max(0, left)} s`,
    conj: "Ne bouge pas…",
    "mbi-ready": "Dernier test (optionnel) : garde les yeux ouverts le plus longtemps possible, sans forcer.",
    mbi: `Yeux ouverts : ${Math.floor(mbiElapsed / 1000)} s · cligne quand tu ne peux plus`,
    error,
  };

  // Cadre de guidage : moitie gauche de l'ecran = oeil droit (image miroir), moitie droite = oeil gauche
  const guide = side ? { left: `${EYE_X[side] - 17}%`, width: "34%" } : null;
  const fixY = "max(56px, calc(env(safe-area-inset-top) + 40px))";

  return createPortal(
    <div className="fixed inset-0 z-[300] flex flex-col items-center justify-center px-6" style={{ background: bg, transition: "background 0.05s" }} role="dialog" aria-label="Scan de l'œil">
      <button type="button" onClick={onCancel} aria-label="Annuler le scan" className="absolute right-4 w-11 h-11 flex items-center justify-center rounded-full"
        style={{ top: "max(16px, env(safe-area-inset-top))", background: bg === "#fff" ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.12)", color: fg }}>
        <IconX size={20} />
      </button>

      {/* Cible de fixation juste sous la camera */}
      {(phase === "eyes-R" || phase === "eyes-L" || phase === "plr-dark" || phase === "plr-flash") && (
        <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center" style={{ top: fixY }} aria-hidden>
          <span className="relative flex items-center justify-center w-12 h-12">
            <span className="absolute inset-0 rounded-full animate-ping" style={{ background: dark ? "rgba(255,255,255,0.12)" : "rgba(99,102,241,0.25)" }} />
            <span className="w-9 h-9 rounded-full flex items-center justify-center" style={{ border: `2px solid ${dark ? "#555" : "#6366f1"}` }}>
              <span className="w-3 h-3 rounded-full" style={{ background: dark ? "#666" : "#6366f1" }} />
            </span>
          </span>
        </div>
      )}
      {(phase === "conj-ready" || phase === "conj") && (
        <div className="absolute left-1/2 -translate-x-1/2 animate-bounce" style={{ top: fixY, color: "#6366f1" }} aria-hidden>
          <IconArrowUp size={44} stroke={2.5} />
        </div>
      )}

      <div ref={boxRef} onPointerDown={handleTap} className="relative w-[320px] h-[200px] rounded-2xl overflow-hidden" style={{ touchAction: "manipulation", opacity: dark || phase === "plr-flash" ? 0 : 1, boxShadow: `0 0 0 3px ${face ? "var(--ok)" : "var(--warn)"}` }}>
        <video ref={videoRef} playsInline muted className="w-full h-full object-cover"
          style={{ transform: `scaleX(-1) scale(${side ? ZOOM : 1})`, transformOrigin: `${side ? EYE_X[side] : 50}% 42%`, objectPosition: "50% 38%" }} />
        {/* Structures detectees (iris, pupille, paupieres) : meme transformation que la video pour coincider avec l'image zoomee */}
        <canvas ref={overlayRef} aria-hidden className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          style={{ transform: `scaleX(-1) scale(${side ? ZOOM : 1})`, transformOrigin: `${side ? EYE_X[side] : 50}% 42%`, objectPosition: "50% 38%" }} />
        {guide && (
          <div className="absolute top-[22%] bottom-[22%] rounded-[50%] pointer-events-none" aria-hidden
            style={{ left: guide.left, width: guide.width, border: `2px solid ${quality.score >= MIN_QUALITY ? "var(--ok)" : "var(--warn)"}`, boxShadow: "0 0 0 9999px rgba(0,0,0,0.35)" }} />
        )}
        {side && (
          <span className="absolute inset-x-0 top-1 text-center font-black pointer-events-none whitespace-nowrap" aria-hidden
            style={{ fontSize: 26, letterSpacing: 1, color: "rgba(255,255,255,0.55)", textShadow: "0 0 10px rgba(0,0,0,0.6)" }}>{LABEL[side]}</span>
        )}
        {phase === "loading" && <div className="absolute inset-0 flex items-center justify-center" style={{ color: "#fff" }}><IconLoader2 className="animate-spin" /></div>}
      </div>

      {/* Legende des structures + progression de la duree minimale (l'acquisition ne se termine pas trop vite) */}
      {side && (
        <div className="mt-2 w-[320px] max-w-full">
          <div className="flex items-center justify-center gap-3 text-[12px] mb-2" style={{ color: fg }}>
            <span><span style={{ color: "#818cf8" }}>●</span> Iris</span>
            <span><span style={{ color: "#fbbf24" }}>●</span> Pupille</span>
            <span><span style={{ color: "#34d399" }}>●</span> Paupières</span>
          </div>
          <div className="h-1 rounded-full overflow-hidden" style={{ background: bg === "#fff" ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.15)" }} aria-label={`Acquisition ${Math.round(dwell)} %`}>
            <div className="h-full rounded-full" style={{ width: `${dwell}%`, background: "var(--accent)", transition: "width 0.15s linear" }} />
          </div>
        </div>
      )}

      {side && (
        <p className="mt-2 text-[12px] text-center" style={{ color: fg }}>
          {hasManual ? (
            <>
              Centre choisi à la main
              <button
                type="button"
                onClick={clearManual}
                className="min-h-[44px] px-3 underline text-[var(--accent)]"
              >
                Réinitialiser
              </button>
            </>
          ) : (
            "Option : touche le centre de ton œil sur l'image pour affiner l'alignement."
          )}
        </p>
      )}

      {/* Confirmation apres chaque oeil, puis choix des analyses avancees (optionnelles) */}
      {phase === "eye-done" && doneInfo && (
        <div className="absolute inset-0 z-10 flex items-center justify-center" style={{ background: "#fff" }}>
          <EyeDoneScreen label={doneInfo.label} image={doneInfo.image} score={doneInfo.score} />
        </div>
      )}
      {phase === "choose" && (
        <div className="absolute inset-0 z-10 flex items-center justify-center px-6" style={{ background: "#fff" }}>
          <EyeChoiceScreen onFinish={() => finishNow.current?.()} onAdvanced={() => startAdvanced.current?.()} />
        </div>
      )}

      {side && face && (
        <div className="mt-4 w-[320px] max-w-full" aria-label={`Qualité d'acquisition ${quality.score} %`}>
          <div className="flex justify-between text-[12px] mb-1" style={{ color: fg }}><span>Qualité de prise</span><span className="tabular-nums">{quality.score} %</span></div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: bg === "#fff" ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.15)" }}>
            <div className="h-full rounded-full transition-[width] duration-200" style={{ width: `${quality.score}%`, background: qColor }} />
          </div>
        </div>
      )}

      <p className="text-[16px] font-semibold mt-5 text-center max-w-[320px]" style={{ color: fg }} aria-live="polite">{message[phase]}</p>

      {phase === "mbi-ready" && (
        <div className="flex gap-3 mt-5">
          <button type="button" onClick={() => skipMbi.current?.()} className="min-h-[48px] px-5 rounded-xl text-[14px] font-medium" style={{ background: "rgba(0,0,0,0.08)", color: fg }}>Passer</button>
          <button type="button" onClick={() => startMbi.current?.()} className="min-h-[48px] px-5 rounded-xl text-[14px] font-semibold" style={{ background: "#111", color: "#fff" }}>Commencer</button>
        </div>
      )}
      {phase === "error" && (
        <button type="button" onClick={onCancel} className="mt-4 min-h-[44px] px-5 rounded-xl text-[14px] font-semibold" style={{ background: "#fff", color: "#000" }}>Fermer</button>
      )}
    </div>,
    document.body,
  );
}
