"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import MealSection from "@/app/components/MealSection";
import DateNav from "@/app/components/DateNav";
import VoiceMealModal from "@/app/components/VoiceMealModal";
import WaterTracker from "@/app/components/WaterTracker";
import FastingTimer from "@/app/components/FastingTimer";
import AlcoolTracker from "@/app/components/AlcoolTracker";
import SupplementLogger from "@/app/components/SupplementLogger";
import MicronutrientTracker from "@/app/components/MicronutrientTracker";
import MacroContributionPanel from "@/app/components/MacroContributionPanel";
import MealMicronutrientsPanel from "@/app/components/MealMicronutrientsPanel";
import { extractMicronutrientsForced, logMicronutrients } from "@/app/lib/micronutrient-extractor";
import type { DayLog, FoodEntry, MealType, DayTotals, NutritionGoals, Lang, HungerLevel, TrackedNutrients, DayType, AlcoolDrink, MicronutrientDay, SupplementLog, DietProgramPrefs } from "@/app/lib/types";
import { checkDietCompliance, normalizeFoodName, DIET_PROGRAM_NAME } from "@/app/lib/diet-program";
import DietProgramInfoModal from "@/app/components/DietProgramInfoModal";
import AlternativeFoodsModal from "@/app/components/AlternativeFoodsModal";
import HungerTimeline from "@/app/components/HungerTimeline";

type MealPhotos = Partial<Record<MealType, string>>;
import type { AddedInfo } from "@/app/components/FoodSearchModal";
import { pct } from "@/app/lib/nutrition";
import { IconCheck, IconLock, IconLockOpen, IconX, IconMicrophone, IconCamera, IconSalt, IconCandy, IconAvocado, IconInfoCircle, IconPlayerPause, IconPlayerPlay, IconArrowsExchange } from "@tabler/icons-react";
import AIInsightBox from "@/app/components/AIInsightBox";
import DayPhotos from "@/app/components/DayPhotos";
import DayTypeSelector from "@/app/components/DayTypeSelector";
import MeasurementReminderBanner from "@/app/components/MeasurementReminderBanner";
import FaceScanReminderBanner from "@/app/components/FaceScanReminderBanner";
import type { DayPhoto } from "@/app/api/photos/route";
import { levelBarStyle, levelBarBg, levelBarClip, levelColor } from "@/app/lib/colors";

const MEALS: MealType[] = ["breakfast", "lunch", "snacks", "dinner"];

// ─── SVG helpers for the daily summary ───────────────────────────────────────

/** Donut arc showing calories eaten vs goal */
function CalorieArc({ eaten, goal, size = 80 }: { eaten: number; goal: number; size?: number }) {
  const cx   = size / 2;
  const R    = cx - 6;
  const circ = 2 * Math.PI * R;
  const fraction = Math.min(1.05, eaten / Math.max(1, goal));
  const over     = fraction > 1;
  const col      = over ? "#ef4444" : fraction > 0.88 ? "#f97316" : fraction > 0.65 ? "#fbbf24" : "#22c55e";
  const dashArr  = `${Math.min(fraction, 1) * circ} ${circ}`;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: "block", flexShrink: 0 }}>
      {/* Track */}
      <circle cx={cx} cy={cx} r={R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={7} />
      {/* Filled arc */}
      <motion.circle
        cx={cx} cy={cx} r={R}
        fill="none" stroke={col} strokeWidth={7} strokeLinecap="round"
        strokeDasharray={dashArr}
        transform={`rotate(-90 ${cx} ${cx})`}
        initial={{ strokeDasharray: `0 ${circ}` }}
        animate={{ strokeDasharray: dashArr }}
        transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
      />
      {/* Glow dot at tip */}
      {fraction > 0.02 && fraction < 1 && (() => {
        const angle = (fraction * 360 - 90) * (Math.PI / 180);
        const tx = cx + R * Math.cos(angle);
        const ty = cx + R * Math.sin(angle);
        return <circle cx={tx} cy={ty} r={4} fill={col} opacity={0.7} />;
      })()}
      {/* Center text */}
      <text x={cx} y={cx - 3} textAnchor="middle" dominantBaseline="auto"
        fontSize={over ? 13 : 15} fontWeight="700"
        fill="var(--calories)" fontFamily="monospace">
        {eaten >= 1000 ? `${(eaten / 1000).toFixed(1)}k` : eaten}
      </text>
      <text x={cx} y={cx + 10} textAnchor="middle" dominantBaseline="auto"
        fontSize={9} fill="rgba(255,255,255,0.38)">
        kcal
      </text>
    </svg>
  );
}

