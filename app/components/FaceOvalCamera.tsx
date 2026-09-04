"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconX } from "@tabler/icons-react";

interface Props {
  onCapture: (file: File) => void;
  onCancel: () => void;
  onError: (message: string) => void;
}

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

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMounted(true); }, []);

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
        }
        setReady(true);
      } catch (e) {
        console.warn("Camera access failed:", e);
        onError("Accès caméra refusé ou indisponible — utilise la galerie à la place.");
      }
    })();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopAndClose = (after?: () => void) => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    after?.();
  };

  const handleCapture = () => {
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
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 130" preserveAspectRatio="xMidYMid slice">
        <defs>
          <mask id="oval-mask">
            <rect x="0" y="0" width="100" height="130" fill="white" />
            <ellipse cx="50" cy="55" rx="27" ry="37" fill="black" />
          </mask>
        </defs>
        <rect x="0" y="0" width="100" height="130" fill="rgba(0,0,0,0.45)" mask="url(#oval-mask)" />
        <ellipse cx="50" cy="55" rx="27" ry="37" fill="none" stroke="#34d399" strokeWidth="0.6" strokeDasharray="2.5 2" opacity="0.9" />
      </svg>

      <div className="absolute top-0 inset-x-0 flex items-center justify-between px-4 pt-4" style={{ paddingTop: "calc(env(safe-area-inset-top) + 16px)" }}>
        <p className="text-white text-[13px] font-medium">Centre ton visage dans l&apos;ovale</p>
        <button onClick={() => stopAndClose(onCancel)} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.15)" }}>
          <IconX size={18} color="white" />
        </button>
      </div>

      <div className="absolute inset-x-0 flex justify-center" style={{ bottom: "calc(env(safe-area-inset-bottom) + 32px)" }}>
        <button
          onClick={handleCapture}
          disabled={!ready}
          className="w-16 h-16 rounded-full flex items-center justify-center transition-all active:scale-90 disabled:opacity-40"
          style={{ background: "rgba(255,255,255,0.15)", border: "3px solid white" }}
        >
          <div className="w-12 h-12 rounded-full bg-white" />
        </button>
      </div>
    </div>,
    document.body,
  );
}
