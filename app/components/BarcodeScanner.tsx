"use client";

import { useRef, useState, useEffect } from "react";
import { IconX } from "@tabler/icons-react";

// Scanner de code-barre (ZXing — cross-browser incl. iOS Safari) — extrait de
// FoodSearchModal.tsx.
export default function BarcodeScanner({ onDetect, onClose }: { onDetect: (code: string) => void; onClose: () => void }) {
  const videoRef    = useRef<HTMLVideoElement>(null);
  const readerRef   = useRef<import("@zxing/browser").BrowserMultiFormatReader | null>(null);
  const firedRef    = useRef(false); // prevent double-fire
  const [error,     setError]    = useState("");
  const [hint,      setHint]     = useState("Pointez la caméra vers un code-barre");
  const [detected,  setDetected] = useState<string | null>(null);
  const [manualCode,setManualCode] = useState("");
  const [showManual,setShowManual] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;

    async function start() {
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");

        // Request camera with high resolution + zoom 2x if supported
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode:  { ideal: "environment" },
              width:       { ideal: 1920 },
              height:      { ideal: 1080 },
            },
          });
          // Try applying 2x zoom if the device supports it
          const track = stream.getVideoTracks()[0];
          const caps   = track.getCapabilities() as MediaTrackCapabilities & { zoom?: { min: number; max: number } };
          if (caps.zoom) {
            const z = Math.min(caps.zoom.max, caps.zoom.min * 2);
            await track.applyConstraints({ advanced: [{ zoom: z } as MediaTrackConstraintSet] } as MediaTrackConstraints);
          }
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            await videoRef.current.play();
          }
        } catch {
          // Fallback to ZXing default device selection
          stream = null;
        }

        const reader = new BrowserMultiFormatReader();
        readerRef.current = reader;

        if (!stream) {
          // Fallback path: let ZXing pick the back camera
          const devices = await BrowserMultiFormatReader.listVideoInputDevices();
          if (!devices.length) { setError("Aucune caméra détectée"); return; }
          const back = devices.find(d => /back|rear|environment/i.test(d.label)) ?? devices[devices.length - 1];
          if (cancelled) return;
          setHint("Centrez le code-barre dans le cadre");
          await reader.decodeFromVideoDevice(back.deviceId, videoRef.current!, (result) => {
            if (cancelled || firedRef.current) return;
            if (result) {
              firedRef.current = true;
              const code = result.getText();
              setDetected(code);
              setHint("✅ Code détecté !");
              setTimeout(() => { if (!cancelled) onDetect(code); }, 700);
            }
          });
        } else {
          // Main path: stream already attached, just scan frames
          if (cancelled) return;
          setHint("Centrez le code-barre dans le cadre");
          await reader.decodeFromStream(stream, videoRef.current!, (result) => {
            if (cancelled || firedRef.current) return;
            if (result) {
              firedRef.current = true;
              const code = result.getText();
              setDetected(code);
              setHint("✅ Code détecté !");
              setTimeout(() => { if (!cancelled) onDetect(code); }, 700);
            }
          });
        }
      } catch (e: unknown) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : String(e);
          setError(
            msg.includes("Permission") || msg.includes("NotAllowed")
              ? "Accès caméra refusé — autorisez-le dans les réglages"
              : "Caméra inaccessible — essayez la saisie manuelle"
          );
        }
      }
    }

    start();

    return () => {
      cancelled = true;
      stream?.getTracks().forEach(t => t.stop());
      if (videoRef.current?.srcObject instanceof MediaStream) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      }
      readerRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center" style={{ background: "rgba(0,0,0,0.94)" }}>
      <div className="w-full max-w-sm p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <p className="text-[15px] font-semibold text-white">Scanner un code-barre</p>
          <button onClick={onClose} className="p-2 rounded-lg" style={{ background: "rgba(255,255,255,0.1)", color: "#fff" }}>
            <IconX size={16} />
          </button>
        </div>

        {error ? (
          <div className="rounded-xl p-4 text-center space-y-2">
            <p className="text-[13px]" style={{ color: "var(--danger)" }}>{error}</p>
          </div>
        ) : (
          <div className="relative rounded-2xl overflow-hidden" style={{ aspectRatio: "4/3", background: "#000" }}>
            <video ref={videoRef} className="w-full h-full object-cover" playsInline muted autoPlay />
            {/* Viewfinder — zone large pour meilleure détection */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="relative"
                style={{
                  width: "88%", height: 110,
                  border: `2px solid ${detected ? "var(--fiber)" : "rgba(52,211,153,0.85)"}`,
                  borderRadius: 12,
                  boxShadow: detected
                    ? "0 0 0 9999px rgba(0,0,0,0.5), 0 0 30px rgba(52,211,153,0.6)"
                    : "0 0 0 9999px rgba(0,0,0,0.45)",
                  transition: "box-shadow 0.2s, border-color 0.2s",
                }}
              >
                {/* Scan line */}
                {!detected && (
                  <div className="absolute inset-x-0 h-0.5 rounded-full"
                    style={{
                      background: "linear-gradient(90deg, transparent, rgba(52,211,153,0.9), transparent)",
                      animation: "scanLine 1.6s ease-in-out infinite",
                      top: "50%",
                    }}
                  />
                )}
                {/* Corner accents */}
                {[
                  { t: 0, l: 0 }, { t: 0, r: 0 }, { b: 0, l: 0 }, { b: 0, r: 0 },
                ].map((pos, i) => (
                  <div key={i} className="absolute w-4 h-4"
                    style={{
                      top: pos.t !== undefined ? -1 : undefined,
                      bottom: (pos as { b?: number }).b !== undefined ? -1 : undefined,
                      left: pos.l !== undefined ? -1 : undefined,
                      right: (pos as { r?: number }).r !== undefined ? -1 : undefined,
                      borderTop:    i < 2 ? `3px solid ${detected ? "var(--fiber)" : "rgba(52,211,153,0.95)"}` : "none",
                      borderBottom: i >= 2 ? `3px solid ${detected ? "var(--fiber)" : "rgba(52,211,153,0.95)"}` : "none",
                      borderLeft:   i % 2 === 0 ? `3px solid ${detected ? "var(--fiber)" : "rgba(52,211,153,0.95)"}` : "none",
                      borderRight:  i % 2 === 1 ? `3px solid ${detected ? "var(--fiber)" : "rgba(52,211,153,0.95)"}` : "none",
                      borderRadius: i === 0 ? "4px 0 0 0" : i === 1 ? "0 4px 0 0" : i === 2 ? "0 0 0 4px" : "0 0 4px 0",
                    }}
                  />
                ))}
              </div>
            </div>
            {/* Detection flash */}
            {detected && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2"
                style={{ background: "rgba(52,211,153,0.15)" }}>
                <span className="text-5xl">✅</span>
                <span className="text-white text-[13px] font-semibold px-3 py-1 rounded-full"
                  style={{ background: "rgba(52,211,153,0.3)" }}>{detected}</span>
              </div>
            )}
          </div>
        )}

        <p className="text-center text-[12px]" style={{ color: detected ? "var(--fiber)" : "rgba(255,255,255,0.55)" }}>{hint}</p>

        {/* Manual entry fallback */}
        {!detected && (
          <div className="space-y-2">
            <button onClick={() => setShowManual(v => !v)}
              className="w-full text-[11px] py-1"
              style={{ color: "rgba(255,255,255,0.4)" }}>
              {showManual ? "▲ Masquer" : "Saisie manuelle du code ▼"}
            </button>
            {showManual && (
              <div className="flex gap-2">
                <input
                  value={manualCode}
                  onChange={e => setManualCode(e.target.value)}
                  placeholder="Ex: 3017624010701"
                  className="flex-1 px-3 py-2 rounded-xl text-[13px] text-white"
                  style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)" }}
                  onKeyDown={e => { if (e.key === "Enter" && manualCode.trim()) onDetect(manualCode.trim()); }}
                />
                <button
                  onClick={() => { if (manualCode.trim()) onDetect(manualCode.trim()); }}
                  disabled={!manualCode.trim()}
                  className="px-3 py-2 rounded-xl text-[13px] font-semibold"
                  style={{ background: "rgba(52,211,153,0.2)", color: "var(--fiber)", border: "1px solid rgba(52,211,153,0.4)" }}>
                  OK
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      <style>{`
        @keyframes scanLine {
          0%   { top: 10%; opacity: 0.8; }
          50%  { top: 90%; opacity: 1;   }
          100% { top: 10%; opacity: 0.8; }
        }
      `}</style>
    </div>
  );
}
