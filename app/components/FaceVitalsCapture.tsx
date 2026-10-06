"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconX, IconLoader2 } from "@tabler/icons-react";
import { getVideoLandmarker } from "@/app/lib/face-landmarker";
import { computeVitals, type FaceVitals, type VitalsFrame } from "@/app/lib/face-vitals";

const DURATION_MS = 30_000;
// Zones de peau suivies a chaque image : front (151) et joues (205, 425)
const ROI = [151, 205, 425];

interface Props {
  onDone: (v: FaceVitals) => void;
  onCancel: () => void;
}

/** Mesure de 30 s : camera frontale, suivi du visage image par image, couleur moyenne de la peau. */
export default function FaceVitalsCapture({ onDone, onCancel }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [phase, setPhase] = useState<"loading" | "measuring" | "error">("loading");
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [face, setFace] = useState(false);
  const [liveBpm, setLiveBpm] = useState<number | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    const frames: VitalsFrame[] = [];
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;

    (async () => {
      try {
        const [lm, s] = await Promise.all([
          getVideoLandmarker(),
          navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 } }, audio: false }),
        ]);
        stream = s;
        if (stopped) { s.getTracks().forEach((t) => t.stop()); return; }
        const video = videoRef.current!;
        video.srcObject = s;
        await video.play();
        canvas.width = video.videoWidth; canvas.height = video.videoHeight;
        setPhase("measuring");
        let start = 0, lastVideoTime = -1, lastLive = 0;

        const tick = () => {
          if (stopped) return;
          raf = requestAnimationFrame(tick);
          if (video.currentTime === lastVideoTime) return;
          lastVideoTime = video.currentTime;
          const now = performance.now();
          const res = lm.detectForVideo(video, now);
          const pts = res.faceLandmarks?.[0];
          setFace(!!pts);
          if (!pts) return;
          if (!start) start = now;
          const w = canvas.width, h = canvas.height;
          ctx.drawImage(video, 0, 0, w, h);
          const px = (i: number) => ({ x: pts[i].x * w, y: pts[i].y * h });
          const eA = px(33), eB = px(263);
          const iod = Math.hypot(eA.x - eB.x, eA.y - eB.y) * 0.75 || 1;
          const r = Math.max(3, Math.round(iod * 0.12));
          let R = 0, G = 0, B = 0, n = 0;
          for (const i of ROI) {
            const c = px(i);
            const x0 = Math.max(0, Math.round(c.x - r)), y0 = Math.max(0, Math.round(c.y - r));
            const size = Math.min(2 * r, w - x0, h - y0);
            if (size <= 0) continue;
            const { data } = ctx.getImageData(x0, y0, size, size);
            for (let k = 0; k < data.length; k += 4) { R += data[k]; G += data[k + 1]; B += data[k + 2]; n++; }
          }
          if (!n) return;
          const bs = res.faceBlendshapes?.[0]?.categories ?? [];
          const blink = ((bs.find((c) => c.categoryName === "eyeBlinkLeft")?.score ?? 0) + (bs.find((c) => c.categoryName === "eyeBlinkRight")?.score ?? 0)) / 2;
          const nose = px(1);
          frames.push({ t: now - start, rgb: [R / n, G / n, B / n], blink, noseX: nose.x / iod, noseY: nose.y / iod });

          const el = now - start;
          setElapsed(el);
          if (el > 12_000 && now - lastLive > 2000) {
            lastLive = now;
            const v = computeVitals(frames);
            setLiveBpm(v?.heartRate ?? null);
          }
          if (el >= DURATION_MS) {
            stopped = true;
            cancelAnimationFrame(raf);
            stream?.getTracks().forEach((t) => t.stop());
            const v = computeVitals(frames);
            if (v) onDone(v);
            else { setError("Pas assez d'images exploitables : garde le visage dans l'ovale, bien éclairé."); setPhase("error"); }
          }
        };
        raf = requestAnimationFrame(tick);
      } catch (e) {
        const msg = e instanceof DOMException && e.name === "NotAllowedError"
          ? "Accès à la caméra refusé : autorise-le dans les réglages du navigateur."
          : "Impossible de démarrer la mesure (caméra ou modèle indisponible).";
        setError(msg);
        setPhase("error");
      }
    })();

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
    // onDone volontairement exclu : la mesure ne doit pas redemarrer si le parent se re-rend
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pct = Math.min(100, (elapsed / DURATION_MS) * 100);
  const left = Math.max(0, Math.ceil((DURATION_MS - elapsed) / 1000));

  // Portail vers <body> : la page cree son propre contexte d'empilement (wrapper relative z-10), qui laisserait
  // la barre de navigation passer par-dessus l'ecran de mesure (meme piege que FaceOvalCamera).
  return createPortal(
    <div className="fixed inset-0 z-[300] flex flex-col items-center justify-center px-6" style={{ background: "#000" }} role="dialog" aria-label="Mesure des constantes">
      <button type="button" onClick={onCancel} aria-label="Annuler la mesure" className="absolute right-4 w-11 h-11 flex items-center justify-center rounded-full" style={{ top: "max(16px, env(safe-area-inset-top))", background: "rgba(255,255,255,0.12)", color: "#fff" }}>
        <IconX size={20} />
      </button>

      <div className="relative w-[260px] h-[340px] rounded-[50%] overflow-hidden" style={{ boxShadow: `0 0 0 4px ${face ? "var(--ok)" : "var(--warn)"}` }}>
        <video ref={videoRef} playsInline muted className="w-full h-full object-cover" style={{ transform: "scaleX(-1)" }} />
        {phase === "loading" && (
          <div className="absolute inset-0 flex items-center justify-center" style={{ color: "#fff" }}><IconLoader2 className="animate-spin" /></div>
        )}
      </div>

      <div className="w-[260px] h-2 rounded-full mt-5 overflow-hidden" style={{ background: "rgba(255,255,255,0.15)" }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--ok)", transition: "width 0.2s linear" }} />
      </div>

      <p className="text-[15px] font-semibold mt-3 text-center" style={{ color: "#fff" }} aria-live="polite">
        {phase === "loading" ? "Préparation de la caméra…"
          : phase === "error" ? error
          : !face ? "Place ton visage dans l'ovale"
          : `Ne bouge pas, respire normalement · ${left} s`}
      </p>
      {phase === "measuring" && (
        <p className="text-[13px] mt-1 text-center" style={{ color: "rgba(255,255,255,0.7)" }}>
          {liveBpm ? `Pouls provisoire : ${liveBpm} bpm` : "Assis, lumière stable et de face, sans parler."}
        </p>
      )}
      {phase === "error" && (
        <button type="button" onClick={onCancel} className="mt-4 min-h-[44px] px-5 rounded-xl text-[14px] font-semibold" style={{ background: "#fff", color: "#000" }}>Fermer</button>
      )}
    </div>,
    document.body,
  );
}
