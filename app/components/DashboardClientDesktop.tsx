"use client";

import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { motion } from "framer-motion";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { IconHeart, IconBolt, IconShoe, IconMoon } from "@tabler/icons-react";
import CalorieBudgetRing from "@/app/components/CalorieBudgetRing";
import WeightWidget      from "@/app/components/WeightWidget";
import WaterTracker      from "@/app/components/WaterTracker";
import AIInsightBox      from "@/app/components/AIInsightBox";
import FastingTimer      from "@/app/components/FastingTimer";
import StreakWidget      from "@/app/components/StreakWidget";
import type {
  DayTotals, NutritionGoals, NutritionPlan, WeightPoint,
  DayTrendPoint, Lang, TrackedNutrients,
} from "@/app/lib/types";
import type { RecentPhoto } from "@/app/api/photos/recent/route";

interface Session {
  id: string; name: string; activityType: number;
  durationMin: number; startMs: number; calories?: number | null;
}

interface Props {
  date: string; displayName?: string; photoUrl?: string;
  goals: NutritionGoals; consumed: DayTotals;
  burned: number | null; steps: number | null; stepsGoal: number;
  activeMinutes: number | null; heartRate: number | null;
  sleepMinutes: number | null; sleepGoalMin: number;
  sessions: Session[]; weight: WeightPoint | null;
  previousWeight: WeightPoint | null; recentWeight: WeightPoint[];
  trendPoints: DayTrendPoint[]; waterMl: number;
  plan?: NutritionPlan; lang: Lang; trackedNutrients?: TrackedNutrients;
  recentPhotos?: RecentPhoto[]; todayMeditationMin?: number;
  todayMeditationSessions?: number; lastBPDate?: string | null; lastBPSystolic?: number | null;
}

const ACT_EMOJI: Record<number, string> = {
  1:"🏃",3:"🏃",7:"🚴",8:"🚴",9:"💪",17:"🏋️",
  46:"🚶",82:"🧘",83:"💃",93:"🏊",104:"🥊",45:"⚽",54:"🎾",
};

