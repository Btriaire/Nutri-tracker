"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import MealSection from "@/app/components/MealSection";
import DateNav from "@/app/components/DateNav";
import WaterTracker from "@/app/components/WaterTracker";
import type { DayLog, FoodEntry, MealType, DayTotals, NutritionGoals, Lang } from "@/app/lib/types";
import { pct } from "@/app/lib/nutrition";

const MEALS: MealType[] = ["breakfast", "lunch", "dinner", "snacks"];

interface Props {
  date:       string;
  initialLog: DayLog | null;
  goals:      NutritionGoals;
  lang?:      Lang;
}

export default function LogClient({ date, initialLog, goals, lang = "fr" }: Props) {
  const [entries, setEntries] = useState<FoodEntry[]>(initialLog?.entries ?? []);
  const [waterMl, setWaterMl] = useState(initialLog?.waterMl ?? 0);

  useEffect(() => {
    setEntries(initialLog?.entries ?? []);
    setWaterMl(initialLog?.waterMl ?? 0);
  }, [date, initialLog]);

  const totals: DayTotals = entries.reduce(
    (acc, e) => ({
      calories: acc.calories + e.nutrition.calories,
      proteinG: acc.proteinG + e.nutrition.proteinG,
      carbsG:   acc.carbsG   + e.nutrition.carbsG,
      fatG:     acc.fatG     + e.nutrition.fatG,
      fiberG:   acc.fiberG   + e.nutrition.fiberG,
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 },
  );

  const remaining = goals.dailyCalories - Math.round(totals.calories);

  const handleMealChange = (meal: MealType, mealEntries: FoodEntry[]) => {
    setEntries((prev) => [...prev.filter((e) => e.meal !== meal), ...mealEntries]);
  };

  return (
    <div className="relative min-h-screen" style={{ paddingBottom: "80px" }}>
      <div className="bg-orbs" />

      <div className="relative z-10 max-w-md mx-auto px-4 py-6 md:ml-[220px]">
        {/* Date nav */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-5"
        >
          <DateNav date={date} />
        </motion.div>

        {/* Daily summary */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.05 }}
          className="glass p-5 mb-5"
        >
          <div className="flex justify-between items-center mb-4">
            <div className="text-center">
              <p className="text-[20px] font-bold t-calories tabular-nums leading-tight">
                {Math.round(totals.calories)}
              </p>
              <p className="label-xs mt-0.5">Mangées</p>
            </div>

            <div className="flex-1 mx-4">
              <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                <motion.div
                  className="h-full rounded-full"
                  style={{
                    background: remaining >= 0
                      ? "linear-gradient(90deg, var(--calories), rgba(249,115,22,0.6))"
                      : "#ef4444",
                  }}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(pct(totals.calories, goals.dailyCalories), 100)}%` }}
                  transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
            </div>

            <div className="text-center">
              <p
                className="text-[20px] font-bold tabular-nums leading-tight"
                style={{ color: remaining >= 0 ? "var(--text-primary)" : "#ef4444" }}
              >
                {Math.abs(remaining)}
              </p>
              <p className="label-xs mt-0.5">{remaining >= 0 ? "Restantes" : "Dépassé"}</p>
            </div>
          </div>

          {/* Macro bars */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Protéines", val: totals.proteinG, goal: goals.proteinGrams, color: "var(--protein)" },
              { label: "Glucides",  val: totals.carbsG,   goal: goals.carbsGrams,  color: "var(--carbs)" },
              { label: "Lipides",   val: totals.fatG,     goal: goals.fatGrams,    color: "var(--fat)" },
            ].map(({ label, val, goal, color }) => (
              <div key={label}>
                <div className="flex justify-between text-[11px] mb-1">
                  <span style={{ color: "var(--text-muted)" }}>{label}</span>
                  <span style={{ color }}>{Math.round(val)}g</span>
                </div>
                <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(pct(val, goal), 100)}%` }}
                    transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                  />
                </div>
                <p className="text-[10px] mt-0.5 text-right" style={{ color: "var(--text-muted)" }}>/{goal}g</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Water tracker */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.08 }}
          className="mb-5"
        >
          <WaterTracker
            date={date}
            waterMl={waterMl}
            goalMl={goals.waterMl ?? 2000}
            onUpdate={setWaterMl}
          />
        </motion.div>

        {/* Meal sections */}
        <div className="space-y-3">
          {MEALS.map((meal, i) => (
            <motion.div
              key={meal}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.12 + i * 0.05 }}
            >
              <MealSection
                meal={meal}
                entries={entries.filter((e) => e.meal === meal)}
                date={date}
                lang={lang}
                onEntriesChange={handleMealChange}
              />
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
