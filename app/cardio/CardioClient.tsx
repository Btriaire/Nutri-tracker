"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import {
  ArrowLeft, Heart, Lightning, Moon, Footprints, Warning,
  CheckCircle, ArrowUp, ArrowDown, Minus,
} from "@phosphor-icons/react";
import {
  ResponsiveContainer, AreaChart, Area, LineChart, Line,
  XAxis, YAxis, Tooltip, ReferenceLine, CartesianGrid,
} from "recharts";
import type { CardioPoint } from "@/app/api/cardio/route";

interface Props { points: CardioPoint[] }

const RANGES = [
  { label: "7J",  days: 7  },
  { label: "14J", days: 14 },
  { label: "30J", days: 30 },
] as const;

function hrZone(bpm: number): { label: string; color: string; desc: string } {
  if (bpm < 60)  return { label: "Repos",    color: "var(--fit-indigo)", desc: "Fréquence au repos" };
  if (bpm < 70)  return { label: "Faible",   color: "var(--fit-green)", desc: "Zone de récupération" };
  if (bpm < 85)  return { label: "Modéré",   color: "#fbbf24",          desc: "Zone aérobie légère" };
  if (bpm < 100) return { label: "Élevé",    color: "#f97316",          desc: "Zone cardiovasculaire" };
  return               { label: "Intense",  color: "var(--fit-red)",   desc: "Effort intense" };
}

function fmtSleep(min: number | null): string {
  if (!min) return "—";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}

const ease = [0.16, 1, 0.3, 1] as [number, number, number, number];
const fade = (delay = 0) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, ease, delay },
});

