"use client";

import { useState, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import MealSection   from "@/app/components/MealSection";
import DateNav       from "@/app/components/DateNav";
import WaterTracker  from "@/app/components/WaterTracker";
import FastingTimer  from "@/app/components/FastingTimer";
import AlcoolTracker from "@/app/components/AlcoolTracker";
import DayPhotos     from "@/app/components/DayPhotos";
import DayTypeSelector from "@/app/components/DayTypeSelector";
import MeasurementReminderBanner from "@/app/components/MeasurementReminderBanner";
import FaceScanReminderBanner from "@/app/components/FaceScanReminderBanner";
import type { DayLog, FoodEntry, MealType, DayTotals, NutritionGoals, Lang, HungerLevel, TrackedNutrients, DayType, AlcoolDrink } from "@/app/lib/types";
import type { AddedInfo } from "@/app/components/FoodSearchModal";
import type { DayPhoto } from "@/app/api/photos/route";

const MEALS: MealType[] = ["breakfast", "lunch", "snacks", "dinner"];

interface Props {
  date:              string;
  initialLog:        DayLog | null;
  goals:             NutritionGoals;
  lang?:             Lang;
  trackedNutrients?: TrackedNutrients;
}

/* ── Mini donut calorie ── */
function CalorieDonut({ eaten, goal, size = 120 }: { eaten: number; goal: number; size?: number }) {
  const cx = size / 2, R = cx - 8, circ = 2 * Math.PI * R;
  const frac = Math.min(1.05, eaten / Math.max(1, goal));
  const over = frac > 1;
  const col  = over ? "#ef4444" : frac > 0.88 ? "#f97316" : frac > 0.65 ? "#fbbf24" : "#22c55e";
  const dash = `${Math.min(frac, 1) * circ} ${circ}`;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: "block" }}>
      <circle cx={cx} cy={cx} r={R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={8} />
      <motion.circle cx={cx} cy={cx} r={R} fill="none" stroke={col} strokeWidth={8} strokeLinecap="round"
        strokeDasharray={dash} transform={`rotate(-90 ${cx} ${cx})`}
        initial={{ strokeDasharray: `0 ${circ}` }}
        animate={{ strokeDasharray: dash }}
        transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }} />
      <text x={cx} y={cx - 4} textAnchor="middle" dominantBaseline="auto"
        fontSize={over ? 16 : 18} fontWeight="700" fill="var(--calories)">
        {eaten >= 1000 ? `${(eaten / 1000).toFixed(1)}k` : eaten}
      </text>
      <text x={cx} y={cx + 11} textAnchor="middle" dominantBaseline="auto"
        fontSize={10} fill="rgba(255,255,255,0.38)">kcal</text>
    </svg>
  );
}

/* ── Animated macro bar ── */
function MacroBar({ value, goal, color, label }: {
  value: number; goal: number; color: string; label: string;
}) {
  const p    = goal > 0 ? Math.min(100, value / goal * 100) : 0;
  const over = value > goal && goal > 0;
  return (
    <div>
      <div className="flex justify-between text-[11px] mb-1">
        <span style={{ color: "var(--text-muted)" }}>{label}</span>
        <span className="tabular-nums" style={{ color: over ? "#ef4444" : color }}>
          {value}g <span style={{ color: "var(--text-muted)" }}>/ {goal}g</span>
        </span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
        <motion.div className="h-full rounded-full"
          style={{ background: over ? "#ef4444" : color, width: `${p}%` }}
          initial={{ width: 0 }}
          animate={{ width: `${p}%` }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }} />
      </div>
    </div>
  );
}

