"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import MealSection from "@/app/components/MealSection";
import DateNav from "@/app/components/DateNav";
import WaterTracker from "@/app/components/WaterTracker";
import type { DayLog, FoodEntry, MealType, DayTotals, NutritionGoals, Lang, HungerLevel, TrackedNutrients } from "@/app/lib/types";
import HungerTimeline from "@/app/components/HungerTimeline";

type MealPhotos = Partial<Record<MealType, string>>;
import type { AddedInfo } from "@/app/components/FoodSearchModal";
import { pct } from "@/app/lib/nutrition";
import { Check } from "@phosphor-icons/react";
import AIInsightBox from "@/app/components/AIInsightBox";

const MEALS: MealType[] = ["breakfast", "lunch", "snacks", "dinner"];

function TrackedNutrientBar({
  emoji, label, unit, value, goal, color, invertAlert = false,
}: {
  emoji: string; label: string; unit: string;
  value: number; goal: number; color: string; invertAlert?: boolean;
}) {
  const fraction = goal > 0 ? value / goal : 0;
  const over = fraction > 1;
  // For nutrients where going over is bad (sodium, sugar, sat. fat), alert in red when over
  const barColor = over && invertAlert ? "#ef4444" : color;
  return (
    <div className="rounded-xl p-2.5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-sm">{emoji}</span>
        <span className="text-[11px] font-medium flex-1 truncate" style={{ color: "var(--text-secondary)" }}>{label}</span>
        <span className="text-[11px] font-semibold tabular-nums" style={{ color: over && invertAlert ? "#ef4444" : color }}>
          {value}{unit}
        </span>
      </div>
      <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${Math.min(fraction * 100, 100)}%`, background: barColor }}
        />
      </div>
      <p className="text-[9px] mt-1 text-right" style={{ color: "var(--text-muted)" }}>/{goal}{unit}</p>
    </div>
  );
}

interface Props {
  date:             string;
  initialLog:       DayLog | null;
  goals:            NutritionGoals;
  lang?:            Lang;
  trackedNutrients?: TrackedNutrients;
}

export default function LogClient({ date, initialLog, goals, lang = "fr", trackedNutrients }: Props) {
  const [entries,    setEntries]    = useState<FoodEntry[]>(initialLog?.entries ?? []);
  const [waterMl,   setWaterMl]    = useState(initialLog?.waterMl ?? 0);
  const [mealHunger, setMealHunger] = useState<Partial<Record<MealType, HungerLevel>>>(
    (initialLog as (DayLog & { mealHunger?: Partial<Record<MealType, HungerLevel>> }) | null)?.mealHunger ?? {}
  );
  const [toast,     setToast]      = useState<AddedInfo | null>(null);
  const [validated,      setValidated]      = useState((initialLog as { validated?: boolean } | null)?.validated ?? false);
  const [validating,     setValidating]     = useState(false);
  const [showValidateModal, setShowValidateModal] = useState(false);
  const [mealPhotos, setMealPhotos] = useState<MealPhotos>({});
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setEntries(initialLog?.entries ?? []);
    setWaterMl(initialLog?.waterMl ?? 0);
    setValidated((initialLog as { validated?: boolean } | null)?.validated ?? false);
    setMealHunger((initialLog as (DayLog & { mealHunger?: Partial<Record<MealType, HungerLevel>> }) | null)?.mealHunger ?? {});
    // Load meal photos for this date
    fetch(`/api/log/photos?date=${date}`)
      .then((r) => r.ok ? r.json() : {})
      .then((data: { photos?: MealPhotos }) => setMealPhotos(data.photos ?? {}))
      .catch(() => setMealPhotos({}));
  }, [date, initialLog]);

  const handleValidate = async () => {
    setValidating(true);
    try {
      await fetch("/api/log", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, validated: true }),
      });
      setValidated(true);
      setShowValidateModal(false);
    } finally { setValidating(false); }
  };

  const totals: DayTotals = entries.reduce(
    (acc, e) => ({
      calories:      acc.calories      + e.nutrition.calories,
      proteinG:      acc.proteinG      + e.nutrition.proteinG,
      carbsG:        acc.carbsG        + e.nutrition.carbsG,
      fatG:          acc.fatG          + e.nutrition.fatG,
      fiberG:        acc.fiberG        + e.nutrition.fiberG,
      sugarG:        (acc.sugarG       ?? 0) + (e.nutrition.sugarG       ?? 0),
      sodiumMg:      (acc.sodiumMg     ?? 0) + (e.nutrition.sodiumMg     ?? 0),
      saturatedFatG: (acc.saturatedFatG ?? 0) + (e.nutrition.saturatedFatG ?? 0),
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0, sugarG: 0, sodiumMg: 0, saturatedFatG: 0 },
  );

  const remaining = goals.dailyCalories - Math.round(totals.calories);

  const journalInsightData = useMemo(() => ({
    entries: entries.map((e) => ({
      name:     e.name,
      grams:    e.servingGrams,
      calories: Math.round(e.nutrition.calories),
    })),
    totals: {
      calories: Math.round(totals.calories),
      proteinG: Math.round(totals.proteinG),
      carbsG:   Math.round(totals.carbsG),
      fatG:     Math.round(totals.fatG),
      fiberG:   Math.round(totals.fiberG),
    },
    goals: {
      dailyCalories: goals.dailyCalories,
      proteinGrams:  goals.proteinGrams,
      carbsGrams:    goals.carbsGrams,
      fatGrams:      goals.fatGrams,
      fiberGrams:    goals.fiberGrams,
    },
    waterMl,
    waterGoal: goals.waterMl ?? 2000,
    mealHunger,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [entries.length, Math.round(totals.calories), waterMl, mealHunger]);

  const handleMealChange = (meal: MealType, mealEntries: FoodEntry[]) => {
    setEntries((prev) => [...prev.filter((e) => e.meal !== meal), ...mealEntries]);
  };

  const handleHungerChange = async (meal: MealType, level: HungerLevel | null) => {
    const next = { ...mealHunger };
    if (level == null) delete next[meal]; else next[meal] = level;
    setMealHunger(next);
    await fetch("/api/log", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, mealHunger: next }),
    });
  };

  const handlePhotoChange = (meal: MealType, url: string | null) => {
    setMealPhotos((prev) => {
      const next = { ...prev };
      if (url) next[meal] = url; else delete next[meal];
      return next;
    });
  };

  const showToast = (info: AddedInfo) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(info);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
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
          <div className="flex justify-between items-start mb-4">
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

          {/* Validate day button */}
          <button
            onClick={() => validated ? undefined : setShowValidateModal(true)}
            className="w-full mt-4 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-medium transition-all"
            style={{
              background: validated
                ? "rgba(34,197,94,0.12)"
                : "rgba(255,255,255,0.04)",
              border: `1px solid ${validated ? "rgba(34,197,94,0.4)" : "var(--border)"}`,
              color: validated ? "#22c55e" : "var(--text-secondary)",
              cursor: validated ? "default" : "pointer",
            }}
          >
            <Check size={14} weight={validated ? "fill" : "regular"} />
            {validated ? "Journée validée" : "Valider la journée"}
          </button>
        </motion.div>

        {/* Tracked nutrients */}
        {trackedNutrients && Object.values(trackedNutrients).some(Boolean) && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.065 }}
            className="glass p-4 mb-5"
          >
            <p className="text-[11px] font-semibold mb-3" style={{ color: "var(--text-muted)" }}>
              PARAMÈTRES SUIVIS
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              {trackedNutrients.protein && (
                <TrackedNutrientBar
                  emoji="💪" label="Protéines" unit="g"
                  value={Math.round(totals.proteinG)}
                  goal={goals.proteinGrams}
                  color="var(--protein)"
                />
              )}
              {trackedNutrients.sodium && (
                <TrackedNutrientBar
                  emoji="🧂" label="Sel" unit="mg"
                  value={Math.round(totals.sodiumMg ?? 0)}
                  goal={goals.sodiumMg ?? 2000}
                  color="#f59e0b"
                  invertAlert
                />
              )}
              {trackedNutrients.sugar && (
                <TrackedNutrientBar
                  emoji="🍬" label="Sucres" unit="g"
                  value={Math.round(totals.sugarG ?? 0)}
                  goal={goals.sugarGrams ?? 50}
                  color="#ec4899"
                  invertAlert
                />
              )}
              {trackedNutrients.saturatedFat && (
                <TrackedNutrientBar
                  emoji="🧈" label="Lip. saturés" unit="g"
                  value={Math.round(totals.saturatedFatG ?? 0)}
                  goal={goals.saturatedFatGrams ?? 20}
                  color="var(--fat)"
                  invertAlert
                />
              )}
            </div>
          </motion.div>
        )}

        {/* AI Insight */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.07 }}
          className="mb-5"
        >
          <AIInsightBox type="journal" data={journalInsightData} delay={800} />
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
                photoUrl={mealPhotos[meal]}
                hunger={mealHunger[meal]}
                onEntriesChange={handleMealChange}
                onFoodAdded={showToast}
                onPhotoChange={handlePhotoChange}
                onHungerChange={handleHungerChange}
              />
            </motion.div>
          ))}
        </div>

        {/* Hunger timeline */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.35 }}
          className="mt-3"
        >
          <HungerTimeline
            mealHunger={mealHunger}
            onSetHunger={handleHungerChange}
          />
        </motion.div>
      </div>

      {/* Validate modal */}
      <AnimatePresence>
        {showValidateModal && (
          <>
            <motion.div
              key="validate-backdrop"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
              onClick={() => setShowValidateModal(false)}
            />
            <motion.div
              key="validate-sheet"
              initial={{ opacity: 0, y: 32 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 32 }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="fixed bottom-0 inset-x-0 z-50 rounded-t-2xl p-6 pb-10"
              style={{
                background: "rgba(13,13,17,0.98)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderBottom: "none",
                backdropFilter: "blur(24px)",
              }}
            >
              <div className="flex justify-center mb-4">
                <div className="w-10 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.15)" }} />
              </div>
              <div className="flex flex-col items-center gap-1 mb-6">
                <span className="text-4xl mb-1">🎯</span>
                <h2 className="text-[17px] font-bold" style={{ color: "var(--text-primary)" }}>Valider la journée</h2>
                <p className="text-[13px] text-center" style={{ color: "var(--text-muted)" }}>
                  Confirmez que vous avez terminé de saisir vos repas du jour.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-6">
                {[
                  { label: "Calories", val: `${Math.round(totals.calories)} / ${goals.dailyCalories}`, color: "var(--calories)" },
                  { label: "Protéines", val: `${Math.round(totals.proteinG)}g / ${goals.proteinGrams}g`, color: "var(--protein)" },
                  { label: "Glucides",  val: `${Math.round(totals.carbsG)}g / ${goals.carbsGrams}g`,    color: "var(--carbs)" },
                  { label: "Lipides",   val: `${Math.round(totals.fatG)}g / ${goals.fatGrams}g`,        color: "var(--fat)" },
                ].map(({ label, val, color }) => (
                  <div key={label} className="p-3 rounded-xl text-center"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)" }}>
                    <p className="text-[12px] tabular-nums font-bold" style={{ color }}>{val}</p>
                    <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>{label}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowValidateModal(false)}
                  className="flex-1 btn btn-ghost">
                  Annuler
                </button>
                <button onClick={handleValidate} disabled={validating}
                  className="flex-1 btn btn-primary gap-2">
                  {validating
                    ? <span className="animate-spin">⏳</span>
                    : <Check size={14} weight="bold" />
                  }
                  Valider
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key="toast"
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0,  scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.95 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-xl"
            style={{
              background: "rgba(30,30,40,0.92)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(255,255,255,0.1)",
              whiteSpace: "nowrap",
            }}
          >
            <span className="flex items-center justify-center w-5 h-5 rounded-full"
              style={{ background: "var(--protein)" }}>
              <Check size={11} weight="bold" color="#fff" />
            </span>
            <span className="text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>
              {toast.name}
            </span>
            <span className="text-[12px] font-bold tabular-nums" style={{ color: "var(--calories)" }}>
              {toast.calories} kcal
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
