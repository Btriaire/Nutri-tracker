"use client";

import { useEffect, useRef, useState } from "react";

const SIZE = 210;
const RADIUS = SIZE / 2;
const BALL_SIZE = 24;

// Two-axis mood model (Yale Mood Meter), adapted from Halcyon-PaLaMa's
// "Humeur du jour": x is valence (-1 désagréable .. +1 agréable), y is
// arousal (-1 calme/basse énergie .. +1 énergisé) — screen y grows downward,
// so arousal is the negative of the pixel-space y.
const LABELS: { angleDeg: number; label: string }[] = [
  { angleDeg: 0,   label: "content" },
  { angleDeg: 45,  label: "joyeux" },
  { angleDeg: 90,  label: "énergique" },
  { angleDeg: 135, label: "anxieux" },
  { angleDeg: 180, label: "triste" },
  { angleDeg: 225, label: "abattu" },
  { angleDeg: 270, label: "calme" },
  { angleDeg: 315, label: "serein" },
];

function intensityPrefix(distance: number): string {
  if (distance < 0.4) return "légèrement ";
  if (distance > 0.75) return "très ";
  return "";
}

export function moodLabelFromPosition(x: number, y: number): string {
  const distance = Math.hypot(x, y);
  if (distance < 0.12) return "Normal";
  const angleDeg = ((Math.atan2(-y, x) * 180) / Math.PI + 360) % 360;
  let closest = LABELS[0];
  let smallestDelta = 360;
  for (const entry of LABELS) {
    const delta = Math.min(
      Math.abs(entry.angleDeg - angleDeg),
      360 - Math.abs(entry.angleDeg - angleDeg)
    );
    if (delta < smallestDelta) {
      smallestDelta = delta;
      closest = entry;
    }
  }
  const combined = intensityPrefix(distance) + closest.label;
  return combined.charAt(0).toUpperCase() + combined.slice(1);
}

// Collapses the 2D position back down to the app's existing 1–5 mood scale
// (dashboard indicator, trend chart, Halcyon-PaLaMa auto-push all expect
// this) — driven by valence alone, since that's what "bien / mal" means.
export function moodValueFromPosition(x: number): number {
  return Math.min(5, Math.max(1, Math.round(((x + 1) / 2) * 4) + 1));
}

interface MoodCircleProps {
  initialX?: number;
  initialY?: number;
  onChange: (x: number, y: number) => void;
}

export default function MoodCircle({ initialX = 0, initialY = 0, onChange }: MoodCircleProps) {
  const [pos, setPos] = useState({ x: initialX, y: initialY });
  const [dragging, setDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPos({ x: initialX, y: initialY });
  }, [initialX, initialY]);

  function updateFromPointer(clientX: number, clientY: number) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = rect.left + RADIUS;
    const cy = rect.top + RADIUS;
    let x = (clientX - cx) / RADIUS;
    let y = (clientY - cy) / RADIUS;
    const distance = Math.hypot(x, y);
    if (distance > 1) { x /= distance; y /= distance; }
    setPos({ x, y });
    onChange(x, y);
  }

  function handlePointerDown(e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    updateFromPointer(e.clientX, e.clientY);
  }
  function handlePointerMove(e: React.PointerEvent) {
    if (!dragging) return;
    updateFromPointer(e.clientX, e.clientY);
  }
  function handlePointerUp() { setDragging(false); }

  const label = moodLabelFromPosition(pos.x, pos.y);
  const moodVal = moodValueFromPosition(pos.x);
  const ballColor = moodVal >= 5 ? "#34d399" : moodVal >= 4 ? "#86efac" : moodVal >= 3 ? "#fbbf24" : moodVal >= 2 ? "#f97316" : "#f87171";

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          width: SIZE,
          height: SIZE,
          touchAction: "none",
          // Four soft quadrant glows built from NutriTracker's own semantic
          // colors: agréable+énergique → carbs (ambre), désagréable+énergique
          // → calories (orange/rouge), désagréable+calme → muted, agréable+
          // calme → fiber (vert) — the same green/red logic as MoodFace.
          background: [
            "radial-gradient(circle at 82% 18%, color-mix(in srgb, var(--carbs) 30%, transparent) 0%, transparent 58%)",
            "radial-gradient(circle at 18% 18%, color-mix(in srgb, var(--calories) 26%, transparent) 0%, transparent 58%)",
            "radial-gradient(circle at 18% 82%, color-mix(in srgb, var(--text-muted) 22%, transparent) 0%, transparent 58%)",
            "radial-gradient(circle at 82% 82%, color-mix(in srgb, var(--fiber) 26%, transparent) 0%, transparent 58%)",
            "var(--surface)",
          ].join(", "),
        }}
        className="relative select-none rounded-full"
      >
        <div className="absolute inset-0 rounded-full" style={{ border: "1px solid var(--border)" }} />
        {/* Axis crosshair */}
        <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2" style={{ background: "var(--border)" }} />
        <div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2" style={{ background: "var(--border)" }} />
        {/* Center mark ("normal") */}
        <div className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: "var(--text-muted)" }} />

        {/* Draggable ball */}
        <div
          style={{
            width: BALL_SIZE,
            height: BALL_SIZE,
            left: RADIUS + pos.x * RADIUS,
            top: RADIUS + pos.y * RADIUS,
            background: ballColor,
            boxShadow: `0 0 14px ${ballColor}66`,
            transition: dragging ? "none" : "left 0.25s ease, top 0.25s ease, background 0.2s ease",
          }}
          className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
        />
      </div>

      <p className="text-[13px] font-semibold" style={{ color: ballColor }}>{label}</p>
      <p className="text-center text-[10px]" style={{ color: "var(--text-muted)" }}>
        Déplace la bille où tu te sens — le centre, c&apos;est ton état normal.
      </p>
    </div>
  );
}
