"use client";

import { useMemo } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Stage = "awake" | "rem" | "light" | "deep";

interface Segment {
  stage: Stage;
  durationMin: number;
}

// ─── Stage config ─────────────────────────────────────────────────────────────

const STAGE_Y: Record<Stage, number> = { awake: 4, rem: 3, light: 2, deep: 1 };

const STAGE_CFG: Record<Stage, { label: string; color: string; bg: string }> = {
  awake: { label: "Éveillé",  color: "#94a3b8", bg: "rgba(148,163,184,0.18)" },
  rem:   { label: "REM",      color: "#c084fc", bg: "rgba(192,132,252,0.20)" },
  light: { label: "Léger",    color: "#60a5fa", bg: "rgba(96,165,250,0.22)"  },
  deep:  { label: "Profond",  color: "#1d4ed8", bg: "rgba(29,78,216,0.30)"   },
};

// ─── Sleep architecture model ─────────────────────────────────────────────────
// Based on standard polysomnography patterns:
// - 90-min cycles; first cycles = more deep, later cycles = more REM
// - Typical distribution: ~5% awake, ~20% deep, ~50% light, ~25% REM

function generateSleepCycles(totalMin: number): Segment[] {
  const NUM_CYCLES = Math.max(2, Math.min(6, Math.round(totalMin / 90)));
  const segments: Segment[] = [];

  // Fall asleep onset
  segments.push({ stage: "light", durationMin: 8 });
  let used = 8;

  for (let c = 0; c < NUM_CYCLES; c++) {
    const progress = c / Math.max(1, NUM_CYCLES - 1); // 0 → 1 across night
    const remaining = totalMin - used;
    const cycleBudget = Math.min(90, remaining - (NUM_CYCLES - 1 - c) * 20);
    if (cycleBudget < 15) break;

    // Deep sleep: prominent early, fades later
    const deepMin  = Math.max(0, Math.round(cycleBudget * (0.40 - progress * 0.35)));
    // REM: rare early, dominant later
    const remMin   = Math.max(0, Math.round(cycleBudget * (0.08 + progress * 0.42)));
    // Light sleep fills the rest
    const lightMin = Math.max(0, cycleBudget - deepMin - remMin - 3);
    // Brief awakening between cycles (except last)
    const awakeMin = c < NUM_CYCLES - 1 ? 3 : 0;

    if (lightMin > 0) segments.push({ stage: "light", durationMin: Math.round(lightMin * 0.45) });
    if (deepMin  > 0) segments.push({ stage: "deep",  durationMin: deepMin  });
    if (lightMin > 0) segments.push({ stage: "light", durationMin: Math.round(lightMin * 0.55) });
    if (remMin   > 0) segments.push({ stage: "rem",   durationMin: remMin   });
    if (awakeMin > 0) segments.push({ stage: "awake", durationMin: awakeMin });

    used += deepMin + remMin + lightMin + awakeMin;
    if (used >= totalMin - 5) break;
  }

  // Fill any remaining time with light sleep
  const totalGenerated = segments.reduce((s, x) => s + x.durationMin, 0);
  const leftover = totalMin - totalGenerated;
  if (leftover > 0) segments.push({ stage: "light", durationMin: leftover });

  // Final wake-up
  segments.push({ stage: "awake", durationMin: 2 });

  return segments;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  sleepMinutes: number;
  /** Estimated bedtime hour (24h). Defaults to 23. */
  bedtimeHour?: number;
}

