"use client";

import { motion } from "framer-motion";
import { format, parseISO, subDays } from "date-fns";
import {
  BarChart, Bar, Cell, XAxis, YAxis, ReferenceLine, ResponsiveContainer,
} from "recharts";
import type { FastingSession } from "@/app/api/fasting/route";
import type { IntermittentFasting } from "@/app/lib/types";

// Widget "Jeune intermittent" — extrait de ProgressClient.tsx.
export default function FastingTracker({
  sessions,
  config,
}: {
  sessions: FastingSession[];
  config:   IntermittentFasting | undefined;
}) {
  if (!config?.enabled || sessions.length === 0) return null;

  const durationH = config.durationH;
  const targetMs  = durationH * 3_600_000;

  // Only sessions that were actually started, most recent last, max 14
  const recent = [...sessions]
    .filter(s => s.startedAtMs != null)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-14);

  if (recent.length === 0) return null;

  // Build chart points
  const chartData = recent.map(s => {
    const endMs    = s.active ? Date.now() : (s.completedAtMs ?? (s.startedAtMs! + targetMs));
    const elapsedH = Math.min((endMs - s.startedAtMs!) / 3_600_000, durationH);
    const pct      = elapsedH / durationH;
    return {
      label:   format(parseISO(s.date), "d/M"),
      hours:   Math.round(elapsedH * 10) / 10,
      pct,
      active:  !!s.active,
    };
  });

  // Stats
  const withEnd   = sessions.filter(s => s.startedAtMs != null && (s.completedAtMs != null || s.active));
  const fullDone  = withEnd.filter(s => {
    const endMs = s.active ? Date.now() : (s.completedAtMs ?? 0);
    return (endMs - (s.startedAtMs ?? 0)) >= targetMs * 0.99;
  });
  const avgH = withEnd.length
    ? withEnd.reduce((sum, s) => {
        const endMs = s.active ? Date.now() : (s.completedAtMs ?? (s.startedAtMs! + targetMs));
        return sum + Math.min((endMs - s.startedAtMs!) / 3_600_000, durationH);
      }, 0) / withEnd.length
    : 0;

  // Streak — consecutive fully-completed sessions on scheduled days from today back
  let streak = 0;
  {
    const completedDates = new Set(
      sessions
        .filter(s => s.startedAtMs != null && s.completedAtMs != null &&
          ((s.completedAtMs - s.startedAtMs!) >= targetMs * 0.99))
        .map(s => s.date),
    );
    for (let i = 0; i < 60; i++) {
      const d   = format(subDays(new Date(), i), "yyyy-MM-dd");
      const dow = parseISO(d).getDay();
      if (!config.days.includes(dow)) continue;  // not a scheduled day, skip
      if (completedDates.has(d)) streak++;
      else break;
    }
  }

  function barFill(pct: number, active: boolean): string {
    if (active)    return "var(--calories)";
    if (pct >= 1)  return "var(--ok)";
    if (pct >= 0.75) return "#86efac";
    if (pct >= 0.5)  return "var(--carbs)";
    return "#a855f7";
  }

  // Custom bar label (hours value)
  const CustomLabel = ({ x, y, width, value }: { x?: number; y?: number; width?: number; value?: number }) => {
    if (!value || !width || width < 16) return null;
    return (
      <text x={(x ?? 0) + (width ?? 0) / 2} y={(y ?? 0) - 3}
        textAnchor="middle" fontSize={8} fill="rgba(250,250,250,0.45)" fontFamily="inherit">
        {value}h
      </text>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut", delay: 0.18 }}
      className="mb-4 glass px-4 pt-4 pb-3"
    >
      {/* Header + stats */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 13 }}>🌿</span>
          <p className="text-[12px] font-semibold" style={{ color: "var(--text-primary)" }}>
            Jeûne Intermittent · {durationH}h
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {streak > 0 && (
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: "rgba(34,197,94,0.15)", color: "var(--ok)", border: "1px solid rgba(34,197,94,0.3)" }}>
              {streak}🔥
            </span>
          )}
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
            style={{ background: "rgba(129,140,248,0.12)", color: "var(--fit-indigo)", border: "1px solid rgba(129,140,248,0.25)" }}>
            {withEnd.length} / {fullDone.length} ✓
          </span>
          {avgH > 0 && (
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
              style={{ background: "rgba(251,191,36,0.1)", color: "var(--carbs)", border: "1px solid rgba(251,191,36,0.25)" }}>
              ⌀ {avgH.toFixed(1)}h
            </span>
          )}
        </div>
      </div>

      {/* Bar chart — one bar per session */}
      <ResponsiveContainer width="100%" height={88}>
        <BarChart data={chartData} margin={{ top: 14, right: 2, left: -28, bottom: 0 }} barCategoryGap="22%">
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "rgba(250,250,250,0.3)" }}
            axisLine={false} tickLine={false}
          />
          <YAxis domain={[0, durationH + durationH * 0.1]} hide />
          <ReferenceLine
            y={durationH}
            stroke="rgba(34,197,94,0.35)"
            strokeDasharray="4 3"
            label={{ value: `${durationH}h`, position: "insideTopRight", fontSize: 11, fill: "rgba(34,197,94,0.6)" }}
          />
          <Bar dataKey="hours" radius={[4, 4, 2, 2]} label={<CustomLabel />}>
            {chartData.map((d, i) => (
              <Cell key={i} fill={barFill(d.pct, d.active)} fillOpacity={0.85} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex items-center gap-3 mt-1">
        {[
          { c: "#a855f7", label: "< 50%" },
          { c: "var(--carbs)", label: "50-74%" },
          { c: "#86efac", label: "75-99%" },
          { c: "var(--ok)", label: "100% ✓" },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-sm" style={{ background: l.c }} />
            <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{l.label}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
