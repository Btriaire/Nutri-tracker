"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import type { MealTimingData, MealTimingStats } from "@/app/api/meal-timing/route";

// ─── Constants ────────────────────────────────────────────────────────────────

const VW   = 320;  // total SVG width
const LP   = 28;   // left padding (emoji zone)
const RP   = 42;   // right padding (time label zone)
const PW   = VW - LP - RP; // plot width = 250
const ROW_H = 32;  // height per meal row
const AXIS_H = 18; // height for bottom axis
const PAD_T  = 6;  // top padding

const MEALS = ["breakfast", "lunch", "dinner", "snacks"] as const;

const MEAL_META: Record<string, { emoji: string; label: string; color: string }> = {
  breakfast: { emoji: "🌅", label: "Petit-déj", color: "#fbbf24" },
  lunch:     { emoji: "🥗", label: "Déjeuner",  color: "#34d399" },
  dinner:    { emoji: "🍽️", label: "Dîner",     color: "#a78bfa" },
  snacks:    { emoji: "🍎", label: "Collation", color: "#f97316" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function minutesToLabel(m: number): string {
  const h  = Math.floor(m / 60) % 24;
  const mn = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mn).padStart(2, "0")}`;
}

function mx(min: number, winStart: number, winEnd: number): number {
  const range = winEnd - winStart;
  const pct   = Math.max(0, Math.min(1, (min - winStart) / range));
  return LP + pct * PW;
}

// ─── SVG Timeline ─────────────────────────────────────────────────────────────

function MealTimingSVG({ stats }: { stats: MealTimingStats[] }) {
  const activeStats = stats.filter(s => s.count >= 2);

  // Compute shared time window from all data
  let globalMin = 1440, globalMax = 0;
  for (const s of activeStats) {
    for (const p of s.points) {
      if (p.minutes < globalMin) globalMin = p.minutes;
      if (p.minutes > globalMax) globalMax = p.minutes;
    }
    // Include std-dev bands
    globalMin = Math.min(globalMin, s.avgMinutes - s.stdMinutes);
    globalMax = Math.max(globalMax, s.avgMinutes + s.stdMinutes);
  }
  if (activeStats.length === 0) { globalMin = 360; globalMax = 1320; }

  // Snap to hour boundaries with 45-min padding
  const PAD = 45;
  const winStart = Math.floor(Math.max(0,    globalMin - PAD) / 60) * 60;
  const winEnd   = Math.ceil( Math.min(1440, globalMax + PAD) / 60) * 60;

  // Tick marks every 2h, or 1h if window is small
  const windowH = (winEnd - winStart) / 60;
  const tickStep = windowH <= 8 ? 1 : 2;
  const ticks: number[] = [];
  for (let h = Math.ceil(winStart / 60); h <= Math.floor(winEnd / 60); h++) {
    if (h % tickStep === 0) ticks.push(h);
  }

  const rows = MEALS
    .map(m => stats.find(s => s.meal === m))
    .filter((s): s is MealTimingStats => !!s && s.count >= 2);

  const svgH = PAD_T + rows.length * ROW_H + AXIS_H + 4;

  return (
    <svg
      viewBox={`0 0 ${VW} ${svgH}`}
      width="100%"
      style={{ display: "block", overflow: "visible" }}
    >
      {rows.map((stat, ri) => {
        const meta    = MEAL_META[stat.meal];
        const cy      = PAD_T + ri * ROW_H + ROW_H / 2;
        const avgX    = mx(stat.avgMinutes, winStart, winEnd);
        const sdLeft  = mx(stat.avgMinutes - stat.stdMinutes, winStart, winEnd);
        const sdRight = mx(stat.avgMinutes + stat.stdMinutes, winStart, winEnd);
        const sdW     = Math.max(4, sdRight - sdLeft);

        // Recent 7 points, newest last (so newest renders on top)
        const recentPts = [...stat.points]
          .sort((a, b) => a.date.localeCompare(b.date))
          .slice(-7);

        return (
          <g key={stat.meal}>
            {/* Emoji label */}
            <text
              x={LP / 2} y={cy + 1}
              textAnchor="middle" dominantBaseline="middle"
              fontSize={15}
            >
              {meta.emoji}
            </text>

            {/* Track line */}
            <line
              x1={LP} y1={cy} x2={LP + PW} y2={cy}
              stroke="rgba(255,255,255,0.07)" strokeWidth={3} strokeLinecap="round"
            />

            {/* Std-dev band */}
            {stat.stdMinutes > 0 && (
              <rect
                x={sdLeft} y={cy - 5}
                width={sdW} height={10} rx={5}
                fill={`${meta.color}22`}
                stroke={`${meta.color}50`} strokeWidth={0.75}
              />
            )}

            {/* Historical dots (oldest → faintest, newest → brightest) */}
            {recentPts.map((pt, i) => {
              const opacity = 0.25 + (i / Math.max(recentPts.length - 1, 1)) * 0.55;
              const r = i === recentPts.length - 1 ? 4 : 3;
              return (
                <circle
                  key={`${pt.date}-${i}`}
                  cx={mx(pt.minutes, winStart, winEnd)} cy={cy}
                  r={r}
                  fill={meta.color}
                  opacity={opacity}
                />
              );
            })}

            {/* Average marker — outer ring + inner dot */}
            <circle cx={avgX} cy={cy} r={6}
              fill="none" stroke={meta.color} strokeWidth={1.5}
            />
            <circle cx={avgX} cy={cy} r={2.5}
              fill={meta.color}
            />

            {/* Time label + σ */}
            <text
              x={LP + PW + RP - 2} y={cy - 1}
              textAnchor="end" dominantBaseline="auto"
              fontSize={11} fontWeight={600} fontFamily="monospace"
              fill={meta.color}
            >
              {minutesToLabel(stat.avgMinutes)}
            </text>
            <text
              x={LP + PW + RP - 2} y={cy + 10}
              textAnchor="end" dominantBaseline="auto"
              fontSize={9}
              fill="rgba(255,255,255,0.35)"
            >
              ±{stat.stdMinutes}&apos;
            </text>
          </g>
        );
      })}

      {/* X-axis */}
      {(() => {
        const axisY = PAD_T + rows.length * ROW_H + 4;
        return (
          <g>
            <line
              x1={LP} y1={axisY} x2={LP + PW} y2={axisY}
              stroke="rgba(255,255,255,0.10)" strokeWidth={1}
            />
            {ticks.map(h => {
              const x = mx(h * 60, winStart, winEnd);
              if (x < LP + 2 || x > LP + PW - 2) return null;
              return (
                <g key={h}>
                  <line x1={x} y1={axisY} x2={x} y2={axisY + 3}
                    stroke="rgba(255,255,255,0.20)" strokeWidth={1} />
                  <text
                    x={x} y={axisY + 13}
                    textAnchor="middle" dominantBaseline="auto"
                    fontSize={9}
                    fill="rgba(255,255,255,0.35)"
                  >
                    {String(h % 24).padStart(2, "0")}h
                  </text>
                </g>
              );
            })}
          </g>
        );
      })()}
    </svg>
  );
}

// ─── Main widget ──────────────────────────────────────────────────────────────

export default function MealTimingWidget() {
  const [data,    setData]    = useState<MealTimingData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/meal-timing")
      .then(r => r.ok ? r.json() as Promise<MealTimingData> : Promise.reject())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="glass p-4 animate-pulse">
        <div className="h-3 rounded-full w-2/5 mb-3" style={{ background: "rgba(255,255,255,0.07)" }} />
        <div className="h-32 rounded-xl" style={{ background: "rgba(255,255,255,0.04)" }} />
      </div>
    );
  }

  if (!data || data.days === 0) {
    return (
      <div className="glass p-4 text-center">
        <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>
          Pas encore de données d'horaires — loggez vos repas avec horodatage automatique
        </p>
      </div>
    );
  }

  const hasEnough = data.stats.some(s => s.count >= 2);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="glass p-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-[15px]">🕐</span>
          <p className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
            Horaires des repas
          </p>
        </div>
        <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
          {data.days}j analysés
        </p>
      </div>

      {!hasEnough ? (
        <p className="text-[12px] text-center py-4" style={{ color: "var(--text-muted)" }}>
          Continuez à logger vos repas — les statistiques apparaîtront après quelques jours
        </p>
      ) : (
        <>
          <MealTimingSVG stats={data.stats} />

          {/* Legend */}
          <div className="flex items-center gap-4 mt-2 pl-1">
            <div className="flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 14 14">
                <circle cx="7" cy="7" r="5" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5"/>
                <circle cx="7" cy="7" r="2" fill="rgba(255,255,255,0.5)"/>
              </svg>
              <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>Moyenne</span>
            </div>
            <div className="flex items-center gap-1.5">
              <svg width="18" height="10" viewBox="0 0 18 10">
                <rect x="1" y="2" width="16" height="6" rx="3"
                  fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.25)" strokeWidth="0.75"/>
              </svg>
              <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>±1σ</span>
            </div>
            <div className="flex items-center gap-1.5">
              <svg width="22" height="8" viewBox="0 0 22 8">
                {[0.2, 0.4, 0.6, 0.8, 1.0].map((op, i) => (
                  <circle key={i} cx={2 + i * 4.5} cy="4" r="2.5"
                    fill="rgba(255,255,255,1)" opacity={op}/>
                ))}
              </svg>
              <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>7 derniers repas</span>
            </div>
          </div>
        </>
      )}
    </motion.div>
  );
}
