"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconX, IconLoader2 } from "@tabler/icons-react";
import { getVideoLandmarker } from "@/app/lib/face-landmarker";
import { computeEyeMetrics, computeConjunctiva, analyzePlr, type EyeMetrics, type Conjunctiva, type PlrResult, type PlrSample } from "@/app/lib/eye-metrics";
import type { PixelReader } from "@/app/lib/face-metrics";

export interface EyeCaptureResult {
  metrics: EyeMetrics;
  plr: PlrResult | null;
  conjunctiva: Conjunctiva | null;
  mbiS: number | null;
  image: string | null;
}

type Phase = "loading" | "eyes" | "plr-dark" | "plr-flash" | "conj-ready" | "conj" | "mbi-ready" | "mbi" | "error";

const EYES_MS = 3000, DARK_MS = 1300, FLASH_MS = 2300, CONJ_WAIT_MS = 3000, CONJ_MS = 1500, MBI_MAX_MS = 40_000;
const EYE_PTS = [33, 133, 159, 145, 263, 362, 386, 374, 468, 473];

/** Scan guide de l'oeil : yeux ouverts, reflexe pupillaire au flash de l'ecran, conjonctive, test de secheresse. */
export default function EyeScanCapture({ onDone, onCancel }: { onDone: (r: EyeCaptureResult) => void; onCancel: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState("");
  const [face, setFace] = useState(false);
  const [left, setLeft] = useState(0);
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

    // Resultats accumules
    let best: { m: EyeMetrics; iris: number; image: string | null } | null = null;
    const plrSamples: PlrSample[] = [];
    let conj: Conjunctiva | null = null;
    let mbiS: number | null = null;
    let phaseStart = 0, flashT = 0, lastEval = 0, eyesClosedSince = 0;

    const finish = () => {
      if (stopped) return;
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
      if (!best) { setError("Yeux non mesurés : rapproche le téléphone (25-30 cm), bien en face."); go("error"); return; }
      onDone({ metrics: best.m, plr: analyzePlr(plrSamples, flashT), conjunctiva: conj, mbiS, image: best.image });
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
        const video = videoRef.current!;
        video.srcObject = s;
        await video.play();
        canvas.width = video.videoWidth; canvas.height = video.videoHeight;
        go("eyes");
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
          if (!pts) { if (p === "eyes") phaseStart = 0; return; }
          const bs = res.faceBlendshapes?.[0]?.categories ?? [];
          const blink = ((bs.find((c) => c.categoryName === "eyeBlinkLeft")?.score ?? 0) + (bs.find((c) => c.categoryName === "eyeBlinkRight")?.score ?? 0)) / 2;

          // Lecture des pixels : seulement la zone des yeux (rapide), lecteur en coordonnees de l'image entiere
          const w = canvas.width, h = canvas.height;
          const xs = EYE_PTS.map((i) => pts[i].x * w), ys = EYE_PTS.map((i) => pts[i].y * h);
          const span = Math.max(...xs) - Math.min(...xs);
          const x0 = Math.max(0, Math.floor(Math.min(...xs) - span * 0.25)), x1 = Math.min(w, Math.ceil(Math.max(...xs) + span * 0.25));
          const y0 = Math.max(0, Math.floor(Math.min(...ys) - span * 0.25)), y1 = Math.min(h, Math.ceil(Math.max(...ys) + span * 0.45));
          const read = (): { reader: PixelReader; crop: () => string | null } => {
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
            };
          };

          if (p === "eyes") {
            if (!phaseStart) phaseStart = now;
            if (blink < 0.3 && now - lastEval > 180) {
              lastEval = now;
              const { reader, crop } = read();
              const m = computeEyeMetrics({ landmarks: pts, width: w, height: h, read: reader });
              const iris = m ? Math.min(m.A.irisPx, m.B.irisPx) : 0;
              if (m && (!best || m.quality.score > best.m.quality.score || (m.quality.score === best.m.quality.score && iris > best.iris))) {
                best = { m, iris, image: crop() };
              }
            }
            setLeft(Math.ceil((EYES_MS - (now - phaseStart)) / 1000));
            if (now - phaseStart >= EYES_MS && best) { go("plr-dark"); phaseStart = now; }
            else if (now - phaseStart >= 15_000) finish();   // jamais mesurable : on explique quoi changer
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
            // Un clignement = yeux fermes au moins 80 ms (evite les faux positifs sur une seule image)
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
  const message: Record<Phase, string> = {
    loading: "Préparation de la caméra…",
    eyes: face ? `Regarde l'écran, yeux grands ouverts · ${Math.max(0, left)} s` : "Place ton visage à 25-30 cm, de face",
    "plr-dark": "Garde les yeux ouverts…",
    "plr-flash": "Flash : ne cligne pas",
    "conj-ready": `Tire doucement ta paupière inférieure vers le bas et regarde vers le haut · ${Math.max(0, left)} s`,
    conj: "Ne bouge pas…",
    "mbi-ready": "Dernier test (optionnel) : garde les yeux ouverts le plus longtemps possible, sans forcer.",
    mbi: `Yeux ouverts : ${Math.floor(mbiElapsed / 1000)} s · cligne quand tu ne peux plus`,
    error,
  };

  return createPortal(
    <div className="fixed inset-0 z-[300] flex flex-col items-center justify-center px-6" style={{ background: bg, transition: "background 0.05s" }} role="dialog" aria-label="Scan de l'œil">
      <button type="button" onClick={onCancel} aria-label="Annuler le scan" className="absolute right-4 w-11 h-11 flex items-center justify-center rounded-full"
        style={{ top: "max(16px, env(safe-area-inset-top))", background: bg === "#fff" ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.12)", color: fg }}>
        <IconX size={20} />
      </button>

      <div className="relative w-[300px] h-[150px] rounded-2xl overflow-hidden" style={{ opacity: dark || phase === "plr-flash" ? 0 : 1, boxShadow: `0 0 0 3px ${face ? "var(--ok)" : "var(--warn)"}` }}>
        <video ref={videoRef} playsInline muted className="w-full h-full object-cover" style={{ transform: "scaleX(-1)", objectPosition: "50% 38%" }} />
        {phase === "loading" && <div className="absolute inset-0 flex items-center justify-center" style={{ color: "#fff" }}><IconLoader2 className="animate-spin" /></div>}
      </div>

      <p className="text-[16px] font-semibold mt-6 text-center max-w-[320px]" style={{ color: fg }} aria-live="polite">{message[phase]}</p>

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
