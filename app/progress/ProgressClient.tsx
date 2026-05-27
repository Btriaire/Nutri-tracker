"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { format, subDays, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell,
} from "recharts";
import {
  ArrowDown, ArrowUp, Minus, Lightning, Scales, ChartBar, ChartLine,
  CalendarBlank, Footprints, Fire, Heart, Moon, Drop, PersonSimpleRun,
} from "@phosphor-icons/react";
import type { DayTrendPoint, NutritionGoals } from "@/app/lib/types";

type Range = "1j" | "7d" | "30d" | "3m" | "6m" | "1y" | "all";
type CalChart = "area" | "bar";

const RANGES: { key: Range; label: string; days?: number }[] = [
  { key: "1j",  label: "Jour" },
  { key: "7d",  label: "7J",  days: 7  },
  { key: "30d", label: "30J", days: 30 },
  { key: "3m",  label: "3M",  days: 90 },
  { key: "6m",  label: "6M",  days: 180 },
  { key: "1y",  label: "1A",  days: 365 },
  { key: "all", label: "Tout" },
];

function estimateTDEE(goals: NutritionGoals): number { return goals.dailyCalories; }

function calcProjection(currentKg: number, targetKg: number, avgCalories: number, tdee: number) {
  const dailyDelta = avgCalories - tdee;
  if (dailyDelta === 0) return null;
  const daysNeeded = (targetKg - currentKg) / (dailyDelta / 7700);
  return daysNeeded <= 0 ? null : Math.round(daysNeeded);
}

function fmtSleep(min?: number): string {
  if (!min) return "—";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}

function hrZoneColor(bpm: number): string {
  if (bpm < 60)  return "#818cf8";
  if (bpm < 85)  return "#34d399";
  if (bpm < 100) return "#fbbf24";
  return "#f87171";
}

interface Props {
  goals:           NutritionGoals;
  currentWeightKg: number | null;
  targetWeightKg:  number | null;
}

const Tt = ({ bg, label, value, unit, color }: { bg?: string; label: string; value: string | number | undefined; unit?: string; color?: string }) => (
  <div className="px-3 py-2 rounded-xl text-[12px]"
    style={{ background: bg ?? "rgba(13,13,17,0.96)", border: "1px solid var(--border)" }}>
    <p style={{ color: "var(--text-muted)" }}>{label}</p>
    <p className="font-bold" style={{ color: color ?? "var(--text-primary)" }}>{value}{unit ? ` ${unit}` : ""}</p>
  </div>
);

