"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { format, subDays } from "date-fns";
import { fr } from "date-fns/locale";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell
} from "recharts";
import { ArrowDown, ArrowUp, Minus, Lightning, Scales, ChartBar, ChartLine, CalendarBlank } from "@phosphor-icons/react";
import type { DayTrendPoint, NutritionGoals } from "@/app/lib/types";

type Range = "7d" | "30d" | "3m" | "6m" | "1y" | "all";
type CalChart = "area" | "bar";

const RANGES: { key: Range; label: string; days?: number }[] = [
  { key: "7d",  label: "7J",  days: 7  },
  { key: "30d", label: "30J", days: 30 },
  { key: "3m",  label: "3M",  days: 90 },
  { key: "6m",  label: "6M",  days: 180 },
  { key: "1y",  label: "1A",  days: 365 },
  { key: "all", label: "Tout" },
];

// TDEE estimate kcal/day based on activity level
function estimateTDEE(goals: NutritionGoals): number {
  return goals.dailyCalories;
}

// Weekly deficit/surplus → weeks to reach target
function calcProjection(currentKg: number, targetKg: number, avgCalories: number, tdee: number) {
  const dailyDelta = avgCalories - tdee; // negative = deficit
  if (dailyDelta === 0) return null;
  const kgPerDay = dailyDelta / 7700; // 7700 kcal ≈ 1 kg fat
  const kgNeeded = targetKg - currentKg;
  const daysNeeded = kgNeeded / kgPerDay;
  if (daysNeeded <= 0) return null;
  return Math.round(daysNeeded);
}

interface Props {
  goals:           NutritionGoals;
  currentWeightKg: number | null;
  targetWeightKg:  number | null;
}

const CustomTooltipCal = ({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="px-3 py-2 rounded-xl text-[12px]"
      style={{ background: "rgba(13,13,17,0.96)", border: "1px solid var(--border)", backdropFilter: "blur(8px)" }}>
      <p style={{ color: "var(--text-muted)" }}>{label}</p>
      <p style={{ color: "var(--calories)" }} className="font-bold">{payload[0]?.value} kcal</p>
    </div>
  );
};

const CustomTooltipWeight = ({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="px-3 py-2 rounded-xl text-[12px]"
      style={{ background: "rgba(13,13,17,0.96)", border: "1px solid var(--border)", backdropFilter: "blur(8px)" }}>
      <p style={{ color: "var(--text-muted)" }}>{label}</p>
      <p style={{ color: "var(--steps)" }} className="font-bold">{payload[0]?.value?.toFixed(1)} kg</p>
    </div>
  );
};

