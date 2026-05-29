"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { format, subDays, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import {
  ComposedChart, AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell, Legend,
} from "recharts";
import {
  ArrowDown, ArrowUp, Minus, Lightning, Scales, ChartBar, ChartLine,
  CalendarBlank, Footprints, Fire, Heart, Moon, Drop, PersonSimpleRun,
} from "@phosphor-icons/react";
import type { DayTrendPoint, NutritionGoals, NutritionPlan } from "@/app/lib/types";
import AIInsightBox from "@/app/components/AIInsightBox";
import { Spinner } from "@phosphor-icons/react";

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

function hrZoneColor(bpm: number, maxHr: number): string {
  const pct = bpm / maxHr;
  if (pct < 0.50) return "var(--fit-indigo)";
  if (pct < 0.60) return "#4285F4";
  if (pct < 0.70) return "var(--fit-green)";
  if (pct < 0.85) return "#FBBC04";
  return "var(--fit-red)";
}

interface Props {
  goals:           NutritionGoals;
  currentWeightKg: number | null;
  targetWeightKg:  number | null;
  targetDate?:     string;
  age?:            number;
  plan?:           NutritionPlan;
}

const Tt = ({ bg, label, value, unit, color }: { bg?: string; label: string; value: string | number | undefined; unit?: string; color?: string }) => (
  <div className="px-3 py-2 rounded-xl text-[12px]"
    style={{ background: bg ?? "rgba(13,13,17,0.96)", border: "1px solid var(--border)" }}>
    <p style={{ color: "var(--text-muted)" }}>{label}</p>
    <p className="font-bold" style={{ color: color ?? "var(--text-primary)" }}>{value}{unit ? ` ${unit}` : ""}</p>
  </div>
);

// ── Build combined actual + projected weight chart data ──────────────────────
type WeightChartPoint = {
  label:     string;
  date:      string;
  actual:    number | null;
  projected: number | null;
  calories:  number | null;
  isToday?:  boolean;
  isFuture?: boolean;
};

function buildWeightChartData(
  weightData: { label: string; date: string; weightKg: number | undefined }[],
  calorieData: { date: string; calories: number }[],
  currentKg: number | null,
  targetKg: number | null,
  targetDate: string | undefined,
): WeightChartPoint[] {
  const today    = new Date();
  const todayStr = format(today, "yyyy-MM-dd");

  const calMap = new Map(calorieData.map(p => [p.date, p.calories]));

  // Past: actual measured weight
  const past: WeightChartPoint[] = weightData
    .filter(p => (p.weightKg ?? 0) > 0)
    .map(p => ({
      date:      p.date,
      label:     p.label,
      actual:    p.weightKg ?? null,
      projected: null,
      calories:  calMap.get(p.date) ?? null,
    }));

  if (!targetKg || !targetDate) return past;

  const lastActual = past[past.length - 1]?.actual ?? currentKg;
  if (!lastActual) return past;

  const endDate   = new Date(targetDate + "T00:00:00");
  const totalDays = Math.max(7, Math.round((endDate.getTime() - today.getTime()) / 86400000));
  const dailyDelta = (targetKg - lastActual) / totalDays;

  // Bridge point: today (connects actual line to projected line)
  const todayBridge: WeightChartPoint = {
    date:      todayStr,
    label:     "Auj.",
    actual:    lastActual,
    projected: lastActual,
    calories:  calMap.get(todayStr) ?? null,
    isToday:   true,
  };

  // Future projection: weekly points up to target date
  const future: WeightChartPoint[] = [];
  const weeksTotal = Math.ceil(totalDays / 7);
  for (let w = 1; w <= weeksTotal; w++) {
    const d = new Date(today.getTime() + w * 7 * 86400000);
    if (d >= endDate) break;
    const daysFromNow = Math.round((d.getTime() - today.getTime()) / 86400000);
    future.push({
      date:      format(d, "yyyy-MM-dd"),
      label:     format(d, "dd/MM"),
      actual:    null,
      projected: Math.round((lastActual + dailyDelta * daysFromNow) * 10) / 10,
      calories:  null,
      isFuture:  true,
    });
  }
  // Final target point
  future.push({
    date:      targetDate,
    label:     format(endDate, "dd/MM/yy"),
    actual:    null,
    projected: targetKg,
    calories:  null,
    isFuture:  true,
  });

  // Deduplicate: avoid duplicate today if already in past
  const filteredPast = past.filter(p => p.date !== todayStr);
  return [...filteredPast, todayBridge, ...future];
}

