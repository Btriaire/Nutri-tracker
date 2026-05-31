"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import type { MealTimingData, MealTimingStats } from "@/app/api/meal-timing/route";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function minutesToLabel(m: number): string {
  const h = Math.floor(m / 60) % 24;
  const mn = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mn).padStart(2, "0")}`;
}

const MEAL_META: Record<string, { label: string; emoji: string; color: string; typical: [number, number] }> = {
  breakfast: { label: "Petit-déj", emoji: "☕", color: "#fbbf24", typical: [360, 600]  }, // 6h-10h
  lunch:     { label: "Déjeuner",  emoji: "🥗", color: "#34d399", typical: [660, 840]  }, // 11h-14h
  dinner:    { label: "Dîner",     emoji: "🍽️", color: "#a78bfa", typical: [1080, 1260] }, // 18h-21h
  snacks:    { label: "Collation", emoji: "🍎", color: "#f97316", typical: [0, 1440]    }, // any time
};

// Map 0-1440 minutes to a 0-100% horizontal position within a window
function minutesToPct(min: number, windowStart: number, windowEnd: number): number {
  const range = windowEnd - windowStart;
  return Math.max(0, Math.min(100, ((min - windowStart) / range) * 100));
}

// ─── MealTimeline ─────────────────────────────────────────────────────────────

function MealTimeline({ stat }: { stat: MealTimingStats }) {
  const meta = MEAL_META[stat.meal];
  if (!meta || stat.count === 0) return null;

  // Dynamic window: typical ± 3h or use data range
  const allMins = stat.points.map(p => p.minutes);
  const dataMin = Math.min(...allMins);
  const dataMax = Math.max(...allMins);
  const padding = 60; // 1 hour padding each side
  const winStart = Math.max(0, Math.min(dataMin - padding, meta.typical[0] - padding));
  const winEnd   = Math.min(1440, Math.max(dataMax + padding, meta.typical[1] + padding));

  const avgPct = minutesToPct(stat.avgMinutes, winStart, winEnd);
  const sdPctW = (stat.stdMinutes / (winEnd - winStart)) * 100;

  // Recent 7 dots (most recent first)
  const recentPts = [...stat.points].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7);

  // Tick marks: every 60 min within window
  const tickHours: number[] = [];
  for (let h = Math.ceil(winStart / 60); h <= Math.floor(winEnd / 60); h++) {
    tickHours.push(h);
  }

  return (
    <div className="rounded-xl overflow-hidden"
      style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5"
        style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2">
          <span className="text-[16px]">{meta.emoji}</span>
          <div>
            <p className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>{meta.label}</p>
            <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
              {stat.count} repas · σ {stat.stdMinutes} min
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[18px] font-bold tabular-nums" style={{ color: meta.color }}>
            {minutesToLabel(stat.avgMinutes)}
          </p>
          <p className="text-[9px]" style={{ color: "var(--text-muted)" }}>heure moyenne</p>
        </div>
      </div>

      {/* Timeline */}
      <div className="px-3 py-3">
        <div className="relative h-8">
          {/* Background track */}
          <div className="absolute inset-y-0 inset-x-0 rounded-full"
            style={{ top: "50%", transform: "translateY(-50%)", height: 4, background: "rgba(255,255,255,0.05)" }} />

          {/* Std-dev zone */}
          {stat.stdMinutes > 0 && (
            <div className="absolute rounded-full"
              style={{
                left:   `${Math.max(0, avgPct - sdPctW)}%`,
                width:  `${Math.min(100, sdPctW * 2)}%`,
                top: "50%", transform: "translateY(-50%)",
                height: 8,
                background: `${meta.color}25`,
                border: `1px solid ${meta.color}40`,
              }} />
          )}

          {/* Recent dots */}
          {recentPts.map((pt, i) => (
            <motion.div key={`${pt.date}-${i}`}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: i * 0.04, duration: 0.2 }}
              className="absolute rounded-full"
              style={{
                left:   `${minutesToPct(pt.minutes, winStart, winEnd)}%`,
                top:    "50%",
                transform: "translate(-50%, -50%)",
                width:  8, height: 8,
                background: i === 0 ? meta.color : `${meta.color}${Math.round(80 - i * 10).toString(16)}`,
                border: `1.5px solid ${meta.color}`,
                boxShadow: i === 0 ? `0 0 6px ${meta.color}80` : "none",
                zIndex: recentPts.length - i,
              }}
              title={`${pt.date} · ${minutesToLabel(pt.minutes)} · ${pt.calories} kcal`}
            />
          ))}

          {/* Average marker */}
          <div className="absolute"
            style={{
              left:   `${avgPct}%`,
              top:    "50%",
              transform: "translate(-50%, -50%)",
              width:  2, height: 20,
              background: meta.color,
              borderRadius: 1,
            }} />
        </div>

        {/* Tick labels */}
        <div className="relative mt-1" style={{ height: 14 }}>
          {tickHours.filter((_, i) => i % 1 === 0).map(h => {
            const pct = minutesToPct(h * 60, winStart, winEnd);
            if (pct < 2 || pct > 98) return null;
            return (
              <span key={h}
                className="absolute text-[9px] tabular-nums"
                style={{
                  left:      `${pct}%`,
                  transform: "translateX(-50%)",
                  color:     "var(--text-muted)",
                }}>
                {String(h % 24).padStart(2, "0")}h
              </span>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-1">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full" style={{ background: meta.color }} />
            <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>Moyenne</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-1 rounded-full" style={{ background: `${meta.color}40` }} />
            <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>±1 écart-type</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full" style={{ background: `${meta.color}60` }} />
            <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>7 derniers repas</span>
          </div>
        </div>
      </div>
    </div>
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
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 rounded-xl" style={{ background: "rgba(255,255,255,0.04)" }} />
          ))}
        </div>
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

  const hasData = data.stats.some(s => s.count > 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="glass p-4"
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-[16px]">🕐</span>
        <div>
          <p className="text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>Horaires des repas</p>
          <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            {data.days} jour{data.days > 1 ? "s" : ""} analysé{data.days > 1 ? "s" : ""} · 30 derniers jours
          </p>
        </div>
      </div>

      {!hasData ? (
        <p className="text-[12px] text-center py-4" style={{ color: "var(--text-muted)" }}>
          Les nouvelles entrées seront horodatées automatiquement
        </p>
      ) : (
        <div className="space-y-3">
          {data.stats
            .filter(s => s.count >= 2) // need at least 2 points to be meaningful
            .map(s => (
              <MealTimeline key={s.meal} stat={s} />
            ))}
          {data.stats.filter(s => s.count >= 2).length === 0 && (
            <p className="text-[12px] text-center py-4" style={{ color: "var(--text-muted)" }}>
              Continuez à logger vos repas — les statistiques apparaîtront après quelques jours
            </p>
          )}
        </div>
      )}
    </motion.div>
  );
}