/* ── Main component ── */
export default function LogClientDesktop({ date, initialLog, goals, lang = "fr" }: Props) {
  const [entries,      setEntries]      = useState<FoodEntry[]>(initialLog?.entries ?? []);
  const [waterMl,      setWaterMl]      = useState(initialLog?.waterMl ?? 0);
  const [alcoolDrinks, setAlcoolDrinks] = useState<AlcoolDrink[]>(
    (initialLog as (DayLog & { alcoolDrinks?: AlcoolDrink[] }) | null)?.alcoolDrinks ?? []
  );

  const mealHunger = useState<Partial<Record<MealType, HungerLevel>>>(
    (initialLog as (DayLog & { mealHunger?: Partial<Record<MealType, HungerLevel>> }) | null)?.mealHunger ?? {}
  )[0];

  const initialDayType = (initialLog as (DayLog & { dayType?: DayType }) | null)?.dayType;
  const initialJetlag  = (initialLog as (DayLog & { jetlag?: boolean }) | null)?.jetlag;
  const initialPhotos  = (initialLog as (DayLog & { dayPhotos?: DayPhoto[] }) | null)?.dayPhotos ?? [];

  const totals = useMemo<DayTotals>(() => entries.reduce((acc, e) => ({
    calories: acc.calories + (e.nutrition?.calories ?? 0),
    proteinG: acc.proteinG + (e.nutrition?.proteinG ?? 0),
    carbsG:   acc.carbsG   + (e.nutrition?.carbsG   ?? 0),
    fatG:     acc.fatG     + (e.nutrition?.fatG      ?? 0),
    fiberG:   acc.fiberG   + (e.nutrition?.fiberG    ?? 0),
  }), { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 }), [entries]);

  const remaining = Math.round(goals.dailyCalories - totals.calories);

  const fetchEntries = useCallback(async () => {
    try {
      const res  = await fetch(`/api/log?date=${date}`);
      const data = await res.json() as { entries?: FoodEntry[]; waterMl?: number };
      if (data.entries)    setEntries(data.entries);
      if (data.waterMl != null) setWaterMl(data.waterMl);
    } catch {}
  }, [date]);

  const handleEntriesChange = useCallback((meal: MealType, updated: FoodEntry[]) => {
    setEntries(prev => [...prev.filter(e => e.meal !== meal), ...updated]);
  }, []);

  const handleFoodAdded = useCallback((_info: AddedInfo) => {
    void fetchEntries();
  }, [fetchEntries]);

  return (
    <div className="relative min-h-screen">
      <div className="bg-orbs" />

      <div className="relative z-10 ml-[220px] flex" style={{ height: "100vh", overflow: "hidden" }}>

        {/* ── LEFT STICKY PANEL ── */}
        <div
          className="flex-shrink-0 overflow-y-auto p-6 space-y-4 border-r"
          style={{ width: 300, borderColor: "var(--border)", background: "rgba(8,8,14,0.65)", backdropFilter: "blur(14px)" }}
        >
          <DateNav date={date} basePath="/desktop/log" />

          <MeasurementReminderBanner />
          <FaceScanReminderBanner />

          <div className="flex items-center gap-2">
            <span className="text-[10px] flex-shrink-0" style={{ color: "var(--text-muted)" }}>Journée</span>
            <DayTypeSelector date={date} initialType={initialDayType} initialJetlag={initialJetlag} />
          </div>

          {/* Donut calorie */}
          <div className="flex flex-col items-center gap-2 py-2">
            <CalorieDonut eaten={Math.round(totals.calories)} goal={goals.dailyCalories} size={120} />
            <p className="text-[12px]" style={{ color: remaining >= 0 ? "var(--text-muted)" : "#ef4444" }}>
              {remaining >= 0
                ? `${remaining} kcal restantes`
                : `+${Math.abs(remaining)} kcal dépassées`}
            </p>
          </div>

          {/* Macros */}
          <div className="space-y-2.5">
            <MacroBar value={Math.round(totals.proteinG)} goal={goals.proteinGrams} color="var(--protein)" label="Protéines" />
            <MacroBar value={Math.round(totals.carbsG)}   goal={goals.carbsGrams}   color="var(--carbs)"   label="Glucides" />
            <MacroBar value={Math.round(totals.fatG)}     goal={goals.fatGrams}     color="var(--fat)"     label="Lipides" />
            <MacroBar value={Math.round(totals.fiberG)}   goal={goals.fiberGrams}   color="var(--fiber)"   label="Fibres" />
          </div>

          <WaterTracker date={date} waterMl={waterMl} goalMl={goals.waterMl ?? 2000} onUpdate={setWaterMl} />

          {goals.alcoholTracking && (
            <AlcoolTracker
              date={date}
              initialDrinks={alcoolDrinks}
              weeklyGoalUnits={goals.weeklyAlcoolUnitsGoal}
              onUpdate={setAlcoolDrinks}
            />
          )}

          {goals.intermittentFasting?.enabled && (
            <FastingTimer date={date} fastingConfig={goals.intermittentFasting} />
          )}

          <DayPhotos date={date} initialPhotos={initialPhotos} />
        </div>

        {/* ── RIGHT SCROLLABLE : SECTIONS REPAS ── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {MEALS.map((meal, i) => (
            <motion.div key={meal}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.06 }}>
              <MealSection
                meal={meal}
                date={date}
                entries={entries.filter(e => e.meal === meal)}
                goals={goals}
                lang={lang}
                hunger={mealHunger[meal]}
                onEntriesChange={handleEntriesChange}
                onFoodAdded={handleFoodAdded}
              />
            </motion.div>
          ))}
        </div>

      </div>
    </div>
  );
}
