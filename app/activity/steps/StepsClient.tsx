"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import {
  ArrowLeft, Footprints, Lightning, Fire, CheckCircle, Trophy,
  ArrowUp, ArrowDown, Minus, Flame, Target,
} from "@phosphor-icons/react";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ReferenceLine, CartesianGrid, Cell,
} from "recharts";
import type { StepsPoint } from "./page";
import { levelBarBg, levelBarClip, levelColor } from "@/app/lib/colors";

interface Props { points: StepsPoint[]; stepsGoal: number }

const RANGES = [
  { label: "7J",  days: 7  },
  { label: "14J", days: 14 },
  { label: "30J", days: 30 },
] as const;

const ease = [0.16, 1, 0.3, 1] as [number, number, number, number];
const fade = (delay = 0) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, ease, delay },
});

function stepsColor(steps: number, goal: number): string { return levelColor(steps / goal); }

function stepsLabel(steps: number, goal: number): { label: string; color: string } {
  const pct = steps / goal;
  const color = levelColor(pct);
  if (pct >= 1.0) return { label: "Objectif atteint 🎉", color };
  if (pct >= 0.8) return { label: "Presque !", color };
  if (pct >= 0.5) return { label: "En bonne voie", color };
  return { label: "Encore un effort", color };
}

export default function StepsClient({ points, stepsGoal }: Props) {
  const [rangeDays, setRangeDays] = useState<7 | 14 | 30>(30);

  const visible    = points.slice(-rangeDays);
  const withSteps  = visible.filter((p) => p.steps > 0);
  const today      = visible[visible.length - 1];
  const todaySteps = today?.steps ?? 0;
  const prevSteps  = visible[visible.length - 2]?.steps ?? null;
  const delta      = todaySteps > 0 && prevSteps !== null ? todaySteps - prevSteps : null;

  // Stats
  const avgSteps  = withSteps.length ? Math.round(withSteps.reduce((s, p) => s + p.steps, 0) / withSteps.length) : 0;
  const bestDay   = withSteps.length ? Math.max(...withSteps.map((p) => p.steps)) : 0;
  const bestDate  = withSteps.find((p) => p.steps === bestDay)?.date ?? null;
  const goalDays  = withSteps.filter((p) => p.steps >= stepsGoal).length;
  const goalRate  = withSteps.length ? Math.round(goalDays / withSteps.length * 100) : 0;

  // Streak: consecutive days (from most recent) hitting goal
  let streak = 0;
  for (let i = points.length - 1; i >= 0; i--) {
    if (points[i].steps >= stepsGoal) streak++;
    else break;
  }

  // 7 vs previous 7
  const last7  = points.slice(-7).filter((p) => p.steps > 0);
  const prev7  = points.slice(-14, -7).filter((p) => p.steps > 0);
  const avg7   = last7.length  ? Math.round(last7.reduce((s, p) => s + p.steps, 0) / last7.length)  : null;
  const avgP7  = prev7.length  ? Math.round(prev7.reduce((s, p) => s + p.steps, 0) / prev7.length)  : null;
  const weekDelta = avg7 !== null && avgP7 !== null ? avg7 - avgP7 : null;

  // Active minutes / calories
  const avgActive = withSteps.length
    ? Math.round(withSteps.filter(p => p.activeMinutes > 0).reduce((s, p) => s + p.activeMinutes, 0)
        / Math.max(1, withSteps.filter(p => p.activeMinutes > 0).length))
    : 0;
  const totalCal = withSteps.reduce((s, p) => s + p.activeCalories, 0);

  const chartData = visible.map((p) => ({
    ...p,
    label: format(parseISO(p.date), "dd/MM"),
    goalLine: stepsGoal,
  }));

  const todayInfo = todaySteps > 0 ? stepsLabel(todaySteps, stepsGoal) : null;
  const pctToday  = Math.min((todaySteps / stepsGoal) * 100, 100);

  return (
    <div className="relative min-h-screen">
      <div className="bg-orbs" />
      <div className="relative z-10 max-w-md mx-auto px-4 py-6 md:ml-[220px] md:max-w-2xl" style={{ paddingBottom: "80px" }}>

        {/* Header */}
        <motion.div {...fade(0)} className="flex items-center gap-3 mb-6">
          <Link href="/dashboard" className="p-2 rounded-xl transition-opacity active:opacity-60"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)" }}>
            <ArrowLeft size={16} style={{ color: "var(--text-secondary)" }} />
          </Link>
          <div>
            <h1 className="text-[20px] font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
              Pas
            </h1>
            <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
              Historique activité · objectif {stepsGoal.toLocaleString("fr-FR")} pas
            </p>
          </div>
        </motion.div>

        {/* Today hero card */}
        <motion.div {...fade(0.05)} className="glass p-5 mb-4">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <p className="label-xs mb-1">Aujourd'hui</p>
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-[42px] font-bold leading-none tabular-nums"
                  style={{ color: todaySteps > 0 ? stepsColor(todaySteps, stepsGoal) : "var(--text-muted)" }}>
                  {todaySteps > 0 ? todaySteps.toLocaleString("fr-FR") : "—"}
                </span>
                {todaySteps > 0 && (
                  <span className="text-[14px]" style={{ color: "var(--text-muted)" }}>
                    / {stepsGoal.toLocaleString("fr-FR")} pas
                  </span>
                )}
              </div>
              {todayInfo && (
                <div className="flex items-center gap-1.5 mt-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: todayInfo.color }} />
                  <span className="text-[12px] font-medium" style={{ color: todayInfo.color }}>{todayInfo.label}</span>
                </div>
              )}
            </div>
            {delta !== null && (
              <div className="flex flex-col items-end gap-1 ml-3">
                <div className="flex items-center gap-1 px-2 py-1 rounded-lg text-[12px] font-medium"
                  style={{
                    background: delta === 0 ? "rgba(255,255,255,0.05)" : delta > 0 ? "rgba(52,168,83,0.1)" : "rgba(234,67,53,0.1)",
                    color: delta === 0 ? "var(--text-muted)" : delta > 0 ? "var(--fit-green)" : "var(--fit-red)",
                  }}>
                  {delta > 0 ? <ArrowUp size={12} weight="bold" /> : delta < 0 ? <ArrowDown size={12} weight="bold" /> : <Minus size={12} weight="bold" />}
                  {Math.abs(delta).toLocaleString("fr-FR")}
                </div>
                <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>vs hier</span>
              </div>
            )}
          </div>
          {/* Progress bar */}
          {todaySteps > 0 && (
            <div className="mt-4">
              <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
                <motion.div
                  className="h-full rounded-full w-full"
                  style={{ background: levelBarBg(pctToday / 100) }}
                  initial={{ clipPath: "inset(0 100% 0 0)" }}
                  animate={{ clipPath: levelBarClip(pctToday / 100) }}
                  transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>0</span>
                <span className="text-[10px] font-medium tabular-nums"
                  style={{ color: stepsColor(todaySteps, stepsGoal) }}>
                  {Math.round(pctToday)}%
                </span>
                <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{stepsGoal.toLocaleString("fr-FR")}</span>
              </div>
            </div>
          )}
        </motion.div>

        {/* Stats grid */}
        <motion.div {...fade(0.08)} className="grid grid-cols-4 gap-2.5 mb-4">
          {[
            { label: "Moyenne", value: avgSteps > 0 ? avgSteps.toLocaleString("fr-FR") : "—", icon: <Footprints size={13} style={{ color: "var(--steps)" }} />, color: "var(--steps)" },
            { label: "Record",  value: bestDay  > 0 ? bestDay.toLocaleString("fr-FR")  : "—", icon: <Trophy size={13} style={{ color: "#FBBC04" }} />, color: "#FBBC04" },
            { label: "Jours obj.", value: `${goalDays}j`, icon: <Target size={13} style={{ color: "#34A853" }} />, color: "#34A853" },
            { label: "Streak", value: streak > 0 ? `${streak}j` : "—", icon: <Flame size={13} style={{ color: "#f97316" }} />, color: "#f97316" },
          ].map(({ label, value, icon, color }) => (
            <div key={label} className="card flex flex-col gap-1 items-center text-center p-2.5">
              <div className="flex items-center gap-1">{icon}</div>
              <span className="text-[15px] font-bold tabular-nums" style={{ color }}>{value}</span>
              <span className="text-[9px] leading-tight" style={{ color: "var(--text-muted)" }}>{label}</span>
            </div>
          ))}
        </motion.div>

        {/* Secondary stats */}
        <motion.div {...fade(0.09)} className="grid grid-cols-3 gap-2.5 mb-4">
          {[
            { label: "Taux objectif", value: `${goalRate}%`, icon: <CheckCircle size={12} style={{ color: goalRate >= 70 ? "#34A853" : "#FBBC04" }} />, color: goalRate >= 70 ? "#34A853" : "#FBBC04" },
            { label: "Min. actives", value: avgActive > 0 ? `${avgActive} min` : "—", icon: <Lightning size={12} weight="fill" style={{ color: "var(--fit-green)" }} />, color: "var(--fit-green)" },
            { label: "Kcal actives", value: totalCal > 0 ? `${Math.round(totalCal).toLocaleString("fr-FR")}` : "—", icon: <Fire size={12} weight="fill" style={{ color: "var(--calories)" }} />, color: "var(--calories)" },
          ].map(({ label, value, icon, color }) => (
            <div key={label} className="card flex flex-col gap-1">
              <div className="flex items-center gap-1">{icon}<span className="label-xs">{label}</span></div>
              <span className="text-[16px] font-bold tabular-nums" style={{ color }}>{value}</span>
            </div>
          ))}
        </motion.div>

        {/* Weekly trend */}
        {weekDelta !== null && (
          <motion.div {...fade(0.1)} className="flex items-center gap-2 px-3 py-2 rounded-xl mb-4 text-[12px]"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)" }}>
            {weekDelta === 0
              ? <><CheckCircle size={15} style={{ color: "var(--fit-green)" }} /><span style={{ color: "var(--text-secondary)" }}>Stable sur 7 jours</span></>
              : weekDelta > 0
                ? <><CheckCircle size={15} style={{ color: "var(--fit-green)" }} /><span style={{ color: "var(--text-secondary)" }}>+<strong style={{ color: "var(--fit-green)" }}>{weekDelta.toLocaleString("fr-FR")}</strong> pas/j en moyenne cette semaine</span></>
                : <><ArrowDown size={15} style={{ color: "#fbbf24" }} /><span style={{ color: "var(--text-secondary)" }}><strong style={{ color: "#fbbf24" }}>{Math.abs(weekDelta).toLocaleString("fr-FR")}</strong> pas/j de moins cette semaine</span></>
            }
          </motion.div>
        )}

        {/* Record badge */}
        {bestDate && bestDay > 0 && (
          <motion.div {...fade(0.11)} className="flex items-center gap-2.5 px-3 py-2 rounded-xl mb-4"
            style={{ background: "rgba(251,188,4,0.06)", border: "1px solid rgba(251,188,4,0.2)" }}>
            <Trophy size={18} style={{ color: "#FBBC04" }} />
            <div>
              <p className="text-[12px] font-medium" style={{ color: "var(--text-secondary)" }}>
                Record sur {rangeDays} jours : <strong style={{ color: "#FBBC04" }}>{bestDay.toLocaleString("fr-FR")} pas</strong>
              </p>
              <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                {format(parseISO(bestDate), "EEEE d MMMM", { locale: fr })}
              </p>
            </div>
          </motion.div>
        )}

        {/* Range selector */}
        <motion.div {...fade(0.12)} className="flex gap-2 mb-4">
          {RANGES.map(({ label, days }) => (
            <button key={days}
              onClick={() => setRangeDays(days as 7 | 14 | 30)}
              className="px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all"
              style={{
                background: rangeDays === days ? "var(--surface-active)" : "rgba(255,255,255,0.04)",
                color:      rangeDays === days ? "var(--text-primary)"   : "var(--text-muted)",
                border:     rangeDays === days ? "1px solid var(--border-strong)" : "1px solid transparent",
              }}>
              {label}
            </button>
          ))}
        </motion.div>

        {/* Steps history chart */}
        <motion.div {...fade(0.14)} className="glass p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <p className="label-xs">Évolution des pas</p>
            {avgSteps > 0 && (
              <span className="text-[11px] tabular-nums" style={{ color: "var(--steps)" }}>
                moy. {avgSteps.toLocaleString("fr-FR")} /j
              </span>
            )}
          </div>
          {withSteps.length > 0 ? (
            <ResponsiveContainer width="100%" height={150}>
              <BarChart data={chartData} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 9, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 9, fill: "var(--text-muted)" }} tickLine={false} axisLine={false}
                  tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`} />
                <Tooltip content={({ active, payload, label: lbl }) => {
                  if (!active || !payload?.length || !payload[0]?.value) return null;
                  const val = payload[0].value as number;
                  const color = stepsColor(val, stepsGoal);
                  return (
                    <div className="px-3 py-2 rounded-xl text-[11px] space-y-0.5"
                      style={{ background: "rgba(13,13,17,0.96)", border: "1px solid var(--border)" }}>
                      <p style={{ color: "var(--text-muted)" }}>{lbl}</p>
                      <p className="font-bold text-[14px]" style={{ color }}>{val.toLocaleString("fr-FR")} pas</p>
                      <p style={{ color: "var(--text-muted)" }}>{Math.round(val / stepsGoal * 100)}% de l&apos;objectif</p>
                    </div>
                  );
                }} />
                <ReferenceLine y={stepsGoal} stroke="rgba(56,189,248,0.35)" strokeDasharray="4 3"
                  label={{ value: `${(stepsGoal / 1000).toFixed(0)}k`, fill: "rgba(56,189,248,0.7)", fontSize: 8, position: "right" }} />
                <Bar dataKey="steps" radius={[3, 3, 0, 0]}>
                  {chartData.map((p, i) => (
                    <Cell key={i} fill={p.steps > 0 ? stepsColor(p.steps, stepsGoal) : "rgba(255,255,255,0.08)"} fillOpacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[100px]">
              <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>Pas de données sur cette période</p>
            </div>
          )}
          {/* Color legend */}
          <div className="flex flex-wrap gap-3 mt-3 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
            {[
              { label: "Objectif atteint ≥ 100%", color: "#34A853" },
              { label: "Presque  ≥ 70%",          color: "#FBBC04" },
              { label: "< 70%",                   color: "var(--fit-red)" },
            ].map(({ label, color }) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
                <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{label}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Active minutes chart */}
        {visible.some(p => p.activeMinutes > 0) && (
          <motion.div {...fade(0.16)} className="glass p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <p className="label-xs">Minutes actives</p>
              {avgActive > 0 && (
                <span className="text-[11px]" style={{ color: "var(--fit-green)" }}>moy. {avgActive} min/j</span>
              )}
            </div>
            <ResponsiveContainer width="100%" height={90}>
              <AreaChart data={chartData} margin={{ top: 2, right: 4, left: -24, bottom: 0 }}>
                <defs>
                  <linearGradient id="actGrad2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#34A853" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#34A853" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" tick={{ fontSize: 9, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 9, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} />
                <Tooltip content={({ active, payload, label: lbl }) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <div className="px-2.5 py-1.5 rounded-lg text-[11px]"
                      style={{ background: "rgba(13,13,17,0.96)", border: "1px solid var(--border)" }}>
                      <p style={{ color: "var(--text-muted)" }}>{lbl}</p>
                      <p style={{ color: "var(--fit-green)" }} className="font-bold">{payload[0]?.value} min</p>
                    </div>
                  );
                }} />
                <ReferenceLine y={30} stroke="rgba(52,168,83,0.3)" strokeDasharray="4 3" />
                <Area type="monotone" dataKey="activeMinutes" stroke="#34A853" strokeWidth={1.5} fill="url(#actGrad2)" dot={false} connectNulls />
              </AreaChart>
            </ResponsiveContainer>
            <p className="text-[10px] mt-2" style={{ color: "var(--text-muted)" }}>Trait pointillé = recommandation OMS 30 min</p>
          </motion.div>
        )}

        {/* Calories brûlées chart */}
        {visible.some(p => p.activeCalories > 0) && (
          <motion.div {...fade(0.17)} className="glass p-4 mb-4">
            <p className="label-xs mb-3">Calories actives</p>
            <ResponsiveContainer width="100%" height={90}>
              <AreaChart data={chartData} margin={{ top: 2, right: 4, left: -24, bottom: 0 }}>
                <defs>
                  <linearGradient id="calBurnGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#f97316" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" tick={{ fontSize: 9, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 9, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} />
                <Tooltip content={({ active, payload, label: lbl }) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <div className="px-2.5 py-1.5 rounded-lg text-[11px]"
                      style={{ background: "rgba(13,13,17,0.96)", border: "1px solid var(--border)" }}>
                      <p style={{ color: "var(--text-muted)" }}>{lbl}</p>
                      <p style={{ color: "var(--calories)" }} className="font-bold">{payload[0]?.value} kcal</p>
                    </div>
                  );
                }} />
                <Area type="monotone" dataKey="activeCalories" stroke="var(--calories)" strokeWidth={1.5} fill="url(#calBurnGrad)" dot={false} connectNulls />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>
        )}

        {/* Daily log table */}
        <motion.div {...fade(0.2)} className="glass p-4">
          <p className="label-xs mb-3">Détail quotidien</p>
          <div className="space-y-0.5">
            {[...visible].reverse().slice(0, 14).map((p) => {
              const color = p.steps > 0 ? stepsColor(p.steps, stepsGoal) : "var(--text-muted)";
              const pct   = p.steps > 0 ? Math.min(p.steps / stepsGoal * 100, 100) : 0;
              return (
                <div key={p.date} className="py-2"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <div className="flex items-center gap-3 mb-1.5">
                    <span className="text-[11px] w-[56px] flex-shrink-0" style={{ color: "var(--text-muted)" }}>
                      {format(parseISO(p.date), "dd MMM", { locale: fr })}
                    </span>
                    {/* Steps */}
                    <div className="flex items-center gap-1 flex-1">
                      <Footprints size={11} style={{ color }} />
                      <span className="text-[13px] font-semibold tabular-nums" style={{ color }}>
                        {p.steps > 0 ? p.steps.toLocaleString("fr-FR") : "—"}
                      </span>
                    </div>
                    {/* Active min */}
                    {p.activeMinutes > 0 && (
                      <div className="flex items-center gap-1">
                        <Lightning size={11} style={{ color: "var(--fit-green)" }} />
                        <span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>{p.activeMinutes}min</span>
                      </div>
                    )}
                    {/* Calories */}
                    {p.activeCalories > 0 && (
                      <div className="flex items-center gap-1">
                        <Fire size={11} style={{ color: "var(--calories)" }} />
                        <span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>{Math.round(p.activeCalories)}</span>
                      </div>
                    )}
                    {/* Goal badge */}
                    {p.steps >= stepsGoal && (
                      <CheckCircle size={14} weight="fill" style={{ color: "#34A853", flexShrink: 0 }} />
                    )}
                  </div>
                  {/* Mini progress bar */}
                  {p.steps > 0 && (
                    <div className="h-1 rounded-full overflow-hidden ml-[68px]" style={{ background: "rgba(255,255,255,0.06)" }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color, opacity: 0.7 }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </motion.div>

      </div>
    </div>
  );
}
