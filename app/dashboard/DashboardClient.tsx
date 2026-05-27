"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { ArrowRight, Moon, Heart, Lightning, Timer, TrendUp } from "@phosphor-icons/react";
import CalorieBudgetRing from "@/app/components/CalorieBudgetRing";
import MacroRings from "@/app/components/MacroRings";
import StepsWidget from "@/app/components/StepsWidget";
import WeightWidget from "@/app/components/WeightWidget";
import WaterTracker from "@/app/components/WaterTracker";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import type { DayTotals, NutritionGoals, WeightPoint, DayTrendPoint, Lang } from "@/app/lib/types";

interface Session { id: string; name: string; activityType: number; durationMin: number; startMs: number }

interface Props {
  date:           string;
  goals:          NutritionGoals;
  consumed:       DayTotals;
  burned:         number | null;
  steps:          number | null;
  activeMinutes:  number | null;
  heartRate:      number | null;
  sleepMinutes:   number | null;
  sessions:       Session[];
  weight:         WeightPoint | null;
  previousWeight: WeightPoint | null;
  recentWeight:   WeightPoint[];
  trendPoints:    DayTrendPoint[];
  waterMl:        number;
  lang:           Lang;
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

const ease = [0.16, 1, 0.3, 1] as [number, number, number, number];
const fade = (delay = 0) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, ease, delay },
});

