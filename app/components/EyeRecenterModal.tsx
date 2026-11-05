"use client";

import { useState, useEffect, useRef } from 'react';

export default function EyeRecenterModal(props: {
  label: string;
  imageUrl: string;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: (tap: { x: number; y: number }) => void;
}) {
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null);
  const pressedRef = useRef(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  const { onCancel } = props;
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  useEffect(() => {
    if (dialogRef.current) {
      dialogRef.current.focus();
    }
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    pressedRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    updatePoint(e);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pressedRef.current) {
      updatePoint(e);
    }
  };

  const handlePointerUp = () => {
    pressedRef.current = false;
  };

  const updatePoint = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(320, (e.clientX - rect.left) / rect.width * 320));
    const y = Math.max(0, Math.min(320, (e.clientY - rect.top) / rect.height * 320));
    setPoint({ x, y });
  };

  const getShiftText = () => {
    if (!point) return "Aucun décalage";

    const mmPerPixel = 320 / (3 * 11.7);
    const dx = (point.x - 160) / mmPerPixel;
    const dy = (160 - point.y) / mmPerPixel;

    let text = "";
    if (Math.abs(dx) >= 0.1) {
      text += `${Math.abs(dx).toFixed(1)} mm vers ${dx > 0 ? "la droite" : "la gauche"}`;
    }
    if (Math.abs(dy) >= 0.1) {
      if (text) text += ", ";
      text += `${Math.abs(dy).toFixed(1)} mm vers ${dy > 0 ? "le haut" : "le bas"}`;
    }
    return text || "Aucun décalage";
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Recentrer l'œil : ${props.label}`}
      ref={dialogRef}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.6)" }}
    >
      <div
        className="max-w-sm w-full p-6 rounded-xl"
        style={{
          background: "var(--bg-subtle)",
          border: "1px solid var(--border-strong)",
          borderRadius: "var(--radius-xl)"
        }}
      >
        <h2 className="text-xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
          Recentrer l&apos;œil : {props.label}
        </h2>
        <p className="mb-4" style={{ color: "var(--text-secondary)" }}>
          Touche le vrai centre de la pupille. La mesure est refaite à partir de ta correction.
        </p>
        <div className="relative w-full aspect-square mb-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={props.imageUrl}
            alt={`Photo de l'œil ${props.label}`}
            className="w-full h-full object-fill"
            style={{ touchAction: "none", cursor: "crosshair" }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          />
          <svg
            viewBox="0 0 320 320"
            className="absolute inset-0"
            style={{ pointerEvents: "none" }}
          >
            <circle cx={160} cy={160} r={160/3} fill="none" stroke="black" strokeWidth={3} strokeOpacity={0.6} />
            <circle cx={160} cy={160} r={160/3} fill="none" stroke="white" strokeWidth={1.5} strokeDasharray="5,5" />
            {point && (
              <>
                <circle cx={point.x} cy={point.y} r={160/3} fill="none" stroke="var(--indigo)" strokeWidth={2} />
                <line x1={point.x - 8} y1={point.y} x2={point.x + 8} y2={point.y} stroke="black" strokeWidth={3} />
                <line x1={point.x} y1={point.y - 8} x2={point.x} y2={point.y + 8} stroke="black" strokeWidth={3} />
                <line x1={point.x - 8} y1={point.y} x2={point.x + 8} y2={point.y} stroke="white" strokeWidth={1.5} />
                <line x1={point.x} y1={point.y - 8} x2={point.x} y2={point.y + 8} stroke="white" strokeWidth={1.5} />
              </>
            )}
          </svg>
        </div>
        <p className="mb-4" style={{ color: "var(--text-muted)" }} aria-live="polite">
          Décalage : {getShiftText()}
        </p>
        {props.error && (
          <p role="alert" className="mb-4" style={{ color: "var(--danger)" }}>
            {props.error}
          </p>
        )}
        <div className="flex justify-end space-x-2">
          <button
            onClick={props.onCancel}
            disabled={props.busy}
            className="px-4 py-2 rounded"
            style={{
              background: "var(--surface)",
              color: "var(--text-primary)",
              border: "1px solid var(--border-strong)"
            }}
          >
            Annuler
          </button>
          <button
            onClick={() => point && props.onConfirm(point)}
            disabled={!point || props.busy}
            className="px-4 py-2 rounded text-white"
            style={{ background: "var(--indigo)" }}
          >
            {props.busy ? "Analyse en cours" : "Ré-analyser"}
          </button>
        </div>
      </div>
    </div>
  );
}
