"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { format, parseISO, startOfWeek } from "date-fns";
import { fr } from "date-fns/locale";
import type { StreakData, HeatmapDay } from "@/app/api/streak/route";

// ── Heat colour (0-100+ pct) ──────────────────────────────────────────────────

function heatColor(day: HeatmapDay): string {
  if (!day.logged || day.pct === 0) return "rgba(255,255,255,0.05)";
  if (day.pct < 50)  return "rgba(249,115,22,0.25)";
  if (day.pct < 80)  return "rgba(249,115,22,0.50)";
  if (day.pct < 100) return "rgba(249,115,22,0.75)";
  return "var(--calories)";   // 100%+
}

// ── Heatmap (16 semaines) ─────────────────────────────────────────────────────

function Heatmap({ days }: { days: HeatmapDay[] }) {
  // Group into weeks (columns of 7)
  const weeks: HeatmapDay[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  // Month labels at the start of each month
  const monthLabels: { weekIdx: number; label: string }[] = [];
  weeks.forEach((week, wi) => {
    const first = week[0];
    if (!first) return;
    const d = parseISO(first.date);
    // Show label when it's the first week that contains the 1st of the month
    if (d.getDate() <= 7) {
      monthLabels.push({ weekIdx: wi, label: format(d, "MMM", { locale: fr }) });
    }
  });

  const CELL = 11;
  const GAP  = 2;

  return (
    <div className="overflow-x-auto" style={{ scrollbarWidth: "none" }}>
      <div style={{ display: "inline-block", minWidth: "fit-content" }}>
        {/* Month row */}
        <div className="flex mb-1" style={{ gap: GAP }}>
          {weeks.map((_, wi) => {
            const label = monthLabels.find((m) => m.weekIdx === wi);
            return (
              <div key={wi} style={{ width: CELL, flexShrink: 0 }}>
                {label && (
                  <span className="text-[8px] capitalize" style={{ color: "var(--text-muted)" }}>
                    {label.label}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Grid */}
        <div className="flex" style={{ gap: GAP }}>
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col" style={{ gap: GAP }}>
              {week.map((day) => (
                <motion.div
                  key={day.date}
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.2, delay: wi * 0.01 }}
                  title={`${day.date} · ${day.calories} kcal${day.pct > 0 ? ` (${day.pct}%)` : ""}`}
                  style={{
                    width:  CELL,
                    height: CELL,
                    borderRadius: 2,
                    background: heatColor(day),
                    flexShrink: 0,
                    cursor: "default",
                  }}
                />
              ))}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-2 mt-2">
          <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>0%</span>
          {[0, 0.25, 0.5, 0.75, 1].map((v) => (
            <div key={v} style={{
              width: CELL, height: CELL, borderRadius: 2, flexShrink: 0,
              background: v === 0
                ? "rgba(255,255,255,0.05)"
                : v === 0.25 ? "rgba(249,115,22,0.25)"
                : v === 0.5  ? "rgba(249,115,22,0.50)"
                : v === 0.75 ? "rgba(249,115,22,0.75)"
                : "var(--calories)",
            }} />
          ))}
          <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>100%+</span>
        </div>
      </div>
    </div>
  );
}

// ── Stat pill ─────────────────────────────────────────────────────────────────

function StatPill({ emoji, label, value, sub }: { emoji: string; label: string; value: string | number; sub?: string }) {
  return (
    <div className="flex-1 min-w-0 flex flex-col items-center gap-0.5 py-2">
      <span className="text-base leading-none">{emoji}</span>
      <span className="text-[18px] font-bold tabular-nums leading-tight" style={{ color: "var(--text-primary)" }}>
        {value}
      </span>
      {sub && <span className="text-[9px] tabular-nums" style={{ color: "var(--calories)" }}>{sub}</span>}
      <span className="text-[9px] text-center leading-tight" style={{ color: "var(--text-muted)" }}>{label}</span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function StreakWidget() {
  const [data,    setData]    = useState<StreakData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/streak")
      .then((r) => r.ok ? r.json() as Promise<StreakData> : Promise.reject())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="glass p-4 animate-pulse">
        <div className="h-3 rounded-full w-1/3 mb-3" style={{ background: "rgba(255,255,255,0.07)" }} />
        <div className="h-16 rounded-xl" style={{ background: "rgba(255,255,255,0.04)" }} />
      </div>
    );
  }

  if (!data) return null;

  const streakLabel = data.currentStreak === 0
    ? "Commence aujourd'hui !"
    : data.currentStreak === 1
    ? "1 jour · continue !"
    : `${data.currentStreak} jours d'affilée 🎯`;

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
          <span className="text-base">🔥</span>
          <div>
            <p className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
              Régularité
            </p>
            <p className="text-[11px]" style={{ color: "var(--calories)" }}>{streakLabel}</p>
          </div>
        </div>
        {data.currentStreak >= 3 && (
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl"
            style={{ background: "rgba(249,115,22,0.12)", border: "1px solid rgba(249,115,22,0.3)" }}>
            <span className="text-[13px]">🔥</span>
            <span className="text-[15px] font-bold tabular-nums" style={{ color: "var(--calories)" }}>
              {data.currentStreak}
            </span>
          </div>
        )}
      </div>

      {/* Stats row */}
      <div className="flex items-stretch mb-4"
        style={{ borderRadius: 12, overflow: "hidden", background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
        <StatPill emoji="🏆" label="Record" value={data.longestStreak} sub="jours" />
        <div style={{ width: 1, background: "var(--border)", margin: "8px 0" }} />
        <StatPill emoji="📅" label="Jours loggés" value={data.totalLoggedDays} />
        <div style={{ width: 1, background: "var(--border)", margin: "8px 0" }} />
        <StatPill emoji="📊" label="Moy/semaine" value={data.weeklyAvgDays} sub="j/sem" />
      </div>

      {/* Heatmap */}
      <Heatmap days={data.heatmap} />
    </motion.div>
  );
}