export default function SleepHypnogram({ sleepMinutes, bedtimeHour = 23 }: Props) {
  const segments = useMemo(() => generateSleepCycles(sleepMinutes), [sleepMinutes]);

  // Build time-mapped points for drawing
  const points = useMemo(() => {
    const pts: { t: number; y: number; stage: Stage }[] = [];
    let t = 0;
    for (const seg of segments) {
      pts.push({ t, y: STAGE_Y[seg.stage], stage: seg.stage });
      t += seg.durationMin;
    }
    pts.push({ t, y: STAGE_Y["awake"], stage: "awake" }); // end point
    return pts;
  }, [segments]);

  const totalMin = points[points.length - 1]?.t ?? sleepMinutes;

  // Stage totals
  const stageTotals = useMemo(() => {
    const tot: Record<Stage, number> = { awake: 0, rem: 0, light: 0, deep: 0 };
    for (const s of segments) tot[s.stage] += s.durationMin;
    return tot;
  }, [segments]);

  // SVG geometry
  const W = 380, H = 130;
  const PAD = { top: 6, right: 10, bottom: 22, left: 52 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const NUM_STAGES = 4; // deep=1 … awake=4

  const xFn = (t: number) => PAD.left + (t / totalMin) * plotW;
  // Y: stage 1 (deep) → bottom, stage 4 (awake) → top
  const yFn = (stage: number) => PAD.top + plotH - ((stage - 1) / (NUM_STAGES - 1)) * plotH;

  // Build SVG paths: one filled rect per segment (step-after style)
  const rects: { x: number; width: number; stage: Stage }[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p = points[i];
    const next = points[i + 1];
    rects.push({ x: xFn(p.t), width: xFn(next.t) - xFn(p.t), stage: p.stage });
  }

  // Step-after polyline
  let linePath = "";
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const px = xFn(p.t), py = yFn(p.y);
    if (i === 0) {
      linePath += `M ${px} ${py}`;
    } else {
      // horizontal first (step-after), then vertical
      linePath += ` H ${px} V ${py}`;
    }
  }
  // Close last horizontal to end
  linePath += ` H ${xFn(totalMin)}`;

  // Time axis ticks (every hour)
  const hourTicks: { x: number; label: string }[] = [];
  for (let h = 0; h <= Math.ceil(totalMin / 60); h++) {
    const tMin = h * 60;
    if (tMin > totalMin) break;
    const clockH = ((bedtimeHour + h) % 24);
    hourTicks.push({
      x:     xFn(tMin),
      label: `${String(clockH).padStart(2, "0")}h`,
    });
  }

  // Cycle boundary markers (every ~90 min)
  const cycleBoundaries: number[] = [];
  {
    let acc = 8; // skip sleep onset
    let cycleUsed = 0;
    for (const seg of segments.slice(1)) {
      acc += seg.durationMin;
      cycleUsed += seg.durationMin;
      if (cycleUsed >= 85 && seg.stage === "awake") {
        cycleBoundaries.push(acc);
        cycleUsed = 0;
      }
    }
  }

  const fmtMin = (m: number) => m >= 60
    ? `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, "0") : ""}`
    : `${m}min`;

  return (
    <div>
      {/* Simulation badge */}
      <div className="flex items-center justify-between mb-3">
        <p className="label-xs">Cycles de sommeil</p>
        <span className="text-[9px] px-2 py-0.5 rounded-full font-medium"
          style={{ background: "rgba(96,165,250,0.1)", color: "#60a5fa", border: "1px solid rgba(96,165,250,0.25)" }}>
          Simulation · {Math.round(sleepMinutes / 60 * 10) / 10}h
        </span>
      </div>

      {/* Hypnogram SVG */}
      <div style={{ overflowX: "auto" }}>
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ minWidth: "280px", display: "block" }}>
          {/* Background grid lines per stage */}
          {([1, 2, 3, 4] as const).map(s => (
            <line key={s}
              x1={PAD.left} y1={yFn(s)}
              x2={PAD.left + plotW} y2={yFn(s)}
              stroke="rgba(255,255,255,0.04)" strokeWidth={1} />
          ))}

          {/* Filled stage rectangles */}
          {rects.map((r, i) => {
            const cfg = STAGE_CFG[r.stage];
            const rectY = yFn(STAGE_Y[r.stage]);
            const rectH = (PAD.top + plotH) - rectY;
            return (
              <rect key={i}
                x={r.x} y={rectY}
                width={Math.max(0, r.width - 0.5)} height={rectH}
                fill={cfg.bg}
                rx={0}
              />
            );
          })}

          {/* Cycle boundary dotted lines */}
          {cycleBoundaries.map((t, i) => (
            <line key={i}
              x1={xFn(t)} y1={PAD.top}
              x2={xFn(t)} y2={PAD.top + plotH}
              stroke="rgba(255,255,255,0.12)" strokeWidth={1} strokeDasharray="3 3" />
          ))}

          {/* Step line */}
          <path d={linePath} fill="none" stroke="#60a5fa" strokeWidth={1.8} strokeLinejoin="round" />

          {/* Y axis labels */}
          {(["awake", "rem", "light", "deep"] as Stage[]).map(s => {
            const cfg = STAGE_CFG[s];
            return (
              <text key={s}
                x={PAD.left - 4} y={yFn(STAGE_Y[s]) + 3.5}
                textAnchor="end" fontSize={8} fill={cfg.color} fontFamily="inherit" fontWeight={600}>
                {cfg.label}
              </text>
            );
          })}

          {/* X axis ticks */}
          {hourTicks.map(({ x, label }) => (
            <g key={label}>
              <line x1={x} y1={PAD.top + plotH} x2={x} y2={PAD.top + plotH + 3}
                stroke="rgba(255,255,255,0.2)" strokeWidth={1} />
              <text x={x} y={H - 4}
                textAnchor="middle" fontSize={8} fill="rgba(255,255,255,0.35)" fontFamily="inherit">
                {label}
              </text>
            </g>
          ))}

          {/* X axis line */}
          <line x1={PAD.left} y1={PAD.top + plotH}
            x2={PAD.left + plotW} y2={PAD.top + plotH}
            stroke="rgba(255,255,255,0.12)" strokeWidth={1} />
        </svg>
      </div>

      {/* Stage breakdown */}
      <div className="grid grid-cols-4 gap-1.5 mt-3">
        {(["deep", "light", "rem", "awake"] as Stage[]).map(s => {
          const cfg = STAGE_CFG[s];
          const mins = stageTotals[s];
          const pct = Math.round(mins / sleepMinutes * 100);
          return (
            <div key={s} className="flex flex-col items-center gap-0.5 rounded-lg py-2"
              style={{ background: cfg.bg, border: `1px solid ${cfg.color}30` }}>
              <span className="text-[13px] font-bold tabular-nums" style={{ color: cfg.color }}>
                {fmtMin(mins)}
              </span>
              <span className="text-[9px] font-medium" style={{ color: cfg.color }}>{cfg.label}</span>
              <span className="text-[9px]" style={{ color: "rgba(255,255,255,0.35)" }}>{pct}%</span>
            </div>
          );
        })}
      </div>

      <p className="text-[9px] mt-2 text-center" style={{ color: "rgba(255,255,255,0.25)" }}>
        Architecture simulée basée sur les cycles typiques · données réelles non disponibles
      </p>
    </div>
  );
}