export default function ProgressClient({ goals, currentWeightKg, targetWeightKg }: Props) {
  const [range,      setRange]      = useState<Range>("30d");
  const [calChart,   setCalChart]   = useState<CalChart>("area");
  const [points,     setPoints]     = useState<DayTrendPoint[]>([]);
  const [loading,    setLoading]    = useState(true);

  // Load saved chart preferences on mount
  useEffect(() => {
    fetch("/api/goals")
      .then((r) => r.json())
      .then((data: { chartPrefs?: { calorieTrend?: string } | null }) => {
        if (data.chartPrefs?.calorieTrend === "bar") setCalChart("bar");
      })
      .catch(() => {});
  }, []);

  const loadData = useCallback(async (r: Range) => {
    setLoading(true);
    try {
      const today = format(new Date(), "yyyy-MM-dd");
      let from: string;
      const rangeObj = RANGES.find((x) => x.key === r);
      if (r === "all" || !rangeObj?.days) {
        from = "2020-01-01";
      } else {
        from = format(subDays(new Date(), rangeObj.days), "yyyy-MM-dd");
      }
      const res = await fetch(`/api/progress?from=${from}&to=${today}`);
      if (res.ok) {
        const { points: p } = await res.json() as { points: DayTrendPoint[] };
        setPoints(p ?? []);
      }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(range); }, [range, loadData]);

  // Chart data — format dates for display
  const chartData = points.map((p) => ({
    ...p,
    label: format(new Date(p.date + "T12:00:00"), "dd/MM"),
  }));

  const weightData = chartData.filter((p) => p.weightKg != null && p.weightKg! > 0);

  // Stats
  const caloriePoints = chartData.filter((p) => p.calories > 0);
  const avgCalories = caloriePoints.length
    ? Math.round(caloriePoints.reduce((s, p) => s + p.calories, 0) / caloriePoints.length)
    : 0;
  const avgProtein  = caloriePoints.length
    ? Math.round(caloriePoints.reduce((s, p) => s + p.proteinG, 0) / caloriePoints.length)
    : 0;
  const avgSteps    = chartData.filter((p) => (p.steps ?? 0) > 0).length
    ? Math.round(chartData.filter((p) => (p.steps ?? 0) > 0).reduce((s, p) => s + (p.steps ?? 0), 0)
        / chartData.filter((p) => (p.steps ?? 0) > 0).length)
    : 0;

  const firstWeight = weightData[0]?.weightKg;
  const lastWeight  = weightData[weightData.length - 1]?.weightKg;
  const weightDelta = (firstWeight && lastWeight) ? lastWeight - firstWeight : null;

  // Projection
  const tdee = estimateTDEE(goals);
  const projectionDays = (currentWeightKg && targetWeightKg && avgCalories > 0)
    ? calcProjection(currentWeightKg, targetWeightKg, avgCalories, tdee)
    : null;

  const projectionDate = projectionDays
    ? format(new Date(Date.now() + projectionDays * 86400000), "d MMMM yyyy", { locale: fr })
    : null;

  return (
    <div className="relative min-h-screen" style={{ paddingBottom: "80px" }}>
      <div className="bg-orbs" />
      <div className="relative z-10 max-w-md mx-auto px-4 py-6 md:ml-[220px] md:max-w-2xl">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-5"
        >
          <p className="label-xs mb-0.5">Analyse</p>
          <h1 className="text-[22px] font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
            Progrès
          </h1>
        </motion.div>

        {/* Range selector */}
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.04 }}
          className="flex gap-1.5 mb-5 overflow-x-auto pb-1"
          style={{ scrollbarWidth: "none" }}
        >
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className="flex-shrink-0 px-3 py-1.5 rounded-xl text-[12px] font-medium transition-all"
              style={{
                background: range === r.key ? "rgba(249,115,22,0.12)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${range === r.key ? "rgba(249,115,22,0.4)" : "var(--border)"}`,
                color: range === r.key ? "var(--calories)" : "var(--text-secondary)",
              }}
            >
              {r.label}
            </button>
          ))}
        </motion.div>

        {/* Summary stats */}
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.06 }}
          className="grid grid-cols-3 gap-3 mb-5"
        >
          <div className="card flex flex-col gap-1">
            <span className="label-xs">Moy. calories</span>
            <span className="text-[20px] font-bold tabular-nums" style={{ color: "var(--calories)" }}>
              {avgCalories || "—"}
            </span>
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>kcal/jour</span>
          </div>
          <div className="card flex flex-col gap-1">
            <span className="label-xs">Moy. protéines</span>
            <span className="text-[20px] font-bold tabular-nums" style={{ color: "var(--protein)" }}>
              {avgProtein || "—"}
            </span>
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>g/jour</span>
          </div>
          <div className="card flex flex-col gap-1">
            <span className="label-xs">Moy. pas</span>
            <span className="text-[20px] font-bold tabular-nums" style={{ color: "var(--steps)" }}>
              {avgSteps ? avgSteps.toLocaleString("fr-FR") : "—"}
            </span>
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>pas/jour</span>
          </div>
        </motion.div>

        {/* Calorie trend */}
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.08 }}
          className="glass p-5 mb-4"
        >
          <div className="flex items-center justify-between mb-4">
            <p className="label-xs">Calories journalières</p>
            <div className="flex gap-1.5">
              {(["area", "bar"] as CalChart[]).map((t) => (
                <button key={t} onClick={() => setCalChart(t)}
                  className="btn-icon w-7 h-7"
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
          ) : chartData.filter((p) => p.calories > 0).length === 0 ? (
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
                  <Tooltip content={<CustomTooltipCal />} />
                  <ReferenceLine y={goals.dailyCalories} stroke="rgba(249,115,22,0.4)" strokeDasharray="4 4" />
                  <Area type="monotone" dataKey="calories" stroke="var(--calories)" strokeWidth={2} fill="url(#calGrad)" dot={false} />
                </AreaChart>
              ) : (
                <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltipCal />} />
                  <ReferenceLine y={goals.dailyCalories} stroke="rgba(249,115,22,0.4)" strokeDasharray="4 4" />
                  <Bar dataKey="calories" fill="var(--calories)" fillOpacity={0.8} radius={[3, 3, 0, 0]} />
                </BarChart>
              )}
            </ResponsiveContainer>
          )}
        </motion.div>

        {/* Weight trend */}
        {weightData.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="glass p-5 mb-4"
          >
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
                <Tooltip content={<CustomTooltipWeight />} />
                {targetWeightKg && (
                  <ReferenceLine y={targetWeightKg} stroke="rgba(74,222,128,0.5)" strokeDasharray="4 4" label={{ value: `Objectif ${targetWeightKg}kg`, fontSize: 10, fill: "#4ade80", position: "insideTopRight" }} />
                )}
                <Line type="monotone" dataKey="weightKg" stroke="var(--steps)" strokeWidth={2.5} dot={{ fill: "var(--steps)", r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </motion.div>
        )}

        {/* Macro averages */}
        {caloriePoints.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.12 }}
            className="glass p-5 mb-4"
          >
            <p className="label-xs mb-4">Macros moyens / jour</p>
            <ResponsiveContainer width="100%" height={110}>
              <BarChart
                data={[{
                  name: "Protéines", value: avgProtein, goal: goals.proteinGrams, color: "var(--protein)",
                }, {
                  name: "Glucides",  value: Math.round(caloriePoints.reduce((s, p) => s + p.carbsG, 0) / caloriePoints.length), goal: goals.carbsGrams, color: "var(--carbs)",
                }, {
                  name: "Lipides",   value: Math.round(caloriePoints.reduce((s, p) => s + p.fatG, 0)  / caloriePoints.length), goal: goals.fatGrams,  color: "var(--fat)",
                }]}
                margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload as { name: string; value: number; goal: number };
                    return (
                      <div className="px-3 py-2 rounded-xl text-[12px]"
                        style={{ background: "rgba(13,13,17,0.96)", border: "1px solid var(--border)" }}>
                        <p style={{ color: "var(--text-muted)" }}>{d.name}</p>
                        <p className="font-bold" style={{ color: "var(--text-primary)" }}>{d.value}g <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>/ {d.goal}g</span></p>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {[{ color: "var(--protein)" }, { color: "var(--carbs)" }, { color: "var(--fat)" }].map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </motion.div>
        )}

        {/* Weight projection */}
        {currentWeightKg && targetWeightKg && (
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.14 }}
            className="glass p-5 mb-4"
          >
            <div className="flex items-center gap-2 mb-4">
              <Scales size={15} style={{ color: "var(--protein)" }} />
              <p className="label-xs">Projection de poids</p>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="p-3 rounded-xl text-center"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
                <p className="text-[20px] font-bold tabular-nums" style={{ color: "var(--steps)" }}>
                  {currentWeightKg.toFixed(1)} kg
                </p>
                <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>Poids actuel</p>
              </div>
              <div className="p-3 rounded-xl text-center"
                style={{ background: "rgba(74,222,128,0.06)", border: "1px solid rgba(74,222,128,0.3)" }}>
                <p className="text-[20px] font-bold tabular-nums" style={{ color: "#4ade80" }}>
                  {targetWeightKg.toFixed(1)} kg
                </p>
                <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>Objectif</p>
              </div>
            </div>
            {avgCalories > 0 ? (
              <div className="p-3 rounded-xl text-center"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
                {projectionDate ? (
                  <>
                    <div className="flex items-center justify-center gap-2 mb-1">
                      <CalendarBlank size={14} style={{ color: "var(--calories)" }} />
                      <p className="text-[14px] font-bold" style={{ color: "var(--text-primary)" }}>
                        {projectionDate}
                      </p>
                    </div>
                    <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                      À ce rythme ({avgCalories} kcal/j moy.), objectif atteint en ~{projectionDays} jours
                    </p>
                    <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
                      Basé sur {tdee} kcal/j TDEE estimé
                    </p>
                  </>
                ) : (
                  <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
                    {currentWeightKg <= targetWeightKg
                      ? "🎯 Objectif atteint !"
                      : "Augmentez votre déficit calorique pour atteindre l'objectif."}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-[12px] text-center" style={{ color: "var(--text-muted)" }}>
                Loggez des repas pour calculer la projection.
              </p>
            )}
          </motion.div>
        )}

        {/* Steps trend */}
        {avgSteps > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.16 }}
            className="glass p-5 mb-4"
          >
            <div className="flex items-center gap-2 mb-4">
              <Lightning size={13} weight="fill" style={{ color: "var(--steps)" }} />
              <p className="label-xs">Pas journaliers</p>
            </div>
            <ResponsiveContainer width="100%" height={110}>
              <AreaChart data={chartData.filter((p) => (p.steps ?? 0) > 0)} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="stepsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--steps)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--steps)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} />
                <Tooltip content={({ active, payload, label: lbl }) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <div className="px-3 py-2 rounded-xl text-[12px]"
                      style={{ background: "rgba(13,13,17,0.96)", border: "1px solid var(--border)" }}>
                      <p style={{ color: "var(--text-muted)" }}>{lbl}</p>
                      <p style={{ color: "var(--steps)" }} className="font-bold">{(payload[0]?.value as number)?.toLocaleString("fr-FR")} pas</p>
                    </div>
                  );
                }} />
                <ReferenceLine y={10000} stroke="rgba(56,189,248,0.3)" strokeDasharray="4 4" />
                <Area type="monotone" dataKey="steps" stroke="var(--steps)" strokeWidth={2} fill="url(#stepsGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>
        )}

        {points.length === 0 && !loading && (
          <div className="flex flex-col items-center gap-3 py-16">
            <span className="text-5xl">📊</span>
            <p className="text-[14px] font-medium" style={{ color: "var(--text-secondary)" }}>Aucune donnée</p>
            <p className="text-[12px] text-center" style={{ color: "var(--text-muted)" }}>
              Commencez à logger vos repas pour voir vos tendances.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
