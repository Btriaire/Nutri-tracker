"use client";
import { levelBarStyle, levelBarBg, levelBarClip } from "@/app/lib/colors";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { format, subDays, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import {
  ComposedChart, AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell, Legend,
} from "recharts";
import {
  IconArrowDown, IconArrowUp, IconMinus, IconBolt, IconScale, IconChartBar, IconChartLine,
  IconCalendar, IconShoe, IconFlame, IconHeart, IconMoon, IconDroplet, IconRun, IconLoader2,
  IconPhoto, IconBrain, IconEggFried, IconSalad, IconMeat, IconApple, IconChartGridDots,
} from "@tabler/icons-react";
import type { DayTrendPoint, NutritionGoals, NutritionPlan } from "@/app/lib/types";
import AIInsightBox from "@/app/components/AIInsightBox";
import MealTimingWidget from "@/app/components/MealTimingWidget";
import BodyCompChart from "@/app/components/BodyCompChart";
import AlbumModal from "@/app/components/AlbumModal";
import AdvancedAnalysisModal from "@/app/components/AdvancedAnalysisModal";

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
  label:      string;
  date:       string;
  actual:     number | null;
  projected:  number | null;
  projLow:    number | null;  // lower bound of uncertainty band
  projHigh:   number | null;  // upper bound of uncertainty band
  gapTop:     number | null;  // gap shading top (max of actual/projected)
  gapBottom:  number | null;  // gap shading bottom (min of actual/projected)
  calories:   number | null;
  isToday?:   boolean;
  isFuture?:  boolean;
};

/**
 * Plateau-based weight projection.
 *
 * The body loses weight in cycles: 2–3 weeks of active loss followed by
 * 1 week of metabolic adaptation (plateau / slight rebound). Each cycle
 * the loss rate decreases by ~15% (hormonal adaptation, lower BMR).
 *
 * This produces a visible staircase pattern:
 *   ↘↘ loss phase → ── plateau → ↘↘ loss (slower) → ── plateau → …
 *
 * The loss-phase rate is calibrated so the total projected loss equals
 * exactly the gap by targetDate.
 */
function buildPlateauDailyKg(
  startKg:   number,
  targetKg:  number,
  totalDays: number,
): number[] {
  const gap          = startKg - targetKg; // positive = weight loss
  const direction    = gap >= 0 ? 1 : -1;  // +1 loss, -1 gain
  const LOSS_WEEKS   = 3;  // weeks of active loss per cycle
  const PLATEAU_WEEKS = 1; // weeks of stagnation per cycle
  const CYCLE        = LOSS_WEEKS + PLATEAU_WEEKS;
  const DECAY        = 0.85; // rate multiplier per cycle

  const totalWeeks   = totalDays / 7;
  const numCycles    = Math.ceil(totalWeeks / CYCLE);

  // Calibrate base rate so total projected loss = gap
  // Total loss = sum over cycles of: LOSS_WEEKS × baseRate × DECAY^c
  //            = baseRate × LOSS_WEEKS × Σ DECAY^c
  let geoSum = 0;
  for (let c = 0; c < numCycles; c++) geoSum += Math.pow(DECAY, c);
  const baseWeeklyLoss = Math.abs(gap) / Math.max(geoSum * LOSS_WEEKS, 0.01);

  const daily: number[] = [startKg];
  let cur = startKg;

  for (let day = 0; day < totalDays; day++) {
    const week      = Math.floor(day / 7);
    const cycleNum  = Math.floor(week / CYCLE);
    const cycleWeek = week % CYCLE;
    const weeklyRate = baseWeeklyLoss * Math.pow(DECAY, cycleNum);
    const dailyRate  = weeklyRate / 7;

    if (cycleWeek < LOSS_WEEKS) {
      // Active loss phase
      cur = direction > 0
        ? Math.max(targetKg, cur - dailyRate)
        : Math.min(targetKg, cur + dailyRate);
    } else {
      // Plateau: body stagnates (or slight micro-rebound ~5% of loss rate)
      cur = direction > 0
        ? cur + dailyRate * 0.05   // tiny rebound
        : cur - dailyRate * 0.05;
    }
    daily.push(Math.round(cur * 100) / 100);
  }
  return daily;
}

