"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconX } from "@tabler/icons-react";
import { getVideoLandmarker } from "@/app/lib/face-landmarker";
import { acquisitionStats } from "@/app/lib/eye-metrics";
import { BestShot, faceAcquisition, facePose, faceFraming, ovalGeometry } from "@/app/lib/face-acquisition";

interface Props {
  onCapture: (file: File) => void;
  onCancel: () => void;
  onError: (message: string) => void;
}

const THRESHOLD = 70;
const SHOTS = 5;
const EVAL_MS = 200;

/**
 * Full-screen selfie-camera capture with an oval alignment guide overlay.
 * Falls back to onError (caller should offer the native file input instead)
 * if getUserMedia is unavailable or permission is denied.
 */
export default function FaceOvalCamera({ onCapture, onCancel, onError }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [guided, setGuided] = useState(true);
  const [score, setScore] = useState(0);
  const [issue, setIssue] = useState<string | null>(null);
  const [shots, setShots] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const prevRef = useRef<{ cx: number; cy: number } | null>(null);
  const shotsRef = useRef(new BestShot<Blob>(THRESHOLD));
  const busyRef = useRef(false);
  const finishRef = useRef(false);
  const loopRef = useRef<number | null>(null);
  const [view, setView] = useState({ w: 0, h: 0 });
  const viewRef = useRef({ w: 0, h: 0 });

  const stopAndClose = (after?: () => void) => {
    if (loopRef.current) {
      cancelAnimationFrame(loopRef.current);
    }
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    after?.();
  };

  const finish = (blob: Blob) => {
    if (finishRef.current) return;
    finishRef.current = true;
    stopAndClose(() => onCapture(new File([blob], "face.jpg", { type: "image/jpeg" })));
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const handleResize = () => {
      const newView = { w: window.innerWidth, h: window.innerHeight };
      setView(newView);
      viewRef.current = newView;
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 960 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
          setReady(true);

          try {
            const lm = await getVideoLandmarker();
            const canvas = document.createElement("canvas");
            canvasRef.current = canvas;
            const ctx = canvas.getContext("2d", { willReadFrequently: true });
            if (!ctx) return;

            let lastEval = 0;
            const loop = (timestamp: number) => {
              if (finishRef.current || cancelled) {
                if (loopRef.current) {
                  cancelAnimationFrame(loopRef.current);
                }
                return;
              }

              if (timestamp - lastEval < EVAL_MS) {
                loopRef.current = requestAnimationFrame(loop);
                return;
              }
              lastEval = timestamp;

              const video = videoRef.current;
              if (!video || !video.videoWidth) {
                loopRef.current = requestAnimationFrame(loop);
                return;
              }

              if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
              }
              ctx.drawImage(video, 0, 0);

              const pts = lm.detectForVideo(video, performance.now()).faceLandmarks?.[0];
              if (!pts) {
                setIssue("Place ton visage dans l'ovale");
                setScore(0);
                shotsRef.current.reset();
                setShots(0);
                prevRef.current = null;
                loopRef.current = requestAnimationFrame(loop);
                return;
              }

              const pose = facePose(pts);
              const motion = prevRef.current ? Math.hypot(pose.cx - prevRef.current.cx, pose.cy - prevRef.current.cy) : 0;
              prevRef.current = { cx: pose.cx, cy: pose.cy };

              const w = canvas.width;
              const h = canvas.height;
              const framing = faceFraming(pts, {w:canvas.width,h:canvas.height}, viewRef.current);
              const half = 0.25 * Math.hypot(pts[454].x-pts[234].x, pts[454].y-pts[234].y) * w;

              const cx = pose.cx * w;
              const cy = pose.cy * h;
              const x0 = Math.max(0, Math.floor(cx - half));
              const y0 = Math.max(0, Math.floor(cy - half));
              const x1 = Math.min(w, Math.ceil(cx + half));
              const y1 = Math.min(h, Math.ceil(cy + half));

              if (x1 <= x0 || y1 <= y0) {
                loopRef.current = requestAnimationFrame(loop);
                return;
              }

              const imageData = ctx.getImageData(x0, y0, x1 - x0, y1 - y0);

              const read = (x: number, y: number): [number, number, number] => {
                const ix = Math.max(0, Math.min(imageData.width - 1, Math.round(x) - x0));
                const iy = Math.max(0, Math.min(imageData.height - 1, Math.round(y) - y0));
                const index = (iy * imageData.width + ix) * 4;
                return [
                  imageData.data[index],
                  imageData.data[index + 1],
                  imageData.data[index + 2]
                ];
              };

              const stats = acquisitionStats(read, cx, cy, half / 1.5);
              const a = faceAcquisition({ fill: framing.fill, dx: framing.dx, dy: framing.dy, inFrame: framing.inFrame, yawDeg: pose.yawDeg, rollDeg: pose.rollDeg, motion, ...stats });

              setScore(a.score);
              setIssue(a.issue);

              if (a.issue === null && a.score >= THRESHOLD) {
                if (!busyRef.current) {
                  busyRef.current = true;
                  canvas.toBlob(blob => {
                    if (blob) { shotsRef.current.offer(a.score, blob); setShots(shotsRef.current.count); if (shotsRef.current.count >= SHOTS && shotsRef.current.best) finish(shotsRef.current.best); }
                    busyRef.current = false;
                  }, "image/jpeg", 0.9);
                }
              } else if (a.issue !== null) {
                shotsRef.current.reset();
                setShots(0);
              }

              loopRef.current = requestAnimationFrame(loop);
            };

            loopRef.current = requestAnimationFrame(loop);
          } catch (e) {
            console.warn("Landmarker failed:", e);
            setGuided(false);
          }
        }
      } catch (e) {
        console.warn("Camera access failed:", e);
        onError("Accès caméra refusé ou indisponible — utilise la galerie à la place.");
      }
    })();

    return () => {
      cancelled = true;
      if (loopRef.current) {
        cancelAnimationFrame(loopRef.current);
      }
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCapture = () => {
    if (shotsRef.current.best) {
      finish(shotsRef.current.best);
      return;
    }

    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(blob => {
      if (blob) {
        stopAndClose(() => onCapture(new File([blob], "face.jpg", { type: "image/jpeg" })));
      }
    }, "image/jpeg", 0.9);
  };

  // Portaled to document.body — rendered inline (as it was before), this
  // fullscreen overlay sits inside FaceScanClient's own ancestor stacking
  // context (a `relative z-10` page wrapper), which caps its z-[200] below
  // Nav.tsx's z-50 bottom nav (rendered at the root layout, outside that
  // wrapper) — the shutter button sits right where the nav bar is, so taps
  // on it were silently swallowed by the nav instead. Same fix as
  // BodyMeasurementsTab/PhotoMealAnalyzer earlier this session.
  if (!mounted) return null;
  const oval = ovalGeometry(view.w, view.h);
  return createPortal(
    <div className="fixed inset-0 z-[200] bg-black flex flex-col items-center justify-center">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
        style={{ transform: "scaleX(-1)" }}
      />

      {/* Oval alignment guide */}
      {view.w > 0 && (
        <svg className="absolute inset-0 w-full h-full pointer-events-none" width={view.w} height={view.h}>
          <defs>
            <mask id="oval-mask">
              <rect x="0" y="0" width={view.w} height={view.h} fill="white" />
              <ellipse cx={oval.cx} cy={oval.cy} rx={oval.rx} ry={oval.ry} fill="black" />
            </mask>
          </defs>
          <rect x="0" y="0" width={view.w} height={view.h} fill="rgba(0,0,0,0.45)" mask="url(#oval-mask)" />
          <ellipse cx={oval.cx} cy={oval.cy} rx={oval.rx} ry={oval.ry} fill="none" stroke={score >= THRESHOLD && issue === null ? "var(--ok)" : "var(--fiber)"} strokeWidth="2" strokeDasharray="10 8" opacity="0.9" />
        </svg>
      )}

      <div className="absolute top-0 inset-x-0 flex items-center justify-between px-4 pt-4" style={{ paddingTop: "calc(env(safe-area-inset-top) + 16px)" }}>
        <p className="text-white text-[13px] font-medium">
          {guided && issue ? issue : shots > 0 ? "Ne bouge plus" : "Centre ton visage dans l'ovale"}
        </p>
        <button onClick={() => stopAndClose(onCancel)} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.15)" }}>
          <IconX size={18} color="white" />
        </button>
      </div>

      {guided && (
        <div className="absolute top-12 inset-x-0 flex justify-center" style={{ paddingTop: "calc(env(safe-area-inset-top) + 16px)" }}>
          <p className="text-white text-[13px] font-medium px-4 py-2 rounded-full" style={{ background: "rgba(0,0,0,0.55)" }} aria-live="polite">
            Qualité {score}/100{shots > 0 ? ` · photo ${shots}/${SHOTS}` : ""}
          </p>
        </div>
      )}

      <div className="absolute inset-x-0 flex justify-center" style={{ bottom: "calc(env(safe-area-inset-bottom) + 32px)" }}>
        <button
          onClick={handleCapture}
          disabled={!ready}
          className="w-16 h-16 rounded-full flex items-center justify-center transition-[transform,opacity] active:scale-90 disabled:opacity-40"
          style={{ background: "rgba(255,255,255,0.15)", border: "3px solid white" }}
        >
          <div className="w-12 h-12 rounded-full bg-white" />
        </button>
      </div>
    </div>,
    document.body,
  );
}