function StatPill({ icon, label, value, color, pct }: {
  icon: React.ReactNode; label: string; value: string; color: string; pct?: number;
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl"
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)" }}>
      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: `${color}18` }}>
        <span style={{ color }}>{icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>{label}</div>
        <div className="text-[14px] font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>{value}</div>
        {pct !== undefined && (
          <div className="mt-1 h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
            <motion.div className="h-full rounded-full"
              style={{ background: color, width: `${Math.min(100, pct)}%` }}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, pct)}%` }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }} />
          </div>
        )}
      </div>
    </div>
  );
}

function MacroRow({ label, value, goal, color }: {
  label: string; value: number; goal: number; color: string;
}) {
  const p   = goal > 0 ? Math.min(100, value / goal * 100) : 0;
  const over = value > goal && goal > 0;
  return (
    <div>
      <div className="flex justify-between text-[12px] mb-1">
        <span style={{ color: "var(--text-secondary)" }}>{label}</span>
        <span className="tabular-nums" style={{ color: over ? "#ef4444" : color }}>
          {value}g <span style={{ color: "var(--text-muted)" }}>/ {goal}g</span>
        </span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
        <motion.div className="h-full rounded-full"
          style={{ background: over ? "#ef4444" : color, width: `${p}%` }}
          initial={{ width: 0 }}
          animate={{ width: `${p}%` }}
          transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }} />
      </div>
    </div>
  );
}

export default function DashboardClientDesktop({
  date, displayName, goals, consumed, burned, steps, stepsGoal,
  activeMinutes, heartRate, sleepMinutes, sleepGoalMin, sessions,
  weight, previousWeight, recentWeight, trendPoints, waterMl, plan,
  todayMeditationMin = 0,
}: Props) {
  const [localWater, setLocalWater] = useState(waterMl);

  const todayLabel = format(new Date(date + "T12:00:00"), "EEEE d MMMM", { locale: fr });
  const hour       = new Date().getHours();
  const greeting   = hour < 12 ? "Bonjour" : hour < 18 ? "Bon après-midi" : "Bonsoir";

  const remaining = Math.round(goals.dailyCalories - consumed.calories + (burned ?? 0));
  const stepsPct  = Math.min(100, Math.round((steps ?? 0) / stepsGoal * 100));
  const sleepH    = sleepMinutes ? Math.round(sleepMinutes / 60 * 10) / 10 : null;
  const sleepPct  = sleepMinutes ? Math.min(100, sleepMinutes / sleepGoalMin * 100) : 0;
  const activePct = Math.min(100, Math.round((activeMinutes ?? 0) / 30 * 100));

  const chartData = trendPoints.map(p => ({ date: p.date.slice(5), cal: p.calories }));

  const insightData = {
    sleepMinutes, sleepGoalMin,
    caloriesConsumed: Math.round(consumed.calories), caloriesGoal: goals.dailyCalories,
    burned, steps, stepsGoal, activeMinutes, heartRate,
    waterMl:    localWater,
    waterGoal:  goals.waterMl ?? 2000,
    weightKg:   weight?.kg ?? null,
    previousWeightKg: previousWeight?.kg ?? null,
    weightDeltaKg: weight && previousWeight
      ? Math.round((weight.kg - previousWeight.kg) * 100) / 100 : null,
    weightTrend7d: recentWeight.length >= 2
      ? Math.round((recentWeight[recentWeight.length - 1].kg - recentWeight[0].kg) * 100) / 100 : null,
    targetWeightKg:  goals.targetWeightKg ?? null,
    planLabel:       plan?.programLabel,
    planEmoji:       plan?.programEmoji,
    todayMeditationMin,
  };

  return (
    <div className="relative min-h-screen" style={{ paddingBottom: "3rem" }}>
      <div className="bg-orbs" />
      <div className="relative z-10 ml-[220px] px-8 py-8">

        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-[28px] font-bold" style={{ color: "var(--text-primary)" }}>
              {greeting}{displayName ? `, ${displayName.split(" ")[0]}` : ""} 👋
            </h1>
            <p className="text-[14px] mt-1 capitalize" style={{ color: "var(--text-muted)" }}>{todayLabel}</p>
          </div>
          <Link href="/desktop/log"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold hover:opacity-90 active:scale-95 transition-all"
            style={{ background: "var(--calories)", color: "#fff" }}>
            + Journal du jour
          </Link>
        </div>

        {/* ── 3-column grid ── */}
        <div className="grid gap-6" style={{ gridTemplateColumns: "300px 1fr 280px" }}>

          {/* ══ COL 1 : Ring + macros + eau ══ */}
          <div className="flex flex-col gap-4">
            <div className="glass p-5 flex flex-col items-center gap-3">
              <CalorieBudgetRing
                consumed={Math.round(consumed.calories)}
                goal={goals.dailyCalories}
                burned={burned}
                steps={steps}
                stepsGoal={stepsGoal}
                activeMinutes={activeMinutes}
                sessionCount={sessions.length}
                size={220}
              />
              <p className="text-[13px] text-center"
                style={{ color: remaining >= 0 ? "var(--text-muted)" : "#ef4444" }}>
                {remaining >= 0 ? (
                  <><span className="font-bold text-[17px]" style={{ color: "var(--text-primary)" }}>{remaining}</span> kcal restantes</>
                ) : (
                  <><span className="font-bold text-[17px]">+{Math.abs(remaining)}</span> kcal dépassées</>
                )}
              </p>
            </div>

            <div className="glass p-4 space-y-3">
              <p className="text-[10px] font-semibold tracking-wider" style={{ color: "var(--text-muted)" }}>MACROS</p>
              <MacroRow label="Protéines" value={Math.round(consumed.proteinG)} goal={goals.proteinGrams} color="var(--protein)" />
              <MacroRow label="Glucides"  value={Math.round(consumed.carbsG)}   goal={goals.carbsGrams}   color="var(--carbs)" />
              <MacroRow label="Lipides"   value={Math.round(consumed.fatG)}     goal={goals.fatGrams}     color="var(--fat)" />
              <MacroRow label="Fibres"    value={Math.round(consumed.fiberG)}   goal={goals.fiberGrams}   color="var(--fiber)" />
            </div>

            <div className="glass p-4">
              <WaterTracker date={date} waterMl={localWater} goalMl={goals.waterMl ?? 2000} onUpdate={setLocalWater} />
            </div>

            {goals.intermittentFasting?.enabled && (
              <FastingTimer date={date} fastingConfig={goals.intermittentFasting} />
            )}
          </div>

          {/* ══ COL 2 : Chart + stats ══ */}
          <div className="flex flex-col gap-4">
            <div className="glass p-5">
              <p className="text-[10px] font-semibold tracking-wider mb-4" style={{ color: "var(--text-muted)" }}>
                TENDANCE CALORIQUE — 14 JOURS
              </p>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={chartData} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="deskCalGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="var(--calories)" stopOpacity={0.28} />
                      <stop offset="95%" stopColor="var(--calories)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} domain={["auto", "auto"]} />
                  <Tooltip
                    contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: "var(--text-secondary)" }}
                    itemStyle={{ color: "var(--calories)" }}
                  />
                  <ReferenceLine y={goals.dailyCalories} stroke="var(--calories)" strokeDasharray="3 3" strokeOpacity={0.4} />
                  <Area type="monotone" dataKey="cal" stroke="var(--calories)" strokeWidth={2}
                    fill="url(#deskCalGrad)" dot={false} name="kcal" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <StatPill icon={<IconShoe size={16} />}  label="Pas"                 value={steps != null ? steps.toLocaleString("fr-FR") : "—"}  color="var(--protein)" pct={stepsPct} />
              <StatPill icon={<IconBolt size={16} />}  label="Activité"            value={activeMinutes != null ? `${activeMinutes} min` : "—"}  color="var(--carbs)"   pct={activePct} />
              <StatPill icon={<IconMoon size={16} />}  label="Sommeil"             value={sleepH != null ? `${sleepH} h` : "—"}                  color="#a78bfa"        pct={sleepPct} />
              <StatPill icon={<IconHeart size={16} />} label="Fréquence cardiaque" value={heartRate != null ? `${heartRate} bpm` : "—"}           color="#f43f5e" />
            </div>

            {sessions.length > 0 && (
              <div className="glass p-4">
                <p className="text-[10px] font-semibold tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>
                  SÉANCES DU JOUR
                </p>
                <div className="space-y-2">
                  {sessions.map(s => (
                    <div key={s.id} className="flex items-center gap-3 px-3 py-2 rounded-lg"
                      style={{ background: "rgba(255,255,255,0.03)" }}>
                      <span className="text-[18px]">{ACT_EMOJI[s.activityType] ?? "🏅"}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium truncate" style={{ color: "var(--text-primary)" }}>{s.name}</p>
                        <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                          {s.durationMin} min{s.calories ? ` · ${Math.round(s.calories)} kcal` : ""}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ══ COL 3 : Poids + IA + streak + nav ══ */}
          <div className="flex flex-col gap-4">
            <div className="glass p-4">
              <WeightWidget weight={weight} previous={previousWeight} />
            </div>

            <AIInsightBox type="dashboard" data={insightData} />

            <StreakWidget />

            <div className="glass p-4 space-y-1.5">
              <p className="text-[10px] font-semibold tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
                ACCÈS RAPIDE
              </p>
              {[
                { href: "/desktop/log",      label: "📓  Journal du jour" },
                { href: "/desktop/progress", label: "📈  Mes progrès" },
                { href: "/desktop/health",   label: "❤️  Santé" },
                { href: "/desktop/activity", label: "🏃  Activité" },
                { href: "/desktop/settings", label: "⚙️  Réglages" },
              ].map(({ href, label }) => (
                <Link key={href} href={href}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] transition-all hover:opacity-80"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                  {label}
                </Link>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