function buildWeightChartData(
  weightData: { label: string; date: string; weightKg: number | undefined }[],
  calorieData: { date: string; calories: number }[],
  currentKg: number | null,
  targetKg: number | null,
  targetDate: string | undefined,
  plan?: NutritionPlan | undefined,
): WeightChartPoint[] {
  const today    = new Date();
  const todayStr = format(today, "yyyy-MM-dd");

  const calMap = new Map(calorieData.map(p => [p.date, p.calories]));

  // Past: actual measured weight
  const actualPoints: WeightChartPoint[] = weightData
    .filter(p => (p.weightKg ?? 0) > 0)
    .map(p => ({
      date:      p.date,
      label:     p.label,
      actual:    p.weightKg ?? null,
      projected: null,
      projLow:   null,
      projHigh:  null,
      gapTop:    null,
      gapBottom: null,
      calories:  calMap.get(p.date) ?? null,
    }));

  if (!targetKg || !targetDate) return actualPoints;

  // Simulation start: use plan start for full retrospective view
  const simStartKg   = plan?.startWeightKg ?? actualPoints[0]?.actual ?? currentKg;
  const simStartDate = plan?.startDate ?? actualPoints[0]?.date ?? todayStr;
  if (!simStartKg) return actualPoints;

  const simStart  = new Date(simStartDate + "T00:00:00");
  const endDate   = new Date(targetDate   + "T00:00:00");
  const totalDays = Math.max(14, Math.round((endDate.getTime() - simStart.getTime()) / 86400000));

  // Build full simulation from plan start to target date
  const dailyKg = buildPlateauDailyKg(simStartKg, targetKg, totalDays);

  // Helper: get simulated kg for any date string
  function getProjected(dateStr: string): number | null {
    const d         = new Date(dateStr + "T00:00:00");
    const dayOffset = Math.round((d.getTime() - simStart.getTime()) / 86400000);
    if (dayOffset < 0 || dayOffset >= dailyKg.length) return null;
    return Math.round(dailyKg[dayOffset] * 10) / 10;
  }

  const isLoss = (simStartKg - targetKg) >= 0;

  // Past points with projected overlay for retrospective comparison
  const past: WeightChartPoint[] = actualPoints.map(p => {
    const proj = getProjected(p.date);
    const act  = p.actual;
    return {
      ...p,
      projected: proj,
      // Gap shading between actual and projected (past only)
      gapTop:    (act != null && proj != null) ? Math.max(act, proj) : null,
      gapBottom: (act != null && proj != null) ? Math.min(act, proj) : null,
    };
  });

  const lastActual = past[past.length - 1]?.actual ?? currentKg;
  if (!lastActual) return past;

  // Bridge point: today — always show actual if measured today, else carry last known weight
  const todayActualKg  = past.find(p => p.date === todayStr)?.actual ?? null;
  const todayBridge: WeightChartPoint = {
    date:      todayStr,
    label:     "Auj.",
    actual:    todayActualKg ?? lastActual,   // ← was null when todayHasActual; now always shown
    projected: getProjected(todayStr) ?? lastActual,
    projLow:   todayActualKg ?? lastActual,
    projHigh:  todayActualKg ?? lastActual,
    gapTop:    null,
    gapBottom: null,
    calories:  calMap.get(todayStr) ?? null,
    isToday:   true,
  };

  // Future points — one per week from today to target
  const future: WeightChartPoint[] = [];
  const daysUntilTarget = Math.round((endDate.getTime() - today.getTime()) / 86400000);
  const weeksTotal      = Math.ceil(daysUntilTarget / 7);

  for (let w = 1; w <= weeksTotal; w++) {
    const daysFromNow = Math.min(w * 7, daysUntilTarget);
    const d           = new Date(today.getTime() + daysFromNow * 86400000);
    const dateStr     = format(d, "yyyy-MM-dd");
    const proj        = getProjected(dateStr) ?? dailyKg[dailyKg.length - 1];
    const daysInSim   = Math.round((d.getTime() - simStart.getTime()) / 86400000);
    const bandKg      = Math.min(0.25 + (daysInSim / Math.max(totalDays, 1)) * 0.75, 1.0);

    future.push({
      date:      dateStr,
      label:     daysFromNow >= daysUntilTarget ? format(endDate, "dd/MM/yy") : format(d, "dd/MM"),
      actual:    null,
      projected: Math.round(proj * 10) / 10,
      projLow:   Math.round((proj + (isLoss ?  bandKg : -bandKg)) * 10) / 10,
      projHigh:  Math.round((proj - (isLoss ?  bandKg : -bandKg)) * 10) / 10,
      gapTop:    null,
      gapBottom: null,
      calories:  null,
      isFuture:  true,
    });
    if (daysFromNow >= daysUntilTarget) break;
  }

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
  const [showAlbum,       setShowAlbum]    = useState(false);
  const [showAnalysis,    setShowAnalysis] = useState(false);

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

  // Use the last actual weight measurement from the chart data as "current" weight
  // so the displayed stat always matches the last point on the curve.
  // Fall back to the server-side prop when chart has no data yet.
  const effectiveCurrentWeight = lastWeight ?? currentWeightKg;

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
    effectiveCurrentWeight,
    targetWeightKg,
    targetDate || undefined,
    plan,
  );
  const allWeightValues = weightChartData.flatMap(p =>
    [p.actual, p.projected, p.projLow, p.projHigh].filter((v): v is number => v != null && v > 0 && v < 999)
  );
  const weightYMin = allWeightValues.length ? Math.floor(Math.min(...allWeightValues) - 0.5) : undefined;
  const weightYMax = allWeightValues.length ? Math.ceil(Math.max(...allWeightValues)  + 0.5) : undefined;

  const progressInsightData = {
    days:           points.length,
    avgCalories,
    avgSteps,
    avgSleepH,
    avgHR,
    startWeight:    firstWeight ?? currentWeightKg,  // start of range
    currentWeight:  effectiveCurrentWeight,
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
  const projectionDays = (effectiveCurrentWeight && targetWeightKg && avgCalories > 0)
    ? calcProjection(effectiveCurrentWeight, targetWeightKg, avgCalories, tdee) : null;
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

        {/* ── Modals ── */}
        <AlbumModal open={showAlbum} onClose={() => setShowAlbum(false)} />
        <AdvancedAnalysisModal open={showAnalysis} onClose={() => setShowAnalysis(false)} />

        {/* ── Banner ── */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="mb-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="label-xs mb-0.5">Analyse</p>
              <h1 className="text-[22px] font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>Progrès</h1>
            </div>
            <div className="flex gap-2 mt-1">
              <button
                onClick={() => setShowAlbum(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-medium transition-all active:scale-95"
                style={{
                  background: "rgba(245,158,11,0.1)",
                  border: "1px solid rgba(245,158,11,0.3)",
                  color: "#f59e0b",
                }}
              >
                <IconPhoto size={14} />
                Album
              </button>
              <button
                onClick={() => setShowAnalysis(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-medium transition-all active:scale-95"
                style={{
                  background: "rgba(139,92,246,0.1)",
                  border: "1px solid rgba(139,92,246,0.3)",
                  color: "#a78bfa",
                }}
              >
                <IconBrain size={14} />
                Analyse IA
              </button>
            </div>
          </div>
        </motion.div>

        {/* ── Mon plan card ── */}
        {plan && (() => {
          const daysInPlan = Math.floor((Date.now() - new Date(plan.startDate + "T00:00:00").getTime()) / 86400000) + 1;
          const startKg    = plan.startWeightKg;
          const targetKg   = plan.targetWeightKg;
          const currentKg  = effectiveCurrentWeight;
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
                      ? <IconLoader2 size={11} stroke={2} className="animate-spin" />
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
                    <div className="h-full rounded-full w-full"
                      style={levelBarStyle(progressPct / 100)} />
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
                    <IconFlame size={16} stroke={1.5} style={{ color: "var(--calories)" }} />
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
                    <IconRun size={16} stroke={1.5} style={{ color: "var(--steps)" }} />
                    <p className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>Activité</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { icon: IconShoe,    label: "Pas",            val: todayPoint?.steps ? todayPoint.steps.toLocaleString("fr-FR") : "—",             color: "var(--steps)",    goal: "/ 10 000" },
                      { icon: IconBolt,     label: "Min. actives",   val: todayPoint?.activeMinutes ?? "—",                                                color: "var(--fit-green)", goal: "/ 30 min" },
                      { icon: IconFlame,    label: "Kcal brûlées",   val: todayPoint?.burned ?? "—",                                                       color: "var(--fit-red)",   goal: "actives" },
                      { icon: IconHeart,    label: "FC moy.",         val: todayPoint?.heartRateAvg ? `${todayPoint.heartRateAvg} bpm` : "—",               color: "var(--fit-red)",   goal: todayPoint?.heartRateAvg ? (todayPoint.heartRateAvg < 60 ? "Repos" : todayPoint.heartRateAvg < 100 ? "Normal" : "Élevé") : "" },
                    ].map(({ icon: Icon, label, val, color, goal }) => (
                      <div key={label} className="flex items-center gap-3 p-3 rounded-xl"
                        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)" }}>
                        <Icon size={22} stroke={1.5} style={{ color, flexShrink: 0 }} />
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
                    <IconMoon size={16} stroke={1.5} style={{ color: "var(--fit-indigo)" }} />
                    <p className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>Récupération</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-3 p-3 rounded-xl"
                      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)" }}>
                      <IconMoon size={24} stroke={1.5} style={{ color: "var(--fit-indigo)", flexShrink: 0 }} />
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
                      <IconDroplet size={24} stroke={1.5} style={{ color: "#38bdf8", flexShrink: 0 }} />
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
                    <IconScale size={28} stroke={1.5} style={{ color: "var(--protein)" }} />
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
                  <IconFlame size={14} stroke={1.5} style={{ color: "var(--calories)" }} />
                  <p className="label-xs">Calories &amp; Activité</p>
                </div>
                <div className="flex gap-1.5">
                  {(["area", "bar"] as CalChart[]).map((t) => (
                    <button key={t} onClick={() => setCalChart(t)} className="btn-icon w-7 h-7"
                      style={{ color: calChart === t ? "var(--calories)" : "var(--text-muted)" }}>
                      {t === "area" ? <IconChartLine size={13} stroke={1.5} /> : <IconChartBar size={13} stroke={1.5} />}
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
                    <IconRun size={13} stroke={1.5} style={{ color: "var(--steps)" }} />
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
            {(weightData.length > 0 || effectiveCurrentWeight) && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.1 }} className="glass p-5 mb-4">

                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <IconScale size={15} stroke={1.5} style={{ color: "var(--protein)" }} />
                    <p className="label-xs">Poids &amp; Simulation</p>
                  </div>
                  {weightDelta !== null && (
                    <span className="flex items-center gap-1 text-[12px] font-medium"
                      style={{ color: weightDelta < -0.1 ? "#4ade80" : weightDelta > 0.1 ? "#f87171" : "var(--text-muted)" }}>
                      {weightDelta < -0.1 ? <IconArrowDown size={11} stroke={2} /> : weightDelta > 0.1 ? <IconArrowUp size={11} stroke={2} /> : <IconMinus size={11} stroke={2} />}
                      {Math.abs(weightDelta).toFixed(1)} kg sur la période
                    </span>
                  )}
                </div>

                {/* Stats row */}
                <div className="flex gap-2 mb-3">
                  {[
                    { label: "Actuel",   value: effectiveCurrentWeight ? `${effectiveCurrentWeight.toFixed(1)} kg` : "—", color: "var(--protein)" },
                    { label: "Objectif", value: targetWeightKg   ? `${targetWeightKg.toFixed(1)} kg`  : "—", color: "#4ade80" },
                    { label: "Écart",
                      value: (effectiveCurrentWeight && targetWeightKg) ? `${Math.abs(effectiveCurrentWeight - targetWeightKg).toFixed(1)} kg` : "—",
                      color: (effectiveCurrentWeight && targetWeightKg && effectiveCurrentWeight > targetWeightKg) ? "#f87171" : "#4ade80" },
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
                  <IconCalendar size={12} stroke={1.5} style={{ color: "var(--text-muted)" }} />
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
                    {/* Scrollable wrapper — min 52px per data point so labels never overlap */}
                    <div style={{ overflowX: "auto", overflowY: "hidden", marginLeft: "-4px", marginRight: "-4px" }}>
                    <div style={{ width: `${Math.max(100, weightChartData.length * 52)}px`, minWidth: "100%" }}>
                    <ResponsiveContainer width="100%" height={240}>
                      <ComposedChart data={weightChartData} margin={{ top: 8, right: 16, left: -10, bottom: 0 }}>
                        <defs>
                          <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor="var(--protein)" stopOpacity={0.22} />
                            <stop offset="95%" stopColor="var(--protein)" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="bandGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor="#4ade80" stopOpacity={0.12} />
                            <stop offset="95%" stopColor="#4ade80" stopOpacity={0.03} />
                          </linearGradient>
                          <linearGradient id="gapGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor="#f87171" stopOpacity={0.22} />
                            <stop offset="95%" stopColor="#f87171" stopOpacity={0.06} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="label" tick={{ fontSize: 9, fill: "var(--text-muted)" }}
                          tickLine={false} axisLine={false} interval={0} />
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
                            const seen = new Set<string>();
                            const entries = payload.filter(p => {
                              const key = String(p.dataKey);
                              if (["projLow","projHigh","gapTop","gapBottom"].includes(key)) return false;
                              if (p.value == null) return false;
                              if (seen.has(key)) return false;
                              seen.add(key);
                              return true;
                            });
                            if (!entries.length) return null;
                            const actualEntry = entries.find(p => p.dataKey === "actual");
                            const projEntry   = entries.find(p => p.dataKey === "projected");
                            const gap = (actualEntry?.value != null && projEntry?.value != null)
                              ? ((projEntry.value as number) - (actualEntry.value as number))
                              : null;
                            return (
                              <div className="px-3 py-2 rounded-xl text-[11px] space-y-1"
                                style={{ background: "rgba(13,13,17,0.96)", border: "1px solid var(--border)" }}>
                                <p style={{ color: "var(--text-muted)" }}>{lbl}</p>
                                {entries.map((p, i) => (
                                  <p key={i} className="font-semibold" style={{ color: p.dataKey === "actual" ? "var(--protein)" : p.dataKey === "projected" ? "#4ade80" : "var(--calories)" }}>
                                    {p.dataKey === "actual" ? "● Mesuré" : p.dataKey === "projected" ? "- Simulé" : "Calories"} :{" "}
                                    {p.dataKey === "calories" ? `${p.value} kcal` : `${(p.value as number).toFixed(1)} kg`}
                                  </p>
                                ))}
                                {gap != null && (
                                  <p className="text-[10px] pt-0.5" style={{ borderTop: "1px solid rgba(255,255,255,0.08)", color: Math.abs(gap) < 0.2 ? "#4ade80" : "#f87171" }}>
                                    Écart : {gap > 0 ? "+" : ""}{gap.toFixed(1)} kg {gap > 0 ? "sous objectif" : "au-dessus"}
                                  </p>
                                )}
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
                        {/* Uncertainty band: projLow → projHigh (filled area between) */}
                        <Area yAxisId="w" type="monotone" dataKey="projHigh"
                          stroke="none" fill="url(#bandGrad)" fillOpacity={1}
                          dot={false} activeDot={false} connectNulls legendType="none" />
                        <Area yAxisId="w" type="monotone" dataKey="projLow"
                          stroke="none" fill="var(--bg)" fillOpacity={1}
                          dot={false} activeDot={false} connectNulls legendType="none" />
                        {/* Gap shading between actual and projected (past) */}
                        <Area yAxisId="w" type="monotone" dataKey="gapTop"
                          stroke="none" fill="url(#gapGrad)" fillOpacity={1}
                          dot={false} activeDot={false} connectNulls={false} legendType="none" />
                        <Area yAxisId="w" type="monotone" dataKey="gapBottom"
                          stroke="none" fill="var(--bg)" fillOpacity={1}
                          dot={false} activeDot={false} connectNulls={false} legendType="none" />
                        {/* Projected weight (dashed line, always shown) — drawn BEFORE actual so actual is on top */}
                        <Line yAxisId="w" type="monotone" dataKey="projected" name="projected"
                          stroke="#4ade80" strokeWidth={2.5} strokeDasharray="6 3"
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          dot={(props: any) => {
                            const { cx, cy, payload } = props as { cx: number; cy: number; payload: WeightChartPoint };
                            if (payload.projected == null) return <g key={`p-${payload.date}`} />;
                            if (!payload.isFuture) return <g key={`p-${payload.date}`} />;
                            return <circle key={`p-${payload.date}`} cx={cx} cy={cy} r={3} fill="#4ade80" stroke="var(--bg)" strokeWidth={1.5} />;
                          }}
                          activeDot={{ r: 4, fill: "#4ade80" }} connectNulls />
                        {/* Actual weight (solid area, on top) */}
                        <Area yAxisId="w" type="monotone" dataKey="actual" name="actual"
                          stroke="var(--protein)" strokeWidth={2.5} fill="url(#actualGrad)"
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          dot={(props: any) => {
                            const { cx, cy, payload } = props as { cx: number; cy: number; payload: WeightChartPoint };
                            if (payload.actual == null) return <g key={`a-${payload.date}`} />;
                            return <circle key={`a-${payload.date}`} cx={cx} cy={cy} r={payload.isToday ? 5 : 3} fill="var(--protein)" stroke="var(--bg)" strokeWidth={1.5} />;
                          }}
                          activeDot={{ r: 5 }} connectNulls={false} />
                      </ComposedChart>
                    </ResponsiveContainer>
                    </div>{/* inner width */}
                    </div>{/* scroll wrapper */}

                    {/* Legend */}
                    <div className="flex items-center gap-3 mt-2.5 justify-center flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <div className="w-6 h-0.5 rounded" style={{ background: "var(--protein)" }} />
                        <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>Mesuré</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-6 h-0" style={{ borderTop: "2px dashed #4ade80" }} />
                        <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>Simulé</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-4 h-3 rounded-sm opacity-70" style={{ background: "rgba(248,113,113,0.35)" }} />
                        <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>Écart réel/simulé</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-4 h-3 rounded-sm opacity-60" style={{ background: "rgba(74,222,128,0.35)" }} />
                        <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>Fourchette future</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-sm" style={{ background: "rgba(249,115,22,0.5)" }} />
                        <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>Calories</span>
                      </div>
                    </div>

                    {/* Model explanation */}
                    <div className="mt-2.5 px-3 py-2 rounded-xl"
                      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
                      <p className="text-[10px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                        📉 <span style={{ color: "var(--text-secondary)" }}>Modèle par paliers</span> — 3 semaines de perte active
                        → 1 semaine de stagnation/rebond → répétition. Chaque cycle perd ~15% de moins (adaptation métabolique).
                        La fourchette indique l&apos;incertitude croissante.
                      </p>
                    </div>

                    {/* Projection summary */}
                    {projectionDate && avgCalories > 0 && (
                      <div className="mt-2.5 px-3 py-2 rounded-xl flex items-center justify-between"
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

            {/* Body composition chart (Withings) */}
            <BodyCompChart />

            {/* Blood pressure trend */}
            {(() => {
              const bpData = points
                .filter(p => p.systolicBP != null && p.diastolicBP != null)
                .map(p => ({
                  label: format(parseISO(p.date), "d MMM", { locale: fr }),
                  date:  p.date,
                  sys:   p.systolicBP!,
                  dia:   p.diastolicBP!,
                }));
              if (bpData.length === 0) return null;
              const avgSys = Math.round(bpData.reduce((s, p) => s + p.sys, 0) / bpData.length);
              const avgDia = Math.round(bpData.reduce((s, p) => s + p.dia, 0) / bpData.length);
              const cls = avgSys < 120 && avgDia < 80 ? { label: "Optimal", color: "#34d399" }
                        : avgSys < 130 && avgDia < 80 ? { label: "Normal élevé", color: "#a3e635" }
                        : avgSys < 140 || avgDia < 90 ? { label: "HTA grade 1", color: "#fb923c" }
                        : { label: "HTA grade 2+", color: "#f87171" };
              return (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.14 }} className="glass p-5 mb-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <IconHeart size={15} style={{ color: "#EA4335" }} />
                      <p className="label-xs">Tension artérielle</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold tabular-nums" style={{ color: "#EA4335" }}>
                        {avgSys}<span className="text-[9px] font-normal mx-0.5">/</span>{avgDia}
                        <span className="text-[9px] font-normal ml-1" style={{ color: "var(--text-muted)" }}>mmHg moy.</span>
                      </span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                        style={{ background: `${cls.color}15`, color: cls.color, border: `1px solid ${cls.color}40` }}>
                        {cls.label}
                      </span>
                    </div>
                  </div>

                  <ResponsiveContainer width="100%" height={160}>
                    <LineChart data={bpData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 9, fill: "var(--text-muted)" }}
                        tickLine={false} axisLine={false} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 9, fill: "var(--text-muted)" }}
                        tickLine={false} axisLine={false} domain={["auto", "auto"]} />
                      <Tooltip content={({ active, payload, label: lbl }) => {
                        if (!active || !payload?.length) return null;
                        const s = payload.find(p => p.dataKey === "sys")?.value as number;
                        const d = payload.find(p => p.dataKey === "dia")?.value as number;
                        const c = s < 120 && d < 80 ? "#34d399" : s < 130 ? "#a3e635" : s < 140 ? "#fb923c" : "#f87171";
                        const lbl2 = s < 120 && d < 80 ? "Optimal" : s < 130 ? "Normal élevé" : s < 140 ? "HTA 1" : "HTA 2+";
                        return (
                          <div className="px-2.5 py-1.5 rounded-lg text-[11px]"
                            style={{ background: "rgba(13,13,17,0.97)", border: "1px solid var(--border)" }}>
                            <p className="mb-1" style={{ color: "var(--text-muted)" }}>{lbl}</p>
                            <p className="font-bold" style={{ color: "#EA4335" }}>{s} / {d} mmHg</p>
                            <p className="text-[9px]" style={{ color: c }}>{lbl2}</p>
                          </div>
                        );
                      }} />
                      <ReferenceLine y={120} stroke="rgba(163,230,53,0.3)" strokeDasharray="4 3" />
                      <ReferenceLine y={140} stroke="rgba(249,115,22,0.4)" strokeDasharray="4 3" />
                      <ReferenceLine y={80}  stroke="rgba(251,188,4,0.25)"  strokeDasharray="4 3" />
                      <Line type="monotone" dataKey="sys" stroke="#EA4335" strokeWidth={2}
                        dot={{ r: 3, fill: "#EA4335", strokeWidth: 0 }} activeDot={{ r: 5 }} connectNulls />
                      <Line type="monotone" dataKey="dia" stroke="#7986CB" strokeWidth={2}
                        dot={{ r: 3, fill: "#7986CB", strokeWidth: 0 }} activeDot={{ r: 5 }} connectNulls />
                    </LineChart>
                  </ResponsiveContainer>

                  <div className="flex items-center gap-4 mt-2 flex-wrap">
                    <div className="flex items-center gap-1.5 text-[10px]" style={{ color: "var(--text-muted)" }}>
                      <div className="w-3 h-0.5 rounded" style={{ background: "#EA4335" }} /> Systolique
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px]" style={{ color: "var(--text-muted)" }}>
                      <div className="w-3 h-0.5 rounded" style={{ background: "#7986CB" }} /> Diastolique
                    </div>
                    <span className="ml-auto text-[9px]" style={{ color: "rgba(249,115,22,0.6)" }}>— 120 · 140 mmHg</span>
                    <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>{bpData.length} mesures</span>
                  </div>
                </motion.div>
              );
            })()}

            {/* ── Hunger Heatmap ── */}
            {(() => {
              const MEAL_COLORS = {
                breakfast: "#f59e0b",
                lunch:     "#f97316",
                dinner:    "#8b5cf6",
                snacks:    "#34d399",
              };
              // Professional icon components per meal
              const MEAL_ICONS = {
                breakfast: <IconEggFried size={11} />,
                lunch:     <IconSalad   size={11} />,
                dinner:    <IconMeat    size={11} />,
                snacks:    <IconApple   size={11} />,
              };
              const MEAL_SHORT = {
                breakfast: "Petit-dej",
                lunch:     "Déjeuner",
                dinner:    "Dîner",
                snacks:    "Collation",
              };
              const HUNGER_LABEL: Record<number, string> = { 1: "Rassasié", 2: "Peu faim", 3: "Modéré", 4: "Faim", 5: "Très faim" };
              // Dot radius per level: 1→2px, 2→3px, 3→4px, 4→5.5px, 5→7px
              const DOT_R: Record<number, number> = { 1: 2, 2: 3, 3: 4, 4: 5.5, 5: 7 };

              // Build heatmap data: only days with at least one hunger value
              const heatDays = chartData.filter(p =>
                p.hungerBreakfast != null || p.hungerLunch != null ||
                p.hungerDinner != null    || p.hungerSnacks != null
              );

              if (heatDays.length < 2) return null;

              const calGoal = goals.dailyCalories ?? 2000;

              // Avg per meal
              const mealAvg = (key: "breakfast" | "lunch" | "dinner" | "snacks") => {
                const vals = heatDays
                  .map(p => p[`hunger${key.charAt(0).toUpperCase() + key.slice(1)}` as keyof typeof p] as number | undefined)
                  .filter((v): v is number => v != null);
                return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
              };

              // Cell background: transparent to saturated
              function cellBg(meal: keyof typeof MEAL_COLORS, value: number | null) {
                if (value == null) return "rgba(255,255,255,0.025)";
                const base = MEAL_COLORS[meal];
                const alpha = 0.06 + (value - 1) / 4 * 0.68; // 0.06..0.74
                return `${base}${Math.round(alpha * 255).toString(16).padStart(2, "0")}`;
              }

              // 5-pip level indicator for summary cards
              function LevelPips({ value, color }: { value: number; color: string }) {
                return (
                  <div className="flex items-center justify-center gap-0.5 mt-1">
                    {[1,2,3,4,5].map(i => (
                      <div key={i} className="rounded-full"
                        style={{
                          width:      i <= Math.round(value) ? 5 : 4,
                          height:     i <= Math.round(value) ? 5 : 4,
                          background: i <= Math.round(value) ? color : "rgba(255,255,255,0.1)",
                          transition: "all 0.15s",
                        }} />
                    ))}
                  </div>
                );
              }

              const displayDays = heatDays.slice(-Math.min(heatDays.length, 21));

              return (
                <motion.div
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.08 }}
                  className="glass p-4 mb-4"
                >
                  {/* Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-md flex items-center justify-center"
                          style={{ background: "rgba(249,115,22,0.12)", color: "var(--calories)" }}>
                          <IconChartGridDots size={12} />
                        </div>
                        <p className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
                          Niveaux de faim
                        </p>
                      </div>
                      <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                        Par repas · {displayDays.length} jours · intensité = niveau de faim (1–5)
                      </p>
                    </div>
                    {/* Legend: gradient scale */}
                    <div className="flex flex-col items-end gap-0.5">
                      <div className="flex items-center gap-0.5">
                        {[1,2,3,4,5].map(v => (
                          <div key={v} className="rounded-[3px]"
                            style={{
                              width: 10, height: 10,
                              background: `rgba(249,115,22,${0.06 + (v-1)/4 * 0.68})`,
                              border: "1px solid rgba(249,115,22,0.15)",
                            }} />
                        ))}
                      </div>
                      <div className="flex justify-between w-full px-0.5">
                        <span style={{ fontSize: 7, color: "rgba(250,250,250,0.25)" }}>rassasié</span>
                        <span style={{ fontSize: 7, color: "rgba(250,250,250,0.25)" }}>très faim</span>
                      </div>
                    </div>
                  </div>

                  {/* Heatmap grid */}
                  <div className="overflow-x-auto" style={{ scrollbarWidth: "none" }}>
                    <div style={{ minWidth: displayDays.length * 24 + 80 }}>

                      {/* Day labels row */}
                      <div className="flex mb-1.5" style={{ paddingLeft: 80 }}>
                        {displayDays.map((p, i) => (
                          <div key={p.date} className="flex-shrink-0 text-center"
                            style={{
                              width: 22, margin: "0 1px",
                              fontSize: 7,
                              color: i === displayDays.length - 1 ? "rgba(250,250,250,0.6)" : "rgba(250,250,250,0.25)",
                              fontWeight: i === displayDays.length - 1 ? 700 : 400,
                            }}>
                            {format(parseISO(p.date), "dd")}
                          </div>
                        ))}
                      </div>

                      {/* 4 meal rows */}
                      {(["breakfast", "lunch", "dinner", "snacks"] as const).map(meal => {
                        const hungerKey = `hunger${meal.charAt(0).toUpperCase() + meal.slice(1)}` as
                          "hungerBreakfast" | "hungerLunch" | "hungerDinner" | "hungerSnacks";
                        const avgVal = mealAvg(meal);
                        return (
                          <div key={meal} className="flex items-center mb-1.5">
                            {/* Row label: icon + text */}
                            <div className="flex-shrink-0 flex items-center justify-end gap-1.5 pr-2" style={{ width: 80 }}>
                              <span style={{ color: MEAL_COLORS[meal], opacity: 0.8 }}>
                                {MEAL_ICONS[meal]}
                              </span>
                              <span style={{ fontSize: 10, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                                {MEAL_SHORT[meal]}
                              </span>
                            </div>

                            {/* Cells */}
                            {displayDays.map(p => {
                              const val = p[hungerKey] as number | undefined ?? null;
                              const r   = val != null ? DOT_R[val] : 0;
                              return (
                                <div key={p.date}
                                  className="flex-shrink-0 rounded-[4px] flex items-center justify-center"
                                  title={val != null ? `${format(parseISO(p.date), "dd/MM")} — ${HUNGER_LABEL[val]} (${val}/5)` : ""}
                                  style={{
                                    width: 22, height: 22, margin: "0 1px",
                                    background: cellBg(meal, val),
                                    border: val != null
                                      ? `1px solid ${MEAL_COLORS[meal]}28`
                                      : "1px solid rgba(255,255,255,0.03)",
                                  }}
                                >
                                  {val != null && (
                                    <div className="rounded-full"
                                      style={{
                                        width:      r * 2,
                                        height:     r * 2,
                                        background: MEAL_COLORS[meal],
                                        opacity:    0.55 + (val - 1) / 4 * 0.45, // 0.55..1.0
                                      }} />
                                  )}
                                </div>
                              );
                            })}

                            {/* Row avg */}
                            {avgVal !== null && (
                              <div className="flex-shrink-0 ml-2 text-right" style={{ width: 28 }}>
                                <span className="text-[11px] font-semibold tabular-nums" style={{ color: MEAL_COLORS[meal] }}>
                                  {avgVal.toFixed(1)}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* Calorie micro-bars */}
                      {displayDays.some(p => p.calories > 0) && (
                        <>
                          {/* Separator */}
                          <div style={{ height: 1, marginLeft: 80, marginTop: 6, marginBottom: 6, background: "rgba(255,255,255,0.05)" }} />
                          <div className="flex items-end" style={{ paddingLeft: 80 }}>
                            {displayDays.map(p => {
                              const pct  = p.calories > 0 ? Math.min(p.calories / calGoal, 1.3) : 0;
                              const over = pct > 1;
                              return (
                                <div key={p.date} className="flex-shrink-0 flex flex-col items-center justify-end"
                                  style={{ width: 22, margin: "0 1px", height: 20 }}>
                                  <div className="w-[10px] rounded-sm"
                                    style={{
                                      height: pct > 0 ? Math.max(2, Math.round(pct / 1.3 * 18)) : 0,
                                      background: over
                                        ? "rgba(239,68,68,0.6)"
                                        : `rgba(249,115,22,${0.25 + pct * 0.35})`,
                                    }} />
                                </div>
                              );
                            })}
                            {/* Label */}
                            <div className="flex-shrink-0 ml-2 flex items-center gap-1" style={{ width: 28 }}>
                              <IconFlame size={9} style={{ color: "var(--calories)", opacity: 0.6, flexShrink: 0 }} />
                              <span style={{ fontSize: 8, color: "var(--text-muted)", lineHeight: 1.2 }}>
                                kcal
                              </span>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Summary chips */}
                  <div className="grid grid-cols-4 gap-2 mt-4">
                    {(["breakfast","lunch","dinner","snacks"] as const).map(meal => {
                      const avg = mealAvg(meal);
                      if (avg === null) return null;
                      return (
                        <div key={meal} className="flex flex-col items-center p-2.5 rounded-xl"
                          style={{ background: `${MEAL_COLORS[meal]}0D`, border: `1px solid ${MEAL_COLORS[meal]}22` }}>
                          {/* Icon */}
                          <span style={{ color: MEAL_COLORS[meal], opacity: 0.8, marginBottom: 2 }}>
                            {MEAL_ICONS[meal]}
                          </span>
                          {/* Label */}
                          <p className="text-[9px] leading-tight text-center" style={{ color: "var(--text-muted)" }}>
                            {MEAL_SHORT[meal]}
                          </p>
                          {/* Score */}
                          <p className="text-[15px] font-bold tabular-nums mt-1" style={{ color: MEAL_COLORS[meal] }}>
                            {avg.toFixed(1)}
                          </p>
                          {/* 5-pip scale */}
                          <div className="flex items-center justify-center gap-[3px] mt-1.5">
                            {[1,2,3,4,5].map(i => (
                              <div key={i} className="rounded-full transition-all"
                                style={{
                                  width:      i <= Math.round(avg) ? 5 : 4,
                                  height:     i <= Math.round(avg) ? 5 : 4,
                                  background: i <= Math.round(avg) ? MEAL_COLORS[meal] : "rgba(255,255,255,0.1)",
                                }} />
                            ))}
                          </div>
                          {/* Level label */}
                          <p className="text-[8px] mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>
                            {HUNGER_LABEL[Math.round(avg)] ?? "—"}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              );
            })()}

            {/* Meal timing widget */}
            <MealTimingWidget />
          </>
        )}
      </div>
    </div>
  );
}