export default function DashboardClient({
  date, goals, consumed, burned, steps, activeMinutes, heartRate, sleepMinutes, sessions,
  weight, previousWeight, trendPoints, waterMl: initialWaterMl, lang,
}: Props) {
  const today = format(new Date(date + "T12:00:00"), "EEEE d MMMM", { locale: fr });
  const [waterMl, setWaterMl] = useState(initialWaterMl);

  // Silent background sync on every dashboard open
  useEffect(() => {
    fetch("/api/google-fit/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }).catch(() => {});
  }, [date]);

  const chartData = trendPoints.map((p) => ({
    ...p,
    label: format(new Date(p.date + "T12:00:00"), "dd/MM"),
  }));
  const weightChartData = chartData.filter((p) => (p.weightKg ?? 0) > 0);

  return (
    <div className="relative min-h-screen">
      <div className="bg-orbs" />

      <div
        className="relative z-10 max-w-md mx-auto px-4 py-6 md:ml-[220px] md:max-w-2xl"
        style={{ paddingBottom: "80px" }}
      >
        {/* Header */}
        <motion.div {...fade(0)} className="mb-6">
          <p className="label-xs mb-0.5 capitalize">{today}</p>
          <h1 className="text-[22px] font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
            Tableau de bord
          </h1>
        </motion.div>

        {/* Calorie ring */}
        <motion.div {...fade(0.05)} className="glass p-6 mb-4 flex flex-col items-center gap-4">
          <CalorieBudgetRing
            consumed={consumed.calories}
            goal={goals.dailyCalories}
            burned={burned}
          />
          <Link href="/log" className="btn btn-ghost text-[12.5px] w-full justify-center">
            Ouvrir le journal
            <ArrowRight size={14} weight="bold" />
          </Link>
        </motion.div>

        {/* Macros rings */}
        <motion.div {...fade(0.1)} className="glass p-5 mb-4">
          <p className="label-xs mb-4">Macronutriments</p>
          <MacroRings
            proteinG={consumed.proteinG} proteinGoal={goals.proteinGrams}
            carbsG={consumed.carbsG}     carbsGoal={goals.carbsGrams}
            fatG={consumed.fatG}         fatGoal={goals.fatGrams}
            fiberG={consumed.fiberG}     fiberGoal={goals.fiberGrams}
          />
        </motion.div>

        {/* Steps + Weight */}
        <motion.div {...fade(0.15)} className="grid grid-cols-2 gap-3 mb-4">
          <StepsWidget steps={steps} goal={10000} />
          <WeightWidget weight={weight} previous={previousWeight} />
        </motion.div>

        {/* Sleep + Heart rate + Active minutes */}
        <motion.div {...fade(0.17)} className="grid grid-cols-3 gap-3 mb-4">
          {/* Sleep */}
          <div className="card flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <Moon size={16} weight="fill" style={{ color: "#818cf8" }} />
              <span className="label-xs">Sommeil</span>
            </div>
            <span className="text-[20px] font-bold leading-none" style={{ color: sleepMinutes ? "var(--text-primary)" : "var(--text-muted)" }}>
              {sleepMinutes ? `${Math.floor(sleepMinutes / 60)}h${String(sleepMinutes % 60).padStart(2, "0")}` : "—"}
            </span>
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
              {sleepMinutes ? (sleepMinutes >= 420 ? "✓ Récupéré" : "Insuffisant") : "Aucune donnée"}
            </span>
          </div>
          {/* Heart rate */}
          <div className="card flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <Heart size={16} weight="fill" style={{ color: "#f87171" }} />
              <span className="label-xs">Fréq. card.</span>
            </div>
            <span className="text-[20px] font-bold leading-none" style={{ color: heartRate ? "var(--text-primary)" : "var(--text-muted)" }}>
              {heartRate ?? "—"}
            </span>
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
              {heartRate ? "bpm moy." : "Aucune donnée"}
            </span>
          </div>
          {/* Active minutes */}
          <div className="card flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <Lightning size={16} weight="fill" style={{ color: "var(--calories)" }} />
              <span className="label-xs">Min. actives</span>
            </div>
            <span className="text-[20px] font-bold leading-none" style={{ color: activeMinutes ? "var(--text-primary)" : "var(--text-muted)" }}>
              {activeMinutes ?? "—"}
            </span>
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
              {activeMinutes ? `/ 30 min objectif` : "Aucune donnée"}
            </span>
          </div>
        </motion.div>

        {/* Workout sessions */}
        {sessions.length > 0 && (
          <motion.div {...fade(0.19)} className="glass p-4 mb-4">
            <p className="label-xs mb-3">Séances du jour</p>
            <div className="space-y-2">
              {sessions.map(s => (
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
                    <Timer size={14} style={{ color: "var(--text-muted)" }} />
                    <span className="text-[12px]" style={{ color: "var(--text-secondary)" }}>{s.durationMin} min</span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Water tracker */}
        <motion.div {...fade(0.18)} className="mb-4">
          <WaterTracker
            date={date}
            waterMl={waterMl}
            goalMl={goals.waterMl ?? 2000}
            onUpdate={setWaterMl}
          />
        </motion.div>

        {/* 14-day calorie trend */}
        {chartData.filter((p) => p.calories > 0).length > 1 && (
          <motion.div {...fade(0.19)} className="glass p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <p className="label-xs">Tendance 14 jours</p>
              <TrendUp size={13} style={{ color: "var(--calories)" }} />
            </div>
            <ResponsiveContainer width="100%" height={100}>
              <AreaChart data={chartData} margin={{ top: 2, right: 4, left: -28, bottom: 0 }}>
                <defs>
                  <linearGradient id="dbCalGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="var(--calories)" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="var(--calories)" stopOpacity={0} />
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
                <Area type="monotone" dataKey="calories" stroke="var(--calories)" strokeWidth={1.5} fill="url(#dbCalGrad)" dot={false} connectNulls />
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
            ].map(({ label, value, goal, color }) => {
              const pct = Math.min((value / goal) * 100, 100);
              return (
                <div key={label}>
                  <div className="flex justify-between text-[12px] mb-1">
                    <span style={{ color: "var(--text-secondary)" }}>{label}</span>
                    <span style={{ color }}>
                      {Math.round(value)}g
                      <span style={{ color: "var(--text-muted)" }}> / {goal}g</span>
                    </span>
                  </div>
                  <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: color }}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
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
