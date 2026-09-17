"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format as dateFmt, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { IconChevronDown } from "@tabler/icons-react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import type { ActivityHistoryPoint } from "@/app/activity/page";

// Historique 14 jours (pas + sport) avec graphique combine — extrait de
// ActivityClient.tsx.
export default function ActivityHistory({ history, stepsGoal }: { history: ActivityHistoryPoint[]; stepsGoal: number }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const chartData = history.map(p => ({
    label:     dateFmt(parseISO(p.date), "dd/MM"),
    date:      p.date,
    steps:     p.steps,
    sportMin:  p.sportMin,
    sportKcal: p.sportKcal || null,
  }));

  const maxSteps = Math.max(...history.map(p => p.steps), stepsGoal);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.15 }}
      className="space-y-4 mt-2"
    >
      {/* ── Chart ── */}
      <div className="glass p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="label-xs">Activité · 14 derniers jours</p>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ background: "rgba(99,179,237,0.7)" }} />
              <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>Pas</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--calories)" }} />
              <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>Sport (min)</span>
            </div>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={130}>
          <ComposedChart data={chartData} margin={{ top: 4, right: 4, left: -30, bottom: 0 }} barGap={2}>
            <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} />
            <YAxis yAxisId="steps" orientation="left" tick={{ fontSize: 11, fill: "var(--text-muted)" }} tickLine={false} axisLine={false}
              tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} domain={[0, maxSteps * 1.1]} />
            <YAxis yAxisId="sport" orientation="right" tick={{ fontSize: 11, fill: "rgba(249,115,22,0.6)" }} tickLine={false} axisLine={false} />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const steps = (payload.find(p => p.dataKey === "steps")?.value as number) ?? 0;
                const sport = (payload.find(p => p.dataKey === "sportMin")?.value as number) ?? 0;
                return (
                  <div className="px-3 py-2 rounded-xl text-[11px] space-y-1"
                    style={{ background: "rgba(13,13,17,0.96)", border: "1px solid var(--border)" }}>
                    <p style={{ color: "var(--text-muted)" }}>{label}</p>
                    {steps > 0 && <p style={{ color: "#63b3ed" }}>👟 {steps.toLocaleString("fr-FR")} pas</p>}
                    {sport > 0 && <p style={{ color: "var(--calories)" }}>🏅 {sport} min sport</p>}
                  </div>
                );
              }}
            />
            {/* Steps goal reference line */}
            <Bar yAxisId="steps" dataKey="steps" radius={[3, 3, 0, 0]} maxBarSize={18}
              fill="rgba(99,179,237,0.55)" />
            <Line yAxisId="sport" dataKey="sportMin" type="monotone"
              stroke="var(--calories)" strokeWidth={2} dot={{ fill: "var(--calories)", r: 3, strokeWidth: 0 }}
              connectNulls={false} />
          </ComposedChart>
        </ResponsiveContainer>

        {/* Summary stats */}
        {(() => {
          const totalSport  = history.reduce((a, p) => a + p.sportMin, 0);
          const activeDays  = history.filter(p => p.sportMin > 0 || p.steps >= stepsGoal * 0.7).length;
          const avgSteps    = history.length > 0 ? Math.round(history.reduce((a, p) => a + p.steps, 0) / history.length) : 0;
          return (
            <div className="flex gap-3 mt-3 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
              {[
                { v: `${activeDays}j`, l: "jours actifs" },
                { v: `${totalSport}min`, l: "sport total" },
                { v: avgSteps >= 1000 ? `${(avgSteps / 1000).toFixed(1)}k` : String(avgSteps), l: "pas moy." },
              ].map(({ v, l }) => (
                <div key={l} className="flex-1 text-center">
                  <p className="text-[15px] font-bold" style={{ color: "var(--text-primary)" }}>{v}</p>
                  <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{l}</p>
                </div>
              ))}
            </div>
          );
        })()}
      </div>

      {/* ── Day list ── */}
      <div className="glass p-4">
        <p className="label-xs mb-3">Journal des 13 derniers jours</p>
        <div className="space-y-0">
          {[...history].reverse().map(p => {
            const hasActivity = p.sportMin > 0 || p.steps > 0;
            const stepsOk     = p.steps >= stepsGoal * 0.7;
            const isOpen      = expanded === p.date;
            return (
              <div key={p.date} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <button
                  className="w-full flex items-center gap-3 py-2.5 transition-opacity active:opacity-60"
                  onClick={() => setExpanded(isOpen ? null : p.date)}
                >
                  {/* Date */}
                  <span className="text-[11px] w-[44px] flex-shrink-0 text-left tabular-nums"
                    style={{ color: "var(--text-muted)" }}>
                    {dateFmt(parseISO(p.date), "dd MMM", { locale: fr })}
                  </span>

                  {/* Steps pill */}
                  <div className="flex items-center gap-1 w-[60px] flex-shrink-0">
                    {p.steps > 0 ? (
                      <>
                        <span className="text-[11px]">👟</span>
                        <span className="text-[11px] font-semibold tabular-nums"
                          style={{ color: stepsOk ? "var(--fit-green)" : "var(--text-secondary)" }}>
                          {p.steps >= 1000 ? `${(p.steps / 1000).toFixed(1)}k` : String(p.steps)}
                        </span>
                      </>
                    ) : (
                      <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>—</span>
                    )}
                  </div>

                  {/* Sport badges */}
                  <div className="flex-1 flex items-center gap-1 flex-wrap min-w-0">
                    {p.sessions.slice(0, 3).map((s, i) => (
                      <span key={i} className="text-[11px] px-1.5 py-0.5 rounded-md flex-shrink-0"
                        style={{ background: "rgba(249,115,22,0.1)", color: "var(--calories)", fontSize: 11 }}>
                        {s.emoji} {s.durationMin}min
                      </span>
                    ))}
                    {p.sessions.length === 0 && (
                      <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>Repos</span>
                    )}
                  </div>

                  {/* Kcal */}
                  {(p.activeKcal > 0 || p.sportKcal > 0) && (
                    <span className="text-[11px] font-medium flex-shrink-0 tabular-nums"
                      style={{ color: "var(--fiber)" }}>
                      {Math.round(Math.max(p.activeKcal, p.sportKcal))} kcal
                    </span>
                  )}

                  {/* Expand chevron */}
                  {p.sessions.length > 0 && (
                    <motion.span animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}
                      style={{ color: "var(--text-muted)", flexShrink: 0 }}>
                      <IconChevronDown size={12} />
                    </motion.span>
                  )}
                </button>

                {/* Expanded session detail */}
                <AnimatePresence>
                  {isOpen && p.sessions.length > 0 && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      style={{ overflow: "hidden" }}
                    >
                      <div className="pb-2 pl-[56px] space-y-1.5">
                        {p.sessions.map((s, i) => (
                          <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg"
                            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                            <span className="text-[14px] flex-shrink-0">{s.emoji}</span>
                            <span className="flex-1 text-[12px] font-medium truncate"
                              style={{ color: "var(--text-secondary)" }}>{s.name}</span>
                            <span className="text-[11px] tabular-nums flex-shrink-0"
                              style={{ color: "var(--text-muted)" }}>{s.durationMin} min</span>
                            {s.calories && (
                              <span className="text-[11px] tabular-nums flex-shrink-0"
                                style={{ color: "var(--fiber)" }}>{Math.round(s.calories)} kcal</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Horizontal steps bar */}
                {!hasActivity ? null : (
                  <div className="pb-1 pl-[44px] pr-2">
                    <div className="h-0.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min((p.steps / stepsGoal) * 100, 100)}%`,
                          background: stepsOk ? "rgba(52,168,83,0.5)" : "rgba(99,179,237,0.35)",
                        }} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