export default function ProgressClient({ goals, currentWeightKg, targetWeightKg, targetDate: initialTargetDate, age, plan: initialPlan }: Props) {
  const fcMax = age ? 220 - age : 190;
  const [range,           setRange]      = useState<Range>("30d");
  const [calChart,        setCalChart]   = useState<CalChart>("area");
  const [points,          setPoints]     = useState<DayTrendPoint[]>([]);
  const [loading,         setLoading]    = useState(true);
  const [plan,            setPlan]       = useState<NutritionPlan | undefined>(initialPlan);
  const [planRecalcLoading, setPlanRecalcLoading] = useState(false);
  const [targetDate,      setTargetDate] = useState<string>(
    initialTargetDate ?? plan?.projectedTargetDate ?? ""
  );

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

  const avgSleepPts = points.filter((p) => (p.sleepMinutes ?? 0) > 0);
  const avgSleepH   = avgSleepPts.length
    ? Math.round(avgSleepPts.reduce((s, p) => s + (p.sleepMinutes ?? 0), 0) / avgSleepPts.length / 6) / 10
    : 0;
  const avgHRPts    = points.filter((p) => (p.heartRateAvg ?? 0) > 0);
  const avgHR       = avgHRPts.length
    ? Math.round(avgHRPts.reduce((s, p) => s + (p.heartRateAvg ?? 0), 0) / avgHRPts.length)
    : null;
  const weightTrend = weightDelta === null ? "stable" : weightDelta < -0.1 ? "down" : weightDelta > 0.1 ? "up" : "stable";

  // ── Dual-axis weight chart data ──
  const weightChartData = buildWeightChartData(
    chartData.map(p => ({ label: p.label, date: p.date, weightKg: p.weightKg })),
    chartData.map(p => ({ date: p.date, calories: p.calories })),
    currentWeightKg,
    targetWeightKg,
    targetDate || undefined,
  );
  const weightYMin = weightChartData.length
    ? Math.floor(Math.min(
        ...weightChartData.map(p => p.actual ?? p.projected ?? 999).filter(v => v < 999)
      ) - 1)
    : undefined;
  const weightYMax = weightChartData.length
    ? Math.ceil(Math.max(
        ...weightChartData.map(p => p.actual ?? p.projected ?? 0).filter(v => v > 0)
      ) + 1)
    : undefined;

  const progressInsightData = {
    days:           points.length,
    avgCalories,
    avgSteps,
    avgSleepH,
    avgHR,
    startWeight:    currentWeightKg,  // start of range
    currentWeight:  currentWeightKg,
    targetWeight:   targetWeightKg,
    weightTrend,
    calorieGoal:    goals.dailyCalories,
    stepsGoal:      goals.stepsGoal ?? 10000,
    sleepGoalH:     Math.round((goals.sleepGoalMin ?? 480) / 60 * 10) / 10,
    plan: plan ? {
      label:          plan.programLabel,
      emoji:          plan.programEmoji,
      day:            Math.floor((Date.now() - new Date(plan.startDate + "T00:00:00").getTime()) / 86400000) + 1,
      projectedDate:  plan.projectedTargetDate,
      weeklyLoss:     plan.projectedWeeklyLossKg,
    } : undefined,
  };

  const tdee = estimateTDEE(goals);
  const projectionDays = (currentWeightKg && targetWeightKg && avgCalories > 0)
    ? calcProjection(currentWeightKg, targetWeightKg, avgCalories, tdee) : null;
  const projectionDate = projectionDays
    ? format(new Date(Date.now() + projectionDays * 86400000), "d MMMM yyyy", { locale: fr }) : null;

  // ── today data (for Jour view)
  const todayPoint = points[points.length - 1];

  const handleRecalcPlan = async () => {
    if (!plan) return;
    setPlanRecalcLoading(true);
    try {
      const res = await fetch("/api/plan/projection", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ plan, goals }),
      });
      if (res.ok) {
        const json = await res.json() as { ok: boolean; projectedTargetDate: string | null; projectedWeeklyLossKg: number | null; projectedNote: string | null };
        setPlan(p => p ? {
          ...p,
          projectedTargetDate:   json.projectedTargetDate   ?? undefined,
          projectedWeeklyLossKg: json.projectedWeeklyLossKg ?? undefined,
          projectedNote:         json.projectedNote         ?? undefined,
        } : p);
      }
    } catch { /* noop */ }
    finally { setPlanRecalcLoading(false); }
  };

  return (
    <div className="relative min-h-screen" style={{ paddingBottom: "80px" }}>
      <div className="bg-orbs" />
      <div className="relative z-10 max-w-md mx-auto px-4 py-6 md:ml-[220px] md:max-w-2xl">

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="mb-5">
          <p className="label-xs mb-0.5">Analyse</p>
          <h1 className="text-[22px] font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>Progrès</h1>
        </motion.div>

        {/* ── Mon plan card ── */}
        {plan && (() => {
          const daysInPlan = Math.floor((Date.now() - new Date(plan.startDate + "T00:00:00").getTime()) / 86400000) + 1;
          const startKg    = plan.startWeightKg;
          const targetKg   = plan.targetWeightKg;
          const currentKg  = currentWeightKg;
          const progressPct = (startKg && targetKg && currentKg && startKg !== targetKg)
            ? Math.max(0, Math.min(100, Math.abs(currentKg - startKg) / Math.abs(targetKg - startKg) * 100))
            : null;
          return (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.02 }}
              className="glass p-4 mb-5">
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-[20px]">{plan.programEmoji}</span>
                  <div>
                    <p className="font-semibold text-[14px]" style={{ color: "var(--text-primary)" }}>{plan.programLabel}</p>
                    <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Démarré le {format(new Date(plan.startDate + "T00:00:00"), "d MMMM yyyy", { locale: fr })}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold"
                    style={{ background: "rgba(249,115,22,0.12)", color: "var(--calories)", border: "1px solid rgba(249,115,22,0.3)" }}>
                    Jour {daysInPlan}
                  </span>
                  <button onClick={handleRecalcPlan} disabled={planRecalcLoading}
                    className="btn btn-ghost text-[11px] px-2 py-1 gap-1"
                    style={{ height: "auto" }}>
                    {planRecalcLoading
                      ? <Spinner size={11} className="animate-spin" />
                      : "Recalculer"
                    }
                  </button>
                </div>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-4 gap-2 mb-3">
                {[
                  { label: "Départ",  value: startKg   ? `${startKg} kg`   : "—", color: "var(--text-primary)" },
                  { label: "Actuel",  value: currentKg ? `${currentKg.toFixed(1)} kg` : "—", color: "var(--protein)" },
                  { label: "Cible",   value: targetKg  ? `${targetKg} kg`  : "—", color: "var(--fiber)" },
                  { label: "Calories", value: `${plan.dailyCalories}`, color: "var(--calories)" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex flex-col items-center p-2 rounded-xl gap-0.5"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)" }}>
                    <span className="text-[13px] font-bold tabular-nums" style={{ color }}>{value}</span>
                    <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>{label}</span>
                  </div>
                ))}
              </div>

              {/* Progress bar */}
              {progressPct !== null && (
                <div className="mb-3">
                  <div className="flex justify-between text-[10px] mb-1" style={{ color: "var(--text-muted)" }}>
                    <span>{startKg} kg</span>
                    <span>{Math.round(progressPct)}% atteint</span>
                    <span>{targetKg} kg</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
                    <div className="h-full rounded-full transition-all"
                      style={{ width: `${progressPct}%`, background: "linear-gradient(90deg, var(--protein), var(--fiber))" }} />
                  </div>
                </div>
              )}

              {/* Projection — weekly + monthly reduction */}
              {(plan.projectedWeeklyLossKg !== undefined || plan.projectedTargetDate) && (() => {
                const wk  = plan.projectedWeeklyLossKg ?? 0;
                const mo  = Math.round(wk * 4.33 * 100) / 100;
                const isLoss = wk < 0;
                const color  = isLoss ? "var(--fiber)" : "var(--protein)";
                const sign   = (v: number) => v <= 0 ? v.toFixed(2) : `+${v.toFixed(2)}`;
                return (
                  <div className="pt-3 mt-1" style={{ borderTop: "1px solid var(--border)" }}>
                    {/* Weekly / Monthly chips */}
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <div className="flex flex-col items-center p-2.5 rounded-xl gap-0.5"
                        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)" }}>
                        <span className="text-[15px] font-bold tabular-nums" style={{ color }}>
                          {sign(wk)} kg
                        </span>
                        <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>/ semaine</span>
                      </div>
                      <div className="flex flex-col items-center p-2.5 rounded-xl gap-0.5"
                        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)" }}>
                        <span className="text-[15px] font-bold tabular-nums" style={{ color }}>
                          {sign(mo)} kg
                        </span>
                        <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>/ mois</span>
                      </div>
                    </div>
                    {/* Target date */}
                    {plan.projectedTargetDate && (
                      <p className="text-[11px] font-medium" style={{ color: "var(--fiber)" }}>
                        🎯 Objectif estimé le {format(new Date(plan.projectedTargetDate + "T00:00:00"), "d MMMM yyyy", { locale: fr })}
                      </p>
                    )}
                    {/* AI note */}
                    {plan.projectedNote && (
                      <p className="text-[11px] mt-1 italic" style={{ color: "var(--text-muted)" }}>
                        {plan.projectedNote}
                      </p>
                    )}
                  </div>
                );
              })()}
            </motion.div>
          );
        })()}

        {/* ── AI Insight ── */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.06 }}
          className="mb-5">
          <AIInsightBox type="progress" data={progressInsightData} delay={1000} autoLoad />
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
                      { icon: Lightning,     label: "Min. actives",   val: todayPoint?.activeMinutes ?? "—",                                                color: "var(--fit-green)", goal: "/ 30 min" },
                      { icon: Fire,          label: "Kcal brûlées",   val: todayPoint?.burned ?? "—",                                                       color: "var(--fit-red)",   goal: "actives" },
                      { icon: Heart,         label: "FC moy.",         val: todayPoint?.heartRateAvg ? `${todayPoint.heartRateAvg} bpm` : "—",               color: "var(--fit-red)",   goal: todayPoint?.heartRateAvg ? (todayPoint.heartRateAvg < 60 ? "Repos" : todayPoint.heartRateAvg < 100 ? "Normal" : "Élevé") : "" },
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
                    <Moon size={16} weight="fill" style={{ color: "var(--fit-indigo)" }} />
                    <p className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>Récupération</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-3 p-3 rounded-xl"
                      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)" }}>
                      <Moon size={24} weight="fill" style={{ color: "var(--fit-indigo)", flexShrink: 0 }} />
                      <div>
                        <p className="text-[20px] font-bold leading-tight" style={{ color: "var(--fit-indigo)" }}>
                          {fmtSleep(todayPoint?.sleepMinutes)}
                        </p>
                        <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Sommeil</p>
                        {todayPoint?.sleepMinutes && (
                          <p className="text-[9px]" style={{ color: (todayPoint.sleepMinutes >= 420) ? "var(--fit-green)" : "#fbbf24" }}>
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
                <span className="text-[20px] font-bold tabular-nums" style={{ color: "var(--fit-green)" }}>{avgActiveMins || "—"}</span>
                <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>min/j</span>
              </div>
            </motion.div>

            {/* Calories & Activité — fused card */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.08 }}
              className="glass p-5 mb-4">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Fire size={14} weight="fill" style={{ color: "var(--calories)" }} />
                  <p className="label-xs">Calories &amp; Activité</p>
                </div>
                <div className="flex gap-1.5">
                  {(["area", "bar"] as CalChart[]).map((t) => (
                    <button key={t} onClick={() => setCalChart(t)} className="btn-icon w-7 h-7"
                      style={{ color: calChart === t ? "var(--calories)" : "var(--text-muted)" }}>
                      {t === "area" ? <ChartLine size={13} /> : <ChartBar size={13} />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Calorie chart */}
              <p className="text-[10px] mb-1.5 font-medium" style={{ color: "var(--text-muted)" }}>Calories consommées</p>
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

              {/* Activity section — inside the same card */}
              {activityPoints.length > 0 && (
                <>
                  <div className="h-px my-4" style={{ background: "var(--border)" }} />
                  <div className="flex items-center gap-2 mb-3">
                    <PersonSimpleRun size={13} weight="fill" style={{ color: "var(--steps)" }} />
                    <p className="text-[10px] font-medium" style={{ color: "var(--text-muted)" }}>Activité sportive</p>
                    {avgSteps > 0 && (
                      <span className="ml-auto text-[10px] tabular-nums" style={{ color: "var(--steps)" }}>
                        ~{avgSteps.toLocaleString("fr-FR")} pas/j
                      </span>
                    )}
                  </div>
                  {/* Steps */}
                  {avgSteps > 0 && (
                    <>
                      <p className="text-[10px] mb-1" style={{ color: "var(--text-muted)" }}>Pas journaliers</p>
                      <ResponsiveContainer width="100%" height={90}>
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
                          <Area type="monotone" dataKey="steps" stroke="var(--steps)" strokeWidth={1.5} fill="url(#stepsGrad)" dot={false} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </>
                  )}
                  {/* Active minutes */}
                  {avgActiveMins > 0 && (
                    <>
                      <div className="h-px my-3" style={{ background: "var(--border)" }} />
                      <p className="text-[10px] mb-1" style={{ color: "var(--text-muted)" }}>Minutes actives · moy. {avgActiveMins} min/j</p>
                      <ResponsiveContainer width="100%" height={80}>
                        <BarChart data={chartData.filter((p) => (p.activeMinutes ?? 0) > 0)} margin={{ top: 2, right: 4, left: -20, bottom: 0 }}>
                          <XAxis dataKey="label" tick={{ fontSize: 9, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                          <YAxis tick={{ fontSize: 9, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} />
                          <Tooltip content={({ active, payload, label: lbl }) => active && payload?.length ? <Tt label={String(lbl ?? "")} value={payload[0].value as number} unit="min" color="var(--fit-green)" /> : null} />
                          <ReferenceLine y={30} stroke="rgba(52,168,83,0.3)" strokeDasharray="4 4" />
                          <Bar dataKey="activeMinutes" fill="var(--fit-green)" fillOpacity={0.75} radius={[3, 3, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </>
                  )}
                </>
              )}
            </motion.div>

            {/* ── Dual-axis weight + simulation chart ── */}
            {(weightData.length > 0 || currentWeightKg) && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.1 }} className="glass p-5 mb-4">

                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Scales size={15} style={{ color: "var(--protein)" }} />
                    <p className="label-xs">Poids &amp; Simulation</p>
                  </div>
                  {weightDelta !== null && (
                    <span className="flex items-center gap-1 text-[12px] font-medium"
                      style={{ color: weightDelta < -0.1 ? "#4ade80" : weightDelta > 0.1 ? "#f87171" : "var(--text-muted)" }}>
                      {weightDelta < -0.1 ? <ArrowDown size={11} weight="bold" /> : weightDelta > 0.1 ? <ArrowUp size={11} weight="bold" /> : <Minus size={11} />}
                      {Math.abs(weightDelta).toFixed(1)} kg sur la période
                    </span>
                  )}
                </div>

                {/* Stats row */}
                <div className="flex gap-2 mb-3">
                  {[
                    { label: "Actuel",   value: currentWeightKg ? `${currentWeightKg.toFixed(1)} kg` : "—", color: "var(--protein)" },
                    { label: "Objectif", value: targetWeightKg   ? `${targetWeightKg.toFixed(1)} kg`  : "—", color: "#4ade80" },
                    { label: "Écart",
                      value: (currentWeightKg && targetWeightKg) ? `${Math.abs(currentWeightKg - targetWeightKg).toFixed(1)} kg` : "—",
                      color: (currentWeightKg && targetWeightKg && currentWeightKg > targetWeightKg) ? "#f87171" : "#4ade80" },
                    { label: "Date cible",
                      value: targetDate ? format(new Date(targetDate + "T00:00:00"), "dd/MM/yy") : "—",
                      color: "var(--calories)" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="flex-1 flex flex-col items-center p-2 rounded-xl gap-0.5"
                      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
                      <span className="text-[12px] font-bold tabular-nums leading-tight" style={{ color }}>{value}</span>
                      <span className="text-[9px] text-center" style={{ color: "var(--text-muted)" }}>{label}</span>
                    </div>
                  ))}
                </div>

                {/* Editable target date */}
                <div className="flex items-center gap-2 mb-3">
                  <CalendarBlank size={12} style={{ color: "var(--text-muted)" }} />
                  <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>Modifier la date cible :</span>
                  <input
                    type="date" value={targetDate}
                    onChange={e => setTargetDate(e.target.value)}
                    className="flex-1 px-2 py-1 rounded-lg text-[11px] outline-none"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                    min={format(new Date(), "yyyy-MM-dd")}
                  />
                </div>

                {/* Chart */}
                {weightChartData.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={210}>
                      <ComposedChart data={weightChartData} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                        <defs>
                          <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor="var(--protein)" stopOpacity={0.22} />
                            <stop offset="95%" stopColor="var(--protein)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="label" tick={{ fontSize: 9, fill: "var(--text-muted)" }}
                          tickLine={false} axisLine={false} interval="preserveStartEnd" />
                        {/* Left Y: weight */}
                        <YAxis yAxisId="w" orientation="left"
                          tick={{ fontSize: 9, fill: "var(--text-muted)" }} tickLine={false} axisLine={false}
                          domain={[weightYMin ?? "auto", weightYMax ?? "auto"]}
                          tickFormatter={v => `${v}kg`} width={40} />
                        {/* Right Y: calories */}
                        <YAxis yAxisId="c" orientation="right"
                          tick={{ fontSize: 9, fill: "rgba(249,115,22,0.55)" }} tickLine={false} axisLine={false}
                          tickFormatter={v => `${v}`} width={32} />
                        <Tooltip
                          content={({ active, payload, label: lbl }) => {
                            if (!active || !payload?.length) return null;
                            const entries = payload.filter(p => p.value != null);
                            if (!entries.length) return null;
                            return (
                              <div className="px-3 py-2 rounded-xl text-[11px] space-y-1"
                                style={{ background: "rgba(13,13,17,0.96)", border: "1px solid var(--border)" }}>
                                <p style={{ color: "var(--text-muted)" }}>{lbl}</p>
                                {entries.map((p, i) => (
                                  <p key={i} className="font-semibold" style={{ color: p.color ?? "var(--text-primary)" }}>
                                    {p.dataKey === "actual" ? "Mesuré" : p.dataKey === "projected" ? "Simulé" : "Calories"} :{" "}
                                    {p.dataKey === "calories" ? `${p.value} kcal` : `${(p.value as number).toFixed(1)} kg`}
                                  </p>
                                ))}
                              </div>
                            );
                          }}
                        />
                        {/* Target weight */}
                        {targetWeightKg && (
                          <ReferenceLine yAxisId="w" y={targetWeightKg}
                            stroke="rgba(74,222,128,0.4)" strokeDasharray="5 3"
                            label={{ value: `🎯 ${targetWeightKg}kg`, fontSize: 9, fill: "#4ade80", position: "insideTopRight" }} />
                        )}
                        {/* Today line */}
                        <ReferenceLine yAxisId="w" x="Auj."
                          stroke="rgba(255,255,255,0.18)" strokeDasharray="3 3" />
                        {/* Calorie bars (right axis) */}
                        <Bar yAxisId="c" dataKey="calories" fill="var(--calories)"
                          fillOpacity={0.15} radius={[2, 2, 0, 0]} />
                        {/* Goal calorie reference */}
                        <ReferenceLine yAxisId="c" y={goals.dailyCalories}
                          stroke="rgba(249,115,22,0.25)" strokeDasharray="3 3" />
                        {/* Actual weight (solid area) */}
                        <Area yAxisId="w" type="monotone" dataKey="actual" name="actual"
                          stroke="var(--protein)" strokeWidth={2.5} fill="url(#actualGrad)"
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          dot={(props: any) => {
                            const { cx, cy, payload } = props as { cx: number; cy: number; payload: WeightChartPoint };
                            if (payload.actual == null) return <g key={`a-${payload.date}`} />;
                            return <circle key={`a-${payload.date}`} cx={cx} cy={cy} r={payload.isToday ? 5 : 3} fill="var(--protein)" stroke="var(--bg)" strokeWidth={1.5} />;
                          }}
                          activeDot={{ r: 5 }} connectNulls={false} />
                        {/* Projected weight (dashed) */}
                        <Line yAxisId="w" type="monotone" dataKey="projected" name="projected"
                          stroke="#4ade80" strokeWidth={2} strokeDasharray="6 3"
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          dot={(props: any) => {
                            const { cx, cy, payload } = props as { cx: number; cy: number; payload: WeightChartPoint };
                            if (!payload.isFuture || payload.projected == null) return <g key={`p-${payload.date}`} />;
                            return <circle key={`p-${payload.date}`} cx={cx} cy={cy} r={3} fill="#4ade80" stroke="var(--bg)" strokeWidth={1.5} />;
                          }}
                          activeDot={{ r: 4 }} connectNulls />
                      </ComposedChart>
                    </ResponsiveContainer>
                    {/* Legend */}
                    <div className="flex items-center gap-5 mt-2 justify-center">
                      <div className="flex items-center gap-1.5">
                        <div className="w-6 h-0.5 rounded" style={{ background: "var(--protein)" }} />
                        <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>Mesuré</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-6 h-0" style={{ borderTop: "2px dashed #4ade80" }} />
                        <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>Simulation</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-sm" style={{ background: "rgba(249,115,22,0.5)" }} />
                        <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>Calories</span>
                      </div>
                    </div>
                    {/* Projection summary */}
                    {projectionDate && avgCalories > 0 && (
                      <div className="mt-3 px-3 py-2 rounded-xl flex items-center justify-between"
                        style={{ background: "rgba(74,222,128,0.06)", border: "1px solid rgba(74,222,128,0.2)" }}>
                        <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                          À ce rythme ({avgCalories} kcal/j) →
                        </p>
                        <p className="text-[12px] font-semibold" style={{ color: "#4ade80" }}>
                          🎯 {projectionDate}
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="h-28 flex items-center justify-center">
                    <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
                      Aucune mesure de poids — connectez Withings ou Google Fit
                    </p>
                  </div>
                )}
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