/** Horizontal SVG calorie budget bar */
function CalorieBudgetBar({ eaten, goal, remaining }: { eaten: number; goal: number; remaining: number }) {
  const fraction = Math.min(1.1, eaten / Math.max(1, goal));
  const over     = remaining < 0;
  const col      = over ? "#ef4444" : fraction > 0.88 ? "#f97316" : fraction > 0.65 ? "#fbbf24" : "#22c55e";
  const W        = 200; // viewBox width
  const H        = 8;
  const fillW    = Math.min(1, fraction) * W;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ display: "block" }}>
      {/* Track */}
      <rect x={0} y={0} width={W} height={H} rx={H / 2} fill="rgba(255,255,255,0.07)" />
      {/* Fill */}
      <motion.rect
        x={0} y={0} height={H} rx={H / 2}
        fill={col}
        initial={{ width: 0 }}
        animate={{ width: fillW }}
        transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
      />
      {/* Goal tick */}
      <rect x={W - 1.5} y={0} width={1.5} height={H} rx={0.75} fill="rgba(255,255,255,0.25)" />
      {/* Glow cap */}
      {fraction > 0.04 && !over && (
        <motion.circle
          cy={H / 2} r={H / 2 + 1}
          fill={col} opacity={0.45}
          initial={{ cx: 0 }}
          animate={{ cx: fillW }}
          transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
        />
      )}
    </svg>
  );
}

/** Three SVG macro bars — P / G / L */
function MacroSVGBars({
  protein, carbs, fat,
}: {
  protein: { val: number; goal: number };
  carbs:   { val: number; goal: number };
  fat:     { val: number; goal: number };
}) {
  const rows = [
    { label: "Prot.",   color: "#3b82f6", ...protein },
    { label: "Gluc.",   color: "#fbbf24", ...carbs },
    { label: "Lip.",    color: "#a78bfa", ...fat },
  ];
  const W = 200; // viewBox plot width per bar
  const BH = 5;  // bar height
  const RH = 22; // row height

  return (
    <div className="grid grid-cols-3 gap-x-3 gap-y-0">
      {rows.map(({ label, color, val, goal }) => {
        const fraction = goal > 0 ? Math.min(1, val / goal) : 0;
        const fillW    = fraction * W;
        const col      = fraction > 1 ? "#ef4444" : color;
        return (
          <div key={label}>
            <div className="flex justify-between items-baseline mb-1">
              <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{label}</span>
              <span className="text-[11px] font-semibold tabular-nums" style={{ color: col }}>
                {Math.round(val)}
                <span className="text-[9px] font-normal" style={{ color: "var(--text-muted)" }}>g</span>
              </span>
            </div>
            <svg viewBox={`0 0 ${W} ${BH}`} width="100%" height={BH} style={{ display: "block" }}>
              <rect x={0} y={0} width={W} height={BH} rx={BH / 2} fill="rgba(255,255,255,0.07)" />
              <motion.rect
                x={0} y={0} height={BH} rx={BH / 2}
                fill={col}
                initial={{ width: 0 }}
                animate={{ width: fillW }}
                transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
              />
            </svg>
            <p className="text-[9px] mt-0.5 text-right" style={{ color: "var(--text-muted)" }}>/{goal}g</p>
          </div>
        );
      })}
    </div>
  );
}

