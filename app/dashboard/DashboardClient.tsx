"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { ArrowRight } from "@phosphor-icons/react";
import CalorieBudgetRing from "@/app/components/CalorieBudgetRing";
import MacroRings from "@/app/components/MacroRings";
import StepsWidget from "@/app/components/StepsWidget";
import WeightWidget from "@/app/components/WeightWidget";
import WaterTracker from "@/app/components/WaterTracker";
import type { DayTotals, NutritionGoals, WeightPoint, Lang } from "@/app/lib/types";

interface Props {
  date:           string;
  goals:          NutritionGoals;
  consumed:       DayTotals;
  burned:         number | null;
  steps:          number | null;
  weight:         WeightPoint | null;
  previousWeight: WeightPoint | null;
  recentWeight:   WeightPoint[];
  waterMl:        number;
  lang:           Lang;
}

const ease = [0.16, 1, 0.3, 1] as [number, number, number, number];
const fade = (delay = 0) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, ease, delay },
});

export default function DashboardClient({
  date, goals, consumed, burned, steps, weight, previousWeight, waterMl: initialWaterMl, lang,
}: Props) {
  const today = format(new Date(date + "T12:00:00"), "EEEE d MMMM", { locale: fr });
  const [waterMl, setWaterMl] = useState(initialWaterMl);

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
            <ArrowRight size={12} weight="bold" />
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

        {/* Water tracker */}
        <motion.div {...fade(0.18)} className="mb-4">
          <WaterTracker
            date={date}
            waterMl={waterMl}
            goalMl={goals.waterMl ?? 2000}
            onUpdate={setWaterMl}
          />
        </motion.div>

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