export default function ProgressClient({ goals, currentWeightKg, targetWeightKg }: Props) {
  const [range,    setRange]    = useState<Range>("30d");
  const [calChart, setCalChart] = useState<CalChart>("area");
  const [points,   setPoints]   = useState<DayTrendPoint[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    fetch("/api/goals")
      .then((r) => r.json())
      .then((d: { chartPrefs?: { calorieTrend?: string } | null }) => {
        if (d.chartPrefs?.calorieTrend === "bar") setCalChart("bar");
      })
      .catch(() => {});
  }, []);

  const loadData = useCallback(async (r: Range) => {
    setLoading(true);
    try {
      const today = format(new Date(), "yyyy-MM-dd");
      const rangeObj = RANGES.find((x) => x.key === r);
      const from = r === "1j"
        ? today
        : r === "all" || !rangeObj?.days
          ? "2020-01-01"
          : format(subDays(new Date(), rangeObj.days), "yyyy-MM-dd");
      const res = await fetch(`/api/progress?from=${from}&to=${today}`);
      if (res.ok) {
        const { points: p } = await res.json() as { points: DayTrendPoint[] };
        setPoints(p ?? []);
      }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(range); }, [range, loadData]);

  const chartData = points.map((p) => ({
    ...p,
    label: format(parseISO(p.date), range === "1j" ? "HH:mm" : "dd/MM"),
  }));
  const weightData     = chartData.filter((p) => (p.weightKg ?? 0) > 0);
  const caloriePoints  = chartData.filter((p) => p.calories > 0);
  const activityPoints = chartData.filter((p) => (p.activeMinutes ?? 0) > 0 || (p.steps ?? 0) > 0);

  const avgCalories = caloriePoints.length
    ? Math.round(caloriePoints.reduce((s, p) => s + p.calories, 0) / caloriePoints.length) : 0;
  const avgProtein = caloriePoints.length
    ? Math.round(caloriePoints.reduce((s, p) => s + p.proteinG, 0) / caloriePoints.length) : 0;
  const avgSteps = activityPoints.filter((p) => (p.steps ?? 0) > 0).length
    ? Math.round(activityPoints.filter((p) => (p.steps ?? 0) > 0).reduce((s, p) => s + (p.steps ?? 0), 0)
        / activityPoints.filter((p) => (p.steps ?? 0) > 0).length) : 0;
  const avgActiveMins = activityPoints.filter((p) => (p.activeMinutes ?? 0) > 0).length
    ? Math.round(activityPoints.filter((p) => (p.activeMinutes ?? 0) > 0).reduce((s, p) => s + (p.activeMinutes ?? 0), 0)
        / activityPoints.filter((p) => (p.activeMinutes ?? 0) > 0).length) : 0;

  const firstWeight = weightData[0]?.weightKg;
  const lastWeight  = weightData[weightData.length - 1]?.weightKg;
  const weightDelta = (firstWeight && lastWeight) ? lastWeight - firstWeight : null;

  const tdee = estimateTDEE(goals);
  const projectionDays = (currentWeightKg && targetWeightKg && avgCalories > 0)
    ? calcProjection(currentWeightKg, targetWeightKg, avgCalories, tdee) : null;
  const projectionDate = projectionDays
    ? format(new Date(Date.now() + projectionDays * 86400000), "d MMMM yyyy", { locale: fr }) : null;

  // ── today data (for Jour view)
  const todayPoint = points[points.length - 1];

  return (
    <div className="relative min-h-screen" style={{ paddingBottom: "80px" }}>
      <div className="bg-orbs" />
      <div className="relative z-10 max-w-md mx-auto px-4 py-6 md:ml-[220px] md:max-w-2xl">

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="mb-5">
          <p className="label-xs mb-0.5">Analyse</p>
          <h1 className="text-[22px] font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>Progrès</h1>
        </motion.div>

        {/* Range selector */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.04 }}
          className="flex gap-1.5 mb-5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          {RANGES.map((r) => (
            <button key={r.key} onClick={() => setRange(r.key)}
              className="flex-shrink-0 px-3 py-1.5 rounded-xl text-[12px] font-medium transition-all"
              style={{
                background: range === r.key ? "rgba(249,115,22,0.12)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${range === r.key ? "rgba(249,115,22,0.4)" : "var(--border)"}`,
                color: range === r.key ? "var(--calories)" : "var(--text-secondary)",
              }}>
              {r.label}
            </button>
          ))}
        </motion.div>

        {/* ═══════════ VUE JOUR ═══════════ */}
        {range === "1j" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
            className="space-y-3">

            <p className="text-[13px] font-medium capitalize" style={{ color: "var(--text-muted)" }}>
              {format(new Date(), "EEEE d MMMM yyyy", { locale: fr })}
            </p>

            {loading ? (
              <div className="flex items-center justify-center py-16">
                <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>Chargement…</p>
              </div>
            ) : (
              <>
                {/* Nutrition */}
                <div className="glass p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Fire size={16} weight="fill" style={{ color: "var(--calories)" }} />
                    <p className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>Nutrition</p>
                  </div>
                  {todayPoint?.calories ? (
                    <>
                      {/* Calorie bar */}
                      <div className="flex items-baseline gap-2 mb-2">
                        <span className="text-[30px] font-bold tabular-nums" style={{ color: "var(--calories)" }}>
                          {todayPoint.calories}
                        </span>
                        <span className="text-[13px]" style={{ color: "var(--text-muted)" }}>
                          / {goals.dailyCalories} kcal
                        </span>
                      </div>
                      <div className="h-2 rounded-full overflow-hidden mb-4" style={{ background: "rgba(255,255,255,0.07)" }}>
                        <div className="h-full rounded-full" style={{
                          background: "var(--calories)",
                          width: `${Math.min((todayPoint.calories / goals.dailyCalories) * 100, 100)}%`,
                          transition: "width 0.8s ease",
                        }} />
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        {[
                          { label: "Protéines", val: todayPoint.proteinG, goal: goals.proteinGrams, color: "var(--protein)", unit: "g" },
                          { label: "Glucides",  val: todayPoint.carbsG,   goal: goals.carbsGrams,   color: "var(--carbs)",   unit: "g" },
                          { label: "Lipides",   val: todayPoint.fatG,     goal: goals.fatGrams,     color: "var(--fat)",     unit: "g" },
                          { label: "Eau",       val: Math.round((todayPoint.waterMl ?? 0) / 100) / 10, goal: (goals.waterMl ?? 2000) / 1000, color: "#38bdf8", unit: "L" },
                        ].map(({ label, val, goal, color, unit }) => (
                          <div key={label} className="flex flex-col items-center gap-1 p-2.5 rounded-xl"
                            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)" }}>
                            <span className="text-[16px] font-bold tabular-nums" style={{ color }}>{val}{unit}</span>
                            <span className="text-[9px] text-center leading-tight" style={{ color: "var(--text-muted)" }}>{label}</span>
                            <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>/{goal}{unit}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="text-[12px] py-3" style={{ color: "var(--text-muted)" }}>Aucun repas enregistré aujourd'hui</p>
                  )}
                </div>

                {/* Activité */}
                <div className="glass p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <PersonSimpleRun size={16} weight="fill" style={{ color: "var(--steps)" }} />
                    <p className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>Activité</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { icon: Footprints,    label: "Pas",            val: todayPoint?.steps ? todayPoint.steps.toLocaleString("fr-FR") : "—",             color: "var(--steps)",    goal: "/ 10 000" },
                      { icon: Lightning,     label: "Min. actives",   val: todayPoint?.activeMinutes ?? "—",                                                color: "var(--carbs)",    goal: "/ 30 min" },
                      { icon: Fire,          label: "Kcal brûlées",   val: todayPoint?.burned ?? "—",                                                       color: "var(--calories)", goal: "actives" },
                      { icon: Heart,         label: "FC moy.",         val: todayPoint?.heartRateAvg ? `${todayPoint.heartRateAvg} bpm` : "—",               color: "#f87171",         goal: todayPoint?.heartRateAvg ? (todayPoint.heartRateAvg < 60 ? "Repos" : todayPoint.heartRateAvg < 100 ? "Normal" : "Élevé") : "" },
                    ].map(({ icon: Icon, label, val, color, goal }) => (
                      <div key={label} className="flex items-center gap-3 p-3 rounded-xl"
                        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)" }}>
                        <Icon size={22} weight="fill" style={{ color, flexShrink: 0 }} />
                        <div>
                          <p className="text-[18px] font-bold tabular-nums leading-tight" style={{ color }}>{val}</p>
                          <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{label}</p>
                          {goal && <p className="text-[9px]" style={{ color: "var(--text-muted)" }}>{goal}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Récupération */}
                <div className="glass p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Moon size={16} weight="fill" style={{ color: "#818cf8" }} />
                    <p className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>Récupération</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-3 p-3 rounded-xl"
                      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)" }}>
                      <Moon size={24} weight="fill" style={{ color: "#818cf8", flexShrink: 0 }} />
                      <div>
                        <p className="text-[20px] font-bold leading-tight" style={{ color: "#818cf8" }}>
                          {fmtSleep(todayPoint?.sleepMinutes)}
                        </p>
                        <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Sommeil</p>
                        {todayPoint?.sleepMinutes && (
                          <p className="text-[9px]" style={{ color: (todayPoint.sleepMinutes >= 420) ? "#34d399" : "#fbbf24" }}>
                            {todayPoint.sleepMinutes >= 420 ? "✓ Récupéré" : "Insuffisant"}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-xl"
                      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)" }}>
                      <Drop size={24} weight="fill" style={{ color: "#38bdf8", flexShrink: 0 }} />
                      <div>
                        <p className="text-[20px] font-bold leading-tight" style={{ color: "#38bdf8" }}>
                          {todayPoint?.waterMl ? `${(todayPoint.waterMl / 1000).toFixed(1)}L` : "—"}
                        </p>
                        <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Hydratation</p>
                        <p className="text-[9px]" style={{ color: "var(--text-muted)" }}>
                          / {((goals.waterMl ?? 2000) / 1000).toFixed(1)}L objectif
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Weight today */}
                {todayPoint?.weightKg && (
                  <div className="glass p-4 flex items-center gap-4">
                    <Scales size={28} weight="fill" style={{ color: "var(--protein)" }} />
                    <div className="flex-1">
                      <p className="text-[26px] font-bold" style={{ color: "var(--protein)" }}>
                        {todayPoint.weightKg.toFixed(1)} kg
                      </p>
                      {targetWeightKg && (
                        <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
                          Objectif : {targetWeightKg} kg
                          {` · ${Math.abs(todayPoint.weightKg - targetWeightKg).toFixed(1)} kg ${todayPoint.weightKg > targetWeightKg ? "à perdre" : "sous l'objectif"}`}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </motion.div>
        )}

        {/* ═══════════ VUE TENDANCES ═══════════ */}
        {range !== "1j" && (
          <>
            {/* Summary stats */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.06 }}
              className="grid grid-cols-3 gap-3 mb-5">
              <div className="card flex flex-col gap-1">
                <span className="label-xs">Moy. calories</span>
                <span className="text-[20px] font-bold tabular-nums" style={{ color: "var(--calories)" }}>{avgCalories || "—"}</span>
                <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>kcal/j</span>
              </div>
              <div className="card flex flex-col gap-1">
                <span className="label-xs">Moy. pas</span>
                <span className="text-[20px] font-bold tabular-nums" style={{ color: "var(--steps)" }}>{avgSteps ? avgSteps.toLocaleString("fr-FR") : "—"}</span>
                <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>pas/j</span>
              </div>
              <div className="card flex flex-col gap-1">
                <span className="label-xs">Min. actives</span>
                <span className="text-[20px] font-bold tabular-nums" style={{ color: "var(--carbs)" }}>{avgActiveMins || "—"}</span>
                <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>min/j</span>
              </div>
            </motion.div>

            {/* Calories trend */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.08 }}
              className="glass p-5 mb-4">
              <div className="flex items-center justify-between mb-4">
                <p className="label-xs">Calories journalières</p>
                <div className="flex gap-1.5">
                  {(["area", "bar"] as CalChart[]).map((t) => (
                    <button key={t} onClick={() => setCalChart(t)} className="btn-icon w-7 h-7"
                      style={{ color: calChart === t ? "var(--calories)" : "var(--text-muted)" }}>
                      {t === "area" ? <ChartLine size={13} /> : <ChartBar size={13} />}
                    </button>
                  ))}
                </div>
              </div>
              {loading ? (
                <div className="h-32 flex items-center justify-center">
                  <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>Chargement…</span>
                </div>
              ) : caloriePoints.length === 0 ? (
                <div className="h-32 flex items-center justify-center">
                  <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>Aucune donnée</span>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={140}>
                  {calChart === "area" ? (
                    <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="calGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--calories)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="var(--calories)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} />
                      <Tooltip content={({ active, payload, label: lbl }) => active && payload?.length ? <Tt label={String(lbl ?? "")} value={payload[0].value as number} unit="kcal" color="var(--calories)" /> : null} />
                      <ReferenceLine y={goals.dailyCalories} stroke="rgba(249,115,22,0.4)" strokeDasharray="4 4" />
                      <Area type="monotone" dataKey="calories" stroke="var(--calories)" strokeWidth={2} fill="url(#calGrad)" dot={false} />
                    </AreaChart>
                  ) : (
                    <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} />
                      <Tooltip content={({ active, payload, label: lbl }) => active && payload?.length ? <Tt label={String(lbl ?? "")} value={payload[0].value as number} unit="kcal" color="var(--calories)" /> : null} />
                      <ReferenceLine y={goals.dailyCalories} stroke="rgba(249,115,22,0.4)" strokeDasharray="4 4" />
                      <Bar dataKey="calories" fill="var(--calories)" fillOpacity={0.8} radius={[3, 3, 0, 0]} />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              )}
            </motion.div>

            {/* Activity: steps + active minutes side-by-side */}
            {activityPoints.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.09 }}
                className="glass p-5 mb-4">
                <div className="flex items-center gap-2 mb-4">
                  <PersonSimpleRun size={14} weight="fill" style={{ color: "var(--steps)" }} />
                  <p className="label-xs">Activité sportive</p>
                </div>
                {/* Steps */}
                {avgSteps > 0 && (
                  <>
                    <p className="text-[11px] mb-1" style={{ color: "var(--text-muted)" }}>Pas journaliers</p>
                    <ResponsiveContainer width="100%" height={100}>
                      <AreaChart data={chartData.filter((p) => (p.steps ?? 0) > 0)} margin={{ top: 2, right: 4, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="stepsGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--steps)" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="var(--steps)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="label" tick={{ fontSize: 9, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                        <YAxis tick={{ fontSize: 9, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} />
                        <Tooltip content={({ active, payload, label: lbl }) => active && payload?.length ? <Tt label={String(lbl ?? "")} value={(payload[0].value as number).toLocaleString("fr-FR")} unit="pas" color="var(--steps)" /> : null} />
                        <ReferenceLine y={10000} stroke="rgba(56,189,248,0.3)" strokeDasharray="4 4" />
                        <Area type="monotone" dataKey="steps" stroke="var(--steps)" strokeWidth={2} fill="url(#stepsGrad)" dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </>
                )}
                {/* Active minutes */}
                {avgActiveMins > 0 && (
                  <>
                    <div className="h-px my-3" style={{ background: "var(--border)" }} />
                    <p className="text-[11px] mb-1" style={{ color: "var(--text-muted)" }}>Minutes actives</p>
                    <ResponsiveContainer width="100%" height={90}>
                      <BarChart data={chartData.filter((p) => (p.activeMinutes ?? 0) > 0)} margin={{ top: 2, right: 4, left: -20, bottom: 0 }}>
                        <XAxis dataKey="label" tick={{ fontSize: 9, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                        <YAxis tick={{ fontSize: 9, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} />
                        <Tooltip content={({ active, payload, label: lbl }) => active && payload?.length ? <Tt label={String(lbl ?? "")} value={payload[0].value as number} unit="min" color="var(--carbs)" /> : null} />
                        <ReferenceLine y={30} stroke="rgba(251,191,36,0.3)" strokeDasharray="4 4" />
                        <Bar dataKey="activeMinutes" fill="var(--carbs)" fillOpacity={0.75} radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </>
                )}
              </motion.div>
            )}

            {/* Weight trend */}
            {weightData.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.1 }} className="glass p-5 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="label-xs">Courbe de poids</p>
                  {weightDelta !== null && (
                    <span className="flex items-center gap-1 text-[12px] font-medium"
                      style={{ color: weightDelta < -0.1 ? "#4ade80" : weightDelta > 0.1 ? "#f87171" : "var(--text-muted)" }}>
                      {weightDelta < -0.1 ? <ArrowDown size={11} weight="bold" /> : weightDelta > 0.1 ? <ArrowUp size={11} weight="bold" /> : <Minus size={11} />}
                      {Math.abs(weightDelta).toFixed(1)} kg
                    </span>
                  )}
                </div>
                <ResponsiveContainer width="100%" height={130}>
                  <LineChart data={weightData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} domain={["auto", "auto"]} />
                    <Tooltip content={({ active, payload, label: lbl }) => active && payload?.length ? <Tt label={String(lbl ?? "")} value={(payload[0].value as number).toFixed(1)} unit="kg" color="var(--steps)" /> : null} />
                    {targetWeightKg && (
                      <ReferenceLine y={targetWeightKg} stroke="rgba(74,222,128,0.5)" strokeDasharray="4 4"
                        label={{ value: `${targetWeightKg}kg`, fontSize: 10, fill: "#4ade80", position: "insideTopRight" }} />
                    )}
                    <Line type="monotone" dataKey="weightKg" stroke="var(--steps)" strokeWidth={2.5} dot={{ fill: "var(--steps)", r: 3 }} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              </motion.div>
            )}

            {/* Macros */}
            {caloriePoints.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.12 }} className="glass p-5 mb-4">
                <p className="label-xs mb-4">Macros moyens / jour</p>
                <ResponsiveContainer width="100%" height={110}>
                  <BarChart
                    data={[
                      { name: "Protéines", value: avgProtein, goal: goals.proteinGrams },
                      { name: "Glucides",  value: Math.round(caloriePoints.reduce((s, p) => s + p.carbsG, 0) / caloriePoints.length), goal: goals.carbsGrams },
                      { name: "Lipides",   value: Math.round(caloriePoints.reduce((s, p) => s + p.fatG,   0) / caloriePoints.length), goal: goals.fatGrams  },
                    ]}
                    margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} />
                    <Tooltip content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload as { name: string; value: number; goal: number };
                      return <Tt label={d.name} value={`${d.value}g / ${d.goal}g`} />;
                    }} />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {["var(--protein)", "var(--carbs)", "var(--fat)"].map((color, i) => (
                        <Cell key={i} fill={color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </motion.div>
            )}

            {/* Weight projection */}
            {currentWeightKg && targetWeightKg && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.14 }} className="glass p-5 mb-4">
                <div className="flex items-center gap-2 mb-4">
                  <Scales size={15} style={{ color: "var(--protein)" }} />
                  <p className="label-xs">Projection de poids</p>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="p-3 rounded-xl text-center" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
                    <p className="text-[20px] font-bold tabular-nums" style={{ color: "var(--steps)" }}>{currentWeightKg.toFixed(1)} kg</p>
                    <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>Poids actuel</p>
                  </div>
                  <div className="p-3 rounded-xl text-center" style={{ background: "rgba(74,222,128,0.06)", border: "1px solid rgba(74,222,128,0.3)" }}>
                    <p className="text-[20px] font-bold tabular-nums" style={{ color: "#4ade80" }}>{targetWeightKg.toFixed(1)} kg</p>
                    <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>Objectif</p>
                  </div>
                </div>
                {avgCalories > 0 ? (
                  <div className="p-3 rounded-xl text-center" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
                    {projectionDate ? (
                      <>
                        <div className="flex items-center justify-center gap-2 mb-1">
                          <CalendarBlank size={14} style={{ color: "var(--calories)" }} />
                          <p className="text-[14px] font-bold" style={{ color: "var(--text-primary)" }}>{projectionDate}</p>
                        </div>
                        <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                          À ce rythme ({avgCalories} kcal/j), objectif en ~{projectionDays} jours
                        </p>
                      </>
                    ) : (
                      <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
                        {currentWeightKg <= targetWeightKg ? "🎯 Objectif atteint !" : "Augmentez votre déficit pour atteindre l'objectif."}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-[12px] text-center" style={{ color: "var(--text-muted)" }}>Loggez des repas pour calculer la projection.</p>
                )}
              </motion.div>
            )}

            {points.length === 0 && !loading && (
              <div className="flex flex-col items-center gap-3 py-16">
                <span className="text-5xl">📊</span>
                <p className="text-[14px] font-medium" style={{ color: "var(--text-secondary)" }}>Aucune donnée</p>
                <p className="text-[12px] text-center" style={{ color: "var(--text-muted)" }}>Commencez à logger vos repas pour voir vos tendances.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
