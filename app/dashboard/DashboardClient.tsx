"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { IconChevronRight, IconMoon, IconHeart, IconBolt, IconClock, IconTrendingUp, IconShoe, IconArrowUp, IconRefresh, IconX, IconFlame } from "@tabler/icons-react";
import CalorieBudgetRing from "@/app/components/CalorieBudgetRing";
import AIInsightBox from "@/app/components/AIInsightBox";
import WeightWidget from "@/app/components/WeightWidget";
import WaterTracker from "@/app/components/WaterTracker";
import FunFactsBanner from "@/app/components/FunFactsBanner";
import WelcomeChime from "@/app/components/WelcomeChime";
import StreakWidget from "@/app/components/StreakWidget";
import PhotoStrip from "@/app/components/PhotoStrip";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import type { DayTotals, NutritionGoals, NutritionPlan, ActivityPlan, WeightPoint, DayTrendPoint, Lang, TrackedNutrients } from "@/app/lib/types";
import type { RecentPhoto } from "@/app/api/photos/recent/route";
import { levelBarBg, levelBarClip, levelColor, levelColorPct } from "@/app/lib/colors";

interface Session { id: string; name: string; activityType: number; durationMin: number; startMs: number; calories?: number | null }

interface Props {
  date:              string;
  displayName?:      string;
  photoUrl?:         string;
  goals:             NutritionGoals;
  consumed:          DayTotals;
  burned:            number | null;
  steps:             number | null;
  stepsGoal:         number;
  activeMinutes:     number | null;
  heartRate:         number | null;
  sleepMinutes:      number | null;
  sleepGoalMin:      number;
  sessions:          Session[];
  weight:            WeightPoint | null;
  previousWeight:    WeightPoint | null;
  recentWeight:      WeightPoint[];
  trendPoints:       DayTrendPoint[];
  waterMl:           number;
  plan?:             NutritionPlan;
  lang:              Lang;
  trackedNutrients?: TrackedNutrients;
  recentPhotos?:     RecentPhoto[];
}

function activityEmoji(type: number): string {
  const map: Record<number, string> = {
    1: "🏃", 3: "🏃", 7: "🚴", 8: "🚴", 9: "💪", 10: "⛷️", 17: "🏋️",
    37: "🚣", 41: "🏃", 45: "⚽", 46: "🚶", 49: "🏂", 54: "🎾", 55: "🪜",
    56: "🚴", 60: "💪", 72: "🎾", 74: "🏐", 75: "🚶", 82: "🧘", 83: "💃",
    93: "🏊", 104: "🥊", 108: "🧘", 109: "🏉",
  };
  return map[type] ?? "🏅";
}

function fmtSleep(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}

function hrZoneLabel(bpm: number, maxHr: number): { label: string; color: string } {
  const pct = bpm / maxHr;
  if (pct < 0.50) return { label: "Repos",        color: "#7986CB" };
  if (pct < 0.60) return { label: "Échauffement", color: "#4285F4" };
  if (pct < 0.70) return { label: "Aérobie",      color: "#34A853" };
  if (pct < 0.85) return { label: "Seuil",        color: "#FBBC04" };
  return               { label: "Maximal",       color: "#EA4335" };
}

// pctColor → levelColorPct from @/app/lib/colors

function ScoreRing({ score }: { score: number }) {
  const SIZE = 56, R = 22, SW = 5;
  const circ = 2 * Math.PI * R;
  const dash = Math.min(score / 100, 1) * circ;
  const color = levelColorPct(score);
  return (
    <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
      <circle cx={SIZE/2} cy={SIZE/2} r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={SW} />
      <circle cx={SIZE/2} cy={SIZE/2} r={R} fill="none" stroke={color} strokeWidth={SW}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        transform={`rotate(-90 ${SIZE/2} ${SIZE/2})`} />
      <text x={SIZE/2} y={SIZE/2 + 4.5} textAnchor="middle" fontSize="12" fontWeight="700"
        fill={color} fontFamily="inherit">
        {Math.round(score)}
      </text>
    </svg>
  );
}

const ease = [0.16, 1, 0.3, 1] as [number, number, number, number];
const fade = (delay = 0) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, ease, delay },
});

