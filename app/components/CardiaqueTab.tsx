"use client";

import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { motion } from "framer-motion";
import {
  IconHeart, IconArrowDown, IconArrowUp, IconMinus, IconCircleCheck, IconAlertCircle, IconBolt, IconMoon,
} from "@tabler/icons-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { hrZone, fmtSleep } from "@/app/lib/health-format";
import type { CardioPoint } from "@/app/api/cardio/route";

const fade = (delay: number) => ({
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3, delay },
});

interface Props {
  todayHr:         number | null;
  zone:            { label: string; color: string; desc: string } | null;
  delta:           number | null;
  avgHr:           number | null;
  minHr:           number | null;
  maxHr:           number | null;
  weekDelta:       number | null;
  rangeDays:       7 | 14 | 30;
  setRangeDays:    (d: 7 | 14 | 30) => void;
  cardioChartData: (CardioPoint & { label: string })[];
  fcMax:           number;
  visible:         CardioPoint[];
}

// Onglet "Cardiaque & sommeil" de Sante — extrait de HealthClient.tsx.
// Composant purement presentationnel : toutes les valeurs derivees (moyennes,
// zones FC, delta hebdo...) restent calculees dans HealthClient a partir de
// `cardioPoints`/`age`/`rangeDays`, et sont passees ici deja pretes — seul le
// JSX de rendu a bouge.
export default function CardiaqueTab({
  todayHr, zone, delta, avgHr, minHr, maxHr, weekDelta, rangeDays, setRangeDays, cardioChartData, fcMax, visible,
}: Props) {
  return (
    <>
            <motion.div {...fade(0.05)} className="mb-4 rounded-2xl p-5 overflow-hidden"
              style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="label-xs mb-1">Aujourd&apos;hui · Google Fit</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-[42px] font-bold leading-none"
                      style={{ color: todayHr ? (zone?.color ?? "var(--text-primary)") : "var(--text-muted)" }}>
                      {todayHr ?? "—"}
                    </span>
                    {todayHr && <span className="text-[16px]" style={{ color: "var(--text-muted)" }}>bpm</span>}
                  </div>
                  {zone && (
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ background: zone.color }} />
                      <span className="text-[12px] font-medium" style={{ color: zone.color }}>{zone.label}</span>
                      <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>· {zone.desc}</span>
                    </div>
                  )}
                  {!todayHr && (
                    <p className="text-[12px] mt-1" style={{ color: "var(--text-muted)" }}>
                      Aucune donnée — synchronisez Google Fit
                    </p>
                  )}
                </div>
                {delta !== null && (
                  <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-1 px-2 py-1 rounded-lg text-[12px] font-medium"
                      style={{
                        background: delta === 0 ? "rgba(255,255,255,0.05)" : delta < 0 ? "rgba(52,168,83,0.1)" : "rgba(234,67,53,0.1)",
                        color: delta === 0 ? "var(--text-muted)" : delta < 0 ? "var(--fit-green)" : "var(--fit-red)",
                      }}>
                      {delta < 0 ? <IconArrowDown size={12} /> : delta > 0 ? <IconArrowUp size={12} /> : <IconMinus size={12} />}
                      {Math.abs(delta)} bpm
                    </div>
                    <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>vs hier</span>
                  </div>
                )}
              </div>
            </motion.div>

            {/* Stats strip */}
            <motion.div {...fade(0.08)} className="grid grid-cols-3 gap-3 mb-4">
              {[
                { label: "Moyenne", value: avgHr ? `${avgHr} bpm` : "—", icon: <IconHeart size={14} style={{ color: "var(--danger)" }} />, c1: "rgba(248,113,113,0.14)", c2: "rgba(248,113,113,0.22)" },
                { label: "Min",     value: minHr ? `${minHr} bpm` : "—", icon: <IconArrowDown size={14} style={{ color: "var(--fiber)" }} />, c1: "rgba(52,211,153,0.14)", c2: "rgba(52,211,153,0.22)" },
                { label: "Max",     value: maxHr ? `${maxHr} bpm` : "—", icon: <IconArrowUp size={14} style={{ color: "var(--calories)" }} />, c1: "rgba(249,115,22,0.14)", c2: "rgba(249,115,22,0.22)" },
              ].map(({ label, value, icon, c1, c2 }) => (
                <div key={label} className="flex flex-col gap-1 rounded-2xl p-3"
                  style={{ background: `linear-gradient(140deg, ${c1} 0%, transparent 100%)`, border: `1px solid ${c2}` }}>
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
                  ? <><IconCircleCheck size={15} style={{ color: "var(--fit-green)" }} /><span style={{ color: "var(--text-secondary)" }}>Stable sur 7 jours</span></>
                  : weekDelta < 0
                    ? <><IconCircleCheck size={15} style={{ color: "var(--fit-green)" }} /><span style={{ color: "var(--text-secondary)" }}>En baisse de <strong style={{ color: "var(--fit-green)" }}>{Math.abs(weekDelta)} bpm</strong> cette semaine</span></>
                    : <><IconAlertCircle size={15} style={{ color: "var(--carbs)" }} /><span style={{ color: "var(--text-secondary)" }}>En hausse de <strong style={{ color: "var(--carbs)" }}>{weekDelta} bpm</strong> cette semaine</span></>
                }
              </motion.div>
            )}

            {/* Range selector */}
            <motion.div {...fade(0.12)} className="flex gap-2 mb-4">
              {([{ label: "7J", days: 7 }, { label: "14J", days: 14 }, { label: "30J", days: 30 }] as const).map(({ label, days }) => (
                <button key={days}
                  onClick={() => setRangeDays(days)}
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

            {/* ── Vue synthèse combinée ── */}
            <motion.div {...fade(0.14)} className="mb-4 rounded-2xl p-4"
              style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              }}
            >
              {/* Legend */}
              <div className="flex items-center justify-between mb-3">
                <p className="label-xs">Vue synthèse</p>
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  {[
                    { label: "BPM",       color: "var(--fit-red)" },
                    { label: "Calories",  color: "var(--info)" },
                    { label: "Activité",  color: "var(--fit-green)" },
                    { label: "Sommeil",   color: "var(--fit-indigo)" },
                  ].map(({ label, color }) => (
                    <div key={label} className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                      <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* BPM — line */}
              <div className="mb-0.5">
                <p className="text-[11px] font-medium mb-0.5" style={{ color: "var(--fit-red)" }}>BPM</p>
                <ResponsiveContainer width="100%" height={68}>
                  <AreaChart syncId="hs" data={cardioChartData} margin={{ top: 2, right: 2, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="g-hr" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="var(--fit-red)" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="var(--fit-red)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="label" hide />
                    <YAxis domain={["auto","auto"]} tick={{ fontSize: 11, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} width={22} tickCount={3} />
                    <ReferenceLine y={60}  stroke="rgba(129,140,248,0.2)" strokeDasharray="3 3" />
                    <ReferenceLine y={100} stroke="rgba(248,113,113,0.2)" strokeDasharray="3 3" />
                    <Tooltip content={({ active, payload, label: lbl }) => {
                      if (!active || !payload?.length) return null;
                      const v = payload[0]?.value as number | null;
                      if (!v) return null;
                      const z = hrZone(v, fcMax);
                      return (
                        <div className="px-2 py-1.5 rounded-lg text-[11px]" style={{ background: "rgba(13,13,17,0.96)", border: "1px solid var(--border)" }}>
                          <p style={{ color: "var(--text-muted)" }}>{lbl}</p>
                          <p className="font-bold" style={{ color: z.color }}>{v} bpm · {z.label}</p>
                        </div>
                      );
                    }} />
                    <Area type="linear" dataKey="hrAvg" stroke="var(--fit-red)" strokeWidth={1.5} fill="url(#g-hr)" dot={{ r: 1.6, fill: "var(--fit-red)", strokeWidth: 0 }} activeDot={{ r: 3.5 }} connectNulls />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="mb-0.5" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                {/* Calories — bar */}
                <p className="text-[11px] font-medium mt-1 mb-0.5" style={{ color: "var(--info)" }}>Calories actives (kcal)</p>
                <ResponsiveContainer width="100%" height={52}>
                  <BarChart syncId="hs" data={cardioChartData} margin={{ top: 2, right: 2, left: 0, bottom: 0 }} barSize={4}>
                    <XAxis dataKey="label" hide />
                    <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} width={22} tickCount={3} />
                    <Tooltip content={({ active, payload, label: lbl }) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div className="px-2 py-1.5 rounded-lg text-[11px]" style={{ background: "rgba(13,13,17,0.96)", border: "1px solid var(--border)" }}>
                          <p style={{ color: "var(--text-muted)" }}>{lbl}</p>
                          <p className="font-bold" style={{ color: "var(--info)" }}>{payload[0]?.value} kcal</p>
                        </div>
                      );
                    }} />
                    <Bar dataKey="activeCalories" fill="#06b6d4" fillOpacity={0.7} radius={[2,2,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="mb-0.5" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                {/* Activité — bar */}
                <p className="text-[11px] font-medium mt-1 mb-0.5" style={{ color: "var(--fit-green)" }}>Activité (min)</p>
                <ResponsiveContainer width="100%" height={52}>
                  <BarChart syncId="hs" data={cardioChartData} margin={{ top: 2, right: 2, left: 0, bottom: 0 }} barSize={4}>
                    <XAxis dataKey="label" hide />
                    <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} width={22} tickCount={3} />
                    <ReferenceLine y={30} stroke="rgba(52,168,83,0.3)" strokeDasharray="3 3" />
                    <Tooltip content={({ active, payload, label: lbl }) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div className="px-2 py-1.5 rounded-lg text-[11px]" style={{ background: "rgba(13,13,17,0.96)", border: "1px solid var(--border)" }}>
                          <p style={{ color: "var(--text-muted)" }}>{lbl}</p>
                          <p className="font-bold" style={{ color: "var(--fit-green)" }}>{payload[0]?.value} min</p>
                        </div>
                      );
                    }} />
                    <Bar dataKey="activeMin" fill="var(--fit-green)" fillOpacity={0.7} radius={[2,2,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                {/* Sommeil — bar avec X axis */}
                <p className="text-[11px] font-medium mt-1 mb-0.5" style={{ color: "var(--fit-indigo)" }}>Sommeil (h) · — objectif 7h</p>
                <ResponsiveContainer width="100%" height={65}>
                  <BarChart syncId="hs"
                    data={cardioChartData.map(p => ({ ...p, sleepH: p.sleepMinutes != null ? Math.round(p.sleepMinutes / 60 * 10) / 10 : null }))}
                    margin={{ top: 2, right: 2, left: 0, bottom: 0 }}
                    barSize={4}
                  >
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                    <YAxis domain={[0, 10]} tick={{ fontSize: 11, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} width={22} tickCount={4} />
                    <ReferenceLine y={7} stroke="rgba(121,134,203,0.4)" strokeDasharray="3 3" />
                    <Tooltip content={({ active, payload, label: lbl }) => {
                      if (!active || !payload?.length) return null;
                      const v = payload[0]?.value as number | null;
                      return (
                        <div className="px-2 py-1.5 rounded-lg text-[11px]" style={{ background: "rgba(13,13,17,0.96)", border: "1px solid var(--border)" }}>
                          <p style={{ color: "var(--text-muted)" }}>{lbl}</p>
                          <p className="font-bold" style={{ color: "var(--fit-indigo)" }}>{v != null ? `${v}h` : "—"}</p>
                        </div>
                      );
                    }} />
                    <Bar dataKey="sleepH" fill="var(--fit-indigo)" fillOpacity={0.7} radius={[2,2,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            {/* Daily log table */}
            {visible.length > 0 && (
              <motion.div {...fade(0.2)} className="rounded-2xl p-4"
                style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
                }}
              >
                <p className="label-xs mb-3">Détail quotidien</p>
                <div className="space-y-1">
                  {[...visible].reverse().slice(0, 14).map((p) => {
                    const z = p.hrAvg ? hrZone(p.hrAvg, fcMax) : null;
                    return (
                      <div key={p.date} className="flex items-center gap-3 py-1.5"
                        style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        <span className="text-[11px] w-[52px] flex-shrink-0" style={{ color: "var(--text-muted)" }}>
                          {format(parseISO(p.date), "dd MMM", { locale: fr })}
                        </span>
                        <div className="flex items-center gap-1 w-[60px]">
                          <IconHeart size={11} style={{ color: z?.color ?? "var(--text-muted)" }} />
                          <span className="text-[12px] font-medium" style={{ color: z?.color ?? "var(--text-muted)" }}>
                            {p.hrAvg ? `${p.hrAvg}` : "—"}
                          </span>
                          {p.hrAvg && <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>bpm</span>}
                        </div>
                        <div className="flex items-center gap-1 w-[52px]">
                          <IconBolt size={11} style={{ color: "var(--fit-green)" }} />
                          <span className="text-[12px]" style={{ color: "var(--text-secondary)" }}>{p.activeMin}min</span>
                        </div>
                        <div className="flex items-center gap-1 flex-1">
                          <IconMoon size={11} style={{ color: "var(--fit-indigo)" }} />
                          <span className="text-[12px]" style={{ color: "var(--text-secondary)" }}>{fmtSleep(p.sleepMinutes)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}

    </>
  );
}
