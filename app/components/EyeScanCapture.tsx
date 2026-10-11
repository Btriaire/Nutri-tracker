"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconX, IconLoader2, IconArrowUp } from "@tabler/icons-react";
import { getVideoLandmarker } from "@/app/lib/face-landmarker";
import { acquisitionQuality, acquisitionStats, analyzePlr, computeConjunctiva, computeEyeMetrics, mergeEyeMetrics, type Conjunctiva, type EyeMetrics, type EyeSideId, type PlrResult, type PlrSample } from "@/app/lib/eye-metrics";
import type { PixelReader } from "@/app/lib/face-metrics";

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

type Phase = "loading" | "eyes-R" | "eyes-L" | "plr-dark" | "plr-flash" | "conj-ready" | "conj" | "mbi-ready" | "mbi" | "error";

const EYE_MS = 3500, DARK_MS = 1300, FLASH_MS = 2300, CONJ_WAIT_MS = 3000, CONJ_MS = 1500, MBI_MAX_MS = 40_000;
const EYE_GIVE_UP_MS = 15_000;          // au-dela, sans prise correcte : on arrete et on explique
const MIN_OPEN = 0.45;                  // ouverture minimale (hauteur de fente / iris) pour retenir une image
const MIN_QUALITY = 60;                 // score de prise de vue minimal pour retenir une image
const STABLE_FRAMES = 2;                // evaluations consecutives sans mouvement avant de retenir
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
          const read = (): { reader: PixelReader; crop: () => string | null; cropEye: (iris: number, irisPx: number) => string | null } => {
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
              // Un oeil isole : carre de 3 diametres d'iris centre sur l'iris
              cropEye: (iris, irisPx) => {
                const side = irisPx * 3;
                if (!(side > 8)) return null;
                const cx = pts[iris].x * w, cy = pts[iris].y * h;
                const out = document.createElement("canvas");
                out.width = 320; out.height = 320;
                const g = out.getContext("2d")!;
                g.fillStyle = "#000"; g.fillRect(0, 0, 320, 320);
                g.drawImage(canvas, cx - side / 2, cy - side / 2, side, side, 0, 0, 320, 320);
                return out.toDataURL("image/jpeg", 0.85);
              },
            };
          };

          if (p === "eyes-R" || p === "eyes-L") {
            // Un oeil a la fois : on garde la prise de meilleure qualite, stable et ouverte
            const side: EyeSideId = p === "eyes-R" ? "A" : "B";
            if (!phaseStart) phaseStart = now;
            if (blinkOf(side) < 0.3 && now - lastEval > 180) {
              lastEval = now;
              const { reader, crop, cropEye } = read();
              const m = computeEyeMetrics({ landmarks: pts, width: w, height: h, read: reader });
              if (m) {
                const iris = IRIS[side];
                const cx = pts[iris].x * w, cy = pts[iris].y * h;
                const ipd = Math.hypot((pts[263].x - pts[33].x) * w, (pts[263].y - pts[33].y) * h);
                const motion = prevIris ? Math.hypot(cx - prevIris.x, cy - prevIris.y) / ipd : 0;
                stable = prevIris && motion < 0.012 ? stable + 1 : 0;
                prevIris = { x: cx, y: cy };
                const open = m[side].fenteRatio ?? 0;
                const { sharp, light } = acquisitionStats(reader, cx, cy, m[side].irisPx);
                const q = acquisitionQuality({ open, dist: ipd / w, motion, sharp, light });
                setQuality(q);
                const cur = best[side];
                if (open >= MIN_OPEN && q.score >= MIN_QUALITY && stable >= STABLE_FRAMES && (!cur || q.score > cur.q)) {
                  best[side] = { m, q: q.score, image: crop(), eye: cropEye(iris, m[side].irisPx) };
                }
              }
            }
            const el = now - phaseStart;
            setLeft(Math.max(0, Math.ceil((EYE_MS - el) / 1000)));
            if (el >= EYE_MS && best[side]) {
              if (only) { finish(); return; }
              if (side === "A") { go("eyes-L"); resetSide(); } else { go("plr-dark"); phaseStart = now; }
            } else if (el >= EYE_GIVE_UP_MS && !best[side]) {
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
  const qColor = quality.score >= MIN_QUALITY ? "var(--ok)" : "var(--warn)";
  const eyeMessage = !face ? "Place ton visage à 25-30 cm, de face"
    : quality.issue ?? `Parfait, reste immobile · ${left} s`;
  const message: Record<Phase, string> = {
    loading: "Préparation de la caméra…",
    "eyes-R": eyeMessage,
    "eyes-L": eyeMessage,
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

      <div className="relative w-[320px] h-[200px] rounded-2xl overflow-hidden" style={{ opacity: dark || phase === "plr-flash" ? 0 : 1, boxShadow: `0 0 0 3px ${face ? "var(--ok)" : "var(--warn)"}` }}>
        <video ref={videoRef} playsInline muted className="w-full h-full object-cover"
          style={{ transform: `scaleX(-1) scale(${side ? ZOOM : 1})`, transformOrigin: `${side ? EYE_X[side] : 50}% 42%`, objectPosition: "50% 38%" }} />
        {guide && (
          <div className="absolute top-[22%] bottom-[22%] rounded-[50%] pointer-events-none" aria-hidden
            style={{ left: guide.left, width: guide.width, border: `2px solid ${quality.score >= MIN_QUALITY ? "var(--ok)" : "var(--warn)"}`, boxShadow: "0 0 0 9999px rgba(0,0,0,0.35)" }} />
        )}
        {side && (
          <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center font-black pointer-events-none whitespace-nowrap" aria-hidden
            style={{ fontSize: 40, letterSpacing: 1, color: "rgba(255,255,255,0.55)", textShadow: "0 0 10px rgba(0,0,0,0.6)" }}>{LABEL[side]}</span>
        )}
        {phase === "loading" && <div className="absolute inset-0 flex items-center justify-center" style={{ color: "#fff" }}><IconLoader2 className="animate-spin" /></div>}
      </div>

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