export default function DashboardClient({
  date, displayName, photoUrl, goals, consumed, burned, steps, stepsGoal, activeMinutes, heartRate,
  sleepMinutes, sleepGoalMin, sessions, weight, previousWeight, trendPoints,
  waterMl: initialWaterMl, plan, lang, trackedNutrients, recentPhotos = [],
}: Props) {
  const todayLabel = format(new Date(date + "T12:00:00"), "EEEE d MMMM", { locale: fr });
  const [waterMl, setWaterMl] = useState(initialWaterMl);
  const [bilanMode, setBilanMode] = useState<"%" | "g">("%");
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
  const [burnedDetailOpen, setBurnedDetailOpen] = useState(false);
  const [deductBurned, setDeductBurned] = useState(goals.deductBurnedCalories !== false);

  const toggleDeductBurned = async () => {
    const next = !deductBurned;
    setDeductBurned(next);
    await fetch("/api/goals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ "goals.deductBurnedCalories": next }),
    }).catch(() => {});
  };
  const router = useRouter();
  const hasSynced = useRef(false);

  // Auto-sync both services on every dashboard open, then refresh data
  useEffect(() => {
    if (hasSynced.current) return;
    hasSynced.current = true;
    const opts = { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) };
    Promise.allSettled([
      fetch("/api/google-fit/sync", opts),
      fetch("/api/withings/sync", { ...opts, body: JSON.stringify({ date }) }),
    ]).then(() => {
      // Refresh server component data to show newly synced values
      router.refresh();
    }).catch(() => {});
  }, [date, router]);

  const handleForceSync = async () => {
    setSyncing(true);
    setSyncMsg("");
    try {
      const [fitRes, wRes] = await Promise.all([
        fetch("/api/google-fit/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) }),
        fetch("/api/withings/sync",   { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date }) }),
      ]);
      // Read response bodies (don't throw if not ok)
      const fitJson = fitRes.ok   ? await fitRes.json() as { ok: boolean } : { ok: false };
      const wJson   = wRes.ok     ? await wRes.json()   as { ok: boolean } : { ok: false };
      // Show per-service indicator: ✓ = synced, · = not connected / no new data
      const label = `${fitJson.ok ? "✓" : "·"}F  ${wJson.ok ? "✓" : "·"}W`;
      setSyncMsg(label);
      setTimeout(() => { window.location.reload(); }, 900);
    } catch {
      setSyncMsg("!");
      setSyncing(false);
    }
  };

  // Greeting
  const hour = new Date().getHours();
  const greeting = hour < 5 ? "Bonne nuit" : hour < 12 ? "Bonjour" : hour < 18 ? "Bon après-midi" : "Bonsoir";
  const greetingEmoji = hour < 5 ? "🌙" : hour < 12 ? "☀️" : hour < 18 ? "🌤️" : "🌆";

  // Daily score (4 objectives)
  const maxHr = goals.age ? 220 - goals.age : 190;
  const objectives = [
    consumed.calories >= goals.dailyCalories * 0.7,
    consumed.proteinG >= goals.proteinGrams * 0.7,
    steps !== null && steps >= stepsGoal * 0.7,
    sleepMinutes !== null && sleepMinutes >= sleepGoalMin * 0.9,
  ];
  const score = objectives.filter(Boolean).length;

  // Bilan du jour metrics
  const bilanMetrics: { label: string; pct: number | null; value: number | null; goalVal: number; unit: string }[] = [
    { label: "Calories",  pct: goals.dailyCalories > 0 ? Math.min(consumed.calories / goals.dailyCalories * 100, 100) : null, value: Math.round(consumed.calories), goalVal: goals.dailyCalories, unit: "kcal" },
    { label: "Protéines", pct: goals.proteinGrams  > 0 ? Math.min(consumed.proteinG  / goals.proteinGrams  * 100, 100) : null, value: Math.round(consumed.proteinG),  goalVal: goals.proteinGrams,  unit: "g" },
    { label: "Glucides",  pct: goals.carbsGrams    > 0 ? Math.min(consumed.carbsG    / goals.carbsGrams    * 100, 100) : null, value: Math.round(consumed.carbsG),    goalVal: goals.carbsGrams,    unit: "g" },
    { label: "Lipides",   pct: goals.fatGrams      > 0 ? Math.min(consumed.fatG      / goals.fatGrams      * 100, 100) : null, value: Math.round(consumed.fatG),      goalVal: goals.fatGrams,      unit: "g" },
    { label: "Fibres",    pct: goals.fiberGrams    > 0 ? Math.min(consumed.fiberG    / goals.fiberGrams    * 100, 100) : null, value: Math.round(consumed.fiberG),    goalVal: goals.fiberGrams,    unit: "g" },
    { label: "Eau",       pct: (goals.waterMl ?? 2000) > 0 ? Math.min(waterMl / (goals.waterMl ?? 2000) * 100, 100) : null, value: waterMl, goalVal: goals.waterMl ?? 2000, unit: "mL" },
    { label: "Pas",       pct: steps !== null ? Math.min(steps / stepsGoal * 100, 100) : null, value: steps, goalVal: stepsGoal, unit: "" },
    { label: "Sommeil",   pct: sleepMinutes !== null ? Math.min(sleepMinutes / sleepGoalMin * 100, 100) : null, value: sleepMinutes ? Math.round(sleepMinutes / 60 * 10) / 10 : null, goalVal: Math.round(sleepGoalMin / 60 * 10) / 10, unit: "h" },
  ];
  const knownPcts = bilanMetrics.filter(m => m.pct !== null).map(m => m.pct as number);
  const overallScore = knownPcts.length > 0
    ? Math.round(knownPcts.reduce((a, b) => a + b, 0) / knownPcts.length)
    : 0;

  const dashboardInsightData = {
    sleepMinutes,
    sleepGoalMin,
    caloriesConsumed: Math.round(consumed.calories),
    caloriesGoal:     goals.dailyCalories,
    burned,
    steps,
    stepsGoal,
    activeMinutes,
    heartRate,
    waterMl,
    waterGoal:        goals.waterMl ?? 2000,
    weightKg:         weight?.kg ?? null,
    targetWeightKg:   goals.targetWeightKg ?? null,
    planLabel:        plan?.programLabel,
    planEmoji:        plan?.programEmoji,
    planDay:          plan ? Math.floor((Date.now() - new Date(plan.startDate + "T00:00:00").getTime()) / 86400000) + 1 : undefined,
    projectedTargetDate: plan?.projectedTargetDate,
  };

  // Macro progress
  const macros = [
    { label: "Prot.",  value: consumed.proteinG, goal: goals.proteinGrams, color: "var(--protein)" },
    { label: "Gluc.",  value: consumed.carbsG,   goal: goals.carbsGrams,   color: "var(--carbs)" },
    { label: "Lip.",   value: consumed.fatG,      goal: goals.fatGrams,     color: "var(--fat)" },
    { label: "Fibres", value: consumed.fiberG,    goal: goals.fiberGrams,   color: "var(--fiber)" },
  ];

  // Sleep
  const sleepGoalH = Math.round(sleepGoalMin / 60 * 10) / 10;
  const sleepPct   = sleepMinutes ? Math.min(sleepMinutes / sleepGoalMin, 1) * 100 : 0;
  const sleepOk    = !!sleepMinutes && sleepMinutes >= sleepGoalMin;

  // Heart rate zone
  const zone = heartRate ? hrZoneLabel(heartRate, maxHr) : null;

  // Active minutes (OMS recommends 30 min/day minimum)
  const activePct = Math.min((activeMinutes ?? 0) / 30, 1) * 100;

  // Steps
  const stepsPct = Math.min((steps ?? 0) / stepsGoal, 1) * 100;

  const chartData = trendPoints.map((p) => ({
    ...p,
    label: format(new Date(p.date + "T12:00:00"), "dd/MM"),
  }));
  const weightChartData = chartData.filter((p) => (p.weightKg ?? 0) > 0);

  return (
    <div className="relative min-h-screen">
      <WelcomeChime />
      <div className="bg-orbs" />

      <div
        className="relative z-10 max-w-md mx-auto px-4 py-6 md:ml-[220px] md:max-w-2xl"
        style={{ paddingBottom: "80px" }}
      >

        {/* ── Header ── */}
        <motion.div {...fade(0)} className="mb-5">

          {/* Row 1 — avatar · greeting · sync */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3 min-w-0">
              {/* Avatar */}
              <div className="w-11 h-11 rounded-full overflow-hidden flex-shrink-0"
                style={{ border: "2px solid var(--border-strong)" }}>
                {photoUrl ? (
                  <img src={photoUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[16px] font-semibold"
                    style={{ background: "rgba(249,115,22,0.15)", color: "var(--calories)" }}>
                    {displayName ? displayName[0].toUpperCase() : "N"}
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
                  {greetingEmoji} {greeting}{displayName ? `, ${displayName.split(" ")[0]}` : ""}
                </p>
                <h1 className="text-[24px] font-bold tracking-tight capitalize leading-tight" style={{ color: "var(--text-primary)" }}>
                  {todayLabel}
                </h1>
              </div>
            </div>

            {/* Sync button */}
            <button
              onClick={handleForceSync}
              disabled={syncing}
              title="Synchroniser"
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid var(--border)",
                color: syncMsg.includes("✓") ? "#34A853" : syncMsg === "!" ? "#EA4335" : "var(--text-muted)",
              }}>
              {syncing
                ? <IconRefresh size={15} stroke={1.5} className="animate-spin" />
                : syncMsg
                  ? <span className="text-[10px] font-bold leading-none">{syncMsg}</span>
                  : <IconRefresh size={15} stroke={1.5} />
              }
            </button>
          </div>

          {/* Photo strip — below date */}
          {recentPhotos.length > 0 && (
            <PhotoStrip photos={recentPhotos} />
          )}

          {/* Row 2 — daily objectives pill */}
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5 items-center">
              {objectives.map((ok, i) => (
                <motion.div key={i}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.15 + i * 0.06, type: "spring", stiffness: 500 }}
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ background: ok ? "var(--calories)" : "rgba(255,255,255,0.12)" }}
                />
              ))}
            </div>
            <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
              {score}/4 objectifs du jour
            </span>
          </div>

          {/* Row 3 — plan card (if active) */}
          {(plan || (goals as NutritionGoals & { activityPlan?: ActivityPlan }).activityPlan) && (() => {
            const ap = (goals as NutritionGoals & { activityPlan?: ActivityPlan }).activityPlan;
            const daysInPlan = plan ? Math.floor((Date.now() - new Date(plan.startDate + "T00:00:00").getTime()) / 86400000) + 1 : null;
            const wk = plan?.projectedWeeklyLossKg;
            const mo = wk !== undefined ? Math.round(wk * 4.33 * 10) / 10 : undefined;
            const fmtKg = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(1)} kg`;
            return (
              <div className="mt-3 rounded-2xl px-4 py-3 flex flex-wrap items-center gap-x-3 gap-y-1.5"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid var(--border)",
                }}>
                {/* Program name + day */}
                {plan && (
                  <div className="flex items-center gap-2">
                    <span className="text-base">{plan.programEmoji}</span>
                    <span className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>{plan.programLabel}</span>
                    {daysInPlan !== null && (
                      <span className="text-[11px] px-1.5 py-0.5 rounded-md"
                        style={{ background: "rgba(249,115,22,0.12)", color: "var(--calories)", fontWeight: 600 }}>
                        Jour {daysInPlan}
                      </span>
                    )}
                    {plan.projectedTargetDate && (
                      <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                        🎯 {format(new Date(plan.projectedTargetDate + "T00:00:00"), "d MMM", { locale: fr })}
                      </span>
                    )}
                  </div>
                )}

                {/* Weight projections */}
                {wk !== undefined && (
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="h-3 w-px" style={{ background: "var(--border)" }} />
                    <span style={{ color: "var(--fiber)", fontWeight: 600 }}>{fmtKg(wk)}/sem</span>
                    {mo !== undefined && (
                      <>
                        <span style={{ color: "var(--text-muted)" }}>·</span>
                        <span style={{ color: "var(--fiber)", fontWeight: 600 }}>{fmtKg(mo)}/mois</span>
                      </>
                    )}
                  </div>
                )}

                {/* Activity plan */}
                {ap && (
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="h-3 w-px" style={{ background: "var(--border)" }} />
                    <span>🏃</span>
                    <span style={{ color: "var(--text-secondary)" }}>
                      {ap.sessionsPerWeek} séances/sem · ~{Math.round(ap.weeklyKcalBurned)} kcal
                    </span>
                  </div>
                )}
              </div>
            );
          })()}
        </motion.div>

        {/* Fun Facts banner */}
        <motion.div {...fade(0.04)} className="mb-4">
          <FunFactsBanner />
        </motion.div>

        {/* ── Hero card: ring + macros + journal ── */}
        <motion.div {...fade(0.05)} className="glass p-5 mb-4">
          {/* Calorie ring */}
          <div className="flex flex-col items-center gap-4">
            <CalorieBudgetRing
              consumed={consumed.calories}
              goal={goals.dailyCalories}
              burned={deductBurned ? burned : null}
              activeMinutes={activeMinutes}
              sessionCount={sessions.length}
              steps={steps}
              stepsGoal={stepsGoal}
              onBurnedClick={burned && deductBurned ? () => setBurnedDetailOpen(true) : undefined}
            />

            {/* ── Deduct-burned toggle ── */}
            {burned != null && burned > 0 && (
              <button
                onClick={toggleDeductBurned}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-[12px] font-medium transition-all active:scale-95"
                style={{
                  background: deductBurned ? "rgba(52,211,153,0.10)" : "rgba(255,255,255,0.05)",
                  border: `1px solid ${deductBurned ? "rgba(52,211,153,0.35)" : "var(--border)"}`,
                  color: deductBurned ? "rgba(52,211,153,0.9)" : "var(--text-muted)",
                }}
              >
                {/* Mini pill switch */}
                <div className="relative w-7 h-4 rounded-full flex-shrink-0 transition-colors"
                  style={{ background: deductBurned ? "rgba(52,211,153,0.5)" : "rgba(255,255,255,0.12)" }}>
                  <div className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform"
                    style={{ transform: deductBurned ? "translateX(15px)" : "translateX(2px)" }} />
                </div>
                Retrancher {Math.round(burned)} kcal brûlées
              </button>
            )}

            {/* Macro progress bars */}
            <div className="w-full grid grid-cols-4 gap-3 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
              {macros.map(({ label, value, goal, color }) => {
                const fraction = goal > 0 ? value / goal : 0;
                const pct = Math.min(fraction * 100, 100);
                const over = value > goal;
                return (
                  <div key={label} className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-medium" style={{ color }}>{label}</span>
                      <span className="text-[10px] tabular-nums" style={{ color: over ? "#ef4444" : levelColor(fraction) }}>
                        {Math.round(value)}g
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                      <motion.div
                        className="h-full rounded-full w-full"
                        style={{ background: levelBarBg(over ? 1.1 : fraction) }}
                        initial={{ clipPath: "inset(0 100% 0 0)" }}
                        animate={{ clipPath: levelBarClip(fraction) }}
                        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
                      />
                    </div>
                    <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>/{goal}g</span>
                  </div>
                );
              })}
            </div>

            {/* Journal link */}
            <Link href="/log" className="btn btn-ghost text-[12.5px] w-full justify-center">
              Ouvrir le journal
              <IconChevronRight size={14} stroke={2} />
            </Link>
          </div>
        </motion.div>

        {/* ── Bilan du jour ── */}
        <motion.div {...fade(0.08)} className="glass p-4 mb-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="label-xs mb-0.5">Score journalier</p>
              <p className="text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>Bilan du jour</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setBilanMode(m => m === "%" ? "g" : "%")}
                className="px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all"
                style={{
                  background: bilanMode === "g" ? "rgba(249,115,22,0.15)" : "rgba(255,255,255,0.06)",
                  color:      bilanMode === "g" ? "var(--calories)"        : "var(--text-muted)",
                  border:     bilanMode === "g" ? "1px solid rgba(249,115,22,0.3)" : "1px solid var(--border)",
                }}>
                {bilanMode === "%" ? "% → g" : "g → %"}
              </button>
              <ScoreRing score={overallScore} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-5 gap-y-3">
            {bilanMetrics.map(({ label, pct, value, goalVal, unit }) => (
              <div key={label}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>{label}</span>
                  {bilanMode === "%" ? (
                    <span className="text-[11px] font-semibold tabular-nums" style={{ color: levelColorPct(pct) }}>
                      {pct !== null ? `${Math.round(pct)}%` : "—"}
                    </span>
                  ) : (
                    <span className="text-[11px] font-semibold tabular-nums" style={{ color: levelColorPct(pct) }}>
                      {value !== null
                        ? unit === "" ? value.toLocaleString("fr-FR")
                          : `${value}${unit !== "kcal" ? "" : " "}${unit}`
                        : "—"}
                      {value !== null && goalVal > 0 && (
                        <span className="font-normal" style={{ color: "var(--text-muted)" }}>
                          /{goalVal}{unit !== "" && unit !== "kcal" ? unit : unit === "kcal" ? " kcal" : ""}
                        </span>
                      )}
                    </span>
                  )}
                </div>
                <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
                  {pct !== null && (
                    <motion.div
                      className="h-full rounded-full w-full"
                      style={{ background: levelBarBg((pct ?? 0) / 100) }}
                      initial={{ clipPath: "inset(0 100% 0 0)" }}
                      animate={{ clipPath: levelBarClip((pct ?? 0) / 100) }}
                      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* ── AI Insight ── */}
        <motion.div {...fade(0.09)} className="mb-4">
          <AIInsightBox type="dashboard" data={dashboardInsightData} delay={1000} />
        </motion.div>

        {/* ── Steps + Weight ── */}
        <motion.div {...fade(0.1)} className="grid grid-cols-2 gap-3 mb-4">

          {/* Steps */}
          <Link href="/activity/steps" className="card flex flex-col gap-2 transition-opacity active:opacity-70">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <IconShoe size={13} stroke={1.5} style={{ color: "var(--steps)" }} />
                <span className="label-xs">Pas</span>
              </div>
              <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                {stepsGoal.toLocaleString("fr-FR")}
              </span>
            </div>
            <span className="text-[24px] font-bold tabular-nums leading-none"
              style={{ color: steps !== null ? "var(--text-primary)" : "var(--text-muted)" }}>
              {steps !== null ? steps.toLocaleString("fr-FR") : "—"}
            </span>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
              <motion.div
                className="h-full rounded-full w-full"
                style={{ background: levelBarBg(stepsPct / 100) }}
                initial={{ clipPath: "inset(0 100% 0 0)" }}
                animate={{ clipPath: levelBarClip(stepsPct / 100) }}
                transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                {steps !== null
                  ? stepsPct >= 100 ? "🎉 Objectif atteint !" : `${Math.round((1 - stepsPct / 100) * stepsGoal).toLocaleString("fr-FR")} restants`
                  : "Sync Google Fit"}
              </span>
              <IconChevronRight size={10} stroke={1.5} style={{ color: "var(--text-muted)" }} />
            </div>
          </Link>

          <WeightWidget weight={weight} previous={previousWeight} />
        </motion.div>

        {/* ── Stats strip: Sleep · HR · Active ── */}
        <motion.div {...fade(0.13)} className="glass p-4 mb-4">
          <div className="grid grid-cols-3 gap-0">

            {/* Sleep */}
            <Link href="/activity/sleep" className="flex flex-col gap-2 pr-4 transition-opacity active:opacity-70" style={{ borderRight: "1px solid var(--border)" }}>
              <div className="flex items-center gap-1.5">
                <IconMoon size={12} stroke={2} style={{ color: "#7986CB" }} />
                <span className="label-xs">Sommeil</span>
              </div>
              <div className="flex items-end gap-1 leading-none">
                <span className="text-[22px] font-bold"
                  style={{ color: sleepMinutes ? "var(--text-primary)" : "var(--text-muted)" }}>
                  {sleepMinutes ? fmtSleep(sleepMinutes) : "—"}
                </span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                <motion.div
                  className="h-full rounded-full w-full"
                  style={{ background: levelBarBg(sleepPct / 100) }}
                  initial={{ clipPath: "inset(0 100% 0 0)" }}
                  animate={{ clipPath: levelBarClip(sleepPct / 100) }}
                  transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px]" style={{ color: sleepOk ? levelColor(1) : "var(--text-muted)" }}>
                  {sleepMinutes ? (sleepOk ? "✓ Récupéré" : `obj. ${sleepGoalH}h`) : "Aucune donnée"}
                </span>
                <IconChevronRight size={10} stroke={1.5} style={{ color: "var(--text-muted)" }} />
              </div>
            </Link>

            {/* Heart rate */}
            <Link href="/cardio" className="flex flex-col gap-2 px-4 transition-opacity active:opacity-70"
              style={{ borderRight: "1px solid var(--border)" }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <IconHeart size={12} stroke={2} style={{ color: "#EA4335" }} />
                  <span className="label-xs">FC moy.</span>
                </div>
                <IconChevronRight size={9} stroke={1.5} style={{ color: "var(--text-muted)" }} />
              </div>
              <span className="text-[22px] font-bold leading-none"
                style={{ color: heartRate ? "var(--text-primary)" : "var(--text-muted)" }}>
                {heartRate ?? "—"}
              </span>
              {heartRate && zone ? (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md self-start"
                  style={{ background: `${zone.color}20`, color: zone.color }}>
                  {zone.label}
                </span>
              ) : (
                <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                  {heartRate ? "bpm" : "Voir historique"}
                </span>
              )}
              <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                {heartRate ? "bpm · Cardio →" : ""}
              </span>
            </Link>

            {/* Active minutes */}
            <Link href="/activity" className="flex flex-col gap-2 pl-4 transition-opacity active:opacity-70">
              <div className="flex items-center gap-1.5">
                <IconBolt size={12} stroke={2} style={{ color: "#34A853" }} />
                <span className="label-xs">Min. actives</span>
              </div>
              <div className="flex items-end gap-1 leading-none">
                <span className="text-[22px] font-bold"
                  style={{ color: activeMinutes ? "var(--text-primary)" : "var(--text-muted)" }}>
                  {activeMinutes ?? "—"}
                </span>
                {activeMinutes && (
                  <span className="text-[11px] mb-0.5" style={{ color: "var(--text-muted)" }}>/30</span>
                )}
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                <motion.div
                  className="h-full rounded-full w-full"
                  style={{ background: levelBarBg(activePct / 100) }}
                  initial={{ clipPath: "inset(0 100% 0 0)" }}
                  animate={{ clipPath: levelBarClip(activePct / 100) }}
                  transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px]" style={{ color: activePct >= 100 ? levelColor(1) : "var(--text-muted)" }}>
                  {activeMinutes
                    ? activePct >= 100 ? "✓ Objectif atteint" : `${30 - (activeMinutes ?? 0)} min restantes`
                    : "Aucune donnée"}
                </span>
                <IconChevronRight size={10} stroke={1.5} style={{ color: "var(--text-muted)" }} />
              </div>
            </Link>
          </div>
        </motion.div>

        {/* ── Workout sessions ── */}
        {sessions.filter(s => ![72, 110, 111, 112, 113, 114].includes(s.activityType)).length > 0 && (
          <motion.div {...fade(0.15)} className="glass p-4 mb-4">
            <p className="label-xs mb-3">Séances du jour</p>
            <div className="space-y-2">
              {sessions.filter(s => ![72, 110, 111, 112, 113, 114].includes(s.activityType)).map(s => (
                <div key={s.id} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0"
                    style={{ background: "rgba(255,255,255,0.06)" }}>
                    {activityEmoji(s.activityType)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium truncate" style={{ color: "var(--text-primary)" }}>{s.name}</p>
                    <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                      {new Date(s.startMs).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <IconClock size={14} stroke={1.5} style={{ color: "var(--text-muted)" }} />
                    <span className="text-[12px]" style={{ color: "var(--text-secondary)" }}>{s.durationMin} min</span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── Burned calories detail modal ── */}
        <AnimatePresence>
          {burnedDetailOpen && burned && (
            <>
              {/* Backdrop */}
              <motion.div
                className="fixed inset-0 z-40"
                style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setBurnedDetailOpen(false)}
              />
              {/* Sheet */}
              <motion.div
                className="fixed bottom-0 left-0 right-0 z-50 max-w-md mx-auto"
                initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                transition={{ type: "spring", stiffness: 400, damping: 40 }}
              >
                <div className="rounded-t-2xl p-5 pb-8"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)", borderBottom: "none" }}>
                  {/* Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                        style={{ background: "rgba(52,211,153,0.12)" }}>
                        <IconFlame size={14} stroke={1.5} style={{ color: "rgba(52,211,153,0.9)" }} />
                      </div>
                      <div>
                        <p className="text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>
                          Calories brûlées
                        </p>
                        <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Détail de la dépense active</p>
                      </div>
                    </div>
                    <button onClick={() => setBurnedDetailOpen(false)}
                      className="w-7 h-7 rounded-full flex items-center justify-center"
                      style={{ background: "rgba(255,255,255,0.06)" }}>
                      <IconX size={13} stroke={2} style={{ color: "var(--text-muted)" }} />
                    </button>
                  </div>

                  {/* Total */}
                  <div className="rounded-xl px-4 py-3 mb-4 flex items-center justify-between"
                    style={{ background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.15)" }}>
                    <span className="text-[13px] font-medium" style={{ color: "var(--text-secondary)" }}>Total actif</span>
                    <span className="text-[22px] font-bold tabular-nums" style={{ color: "rgba(52,211,153,0.9)" }}>
                      −{Math.round(burned)} kcal
                    </span>
                  </div>

                  {/* Sources */}
                  <p className="label-xs mb-2">Sources</p>
                  <div className="space-y-2">

                    {/* Steps contribution */}
                    {steps && steps > 0 && (() => {
                      const stepKcal = Math.round(steps * 0.04);
                      return (
                        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0"
                            style={{ background: "rgba(255,255,255,0.05)" }}>👟</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>Marche · {steps.toLocaleString("fr-FR")} pas</p>
                            <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>≈ 0.04 kcal/pas</p>
                          </div>
                          <span className="text-[12px] font-semibold tabular-nums flex-shrink-0"
                            style={{ color: "rgba(52,211,153,0.8)" }}>~{stepKcal} kcal</span>
                        </div>
                      );
                    })()}

                    {/* Activity sessions */}
                    {sessions.filter(s => ![72, 110, 111, 112, 113, 114].includes(s.activityType)).map(s => (
                      <div key={s.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0"
                          style={{ background: "rgba(255,255,255,0.05)" }}>
                          {activityEmoji(s.activityType)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium truncate" style={{ color: "var(--text-primary)" }}>{s.name}</p>
                          <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                            {new Date(s.startMs).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} · {s.durationMin} min
                          </p>
                        </div>
                        <span className="text-[12px] font-semibold tabular-nums flex-shrink-0"
                          style={{ color: s.calories ? "rgba(52,211,153,0.8)" : "var(--text-muted)" }}>
                          {s.calories ? `${Math.round(s.calories)} kcal` : "—"}
                        </span>
                      </div>
                    ))}

                    {/* Active minutes context */}
                    {activeMinutes && activeMinutes > 0 && (
                      <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0"
                          style={{ background: "rgba(255,255,255,0.05)" }}>⚡</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>Minutes actives</p>
                          <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Intensité globale du jour</p>
                        </div>
                        <span className="text-[12px] font-semibold tabular-nums flex-shrink-0"
                          style={{ color: "var(--text-secondary)" }}>{activeMinutes} min</span>
                      </div>
                    )}
                  </div>

                  {/* Note */}
                  <p className="mt-3 text-[10px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                    💡 Valeur issue de Google Fit · Dépense basale (métabolisme de repos) non incluse
                  </p>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Water tracker */}
        <motion.div {...fade(0.19)} className="mb-4">
          <WaterTracker
            date={date}
            waterMl={waterMl}
            goalMl={goals.waterMl ?? 2000}
            onUpdate={setWaterMl}
          />
        </motion.div>

        {/* Streak & régularité */}
        <motion.div {...fade(0.21)} className="mb-4">
          <StreakWidget />
        </motion.div>

        {/* ── Tracked nutrients ── */}
        {trackedNutrients && Object.values(trackedNutrients).some(Boolean) && (() => {
          const rows: { key: keyof TrackedNutrients; emoji: string; label: string; unit: string; value: number; goal: number; color: string; invertAlert?: boolean }[] = [];
          if (trackedNutrients.protein)      rows.push({ key: "protein",      emoji: "💪", label: "Protéines",     unit: "g",  value: Math.round(consumed.proteinG),       goal: goals.proteinGrams,         color: "var(--protein)"  });
          if (trackedNutrients.sodium)       rows.push({ key: "sodium",       emoji: "🧂", label: "Sel",           unit: "mg", value: Math.round(consumed.sodiumMg ?? 0),   goal: goals.sodiumMg ?? 2000,     color: "#f59e0b", invertAlert: true });
          if (trackedNutrients.sugar)        rows.push({ key: "sugar",        emoji: "🍬", label: "Sucres",        unit: "g",  value: Math.round(consumed.sugarG ?? 0),     goal: goals.sugarGrams ?? 50,     color: "#ec4899", invertAlert: true });
          if (trackedNutrients.saturatedFat) rows.push({ key: "saturatedFat", emoji: "🧈", label: "Lip. saturés",  unit: "g",  value: Math.round(consumed.saturatedFatG ?? 0), goal: goals.saturatedFatGrams ?? 20, color: "var(--fat)", invertAlert: true });
          return (
            <motion.div {...fade(0.185)} className="glass px-4 py-3 mb-4">
              <p className="label-xs mb-2">Paramètres suivis</p>
              <div className="space-y-2">
                {rows.map(({ key, emoji, label, unit, value, goal, invertAlert }) => {
                  const fraction = goal > 0 ? value / goal : 0;
                  const over = fraction > 1;
                  return (
                    <div key={key} className="flex items-center gap-2.5">
                      <span className="text-[13px] flex-shrink-0 w-4 text-center">{emoji}</span>
                      <span className="text-[11px] w-[88px] flex-shrink-0 truncate" style={{ color: "var(--text-muted)" }}>{label}</span>
                      <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                        <motion.div
                          className="h-full rounded-full w-full"
                          style={{ background: levelBarBg(over && invertAlert ? 1.1 : fraction) }}
                          initial={{ clipPath: "inset(0 100% 0 0)" }}
                          animate={{ clipPath: levelBarClip(fraction) }}
                          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                        />
                      </div>
                      <span className="text-[10px] font-semibold tabular-nums flex-shrink-0 w-[48px] text-right"
                        style={{ color: over && invertAlert ? "#ef4444" : levelColor(fraction) }}>
                        {value}<span className="font-normal opacity-60">/{goal}{unit}</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          );
        })()}

        {/* 14-day calorie trend */}
        {chartData.filter((p) => p.calories > 0).length > 1 && (
          <motion.div {...fade(0.19)} className="glass p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <p className="label-xs">Tendance 14 jours</p>
              <IconTrendingUp size={13} stroke={1.5} style={{ color: "var(--calories)" }} />
            </div>
            <ResponsiveContainer width="100%" height={100}>
              <AreaChart data={chartData} margin={{ top: 2, right: 4, left: -28, bottom: 0 }}>
                <defs>
                  <linearGradient id="dbCalGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#f97316" stopOpacity={0.25} />
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
                <ReferenceLine y={goals.dailyCalories} stroke="rgba(249,115,22,0.35)" strokeDasharray="4 3" />
                <Area type="monotone" dataKey="calories" stroke="#f97316" strokeWidth={1.5} fill="url(#dbCalGrad)" dot={false} connectNulls />
              </AreaChart>
            </ResponsiveContainer>
            {weightChartData.length > 1 && (
              <>
                <div className="h-px my-3" style={{ background: "var(--border)" }} />
                <p className="label-xs mb-2">Poids</p>
                <ResponsiveContainer width="100%" height={70}>
                  <AreaChart data={weightChartData} margin={{ top: 2, right: 4, left: -28, bottom: 0 }}>
                    <defs>
                      <linearGradient id="dbWtGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="var(--steps)" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="var(--steps)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="label" tick={{ fontSize: 9, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 9, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} domain={["auto", "auto"]} />
                    <Tooltip content={({ active, payload, label: lbl }) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div className="px-2.5 py-1.5 rounded-lg text-[11px]"
                          style={{ background: "rgba(13,13,17,0.96)", border: "1px solid var(--border)" }}>
                          <p style={{ color: "var(--text-muted)" }}>{lbl}</p>
                          <p style={{ color: "var(--steps)" }} className="font-bold">{(payload[0]?.value as number)?.toFixed(1)} kg</p>
                        </div>
                      );
                    }} />
                    <Area type="monotone" dataKey="weightKg" stroke="var(--steps)" strokeWidth={1.5} fill="url(#dbWtGrad)" dot={false} connectNulls />
                  </AreaChart>
                </ResponsiveContainer>
              </>
            )}
          </motion.div>
        )}

        {/* Macro detail bars */}
        <motion.div {...fade(0.2)} className="glass p-4 mb-4">
          <p className="label-xs mb-3">Détail nutritionnel</p>
          <div className="space-y-2.5">
            {[
              { label: "Protéines", value: consumed.proteinG, goal: goals.proteinGrams, color: "var(--protein)" },
              { label: "Glucides",  value: consumed.carbsG,   goal: goals.carbsGrams,  color: "var(--carbs)" },
              { label: "Lipides",   value: consumed.fatG,     goal: goals.fatGrams,    color: "var(--fat)" },
              { label: "Fibres",    value: consumed.fiberG,   goal: goals.fiberGrams,  color: "var(--fiber)" },
            ].map(({ label, value, goal }) => {
              const fraction = goal > 0 ? value / goal : 0;
              const pct = Math.min(fraction * 100, 100);
              return (
                <div key={label}>
                  <div className="flex justify-between text-[12px] mb-1">
                    <span style={{ color: "var(--text-secondary)" }}>{label}</span>
                    <span style={{ color: levelColor(fraction) }}>
                      {Math.round(value)}g
                      <span style={{ color: "var(--text-muted)" }}> / {goal}g</span>
                    </span>
                  </div>
                  <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
                    <motion.div
                      className="h-full rounded-full w-full"
                      style={{ background: levelBarBg(fraction) }}
                      initial={{ clipPath: "inset(0 100% 0 0)" }}
                      animate={{ clipPath: levelBarClip(fraction) }}
                      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                    />
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
