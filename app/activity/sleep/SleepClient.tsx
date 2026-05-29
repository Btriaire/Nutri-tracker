"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { ArrowLeft, Moon, CheckCircle, Trophy, ArrowUp, ArrowDown, Minus } from "@phosphor-icons/react";
import {
  ResponsiveContainer, BarChart, Bar,
  XAxis, YAxis, Tooltip, ReferenceLine, Cell,
} from "recharts";
import SleepHypnogram from "@/app/components/SleepHypnogram";
import type { SleepPoint } from "./page";

interface Props { points: SleepPoint[]; sleepGoalMin: number }

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

function sleepColor(min: number | null, goal: number): string {
  if (!min) return "rgba(121,134,203,0.25)";
  const pct = min / goal;
  if (pct >= 1.0) return "#34A853";
  if (pct >= 0.8) return "#7986CB";
  if (pct >= 0.6) return "#FBBC04";
  return "#ef4444";
}

function fmtSleep(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

function trendIcon(avg: number, prev: number) {
  const diff = avg - prev;
  if (Math.abs(diff) < 5) return <Minus size={12} style={{ color: "var(--text-muted)" }} />;
  if (diff > 0) return <ArrowUp size={12} style={{ color: "#34A853" }} />;
  return <ArrowDown size={12} style={{ color: "#ef4444" }} />;
}

export default function SleepClient({ points, sleepGoalMin }: Props) {
  const [rangeDays, setRangeDays] = useState<7 | 14 | 30>(30);

  const visible   = points.slice(-rangeDays);
  const withData  = visible.filter(p => p.sleepMinutes != null && p.sleepMinutes > 0);
  const goalH     = Math.round(sleepGoalMin / 60 * 10) / 10;

  // Stats
  const avgMin    = withData.length ? Math.round(withData.reduce((s, p) => s + p.sleepMinutes!, 0) / withData.length) : 0;
  const maxPoint  = withData.length ? withData.reduce((a, b) => b.sleepMinutes! > a.sleepMinutes! ? b : a) : null;
  const goalDays  = withData.filter(p => p.sleepMinutes! >= sleepGoalMin).length;

  // Streak (consecutive days with ≥ goal, from most recent)
  let streak = 0;
  for (let i = points.length - 1; i >= 0; i--) {
    const p = points[i];
    if (p.sleepMinutes != null && p.sleepMinutes >= sleepGoalMin) streak++;
    else if (p.sleepMinutes != null) break;
  }

  // Weekly trend comparison
  const last7  = points.slice(-7).filter(p => p.sleepMinutes != null && p.sleepMinutes > 0);
  const prev7  = points.slice(-14, -7).filter(p => p.sleepMinutes != null && p.sleepMinutes > 0);
  const avg7   = last7.length  ? Math.round(last7.reduce((s,p)  => s + p.sleepMinutes!, 0) / last7.length)  : 0;
  const avgP7  = prev7.length  ? Math.round(prev7.reduce((s,p)  => s + p.sleepMinutes!, 0) / prev7.length)  : 0;
  const trendDiff = avg7 - avgP7;

  // Chart data
  const chartData = visible.map(p => ({
    label:  format(parseISO(p.date), "dd/MM"),
    sleepH: p.sleepMinutes != null ? Math.round(p.sleepMinutes / 60 * 100) / 100 : null,
    sleepMin: p.sleepMinutes,
    date:   p.date,
  }));

  // Most recent sleep with data — for hypnogram
  const lastSleep = [...points].reverse().find(p => p.sleepMinutes != null && p.sleepMinutes > 0);

  return (
    <div className="min-h-screen" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 80px)" }}>
      {/* Header */}
      <div className="sticky top-0 z-20 flex items-center gap-3 px-4 py-3"
        style={{ background: "var(--nav-bg)", borderBottom: "1px solid var(--nav-border)", backdropFilter: "blur(16px)" }}>
        <Link href="/dashboard" className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors"
          style={{ background: "var(--surface)" }}>
          <ArrowLeft size={16} style={{ color: "var(--text-secondary)" }} />
        </Link>
        <div className="flex items-center gap-2">
          <Moon size={18} weight="fill" style={{ color: "#7986CB" }} />
          <span className="text-[15px] font-semibold">Sommeil</span>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4 md:ml-[220px]">

        {/* Hero card */}
        <motion.div {...fade(0)} className="glass p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-[11px] font-medium mb-1" style={{ color: "var(--text-muted)" }}>Moyenne sur {rangeDays} jours</p>
              <div className="flex items-end gap-2 leading-none">
                <span className="text-[38px] font-bold tracking-tight" style={{ color: avgMin ? "var(--text-primary)" : "var(--text-muted)" }}>
                  {avgMin ? fmtSleep(avgMin) : "—"}
                </span>
                <span className="text-[13px] mb-1.5" style={{ color: "var(--text-muted)" }}>/ {goalH}h objectif</span>
              </div>
            </div>
            {/* Trend badge */}
            {avgP7 > 0 && (
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium"
                style={{ background: trendDiff >= 0 ? "rgba(52,168,83,0.1)" : "rgba(239,68,68,0.1)", color: trendDiff >= 0 ? "#34A853" : "#ef4444" }}>
                {trendDiff >= 0 ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
                {fmtSleep(Math.abs(trendDiff))} vs sem. préc.
              </div>
            )}
          </div>

          {/* Progress bar */}
          <div className="w-full h-2.5 rounded-full mb-2" style={{ background: "rgba(255,255,255,0.06)" }}>
            <motion.div className="h-full rounded-full"
              style={{ background: sleepColor(avgMin, sleepGoalMin) }}
              initial={{ width: 0 }}
              animate={{ width: `${avgMin ? Math.min(avgMin / sleepGoalMin * 100, 100) : 0}%` }}
              transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
          <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
            {avgMin >= sleepGoalMin ? `✓ Objectif atteint en moyenne sur ${rangeDays}j` : `${fmtSleep(sleepGoalMin - avgMin)} de moins que l'objectif`}
          </p>
        </motion.div>

        {/* Stats grid */}
        <motion.div {...fade(0.05)} className="grid grid-cols-2 gap-3">
          <div className="glass p-4 flex flex-col gap-1">
            <span className="text-[10px] font-medium" style={{ color: "var(--text-muted)" }}>Record</span>
            <div className="flex items-center gap-1.5">
              <Trophy size={14} weight="fill" style={{ color: "#FBBC04" }} />
              <span className="text-[18px] font-bold">{maxPoint ? fmtSleep(maxPoint.sleepMinutes!) : "—"}</span>
            </div>
            {maxPoint && (
              <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                {format(parseISO(maxPoint.date), "dd MMM", { locale: fr })}
              </span>
            )}
          </div>

          <div className="glass p-4 flex flex-col gap-1">
            <span className="text-[10px] font-medium" style={{ color: "var(--text-muted)" }}>Objectif atteint</span>
            <div className="flex items-center gap-1.5">
              <CheckCircle size={14} weight="fill" style={{ color: "#34A853" }} />
              <span className="text-[18px] font-bold">{goalDays} <span className="text-[12px] font-normal" style={{ color: "var(--text-muted)" }}>/ {withData.length}j</span></span>
            </div>
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
              {withData.length ? `${Math.round(goalDays / withData.length * 100)}% du temps` : "Aucune donnée"}
            </span>
          </div>

          <div className="glass p-4 flex flex-col gap-1">
            <span className="text-[10px] font-medium" style={{ color: "var(--text-muted)" }}>Série en cours</span>
            <span className="text-[18px] font-bold">{streak} <span className="text-[12px] font-normal" style={{ color: "var(--text-muted)" }}>nuits</span></span>
            <span className="text-[10px]" style={{ color: streak >= 3 ? "#34A853" : "var(--text-muted)" }}>
              {streak >= 7 ? "🔥 Excellente semaine !" : streak >= 3 ? "Bonne régularité" : "Continue !"}
            </span>
          </div>

          <div className="glass p-4 flex flex-col gap-1">
            <span className="text-[10px] font-medium" style={{ color: "var(--text-muted)" }}>Tendance 7j</span>
            <div className="flex items-center gap-1.5">
              {trendIcon(avg7, avgP7)}
              <span className="text-[18px] font-bold">{avg7 ? fmtSleep(avg7) : "—"}</span>
            </div>
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
              {avgP7 ? `vs ${fmtSleep(avgP7)} sem. préc.` : "Pas assez de données"}
            </span>
          </div>
        </motion.div>

        {/* Range selector + Bar chart */}
        <motion.div {...fade(0.1)} className="glass p-4">
          <div className="flex items-center justify-between mb-4">
            <p className="label-xs">Historique</p>
            <div className="flex gap-1">
              {RANGES.map(r => (
                <button key={r.days}
                  onClick={() => setRangeDays(r.days as 7 | 14 | 30)}
                  className="px-2.5 py-1 rounded-md text-[11px] font-medium transition-all"
                  style={{
                    background: rangeDays === r.days ? "rgba(121,134,203,0.2)" : "transparent",
                    color:      rangeDays === r.days ? "#7986CB" : "var(--text-muted)",
                    border:     rangeDays === r.days ? "1px solid rgba(121,134,203,0.4)" : "1px solid transparent",
                  }}>
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barSize={rangeDays === 30 ? 6 : rangeDays === 14 ? 10 : 20}>
              <XAxis dataKey="label" tick={{ fontSize: 8, fill: "var(--text-muted)" }} tickLine={false} axisLine={false}
                interval={rangeDays === 30 ? 4 : rangeDays === 14 ? 1 : 0} />
              <YAxis domain={[0, Math.max(10, goalH + 1)]} tick={{ fontSize: 8, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} width={24}
                tickCount={5} tickFormatter={v => `${v}h`} />
              <ReferenceLine y={goalH} stroke="rgba(121,134,203,0.4)" strokeDasharray="4 4" />
              <Tooltip
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const v = payload[0]?.payload?.sleepMin as number | null;
                  return (
                    <div className="px-2.5 py-2 rounded-lg text-[11px]"
                      style={{ background: "rgba(13,13,17,0.96)", border: "1px solid var(--border)" }}>
                      <p style={{ color: "var(--text-muted)" }}>{label}</p>
                      <p className="font-bold" style={{ color: "#7986CB" }}>{v ? fmtSleep(v) : "—"}</p>
                      {v && <p style={{ color: "var(--text-muted)" }}>{Math.round(v / sleepGoalMin * 100)}% de l&apos;objectif</p>}
                    </div>
                  );
                }}
              />
              <Bar dataKey="sleepH" radius={[3, 3, 0, 0]}>
                {chartData.map((d, i) => (
                  <Cell key={i} fill={sleepColor(d.sleepMin, sleepGoalMin)} fillOpacity={d.sleepMin ? 0.85 : 0.3} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          <div className="flex items-center gap-3 mt-2 justify-center">
            {[
              { label: `≥ ${goalH}h`, color: "#34A853" },
              { label: `≥ ${Math.round(goalH * 0.8 * 10)/10}h`, color: "#7986CB" },
              { label: `≥ ${Math.round(goalH * 0.6 * 10)/10}h`, color: "#FBBC04" },
              { label: "Insuffisant", color: "#ef4444" },
            ].map(l => (
              <div key={l.label} className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full" style={{ background: l.color }} />
                <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>{l.label}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Hypnogram — last night */}
        {lastSleep && (
          <motion.div {...fade(0.15)} className="glass p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="label-xs">Dernière nuit analysée</p>
              <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                {format(parseISO(lastSleep.date), "dd MMM", { locale: fr })}
              </span>
            </div>
            <SleepHypnogram sleepMinutes={lastSleep.sleepMinutes!} bedtimeHour={23} />
          </motion.div>
        )}

        {/* Daily log */}
        {withData.length > 0 && (
          <motion.div {...fade(0.2)} className="glass p-4">
            <p className="label-xs mb-3">Détail quotidien</p>
            <div className="space-y-0">
              {[...visible].reverse().filter(p => p.sleepMinutes != null).map(p => {
                const min = p.sleepMinutes!;
                const pct = Math.round(min / sleepGoalMin * 100);
                const color = sleepColor(min, sleepGoalMin);
                return (
                  <div key={p.date} className="flex items-center gap-3 py-2"
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <span className="text-[11px] w-[52px] flex-shrink-0" style={{ color: "var(--text-muted)" }}>
                      {format(parseISO(p.date), "dd MMM", { locale: fr })}
                    </span>
                    <div className="flex items-center gap-1.5 w-[64px]">
                      <Moon size={11} weight="fill" style={{ color }} />
                      <span className="text-[13px] font-semibold" style={{ color }}>{fmtSleep(min)}</span>
                    </div>
                    <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                      <div className="h-full rounded-full transition-all"
                        style={{ width: `${Math.min(pct, 100)}%`, background: color }} />
                    </div>
                    <span className="text-[10px] w-[32px] text-right" style={{ color: "var(--text-muted)" }}>{pct}%</span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Empty state */}
        {withData.length === 0 && (
          <motion.div {...fade(0.1)} className="glass p-8 flex flex-col items-center gap-3 text-center">
            <Moon size={32} weight="thin" style={{ color: "var(--text-muted)" }} />
            <p className="text-[13px] font-medium" style={{ color: "var(--text-secondary)" }}>Aucune donnée de sommeil</p>
            <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Synchronise Google Fit pour importer tes données de sommeil.</p>
          </motion.div>
        )}

      </div>
    </div>
  );
}
