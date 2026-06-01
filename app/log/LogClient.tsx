"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import MealSection from "@/app/components/MealSection";
import DateNav from "@/app/components/DateNav";
import WaterTracker from "@/app/components/WaterTracker";
import type { DayLog, FoodEntry, MealType, DayTotals, NutritionGoals, Lang, HungerLevel, TrackedNutrients, DayType } from "@/app/lib/types";
import HungerTimeline from "@/app/components/HungerTimeline";

type MealPhotos = Partial<Record<MealType, string>>;
import type { AddedInfo } from "@/app/components/FoodSearchModal";
import { pct } from "@/app/lib/nutrition";
import { IconCheck, IconLock, IconLockOpen, IconX } from "@tabler/icons-react";
import AIInsightBox from "@/app/components/AIInsightBox";
import DayPhotos from "@/app/components/DayPhotos";
import DayTypeSelector from "@/app/components/DayTypeSelector";
import type { DayPhoto } from "@/app/api/photos/route";
import { levelBarStyle, levelBarBg, levelBarClip, levelColor } from "@/app/lib/colors";

const MEALS: MealType[] = ["breakfast", "lunch", "snacks", "dinner"];

function TrackedNutrientPill({
  emoji, label, unit, value, goal, color, invertAlert = false,
}: {
  emoji: string; label: string; unit: string;
  value: number; goal: number; color: string; invertAlert?: boolean;
}) {
  const fraction = goal > 0 ? value / goal : 0;
  const over = fraction > 1;
  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-1 mb-1">
        <span className="text-[11px]">{emoji}</span>
        <span className="text-[9px] truncate" style={{ color: "var(--text-muted)" }}>{label}</span>
        <span className="ml-auto text-[10px] font-semibold tabular-nums flex-shrink-0" style={{ color: over && invertAlert ? "#ef4444" : levelColor(fraction) }}>
          {value}<span className="font-normal text-[8px]">{unit}</span>
        </span>
      </div>
      <div className="h-[3px] rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
        <div className="h-full rounded-full w-full"
          style={levelBarStyle(over && invertAlert ? 1.1 : fraction)} />
      </div>
      <p className="text-[8px] mt-0.5 text-right" style={{ color: "var(--text-muted)" }}>/{goal}{unit}</p>
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
  const initialDayType = (initialLog as (DayLog & { dayType?: DayType }) | null)?.dayType;
  const initialJetlag  = (initialLog as (DayLog & { jetlag?: boolean })  | null)?.jetlag;
  const [toast,     setToast]      = useState<AddedInfo | null>(null);
  const [validated,      setValidated]      = useState((initialLog as { validated?: boolean } | null)?.validated ?? false);
  const [validating,     setValidating]     = useState(false);
  const [showValidateModal, setShowValidateModal] = useState(false);
  const [mealPhotos, setMealPhotos] = useState<MealPhotos>({});
  const [dayPhotos,  setDayPhotos]  = useState<DayPhoto[]>([]);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Unlock mechanic: tap ✕ 3× in ≤2 s to unlock a validated day ──────────
  const UNLOCK_TAPS = 3;
  const [unlockTaps,    setUnlockTaps]    = useState(0);
  const [unlockFlash,   setUnlockFlash]   = useState(false); // brief visual feedback
  const unlockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleUnlockTap = useCallback(async () => {
    const next = unlockTaps + 1;
    setUnlockTaps(next);
    setUnlockFlash(true);
    setTimeout(() => setUnlockFlash(false), 150);
    // Reset counter after 2 s of inactivity
    if (unlockTimer.current) clearTimeout(unlockTimer.current);
    unlockTimer.current = setTimeout(() => setUnlockTaps(0), 2000);
    if (next >= UNLOCK_TAPS) {
      setUnlockTaps(0);
      if (unlockTimer.current) clearTimeout(unlockTimer.current);
      setValidated(false);
      await fetch("/api/log", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ date, validated: false }),
      });
    }
  }, [unlockTaps, date]);

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
    // Load day photos
    fetch(`/api/photos?date=${date}`)
      .then((r) => r.ok ? r.json() : { photos: [] })
      .then((data: { photos?: DayPhoto[] }) => setDayPhotos(data.photos ?? []))
      .catch(() => setDayPhotos([]));
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
      calories:      Math.round(totals.calories),
      proteinG:      Math.round(totals.proteinG),
      carbsG:        Math.round(totals.carbsG),
      fatG:          Math.round(totals.fatG),
      fiberG:        Math.round(totals.fiberG),
      sugarG:        Math.round(totals.sugarG ?? 0),
      sodiumMg:      Math.round(totals.sodiumMg ?? 0),
      saturatedFatG: Math.round(totals.saturatedFatG ?? 0),
    },
    goals: {
      dailyCalories:     goals.dailyCalories,
      proteinGrams:      goals.proteinGrams,
      carbsGrams:        goals.carbsGrams,
      fatGrams:          goals.fatGrams,
      fiberGrams:        goals.fiberGrams,
      sugarGrams:        goals.sugarGrams,
      sodiumMg:          goals.sodiumMg,
      saturatedFatGrams: goals.saturatedFatGrams,
    },
    trackedNutrients,
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

        {/* Day photos + type */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.04 }}
          className="mb-4"
        >
          <DayPhotos date={date} initialPhotos={dayPhotos} />
          {/* Day type selector — compact row below photos */}
          <div className="flex items-center gap-2 mt-2 px-0.5">
            <span className="text-[10px] flex-shrink-0" style={{ color: "var(--text-muted)" }}>
              Journée
            </span>
            <DayTypeSelector
              date={date}
              initialType={initialDayType}
              initialJetlag={initialJetlag}
            />
          </div>
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
                  className="h-full rounded-full w-full"
                  style={{ background: levelBarBg(remaining >= 0 ? pct(totals.calories, goals.dailyCalories) / 100 : 1.1) }}
                  initial={{ clipPath: "inset(0 100% 0 0)" }}
                  animate={{ clipPath: levelBarClip(pct(totals.calories, goals.dailyCalories) / 100) }}
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
                  <span style={{ color: levelColor(goal > 0 ? val / goal : 0) }}>{Math.round(val)}g</span>
                </div>
                <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                  <motion.div
                    className="h-full rounded-full w-full"
                    style={{ background: levelBarBg(goal > 0 ? val / goal : 0) }}
                    initial={{ clipPath: "inset(0 100% 0 0)" }}
                    animate={{ clipPath: levelBarClip(goal > 0 ? val / goal : 0) }}
                    transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                  />
                </div>
                <p className="text-[10px] mt-0.5 text-right" style={{ color: "var(--text-muted)" }}>/{goal}g</p>
              </div>
            ))}
          </div>

          {/* Validate / Unlock button */}
          {validated ? (
            <div className="mt-4 flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl"
              style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.3)" }}>
              <div className="flex items-center gap-2">
                <IconLock size={13} style={{ color: "#22c55e" }} />
                <span className="text-[12px] font-medium" style={{ color: "#22c55e" }}>Journée validée</span>
              </div>
              {/* Unlock tap button — shows progress pips */}
              <button
                onClick={handleUnlockTap}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all active:scale-90"
                style={{
                  background: unlockFlash ? "rgba(239,68,68,0.18)" : "rgba(255,255,255,0.05)",
                  border: `1px solid ${unlockFlash ? "rgba(239,68,68,0.5)" : "rgba(255,255,255,0.1)"}`,
                  color: unlockFlash ? "#f87171" : "var(--text-muted)",
                }}
                title="Taper 3× pour déverrouiller"
              >
                <IconX size={11} />
                <span className="text-[10px]">déverrouiller</span>
                {/* tap pips */}
                <div className="flex gap-0.5 ml-0.5">
                  {[1,2,3].map(i => (
                    <div key={i} className="w-1 h-1 rounded-full transition-all"
                      style={{ background: i <= unlockTaps ? "#f87171" : "rgba(255,255,255,0.15)" }} />
                  ))}
                </div>
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowValidateModal(true)}
              className="w-full mt-4 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-medium transition-all"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid var(--border)",
                color: "var(--text-secondary)",
              }}
            >
              <IconCheck size={14} stroke={1.5} />
              Valider la journée
            </button>
          )}
        </motion.div>

        {/* Tracked nutrients — compact strip */}
        {trackedNutrients && Object.values(trackedNutrients).some(Boolean) && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.065 }}
            className="glass px-3 py-2.5 mb-5"
          >
            <div className="flex items-stretch gap-2.5">
              {trackedNutrients.protein && (
                <TrackedNutrientPill emoji="💪" label="Protéines" unit="g"
                  value={Math.round(totals.proteinG)} goal={goals.proteinGrams} color="var(--protein)" />
              )}
              {trackedNutrients.sodium && (
                <TrackedNutrientPill emoji="🧂" label="Sel" unit="mg"
                  value={Math.round(totals.sodiumMg ?? 0)} goal={goals.sodiumMg ?? 2000} color="#f59e0b" invertAlert />
              )}
              {trackedNutrients.sugar && (
                <TrackedNutrientPill emoji="🍬" label="Sucres" unit="g"
                  value={Math.round(totals.sugarG ?? 0)} goal={goals.sugarGrams ?? 50} color="#ec4899" invertAlert />
              )}
              {trackedNutrients.saturatedFat && (
                <TrackedNutrientPill emoji="🧈" label="Lip.sat." unit="g"
                  value={Math.round(totals.saturatedFatG ?? 0)} goal={goals.saturatedFatGrams ?? 20} color="var(--fat)" invertAlert />
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

        {/* Locked wrapper — water + meals + hunger */}
        <div className="relative">
          {/* Lock banner — slim bar above content, no overlay */}
          <AnimatePresence>
            {validated && (
              <motion.div
                initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.22 }}
                className="flex items-center gap-2 mb-4 px-3 py-2 rounded-xl"
                style={{
                  background: "rgba(34,197,94,0.08)",
                  border: "1px solid rgba(34,197,94,0.2)",
                }}
              >
                <IconLock size={14} style={{ color: "#22c55e", flexShrink: 0 }} />
                <span className="text-[12px] font-medium flex-1" style={{ color: "#22c55e" }}>
                  Journée verrouillée
                </span>
                <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.35)" }}>
                  Tapez ✕ 3× pour modifier
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Invisible interaction blocker when validated */}
          {validated && (
            <div className="absolute inset-0 z-10" style={{ pointerEvents: "auto", cursor: "default" }} />
          )}

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
                  goals={goals}
                  alreadyKcal={Math.round(totals.calories)}
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
                    : <IconCheck size={14} />
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
              <IconCheck size={11} color="#fff" />
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