function TrackedNutrientPill({
  Icon, label, unit, value, goal, color, invertAlert = false,
}: {
  Icon: React.ComponentType<{ size?: number; stroke?: number; style?: React.CSSProperties }>;
  label: string; unit: string;
  value: number; goal: number; color: string; invertAlert?: boolean;
}) {
  const fraction = goal > 0 ? value / goal : 0;
  const over = fraction > 1;
  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-1 mb-1">
        <Icon size={12} stroke={1.6} style={{ color, flexShrink: 0 }} />
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
  dietProgram?:     DietProgramPrefs;
}

export default function LogClient({ date, initialLog, goals, lang = "fr", trackedNutrients, dietProgram }: Props) {
  const router = useRouter();
  const [showVoice,    setShowVoice]    = useState(false);
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [entries,      setEntries]      = useState<FoodEntry[]>(initialLog?.entries ?? []);
  const [waterMl,      setWaterMl]      = useState(initialLog?.waterMl ?? 0);
  const [alcoolDrinks, setAlcoolDrinks] = useState<AlcoolDrink[]>(
    (initialLog as (DayLog & { alcoolDrinks?: AlcoolDrink[] }) | null)?.alcoolDrinks ?? []
  );
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
  const [micronutrientData, setMicronutrientData] = useState<MicronutrientDay | null>(null);
  const [supplementLog, setSupplementLog] = useState<SupplementLog | null>(null);
  const [showDietInfo, setShowDietInfo] = useState(false);
  const [dietExceptions, setDietExceptions] = useState<string[]>(dietProgram?.exceptions ?? []);
  const [dietPaused, setDietPaused] = useState(initialLog?.dietPaused ?? false);
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

  const fetchMicronutrients = useCallback(() => {
    fetch(`/api/micronutrient-intakes?date=${date}`, { cache: "no-store" })
      .then((r) => r.ok ? r.json() : {})
      .then((data: { log?: MicronutrientDay }) => setMicronutrientData(data.log ?? null))
      .catch(() => setMicronutrientData(null));
    fetch(`/api/supplement-intakes?date=${date}`, { cache: "no-store" })
      .then((r) => r.ok ? r.json() : {})
      .then((data: { log?: SupplementLog }) => setSupplementLog(data.log ?? null))
      .catch(() => setSupplementLog(null));
  }, [date]);

  useEffect(() => {
    setEntries(initialLog?.entries ?? []);
    setWaterMl(initialLog?.waterMl ?? 0);
    setAlcoolDrinks((initialLog as (DayLog & { alcoolDrinks?: AlcoolDrink[] }) | null)?.alcoolDrinks ?? []);
    setValidated((initialLog as { validated?: boolean } | null)?.validated ?? false);
    setMealHunger((initialLog as (DayLog & { mealHunger?: Partial<Record<MealType, HungerLevel>> }) | null)?.mealHunger ?? {});
    setDietPaused(initialLog?.dietPaused ?? false);
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
    // Load micronutrient data
    fetchMicronutrients();
  }, [date, initialLog, fetchMicronutrients]);

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

  const dietReport = useMemo(
    () => (dietProgram?.enabled && !dietPaused ? checkDietCompliance(entries, dietExceptions) : null),
    [entries, dietProgram?.enabled, dietPaused, dietExceptions]
  );

  const handleDismissViolation = (foodName: string) => {
    const key = normalizeFoodName(foodName);
    setDietExceptions((prev) => {
      if (prev.includes(key)) return prev;
      const next = [...prev, key];
      fetch("/api/goals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dietProgram: { enabled: dietProgram?.enabled ?? true, exceptions: next } }),
      }).catch((err) => console.error("Failed to save diet exception:", err));
      return next;
    });
  };

  const handleToggleDietPause = () => {
    const next = !dietPaused;
    setDietPaused(next);
    fetch("/api/log", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, dietPaused: next }),
    }).catch((err) => console.error("Failed to save diet pause:", err));
  };

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
    supplements: (supplementLog?.intakes ?? []).map((i) => ({
      name:  i.supplementName,
      time:  i.time,
      moment: i.moment,
    })),
    micronutrients: Object.entries(
      (micronutrientData?.intakes ?? []).reduce((acc, i) => {
        acc[i.code] = (acc[i.code] ?? 0) + i.amount;
        return acc;
      }, {} as Record<string, number>)
    ).map(([code, amount]) => ({
      code,
      amount: Math.round(amount * 10) / 10,
      unit: micronutrientData?.intakes?.find((i) => i.code === code)?.unit ?? "",
    })),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [entries.length, Math.round(totals.calories), waterMl, mealHunger, supplementLog, micronutrientData]);

  // Extracts + logs micronutrients for freshly-added entries — shared by every path that
  // can introduce new food entries, so none of them can silently skip this step.
  const syncNewEntryMicronutrients = (newEntries: FoodEntry[]) => {
    if (!newEntries.length) return;
    Promise.all(
      newEntries.map(async (entry) => {
        const time = format(new Date(Number(entry.loggedAt?.seconds ?? 0) * 1000 || Date.now()), "HH:mm");
        const intakes = await extractMicronutrientsForced(entry.nutrition, entry.name, entry.servingGrams, entry.name, time);
        return logMicronutrients(date, intakes);
      })
    ).then(fetchMicronutrients);
  };

  const handleMealChange = (meal: MealType, mealEntries: FoodEntry[]) => {
    const prevIds = new Set(entries.filter((e) => e.meal === meal).map((e) => e.id));
    const newEntries = mealEntries.filter((e) => !prevIds.has(e.id));

    setEntries((prev) => [...prev.filter((e) => e.meal !== meal), ...mealEntries]);
    syncNewEntryMicronutrients(newEntries);
  };

  // Voice logging can distribute items across several meals in one go, so (unlike
  // handleMealChange) it needs to diff against the *whole* day's entries, not just one
  // meal's. Previously this only called router.refresh() — the calorie/macro totals
  // updated, but the micronutrient-extraction step was silently skipped entirely.
  const handleVoiceAdded = async () => {
    setShowVoice(false);
    try {
      const res = await fetch(`/api/log?date=${date}`);
      if (res.ok) {
        const { dayLog } = await res.json() as { dayLog: { entries?: FoodEntry[] } | null };
        const freshEntries = dayLog?.entries ?? [];
        const prevIds = new Set(entries.map((e) => e.id));
        const newEntries = freshEntries.filter((e) => !prevIds.has(e.id));
        setEntries(freshEntries);
        syncNewEntryMicronutrients(newEntries);
      }
    } catch (err) {
      console.error("Voice meal refetch failed:", err);
    }
    router.refresh();
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
          className="mb-5 flex items-center gap-2"
        >
          <div className="flex-1 min-w-0">
            <DateNav date={date} />
          </div>
          {/* Face & eye scan — Nutri-IA wellness photo analysis */}
          <Link
            href="/health/face-scan"
            aria-label="Scan visage"
            className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-90"
            style={{ background: "rgba(99,102,241,0.14)", border: "1px solid rgba(99,102,241,0.4)", color: "var(--indigo)" }}
          >
            <IconCamera size={17} stroke={1.8} />
          </Link>
          {/* Voice meal logging — Nutri-IA */}
          <button
            onClick={() => setShowVoice(true)}
            aria-label="Dicter mon repas"
            className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-90"
            style={{ background: "rgba(52,211,153,0.14)", border: "1px solid rgba(52,211,153,0.4)", color: "#34d399" }}
          >
            <IconMicrophone size={17} stroke={1.8} />
          </button>
          {/* Aliments Alternatifs — calorie-matched food substitution tool */}
          <button
            onClick={() => setShowAlternatives(true)}
            aria-label="Aliments Alternatifs"
            className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-90"
            style={{ background: "rgba(59,130,246,0.14)", border: "1px solid rgba(59,130,246,0.4)", color: "var(--protein)" }}
          >
            <IconArrowsExchange size={17} stroke={1.8} />
          </button>
        </motion.div>

        <MeasurementReminderBanner />
        <FaceScanReminderBanner />

        {/* ── Fasting Timer ── */}
        {goals.intermittentFasting?.enabled && (
          <FastingTimer date={date} fastingConfig={goals.intermittentFasting} />
        )}

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
          className="mb-5 rounded-2xl p-5"
          style={{
            background: "linear-gradient(140deg, rgba(249,115,22,0.11) 0%, rgba(251,191,36,0.05) 100%)",
            border: "1px solid rgba(249,115,22,0.18)",
          }}
        >
          {/* ── Calorie arc + stats row ── */}
          <div className="flex items-center gap-4 mb-4">
            <CalorieArc eaten={Math.round(totals.calories)} goal={goals.dailyCalories} size={80} />
            <div className="flex-1 min-w-0">
              {/* Budget bar SVG */}
              <CalorieBudgetBar
                eaten={Math.round(totals.calories)}
                goal={goals.dailyCalories}
                remaining={remaining}
              />
              {/* Stats under bar */}
              <div className="flex justify-between mt-1.5">
                <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                  Objectif {goals.dailyCalories} kcal
                </span>
                <span className="text-[11px] font-semibold tabular-nums"
                  style={{ color: remaining >= 0 ? "var(--text-secondary)" : "#ef4444" }}>
                  {remaining >= 0 ? `−${remaining}` : `+${Math.abs(remaining)}`} kcal
                </span>
              </div>
            </div>
          </div>

          {/* ── SVG Macro bars ── */}
          <MacroSVGBars
            protein={{ val: totals.proteinG, goal: goals.proteinGrams }}
            carbs={{   val: totals.carbsG,   goal: goals.carbsGrams }}
            fat={{     val: totals.fatG,     goal: goals.fatGrams }}
          />

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

        {/* Tracked nutrients — compact strip. Protein is deliberately excluded here:
            it's already shown as its own bar in the daily summary card just above,
            so repeating it as a pill would be the same number twice on screen. */}
        {trackedNutrients && (trackedNutrients.sodium || trackedNutrients.sugar || trackedNutrients.saturatedFat) && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.065 }}
            className="glass px-3 py-2.5 mb-5"
          >
            <div className="flex items-stretch gap-2.5">
              {trackedNutrients.sodium && (
                <TrackedNutrientPill Icon={IconSalt} label="Sel" unit="mg"
                  value={Math.round(totals.sodiumMg ?? 0)} goal={goals.sodiumMg ?? 2000} color="#f59e0b" invertAlert />
              )}
              {trackedNutrients.sugar && (
                <TrackedNutrientPill Icon={IconCandy} label="Sucres" unit="g"
                  value={Math.round(totals.sugarG ?? 0)} goal={goals.sugarGrams ?? 50} color="#ec4899" invertAlert />
              )}
              {trackedNutrients.saturatedFat && (
                <TrackedNutrientPill Icon={IconAvocado} label="Lip.sat." unit="g"
                  value={Math.round(totals.saturatedFatG ?? 0)} goal={goals.saturatedFatGrams ?? 20} color="var(--fat)" invertAlert />
              )}
            </div>

            <div className="mt-2.5">
              <MacroContributionPanel entries={entries} trackedNutrients={trackedNutrients} />
            </div>
          </motion.div>
        )}

        {/* Diet program compliance — day-level badge */}
        {dietProgram?.enabled && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.068 }}
            className="mb-5 flex items-center gap-2 px-3 py-2.5 rounded-xl"
            style={{
              background: dietPaused ? "rgba(255,255,255,0.03)"
                : dietReport?.day.status === "ecarts" ? "rgba(239,68,68,0.08)"
                : dietReport?.day.status === "conforme" ? "rgba(34,197,94,0.08)"
                : "rgba(255,255,255,0.03)",
              border: `1px solid ${dietPaused ? "var(--border)"
                : dietReport?.day.status === "ecarts" ? "rgba(239,68,68,0.25)"
                : dietReport?.day.status === "conforme" ? "rgba(34,197,94,0.25)" : "var(--border)"}`,
            }}
          >
            <span className="text-[13px]">🩺</span>
            <span className="text-[12px] font-medium flex-1" style={{
              color: dietPaused ? "var(--text-muted)"
                : dietReport?.day.status === "ecarts" ? "#f87171"
                : dietReport?.day.status === "conforme" ? "#22c55e" : "var(--text-muted)",
            }}>
              {DIET_PROGRAM_NAME}
              {" — "}
              {dietPaused
                ? "jour libre, écarts non comptabilisés"
                : dietReport?.day.status === "ecarts"
                  ? `${dietReport.day.violationCount} écart${dietReport.day.violationCount > 1 ? "s" : ""} aujourd'hui`
                  : dietReport?.day.status === "conforme"
                    ? "conforme"
                    : "aucun aliment loggué"}
            </span>
            <button
              type="button"
              onClick={handleToggleDietPause}
              className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full"
              style={{
                background: dietPaused ? "rgba(251,191,36,0.15)" : "rgba(255,255,255,0.06)",
                color: dietPaused ? "#fbbf24" : "var(--text-muted)",
              }}
              aria-label={dietPaused ? "Réactiver le suivi du régime" : "Ne pas suivre le régime aujourd'hui"}
              title={dietPaused ? "Réactiver le suivi aujourd'hui" : "Je ne peux pas suivre le régime aujourd'hui"}
            >
              {dietPaused ? <IconPlayerPlay size={12} stroke={1.8} /> : <IconPlayerPause size={12} stroke={1.8} />}
            </button>
            <button
              type="button"
              onClick={() => setShowDietInfo(true)}
              className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full"
              style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-muted)" }}
              aria-label="Voir les repères du régime"
              title="Voir ce qui est interdit / à favoriser"
            >
              <IconInfoCircle size={13} stroke={1.6} />
            </button>
          </motion.div>
        )}

        {showDietInfo && <DietProgramInfoModal onClose={() => setShowDietInfo(false)} />}

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

          {/* Supplements tracker */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.09 }}
            className="mb-5 rounded-2xl p-5 overflow-hidden"
            style={{
              background: "linear-gradient(140deg, rgba(52,211,153,0.11) 0%, rgba(34,197,94,0.05) 100%)",
              border: "1px solid rgba(52,211,153,0.18)",
            }}
          >
            <SupplementLogger date={date} onIntakeLogged={fetchMicronutrients} />
          </motion.div>

          {/* Micronutrient tracker */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.05 }}
            className="mb-5 rounded-2xl p-5 overflow-hidden"
            style={{
              background: "linear-gradient(140deg, rgba(99,102,241,0.09) 0%, rgba(139,92,246,0.05) 100%)",
              border: "1px solid rgba(99,102,241,0.15)",
            }}
          >
            <MicronutrientTracker date={date} micronutrientData={micronutrientData} onRefresh={fetchMicronutrients} />
          </motion.div>

          {/* Alcohol tracker — only when enabled in settings */}
          {goals.alcoholTracking && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="mb-5"
            >
              <AlcoolTracker
                date={date}
                initialDrinks={alcoolDrinks}
                weeklyGoalUnits={goals.weeklyAlcoolUnitsGoal}
                onUpdate={setAlcoolDrinks}
              />
            </motion.div>
          )}

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
                  dietMealReport={dietReport?.perMeal[meal] ?? null}
                  dietViolationsByEntryId={dietReport?.violationsByEntryId}
                  onDismissViolation={handleDismissViolation}
                />
              </motion.div>
            ))}
          </div>

          {/* Micronutrients per meal / food — collapsed by default */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.15 }}
            className="mt-3"
          >
            <MealMicronutrientsPanel entries={entries} micronutrientData={micronutrientData} />
          </motion.div>

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

      {/* Voice meal modal — Nutri-IA */}
      <AnimatePresence>
        {showVoice && (
          <VoiceMealModal
            date={date}
            onClose={() => setShowVoice(false)}
            onAdded={handleVoiceAdded}
          />
        )}
      </AnimatePresence>

      {/* Aliments Alternatifs — calorie-matched food substitution tool */}
      {showAlternatives && (
        <AlternativeFoodsModal lang={lang} onClose={() => setShowAlternatives(false)} />
      )}

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