export default function CardioClient({ points }: Props) {
  const [rangeDays, setRangeDays] = useState<7 | 14 | 30>(30);

  const visible = points.slice(-rangeDays);
  const hrPoints = visible.filter((p) => p.hrAvg !== null);

  // Stats
  const avgHr   = hrPoints.length ? Math.round(hrPoints.reduce((s, p) => s + p.hrAvg!, 0) / hrPoints.length) : null;
  const minHr   = hrPoints.length ? Math.min(...hrPoints.map((p) => p.hrAvg!)) : null;
  const maxHr   = hrPoints.length ? Math.max(...hrPoints.map((p) => p.hrAvg!)) : null;
  const today   = hrPoints[hrPoints.length - 1]?.hrAvg ?? null;
  const prev    = hrPoints[hrPoints.length - 2]?.hrAvg ?? null;
  const delta   = today !== null && prev !== null ? today - prev : null;

  const zone = today ? hrZone(today) : null;

  const chartData = visible.map((p) => ({
    ...p,
    label: format(parseISO(p.date), "dd/MM"),
  }));

  // Trend: last 7 vs previous 7
  const last7  = points.slice(-7).filter((p) => p.hrAvg).map((p) => p.hrAvg!);
  const prev7  = points.slice(-14, -7).filter((p) => p.hrAvg).map((p) => p.hrAvg!);
  const avg7   = last7.length  ? Math.round(last7.reduce((a, b) => a + b, 0) / last7.length)  : null;
  const avgP7  = prev7.length  ? Math.round(prev7.reduce((a, b) => a + b, 0) / prev7.length)  : null;
  const weekDelta = avg7 !== null && avgP7 !== null ? avg7 - avgP7 : null;

  const HrTooltip = ({ active, payload, label: lbl }: { active?: boolean; payload?: { value: number }[]; label?: string }) => {
    if (!active || !payload?.length || !payload[0]?.value) return null;
    const bpm = payload[0].value;
    const z = hrZone(bpm);
    return (
      <div className="px-3 py-2 rounded-xl text-[11px] space-y-0.5"
        style={{ background: "rgba(13,13,17,0.96)", border: "1px solid var(--border)" }}>
        <p style={{ color: "var(--text-muted)" }}>{lbl}</p>
        <p className="font-bold text-[14px]" style={{ color: z.color }}>{bpm} bpm</p>
        <p style={{ color: z.color }}>{z.label}</p>
      </div>
    );
  };

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
              Cardiaque
            </h1>
            <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
              Historique fréquence cardiaque
            </p>
          </div>
        </motion.div>

        {/* Today's summary card */}
        <motion.div {...fade(0.05)} className="glass p-5 mb-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="label-xs mb-1">Aujourd'hui</p>
              <div className="flex items-baseline gap-2">
                <span className="text-[42px] font-bold leading-none"
                  style={{ color: today ? (zone?.color ?? "var(--text-primary)") : "var(--text-muted)" }}>
                  {today ?? "—"}
                </span>
                {today && <span className="text-[16px]" style={{ color: "var(--text-muted)" }}>bpm</span>}
              </div>
              {zone && (
                <div className="flex items-center gap-1.5 mt-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ background: zone.color }} />
                  <span className="text-[12px] font-medium" style={{ color: zone.color }}>{zone.label}</span>
                  <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>· {zone.desc}</span>
                </div>
              )}
            </div>
            {delta !== null && (
              <div className="flex flex-col items-end gap-1">
                <div className="flex items-center gap-1 px-2 py-1 rounded-lg text-[12px] font-medium"
                  style={{
                    background: delta === 0 ? "rgba(255,255,255,0.05)" : delta < 0 ? "rgba(52,168,83,0.1)" : "rgba(234,67,53,0.1)",
                    color: delta === 0 ? "var(--text-muted)" : delta < 0 ? "var(--fit-green)" : "var(--fit-red)",
                  }}>
                  {delta < 0 ? <ArrowDown size={12} weight="bold" /> : delta > 0 ? <ArrowUp size={12} weight="bold" /> : <Minus size={12} weight="bold" />}
                  {Math.abs(delta)} bpm
                </div>
                <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>vs hier</span>
              </div>
            )}
          </div>
        </motion.div>

        {/* Stats strip */}
        <motion.div {...fade(0.08)} className="grid grid-cols-3 gap-3 mb-4">
          {[
            { label: "Moyenne",  value: avgHr ? `${avgHr} bpm` : "—", icon: <Heart size={14} weight="fill" style={{ color: "var(--fit-red)" }} /> },
            { label: "Min",      value: minHr ? `${minHr} bpm` : "—", icon: <ArrowDown size={14} weight="bold" style={{ color: "var(--fit-green)" }} /> },
            { label: "Max",      value: maxHr ? `${maxHr} bpm` : "—", icon: <ArrowUp size={14} weight="bold" style={{ color: "#f97316" }} /> },
          ].map(({ label, value, icon }) => (
            <div key={label} className="card flex flex-col gap-1">
              <div className="flex items-center gap-1">{icon}<span className="label-xs">{label}</span></div>
              <span className="text-[16px] font-bold" style={{ color: "var(--text-primary)" }}>{value}</span>
            </div>
          ))}
        </motion.div>

        {/* Weekly trend badge */}
        {weekDelta !== null && (
          <motion.div {...fade(0.1)} className="flex items-center gap-2 px-3 py-2 rounded-xl mb-4 text-[12px]"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)" }}>
            {weekDelta === 0
              ? <><CheckCircle size={15} style={{ color: "var(--fit-green)" }} /><span style={{ color: "var(--text-secondary)" }}>Stable sur 7 jours</span></>
              : weekDelta < 0
                ? <><CheckCircle size={15} style={{ color: "var(--fit-green)" }} /><span style={{ color: "var(--text-secondary)" }}>En baisse de <strong style={{ color: "var(--fit-green)" }}>{Math.abs(weekDelta)} bpm</strong> cette semaine</span></>
                : <><Warning size={15} style={{ color: "#fbbf24" }} /><span style={{ color: "var(--text-secondary)" }}>En hausse de <strong style={{ color: "#fbbf24" }}>{weekDelta} bpm</strong> cette semaine</span></>
            }
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

        {/* HR history chart */}
        <motion.div {...fade(0.14)} className="glass p-4 mb-4">
          <p className="label-xs mb-3">Évolution BPM</p>
          {hrPoints.length > 0 ? (
            <ResponsiveContainer width="100%" height={140}>
              <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <defs>
                  <linearGradient id="hrGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="var(--fit-red)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--fit-red)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 9, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 9, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} domain={["auto", "auto"]} />
                <Tooltip content={<HrTooltip />} />
                {/* Zone reference lines */}
                <ReferenceLine y={60}  stroke="rgba(129,140,248,0.25)" strokeDasharray="4 3" label={{ value: "60", fill: "rgba(129,140,248,0.5)", fontSize: 8, position: "right" }} />
                <ReferenceLine y={100} stroke="rgba(248,113,113,0.25)" strokeDasharray="4 3" label={{ value: "100", fill: "rgba(248,113,113,0.5)", fontSize: 8, position: "right" }} />
                <Area type="monotone" dataKey="hrAvg" stroke="var(--fit-red)" strokeWidth={2} fill="url(#hrGrad)" dot={false} connectNulls activeDot={{ r: 4, fill: "var(--fit-red)" }} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[100px]">
              <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>Pas de données sur cette période</p>
            </div>
          )}
          {/* Zone legend */}
          <div className="flex flex-wrap gap-3 mt-3 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
            {[
              { label: "Repos < 60",  color: "var(--fit-indigo)" },
              { label: "Normal 60–100", color: "var(--fit-green)" },
              { label: "Élevé > 100",  color: "var(--fit-red)" },
            ].map(({ label, color }) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{label}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Active minutes + steps correlation */}
        <motion.div {...fade(0.16)} className="glass p-4 mb-4">
          <p className="label-xs mb-3">Minutes actives</p>
          <ResponsiveContainer width="100%" height={90}>
            <AreaChart data={chartData} margin={{ top: 2, right: 4, left: -24, bottom: 0 }}>
              <defs>
                <linearGradient id="actGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="var(--fit-green)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--fit-green)" stopOpacity={0} />
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
              <Area type="monotone" dataKey="activeMin" stroke="var(--fit-green)" strokeWidth={1.5} fill="url(#actGrad)" dot={false} connectNulls />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Sleep vs HR */}
        <motion.div {...fade(0.18)} className="glass p-4 mb-4">
          <p className="label-xs mb-3">Sommeil</p>
          <ResponsiveContainer width="100%" height={90}>
            <AreaChart data={chartData} margin={{ top: 2, right: 4, left: -24, bottom: 0 }}>
              <defs>
                <linearGradient id="sleepGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="var(--fit-indigo)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--fit-indigo)" stopOpacity={0} />
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
                    <p style={{ color: "var(--fit-indigo)" }} className="font-bold">{fmtSleep(payload[0]?.value as number)}</p>
                  </div>
                );
              }} />
              <ReferenceLine y={420} stroke="rgba(121,134,203,0.3)" strokeDasharray="4 3" />
              <Area type="monotone" dataKey="sleepMinutes" stroke="var(--fit-indigo)" strokeWidth={1.5} fill="url(#sleepGrad)" dot={false} connectNulls />
            </AreaChart>
          </ResponsiveContainer>
          <p className="text-[10px] mt-2" style={{ color: "var(--text-muted)" }}>Trait pointillé = objectif 7h</p>
        </motion.div>

        {/* Daily log table */}
        <motion.div {...fade(0.2)} className="glass p-4">
          <p className="label-xs mb-3">Détail quotidien</p>
          <div className="space-y-1">
            {[...visible].reverse().slice(0, 14).map((p) => {
              const z = p.hrAvg ? hrZone(p.hrAvg) : null;
              return (
                <div key={p.date} className="flex items-center gap-3 py-1.5"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <span className="text-[11px] w-[52px] flex-shrink-0" style={{ color: "var(--text-muted)" }}>
                    {format(parseISO(p.date), "dd MMM", { locale: fr })}
                  </span>
                  {/* HR */}
                  <div className="flex items-center gap-1 w-[60px]">
                    <Heart size={11} weight="fill" style={{ color: z?.color ?? "var(--text-muted)" }} />
                    <span className="text-[12px] font-medium" style={{ color: z?.color ?? "var(--text-muted)" }}>
                      {p.hrAvg ? `${p.hrAvg}` : "—"}
                    </span>
                    {p.hrAvg && <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>bpm</span>}
                  </div>
                  {/* Active min */}
                  <div className="flex items-center gap-1 w-[52px]">
                    <Lightning size={11} style={{ color: "var(--fit-green)" }} />
                    <span className="text-[12px]" style={{ color: "var(--text-secondary)" }}>{p.activeMin}min</span>
                  </div>
                  {/* Sleep */}
                  <div className="flex items-center gap-1 flex-1">
                    <Moon size={11} style={{ color: "var(--fit-indigo)" }} />
                    <span className="text-[12px]" style={{ color: "var(--text-secondary)" }}>{fmtSleep(p.sleepMinutes)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

      </div>
    </div>
  );
}
