"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { IconCircleCheck, IconBolt, IconLoader2, IconChevronDown, IconChevronUp, IconAlertCircle, IconRuler, IconUser, IconHeartbeat, IconShoe, IconCalculator, IconDeviceFloppy } from "@tabler/icons-react";
import { calcTDEE, TDEE_FORMULA_CONFIG, type TDEEFormula } from "@/app/lib/nutrition";
import type { NutritionGoals, NutritionPlan, ActivityLevel, Gender, PlannedActivity, ActivityPlan } from "@/app/lib/types";
import { format as formatDate } from "date-fns";

// Extrait de SettingsClient.tsx (3750 lignes) : ce panneau et ses constantes
// en representaient a eux seuls 1183, et n'etaient utilises nulle part
// ailleurs. SliderField et les tables ACTIVITY_*/PROGRAMS ne servent qu'ici.

function SliderField({ label, unit, value, min, max, step, color, onChange }: {
  label: string; unit: string; value: string; min: number; max: number; step: number;
  color: string; onChange: (v: string) => void;
}) {
  const num = parseFloat(value) || min;
  const clamped = Math.max(min, Math.min(max, num));
  const pct = ((clamped - min) / (max - min)) * 100;
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] font-medium" style={{ color }}>{label}</p>
        <span className="text-[15px] font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>
          {step < 1 ? num.toFixed(1) : Math.round(num)}
          <span className="text-[11px] font-normal ml-0.5" style={{ color: "var(--text-muted)" }}>{unit}</span>
        </span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={clamped}
        onChange={e => onChange(e.target.value)}
        className="nt-slider"
        style={{
          background: `linear-gradient(to right, ${color} ${pct}%, rgba(255,255,255,0.1) ${pct}%)`,
        }}
      />
      <div className="flex justify-between text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
        <span>{step < 1 ? min.toFixed(1) : min}{unit}</span>
        <span>{step < 1 ? max.toFixed(1) : max}{unit}</span>
      </div>
    </div>
  );
}

// ─── Goals Panel ─────────────────────────────────────────────────────────────

const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary:   "Sédentaire",
  light:       "Légèrement actif",
  moderate:    "Modérément actif",
  active:      "Très actif",
  very_active: "Extrêmement actif",
};

const ACTIVITY_DESCS: Record<ActivityLevel, string> = {
  sedentary:   "Peu ou pas d'exercice",
  light:       "1–3 fois/sem.",
  moderate:    "3–5 fois/sem.",
  active:      "6–7 fois/sem.",
  very_active: "2× par jour",
};

const ACTIVITY_CATALOG: Omit<PlannedActivity, 'id' | 'durationMin'>[] = [
  // Sport
  { label: "Course à pied",   emoji: "🏃", category: "sport",   kcalPer30min: 300 },
  { label: "Vélo",            emoji: "🚴", category: "sport",   kcalPer30min: 200 },
  { label: "Natation",        emoji: "🏊", category: "sport",   kcalPer30min: 250 },
  { label: "Musculation",     emoji: "🏋️", category: "sport",   kcalPer30min: 150 },
  { label: "Tennis",          emoji: "🎾", category: "sport",   kcalPer30min: 200 },
  { label: "Football",        emoji: "⚽", category: "sport",   kcalPer30min: 250 },
  { label: "Yoga",            emoji: "🧘", category: "sport",   kcalPer30min: 80  },
  { label: "Marche rapide",   emoji: "🚶", category: "sport",   kcalPer30min: 120 },
  // Loisirs
  { label: "Jardinage",       emoji: "🌱", category: "leisure", kcalPer30min: 120 },
  { label: "Danse",           emoji: "💃", category: "leisure", kcalPer30min: 150 },
  { label: "Ménage intensif", emoji: "🧹", category: "leisure", kcalPer30min: 90  },
  { label: "Bricolage",       emoji: "🔨", category: "leisure", kcalPer30min: 100 },
  { label: "Promenade",       emoji: "🌳", category: "leisure", kcalPer30min: 80  },
  { label: "Stretching",      emoji: "🤸", category: "leisure", kcalPer30min: 60  },
];

// ─── Programmes & ajustements (module-level pour useEffect) ─────────────────

const PROGRAMS: Record<string, { label: string; emoji: string; desc: string; protPct: number; carbPct: number; fatPct: number; fiber: number; calorieBonus?: number; fixedCalories?: number; group?: string; tip?: string }> = {
  // ── Programmes standard ──
  balanced:    { label: "Équilibré",           emoji: "⚖️",  desc: "50% G · 25% P · 25% L",              protPct: 0.25, carbPct: 0.50, fatPct: 0.25, fiber: 30 },
  keto:        { label: "Cétogène",            emoji: "🥑",  desc: "5% G · 25% P · 70% L",               protPct: 0.25, carbPct: 0.05, fatPct: 0.70, fiber: 25 },
  lowcarb:     { label: "Sans sucre",          emoji: "🚫🍬", desc: "20% G · 30% P · 50% L",              protPct: 0.30, carbPct: 0.20, fatPct: 0.50, fiber: 28 },
  highprot:    { label: "Hyperprotéiné",       emoji: "💪",  desc: "25% G · 40% P · 35% L",              protPct: 0.40, carbPct: 0.25, fatPct: 0.35, fiber: 30 },
  mediter:     { label: "Méditerranéen",       emoji: "🫒",  desc: "45% G · 20% P · 35% L",              protPct: 0.20, carbPct: 0.45, fatPct: 0.35, fiber: 35 },
  bulk:        { label: "Prise de masse",      emoji: "🏋️",  desc: "45% G · 30% P · 25% L",              protPct: 0.30, carbPct: 0.45, fatPct: 0.25, fiber: 30, calorieBonus: 300 },
  // ── Méthode Dr.C (Dr Jean-Michel Cohen) — calories fixes ──
  drc_confort: { label: "Dr.C Confort",        emoji: "🥗",  desc: "1 400 kcal · 45%G · 30%P · 25%L",   protPct: 0.30, carbPct: 0.45, fatPct: 0.25, fiber: 30, fixedCalories: 1400, group: "drc", tip: "Phase principale · perte 2–4 kg/mois" },
  drc_boost:   { label: "Dr.C Boost",          emoji: "⚡",  desc: "900 kcal · 35%G · 40%P · 25%L",     protPct: 0.40, carbPct: 0.35, fatPct: 0.25, fiber: 20, fixedCalories: 900,  group: "drc", tip: "1–2 sem/mois · relance après plateau" },
  drc_stab:    { label: "Dr.C Stabilisation",  emoji: "🏆",  desc: "1 600 kcal · 50%G · 25%P · 25%L",   protPct: 0.25, carbPct: 0.50, fatPct: 0.25, fiber: 30, fixedCalories: 1600, group: "drc", tip: "Maintien du poids · long terme" },
};

const WEEKLY_ADJUSTMENTS: Record<string, number> = { lose: -500, maintain: 0, gain: 300 };

// ─── Goals Panel ─────────────────────────────────────────────────────────────

export default function GoalsPanel({ initialGoals }: { initialGoals: NutritionGoals }) {
  const [age,      setAge]      = useState(initialGoals.age?.toString()       ?? "");
  const [height,   setHeight]   = useState(initialGoals.heightCm?.toString()  ?? "");
  const [weight,   setWeight]   = useState(initialGoals.targetWeightKg?.toString() ?? "");
  const [gender,   setGender]   = useState<Gender | "">(initialGoals.gender   ?? "");
  const [activity, setActivity] = useState<ActivityLevel>(initialGoals.activityLevel ?? "moderate");
  const [calories, setCalories] = useState(initialGoals.dailyCalories.toString());
  const [protein,  setProtein]  = useState(initialGoals.proteinGrams.toString());
  const [carbs,    setCarbs]    = useState(initialGoals.carbsGrams.toString());
  const [fat,      setFat]      = useState(initialGoals.fatGrams.toString());
  const [fiber,    setFiber]    = useState(initialGoals.fiberGrams.toString());
  const [water,    setWater]    = useState(initialGoals.waterMl.toString());
  const [steps,    setSteps]    = useState((initialGoals.stepsGoal ?? 10000).toString());
  const [sleep,    setSleep]    = useState(Math.round((initialGoals.sleepGoalMin ?? 420) / 60).toString());
  const [deductBurned,   setDeductBurned]   = useState(initialGoals.deductBurnedCalories !== false);
  const [weeklyGoal,     setWeeklyGoal]     = useState(initialGoals.weeklyGoal ?? "maintain");
  const [currentWeight,  setCurrentWeight]  = useState(initialGoals.currentWeightKg?.toString() ?? "");
  const [targetDate,     setTargetDate]     = useState<string>("");
  const [tdeeCalc,       setTdeeCalc]       = useState<number | null>(null);
  const [selectedProgram,   setSelectedProgram]   = useState<string | null>(null);
  const [tdeeFormula,       setTdeeFormula]       = useState<TDEEFormula>("mifflin");
  const [bodyFatPct,        setBodyFatPct]        = useState<string>("");
  const [saving,            setSaving]            = useState(false);
  const [saved,             setSaved]             = useState(false);
  const [expanded,          setExpanded]          = useState(false);
  const [planLoading,       setPlanLoading]       = useState(false);
  const [planResult,        setPlanResult]        = useState<{ projectedTargetDate: string | null; projectedWeeklyLossKg: number | null; projectedNote: string | null } | null>(null);
  const [activityPlan,      setActivityPlan]      = useState<ActivityPlan | null>(
    (initialGoals as NutritionGoals & { activityPlan?: ActivityPlan }).activityPlan ?? null
  );
  const [apSessions,     setApSessions]     = useState<number>(activityPlan?.sessionsPerWeek ?? 3);
  const [apMinDuration,  setApMinDuration]  = useState<number>(activityPlan?.activities?.[0]?.durationMin ?? 30);
  const [apSelected,     setApSelected]     = useState<Set<string>>(
    new Set((activityPlan?.activities ?? []).map(a => a.id))
  );
  // Plan change confirmation
  const [planActive,         setPlanActive]         = useState(!!initialGoals.plan);
  const [confirmPlanChange,  setConfirmPlanChange]  = useState(false);
  // Section collapse — both start closed
  const [programOpen,    setProgramOpen]    = useState(false);
  const [activityOpen,   setActivityOpen]   = useState(false);
  const [activityLevelOpen, setActivityLevelOpen] = useState(false);
  const [tdeeOpen,          setTdeeOpen]          = useState(false);
  const [macroOpen,         setMacroOpen]          = useState(false);


  // ── Auto-propose date cible dès que poids actuel + cible + profil sont renseignés ──
  useEffect(() => {
    if (!currentWeight || !weight) return;
    const cur = parseFloat(currentWeight);
    const tgt = parseFloat(weight);
    if (!cur || !tgt || Math.abs(cur - tgt) < 0.5) return;
    // Compute deficit: use TDEE if profile available, else assume 500 kcal/day
    let deficit = 500;
    const kcal = parseInt(calories) || 0;
    const a = parseInt(age), h = parseInt(height);
    if (kcal && a && h && gender) {
      const bf   = parseFloat(bodyFatPct) || undefined;
      const tdee = calcTDEE(cur, h, a, gender as Gender, activity, tdeeFormula, bf);
      deficit = Math.max(50, Math.abs(tdee - kcal));
    } else if (kcal) {
      deficit = Math.max(50, Math.abs(cur * 30 - kcal));
    }
    const days     = Math.round(Math.abs(cur - tgt) * 7700 / deficit);
    const proposed = new Date();
    proposed.setDate(proposed.getDate() + days);
    setTargetDate(proposed.toISOString().split("T")[0]);

  }, [selectedProgram, calories, currentWeight, weight, weeklyGoal, activity, age, height, gender, bodyFatPct, tdeeFormula]);

  const handleCalcTDEE = () => {
    const a = parseInt(age);
    const h = parseInt(height);
    const w = parseFloat(currentWeight) || parseFloat(weight) || 70;
    const bf = parseFloat(bodyFatPct) || undefined;
    if (!a || !h || !gender) return;
    const tdee = calcTDEE(w, h, a, gender as Gender, activity, tdeeFormula, bf);
    setTdeeCalc(tdee);
    setCalories(tdee.toString());
    const p = Math.round(w * 2);
    const f = Math.round((tdee * 0.25) / 9);
    const c = Math.round((tdee - p * 4 - f * 9) / 4);
    setProtein(p.toString());
    setFat(f.toString());
    setCarbs(Math.max(c, 0).toString());
    setSelectedProgram(null);
  };

  const handleApplyProgram = (key: string) => {
    const prog = PROGRAMS[key];
    if (!prog) return;
    const a = parseInt(age), h = parseInt(height), w = parseFloat(currentWeight) || parseFloat(weight) || 70;
    const bf = parseFloat(bodyFatPct) || undefined;
    // Dr.C programs use fixed calories — ignore TDEE
    let kcal: number;
    if (prog.fixedCalories) {
      kcal = prog.fixedCalories;
    } else {
      let base = parseInt(calories) || 2000;
      if (a && h && gender) {
        base = calcTDEE(w, h, a, gender as Gender, activity, tdeeFormula, bf);
        setTdeeCalc(base);
      }
      const adj = WEEKLY_ADJUSTMENTS[weeklyGoal] ?? 0;
      const bonus = prog.calorieBonus ?? 0;
      kcal = Math.max(800, base + adj + bonus);
    }
    const p = Math.round((kcal * prog.protPct) / 4);
    const f = Math.round((kcal * prog.fatPct)  / 9);
    const c = Math.round((kcal * prog.carbPct) / 4);
    setCalories(kcal.toString());
    setProtein(p.toString());
    setFat(f.toString());
    setCarbs(c.toString());
    setFiber(prog.fiber.toString());
    setSelectedProgram(key);
    setProgramOpen(false); // collapse after selection
  };

  const buildGoalsObject = (): Partial<NutritionGoals> => {
    const goals: Partial<NutritionGoals> = {
      dailyCalories:  parseInt(calories) || 2000,
      proteinGrams:   parseInt(protein)  || 150,
      carbsGrams:     parseInt(carbs)    || 220,
      fatGrams:       parseInt(fat)      || 65,
      fiberGrams:     parseInt(fiber)    || 30,
      waterMl:        parseInt(water)    || 2000,
      stepsGoal:            parseInt(steps)    || 10000,
      sleepGoalMin:         (parseInt(sleep)   || 7) * 60,
      activityLevel:        activity,
      deductBurnedCalories: deductBurned,
      weeklyGoal:     weeklyGoal as "lose" | "maintain" | "gain",
      targetWeightKg: parseFloat(weight) || null,
    };
    if (age)           goals.age             = parseInt(age);
    if (height)        goals.heightCm        = parseInt(height);
    if (gender)        goals.gender          = gender as Gender;
    if (currentWeight) goals.currentWeightKg = parseFloat(currentWeight) || undefined;
    if (targetDate)    goals.targetDate      = targetDate;
    return goals;
  };

  const buildActivityPlan = (): ActivityPlan | null => {
    if (apSelected.size === 0) return null;
    const activities: PlannedActivity[] = [...apSelected].map(id => {
      const catalog = ACTIVITY_CATALOG.find(a => `${a.category}-${a.label}` === id);
      if (!catalog) return null;
      return { id, label: catalog.label, emoji: catalog.emoji, category: catalog.category, durationMin: apMinDuration, kcalPer30min: catalog.kcalPer30min };
    }).filter((a): a is PlannedActivity => a !== null);
    const weeklyKcalBurned = activities.reduce((sum, a) => sum + a.kcalPer30min * apMinDuration / 30, 0) * apSessions;
    return { sessionsPerWeek: apSessions, activities, weeklyKcalBurned };
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const goals = buildGoalsObject();
      const ap = buildActivityPlan();
      if (ap) goals.activityPlan = ap;
      // PUT merges into existing goals (preserves alcoholTracking, fasting, etc.)
      await fetch("/api/goals", {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(goals),
      });
      if (ap) setActivityPlan(ap);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally { setSaving(false); }
  };

  const handleStartPlan = async () => {
    if (!selectedProgram) return;
    // Si un plan est déjà actif, demander confirmation
    if (planActive) { setConfirmPlanChange(true); return; }
    await doStartPlan();
  };

  const doStartPlan = async () => {
    if (!selectedProgram) return;
    setConfirmPlanChange(false);
    setPlanLoading(true);
    setPlanResult(null);
    try {
      // 1. Save goals first (PUT merges into existing goals, preserving other fields)
      const goalsObj = buildGoalsObject();
      await fetch("/api/goals", {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(goalsObj),
      });

      // 2. Build NutritionPlan
      const prog = PROGRAMS[selectedProgram];
      const plan: NutritionPlan = {
        programKey:    selectedProgram,
        programLabel:  prog.label,
        programEmoji:  prog.emoji,
        startDate:     formatDate(new Date(), "yyyy-MM-dd"),
        startWeightKg:  parseFloat(currentWeight) || parseFloat(weight) || null,
        targetWeightKg: parseFloat(weight) || null,
        dailyCalories:  parseInt(calories) || 2000,
      };

      // 3. Call projection API
      const res = await fetch("/api/plan/projection", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ plan, goals: goalsObj }),
      });
      if (res.ok) {
        const json = await res.json() as { ok: boolean; projectedTargetDate: string | null; projectedWeeklyLossKg: number | null; projectedNote: string | null };
        setPlanResult({
          projectedTargetDate:   json.projectedTargetDate,
          projectedWeeklyLossKg: json.projectedWeeklyLossKg,
          projectedNote:         json.projectedNote,
        });
        setPlanActive(true);
      }
    } catch { /* noop */ }
    finally { setPlanLoading(false); }
  };

  const inputClass = "w-full px-3 py-2 rounded-xl text-[13px] transition-colors outline-none";
  const inputStyle = {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid var(--border)",
    color: "var(--text-primary)",
  };

  // ── Date presets ──
  const DATE_PRESETS = [
    { label: "1 mois",  months: 1 },
    { label: "3 mois",  months: 3 },
    { label: "6 mois",  months: 6 },
    { label: "1 an",    months: 12 },
  ];
  const addMonthsToToday = (months: number): string => {
    const d = new Date();
    d.setMonth(d.getMonth() + months);
    return d.toISOString().split("T")[0];
  };

  // ── Projection réaliste (calcul live) ──
  const projLive = (() => {
    const cur = parseFloat(currentWeight);
    const tgt = parseFloat(weight);
    if (!cur || !tgt || !targetDate) return null;
    const today = new Date();
    const end   = new Date(targetDate + "T00:00:00");
    const days  = Math.max(1, Math.round((end.getTime() - today.getTime()) / 86400000));
    const totalKg = cur - tgt;
    if (Math.abs(totalKg) < 0.5) return null;
    const perDay        = totalKg / days;
    const perWeek       = perDay * 7;
    const dailyDeficit  = Math.round(Math.abs(perDay) * 7700);
    const isRealistic   = Math.abs(perWeek) <= 0.75;
    const isAmbitious   = Math.abs(perWeek) > 0.75 && Math.abs(perWeek) <= 1.0;
    const isUnrealistic = Math.abs(perWeek) > 1.0;
    const minDays = Math.ceil(Math.abs(totalKg) / 0.75 * 7);
    const minDate = new Date(today.getTime() + minDays * 86400000);
    return { totalKg, perDay, perWeek, dailyDeficit, days, isRealistic, isAmbitious, isUnrealistic, minDate };
  })();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.08 }}
      className="glass p-5 mt-4"
    >
      {/* Header */}
      <button
        className="w-full flex items-center justify-between mb-1"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex items-center gap-2">
          <IconUser size={18} style={{ color: "var(--calories)" }} />
          <div className="text-left">
            <p className="font-semibold text-[14px]" style={{ color: "var(--text-primary)" }}>Objectifs & Profil</p>
            <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>Calories, macros, pas, sommeil</p>
          </div>
        </div>
        {expanded ? <IconChevronUp size={14} style={{ color: "var(--text-muted)" }} /> : <IconChevronDown size={14} style={{ color: "var(--text-muted)" }} />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{ overflow: "hidden" }}
          >
            <div className="pt-4 space-y-5">

              {/* ── Profil ── */}
              <div>
                <p className="label-xs mb-3 flex items-center gap-1.5">
                  <IconRuler size={11} />
                  Profil corporel
                </p>

                {/* Gender */}
                <div className="flex gap-2 mb-3">
                  {(["male", "female"] as Gender[]).map(g => (
                    <button key={g} onClick={() => setGender(g)}
                      className="flex-1 py-2 rounded-xl text-[12px] font-medium transition-all"
                      style={{
                        background: gender === g ? "rgba(249,115,22,0.12)" : "rgba(255,255,255,0.04)",
                        border: `1px solid ${gender === g ? "var(--calories)" : "var(--border)"}`,
                        color: gender === g ? "var(--calories)" : "var(--text-muted)",
                      }}>
                      {g === "male" ? "Homme" : "Femme"}
                    </button>
                  ))}
                </div>

                {/* Age / Height */}
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Âge",    unit: "ans", val: age,    set: setAge },
                    { label: "Taille", unit: "cm",  val: height, set: setHeight },
                  ].map(({ label, unit, val, set }) => (
                    <div key={label}>
                      <p className="text-[11px] mb-1" style={{ color: "var(--text-muted)" }}>{label}</p>
                      <div className="relative">
                        <input
                          type="number"
                          value={val}
                          onChange={e => set(e.target.value)}
                          placeholder="—"
                          className={inputClass}
                          style={{ ...inputStyle, paddingRight: "28px" }}
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px]"
                          style={{ color: "var(--text-muted)" }}>{unit}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* ── Poids actuel ── */}
                <div className="mt-3">
                  <SliderField label="Poids actuel" unit=" kg"
                    value={currentWeight || "70"} min={40} max={200} step={0.5}
                    color="rgba(250,250,250,0.55)" onChange={setCurrentWeight} />
                </div>

                {/* ── Poids cible ── */}
                <div className="mt-4">
                  <SliderField label="Poids cible" unit=" kg"
                    value={weight || "70"} min={40} max={200} step={0.5}
                    color="var(--calories)" onChange={setWeight} />
                </div>

                {/* ── Date cible ── */}
                <div className="mt-4">
                  <p className="text-[11px] mb-2 font-medium" style={{ color: "var(--text-muted)" }}>Date cible</p>
                  <div className="flex gap-1.5 flex-wrap mb-2">
                    {DATE_PRESETS.map(p => {
                      const d = addMonthsToToday(p.months);
                      const sel = targetDate === d;
                      return (
                        <button key={p.months} onClick={() => setTargetDate(d)}
                          className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all"
                          style={{
                            background: sel ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.05)",
                            border: `1px solid ${sel ? "rgba(99,102,241,0.5)" : "var(--border)"}`,
                            color: sel ? "#a5b4fc" : "var(--text-muted)",
                          }}>
                          {p.label}
                        </button>
                      );
                    })}
                  </div>
                  <input type="date" value={targetDate}
                    onChange={e => setTargetDate(e.target.value)}
                    className={inputClass}
                    style={{ ...inputStyle, fontSize: "13px" }}
                    min={new Date().toISOString().split("T")[0]}
                  />
                </div>

                {/* ── Projection live ── */}
                {projLive && (
                  <div className="mt-3 rounded-xl p-3 space-y-2"
                    style={{
                      background: projLive.isUnrealistic ? "rgba(239,68,68,0.07)" : projLive.isAmbitious ? "rgba(251,191,36,0.07)" : "rgba(52,211,153,0.07)",
                      border: `1px solid ${projLive.isUnrealistic ? "rgba(239,68,68,0.3)" : projLive.isAmbitious ? "rgba(251,191,36,0.3)" : "rgba(52,211,153,0.25)"}`,
                    }}>
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] font-semibold"
                        style={{ color: projLive.isUnrealistic ? "var(--danger)" : projLive.isAmbitious ? "var(--carbs)" : "var(--fiber)" }}>
                        {projLive.isUnrealistic ? "❌ Irréaliste" : projLive.isAmbitious ? "⚠️ Ambitieux" : "✅ Réaliste"}
                      </span>
                      <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                        {Math.abs(projLive.totalKg).toFixed(1)} kg à {projLive.totalKg > 0 ? "perdre" : "prendre"}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                      <div>
                        <p className="text-[11px] uppercase tracking-wide mb-0.5" style={{ color: "var(--text-muted)" }}>Par semaine</p>
                        <p className="text-[16px] font-bold tabular-nums leading-none"
                          style={{ color: projLive.isUnrealistic ? "var(--danger)" : "var(--text-primary)" }}>
                          {projLive.totalKg > 0 ? "−" : "+"}{Math.abs(projLive.perWeek).toFixed(2)}
                          <span className="text-[11px] font-normal ml-0.5" style={{ color: "var(--text-muted)" }}>kg</span>
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-wide mb-0.5" style={{ color: "var(--text-muted)" }}>Par jour</p>
                        <p className="text-[16px] font-bold tabular-nums leading-none" style={{ color: "var(--text-primary)" }}>
                          {projLive.totalKg > 0 ? "−" : "+"}{Math.abs(projLive.perDay * 1000).toFixed(0)}
                          <span className="text-[11px] font-normal ml-0.5" style={{ color: "var(--text-muted)" }}>g</span>
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-wide mb-0.5" style={{ color: "var(--text-muted)" }}>Déficit kcal/jour</p>
                        <p className="text-[16px] font-bold tabular-nums leading-none" style={{ color: "var(--calories)" }}>
                          ~{projLive.dailyDeficit}
                          <span className="text-[11px] font-normal ml-0.5" style={{ color: "var(--text-muted)" }}>kcal</span>
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-wide mb-0.5" style={{ color: "var(--text-muted)" }}>Durée totale</p>
                        <p className="text-[16px] font-bold tabular-nums leading-none" style={{ color: "var(--text-secondary)" }}>
                          {projLive.days}
                          <span className="text-[11px] font-normal ml-0.5" style={{ color: "var(--text-muted)" }}>jours</span>
                        </p>
                      </div>
                    </div>
                    {projLive.isUnrealistic && (
                      <p className="text-[11px]" style={{ color: "var(--danger)" }}>
                        ⚠️ Date mini réaliste pour {Math.abs(projLive.totalKg).toFixed(1)} kg :{" "}
                        <strong>{projLive.minDate.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</strong>
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* ── Niveau d'activité ── */}
              <div>
                <button className="w-full flex items-center justify-between mb-2"
                  onClick={() => setActivityLevelOpen(o => !o)}>
                  <p className="label-xs">Niveau d&apos;activité</p>
                  <div className="flex items-center gap-2">
                    {!activityLevelOpen && (
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                        style={{ background: "rgba(249,115,22,0.1)", color: "var(--calories)", border: "1px solid rgba(249,115,22,0.25)" }}>
                        {ACTIVITY_LABELS[activity]}
                      </span>
                    )}
                    {activityLevelOpen
                      ? <IconChevronUp size={12} style={{ color: "var(--text-muted)" }} />
                      : <IconChevronDown size={12} style={{ color: "var(--text-muted)" }} />}
                  </div>
                </button>
                <AnimatePresence initial={false}>
                  {activityLevelOpen && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} style={{ overflow: "hidden" }}>
                      <div className="space-y-1.5 pb-1">
                        {(Object.keys(ACTIVITY_LABELS) as ActivityLevel[]).map(level => (
                          <button key={level}
                            onClick={() => { setActivity(level); setActivityLevelOpen(false); }}
                            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition-all"
                            style={{
                              background: activity === level ? "rgba(249,115,22,0.08)" : "rgba(255,255,255,0.03)",
                              border: `1px solid ${activity === level ? "rgba(249,115,22,0.35)" : "var(--border)"}`,
                            }}>
                            <div>
                              <p className="text-[12px] font-medium" style={{ color: activity === level ? "var(--calories)" : "var(--text-primary)" }}>
                                {ACTIVITY_LABELS[level]}
                              </p>
                              <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{ACTIVITY_DESCS[level]}</p>
                            </div>
                            {activity === level && <IconCircleCheck size={14} style={{ color: "var(--calories)" }} />}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* ── Objectif poids ── */}
              <div>
                <p className="label-xs mb-2">Objectif</p>
                <div className="flex gap-2">
                  {(["lose", "maintain", "gain"] as const).map(g => (
                    <button key={g} onClick={() => setWeeklyGoal(g)}
                      className="flex-1 py-2 rounded-xl text-[11px] font-medium transition-all"
                      style={{
                        background: weeklyGoal === g ? "rgba(167,139,250,0.12)" : "rgba(255,255,255,0.04)",
                        border: `1px solid ${weeklyGoal === g ? "rgba(167,139,250,0.5)" : "var(--border)"}`,
                        color: weeklyGoal === g ? "var(--protein)" : "var(--text-muted)",
                      }}>
                      {g === "lose" ? "Perdre" : g === "maintain" ? "Maintenir" : "Prendre"}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Plan d'activité ── */}
              <div>
                {/* Collapse header */}
                <button className="w-full flex items-center justify-between mb-2"
                  onClick={() => setActivityOpen(o => !o)}>
                  <p className="label-xs flex items-center gap-1.5">
                    <IconBolt size={11} />
                    Plan d&apos;activité
                  </p>
                  <div className="flex items-center gap-2">
                    {!activityOpen && apSelected.size > 0 && (
                      <span className="text-[11px] font-medium" style={{ color: "var(--calories)" }}>
                        {apSelected.size} activité{apSelected.size > 1 ? "s" : ""} · {apSessions} séances/sem · {apMinDuration} min
                      </span>
                    )}
                    {activityOpen
                      ? <IconChevronUp size={12} style={{ color: "var(--text-muted)" }} />
                      : <IconChevronDown size={12} style={{ color: "var(--text-muted)" }} />
                    }
                  </div>
                </button>

                <AnimatePresence initial={false}>
                  {activityOpen && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} style={{ overflow: "hidden" }}>

                      {/* Sessions par semaine */}
                      <div className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[11px] font-medium" style={{ color: "var(--calories)" }}>Séances par semaine</p>
                          <span className="text-[15px] font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>
                            {apSessions}<span className="text-[11px] font-normal ml-0.5" style={{ color: "var(--text-muted)" }}> séances</span>
                          </span>
                        </div>
                        <input
                          type="range"
                          min={1} max={7} step={1}
                          value={apSessions}
                          onChange={e => setApSessions(parseInt(e.target.value))}
                          className="nt-slider"
                          style={{
                            background: `linear-gradient(to right, var(--calories) ${((apSessions - 1) / 6) * 100}%, rgba(255,255,255,0.1) ${((apSessions - 1) / 6) * 100}%)`,
                          }}
                        />
                        <div className="flex justify-between text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
                          <span>1 séance</span>
                          <span>7 séances</span>
                        </div>
                      </div>

                      {/* Durée minimale par séance */}
                      <div className="mb-4">
                        <p className="text-[11px] font-medium mb-2" style={{ color: "var(--calories)" }}>
                          Durée minimale par séance
                        </p>
                        <div className="flex gap-1.5 flex-wrap">
                          {[20, 30, 45, 60, 90].map(d => (
                            <button key={d} onClick={() => setApMinDuration(d)}
                              className="px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all"
                              style={{
                                background: apMinDuration === d ? "var(--calories)" : "rgba(255,255,255,0.06)",
                                color: apMinDuration === d ? "#fff" : "var(--text-muted)",
                                border: `1px solid ${apMinDuration === d ? "var(--calories)" : "var(--border)"}`,
                              }}>
                              {d} min
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Grille activités */}
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        {ACTIVITY_CATALOG.map(act => {
                          const id = `${act.category}-${act.label}`;
                          const isSelected = apSelected.has(id);
                          return (
                            <button key={id}
                              onClick={() => {
                                const next = new Set(apSelected);
                                if (isSelected) next.delete(id); else next.add(id);
                                setApSelected(next);
                              }}
                              className="rounded-xl p-3 text-left transition-all"
                              style={{
                                background: isSelected ? "rgba(249,115,22,0.08)" : "rgba(255,255,255,0.04)",
                                border: `1px solid ${isSelected ? "rgba(249,115,22,0.4)" : "var(--border)"}`,
                              }}>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-base">{act.emoji}</span>
                                <p className="text-[12px] font-medium flex-1 leading-tight" style={{ color: isSelected ? "var(--calories)" : "var(--text-primary)" }}>
                                  {act.label}
                                </p>
                                <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                                  style={{ background: isSelected ? "var(--calories)" : "rgba(255,255,255,0.06)", border: `1.5px solid ${isSelected ? "var(--calories)" : "var(--border)"}` }}>
                                  {isSelected && <IconCircleCheck size={10} color="#fff" />}
                                </div>
                              </div>
                              <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{act.kcalPer30min} kcal/30 min</p>
                            </button>
                          );
                        })}
                      </div>

                      {/* Total estimé + Valider */}
                      {(() => {
                        const totalPerSession = [...apSelected].reduce((sum, id) => {
                          const act = ACTIVITY_CATALOG.find(a => `${a.category}-${a.label}` === id);
                          return sum + (act ? act.kcalPer30min * apMinDuration / 30 : 0);
                        }, 0);
                        const weeklyKcal = Math.round(totalPerSession * apSessions);
                        return (
                          <div className="space-y-2">
                            {apSelected.size > 0 && (
                              <div className="flex items-center justify-between px-3 py-2.5 rounded-xl"
                                style={{ background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.2)" }}>
                                <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
                                  {apSelected.size} activité{apSelected.size > 1 ? "s" : ""} · {apSessions} séances/sem · {apMinDuration} min
                                </p>
                                <p className="text-[14px] font-bold" style={{ color: "var(--calories)" }}>~{weeklyKcal} kcal</p>
                              </div>
                            )}
                            <button onClick={() => setActivityOpen(false)}
                              className="w-full py-2 rounded-xl text-[12px] font-medium transition-all"
                              style={{
                                background: "rgba(249,115,22,0.08)",
                                border: "1px solid rgba(249,115,22,0.25)",
                                color: "var(--calories)",
                              }}>
                              ✓ Valider le plan d&apos;activité
                            </button>
                          </div>
                        );
                      })()}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* ── Programmes nutritionnels ── */}
              <div>
                <button className="w-full flex items-center justify-between mb-2"
                  onClick={() => setProgramOpen(o => !o)}>
                  <p className="label-xs flex items-center gap-1.5">
                    <IconBolt size={11} />
                    Programme nutritionnel
                  </p>
                  <div className="flex items-center gap-2">
                    {selectedProgram && !programOpen && (
                      <span className="text-[11px] font-medium" style={{ color: "var(--calories)" }}>
                        {PROGRAMS[selectedProgram].emoji} {PROGRAMS[selectedProgram].label}
                      </span>
                    )}
                    {programOpen
                      ? <IconChevronUp size={12} style={{ color: "var(--text-muted)" }} />
                      : <IconChevronDown size={12} style={{ color: "var(--text-muted)" }} />
                    }
                  </div>
                </button>
                <AnimatePresence initial={false}>
                  {programOpen && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} style={{ overflow: "hidden" }}>
                      {/* Standard programs */}
                      <div className="grid grid-cols-2 gap-2">
                        {Object.entries(PROGRAMS).filter(([, p]) => !p.group).map(([key, prog]) => {
                          const active = selectedProgram === key;
                          return (
                            <button key={key} onClick={() => handleApplyProgram(key)}
                              className="flex flex-col items-start p-3 rounded-xl text-left transition-all"
                              style={{
                                background: active ? "rgba(249,115,22,0.12)" : "rgba(255,255,255,0.04)",
                                border: `1px solid ${active ? "rgba(249,115,22,0.5)" : "var(--border)"}`,
                              }}>
                              <span className="text-base mb-1">{prog.emoji}</span>
                              <p className="text-[12px] font-semibold leading-tight" style={{ color: active ? "var(--calories)" : "var(--text-primary)" }}>
                                {prog.label}
                              </p>
                              <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>{prog.desc}</p>
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-[11px] mt-2 mb-3" style={{ color: "var(--text-muted)" }}>
                        Le programme calcule automatiquement les macros selon ton profil.
                      </p>

                      {/* Dr.C section */}
                      <div className="rounded-xl p-3 space-y-2"
                        style={{ background: "rgba(34,197,94,0.05)", border: "1px solid rgba(34,197,94,0.2)" }}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                            style={{ background: "rgba(34,197,94,0.15)", color: "var(--ok)" }}>Dr.C</span>
                          <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                            Méthode Dr Jean-Michel Cohen · calories fixes
                          </p>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {Object.entries(PROGRAMS).filter(([, p]) => p.group === "drc").map(([key, prog]) => {
                            const active = selectedProgram === key;
                            return (
                              <button key={key} onClick={() => handleApplyProgram(key)}
                                className="flex flex-col items-start p-2.5 rounded-xl text-left transition-all"
                                style={{
                                  background: active ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.04)",
                                  border: `1px solid ${active ? "rgba(34,197,94,0.5)" : "rgba(34,197,94,0.15)"}`,
                                }}>
                                <span className="text-base mb-1">{prog.emoji}</span>
                                <p className="text-[11px] font-semibold leading-tight" style={{ color: active ? "var(--ok)" : "var(--text-primary)" }}>
                                  {prog.label}
                                </p>
                                <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>{prog.desc}</p>
                                {prog.tip && (
                                  <p className="text-[11px] mt-1 leading-tight" style={{ color: active ? "var(--ok)" : "var(--text-muted)", opacity: 0.8 }}>{prog.tip}</p>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* ── TDEE Calculator ── */}
              <div>
                <button className="w-full flex items-center justify-between mb-2"
                  onClick={() => setTdeeOpen(o => !o)}>
                  <p className="label-xs flex items-center gap-1.5">
                    <IconCalculator size={11} />
                    Calcul TDEE
                  </p>
                  <div className="flex items-center gap-2">
                    {!tdeeOpen && (
                      <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                        {tdeeCalc ? <><span className="font-bold" style={{ color: "var(--calories)" }}>{tdeeCalc} kcal</span> · </> : ""}{TDEE_FORMULA_CONFIG[tdeeFormula].label}
                      </span>
                    )}
                    {tdeeOpen
                      ? <IconChevronUp size={12} style={{ color: "var(--text-muted)" }} />
                      : <IconChevronDown size={12} style={{ color: "var(--text-muted)" }} />}
                  </div>
                </button>
                <AnimatePresence initial={false}>
                  {tdeeOpen && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} style={{ overflow: "hidden" }}>
                      <div className="rounded-xl p-3 space-y-3"
                        style={{ background: "rgba(249,115,22,0.04)", border: "1px solid rgba(249,115,22,0.18)" }}>
                        {/* Compact formula pills */}
                        <div className="flex gap-1.5">
                          {(Object.entries(TDEE_FORMULA_CONFIG) as [TDEEFormula, typeof TDEE_FORMULA_CONFIG[TDEEFormula]][]).map(([key, cfg]) => (
                            <button key={key} onClick={() => setTdeeFormula(key)}
                              className="flex-1 py-1.5 rounded-lg text-[11px] font-medium transition-all"
                              style={{
                                background: tdeeFormula === key ? "var(--calories)" : "rgba(255,255,255,0.05)",
                                color: tdeeFormula === key ? "#fff" : "var(--text-muted)",
                                border: `1px solid ${tdeeFormula === key ? "var(--calories)" : "var(--border)"}`,
                              }}>
                              {cfg.label}
                            </button>
                          ))}
                        </div>
                        {/* Selected formula description */}
                        <p className="text-[11px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                          {TDEE_FORMULA_CONFIG[tdeeFormula].desc}
                        </p>

                        {/* Body fat % input for Katch-McArdle */}
                        <AnimatePresence>
                          {tdeeFormula === "katch" && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} style={{ overflow: "hidden" }}>
                              <div>
                                <p className="text-[11px] mb-1.5 font-medium" style={{ color: "var(--text-muted)" }}>
                                  % masse grasse (requis)
                                </p>
                                <div className="relative">
                                  <input
                                    type="number" min={3} max={60} step={0.5}
                                    value={bodyFatPct}
                                    onChange={e => setBodyFatPct(e.target.value)}
                                    placeholder="ex: 18"
                                    className="w-full px-3 py-2 rounded-xl text-[13px] outline-none transition-colors"
                                    style={{
                                      background: "rgba(255,255,255,0.06)",
                                      border: "1px solid var(--border)",
                                      color: "var(--text-primary)",
                                      paddingRight: "28px",
                                    }}
                                  />
                                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px]"
                                    style={{ color: "var(--text-muted)" }}>%</span>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        <button onClick={() => { handleCalcTDEE(); setTdeeOpen(false); }}
                          disabled={!age || !height || !gender}
                          className="w-full btn gap-2 text-[12px]"
                          style={{
                            height: "34px",
                            background: age && height && gender ? "var(--calories)" : "rgba(255,255,255,0.06)",
                            color: age && height && gender ? "#fff" : "var(--text-muted)",
                            border: "none",
                            opacity: age && height && gender ? 1 : 0.5,
                          }}>
                          <IconCalculator size={12} />
                          {tdeeCalc ? `Recalculer (${tdeeCalc} kcal)` : "Calculer TDEE → appliquer aux macros"}
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* ── Démarrer le plan ── */}
              {selectedProgram && (
                <div className="rounded-xl p-3 space-y-3"
                  style={{ background: "rgba(52,211,153,0.05)", border: "1px solid rgba(52,211,153,0.2)" }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[12px] font-semibold" style={{ color: "var(--fiber)" }}>
                        {PROGRAMS[selectedProgram].emoji} {PROGRAMS[selectedProgram].label}
                      </p>
                      <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                        {parseInt(calories)} kcal/j · {PROGRAMS[selectedProgram].desc}
                      </p>
                    </div>
                    {projLive && (
                      <div className="text-right">
                        <p className="text-[11px] font-bold" style={{ color: projLive.isUnrealistic ? "var(--danger)" : projLive.isAmbitious ? "var(--carbs)" : "var(--fiber)" }}>
                          {projLive.isUnrealistic ? "⚠️ Irréaliste" : projLive.isAmbitious ? "⚡ Ambitieux" : "✅ Réaliste"}
                        </p>
                        {targetDate && (
                          <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                            ~{new Date(targetDate + "T00:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {projLive && (
                    <div className="flex gap-3 text-center">
                      <div className="flex-1">
                        <p className="text-[11px] uppercase tracking-wide mb-0.5" style={{ color: "var(--text-muted)" }}>Par sem.</p>
                        <p className="text-[14px] font-bold tabular-nums" style={{ color: projLive.isUnrealistic ? "var(--danger)" : "var(--text-primary)" }}>
                          {projLive.totalKg > 0 ? "-" : "+"}{Math.abs(projLive.perWeek).toFixed(2)}
                          <span className="text-[11px] font-normal ml-0.5" style={{ color: "var(--text-muted)" }}>kg</span>
                        </p>
                      </div>
                      <div className="flex-1">
                        <p className="text-[11px] uppercase tracking-wide mb-0.5" style={{ color: "var(--text-muted)" }}>Déficit/j</p>
                        <p className="text-[14px] font-bold tabular-nums" style={{ color: "var(--calories)" }}>
                          ~{projLive.dailyDeficit}
                          <span className="text-[11px] font-normal ml-0.5" style={{ color: "var(--text-muted)" }}>kcal</span>
                        </p>
                      </div>
                      <div className="flex-1">
                        <p className="text-[11px] uppercase tracking-wide mb-0.5" style={{ color: "var(--text-muted)" }}>Durée</p>
                        <p className="text-[14px] font-bold tabular-nums" style={{ color: "var(--text-secondary)" }}>
                          {projLive.days}
                          <span className="text-[11px] font-normal ml-0.5" style={{ color: "var(--text-muted)" }}>j</span>
                        </p>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={handleStartPlan}
                    disabled={!age || !height || !gender || planLoading}
                    className="w-full btn gap-2 text-[13px]"
                    style={{
                      height: "38px",
                      background: age && height && gender ? "linear-gradient(135deg,rgba(52,211,153,0.3),rgba(16,185,129,0.2))" : "rgba(255,255,255,0.06)",
                      color: age && height && gender ? "var(--fiber)" : "var(--text-muted)",
                      border: age && height && gender ? "1px solid rgba(52,211,153,0.4)" : "1px solid var(--border)",
                      opacity: age && height && gender ? 1 : 0.5,
                    }}>
                    {planLoading
                      ? <><IconLoader2 size={12} className="animate-spin" /> Calcul…</>
                      : <>🚀 Démarrer le plan</>
                    }
                  </button>

                  {/* Plan result */}
                  <AnimatePresence>
                    {!planLoading && planResult && (
                      <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="px-3 py-2.5 rounded-xl space-y-1"
                        style={{ background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.25)" }}>
                        {planResult.projectedTargetDate && planResult.projectedWeeklyLossKg !== null && (
                          <p className="text-[12px] font-semibold" style={{ color: "var(--fiber)" }}>
                            📅 {formatDate(new Date(planResult.projectedTargetDate + "T00:00:00"), "d MMM yyyy")}
                            {" · "}{planResult.projectedWeeklyLossKg > 0 ? "+" : ""}{planResult.projectedWeeklyLossKg?.toFixed(2)} kg/sem
                          </p>
                        )}
                        {planResult.projectedNote && (
                          <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>{planResult.projectedNote}</p>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* ── Calories & Macros ── */}
              <div>
                <button className="w-full flex items-center justify-between mb-2"
                  onClick={() => setMacroOpen(o => !o)}>
                  <p className="label-xs flex items-center gap-1.5">
                    <IconHeartbeat size={11} />
                    Calories & Macros
                  </p>
                  <div className="flex items-center gap-2">
                    {!macroOpen && (
                      <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                        <span className="font-bold tabular-nums" style={{ color: "var(--calories)" }}>{calories}</span>
                        <span> kcal · </span>
                        <span style={{ color: "var(--protein)" }}>{protein}g P</span>
                        <span> · </span>
                        <span style={{ color: "var(--carbs)" }}>{carbs}g G</span>
                        <span> · </span>
                        <span style={{ color: "var(--fat)" }}>{fat}g L</span>
                      </span>
                    )}
                    {macroOpen
                      ? <IconChevronUp size={12} style={{ color: "var(--text-muted)" }} />
                      : <IconChevronDown size={12} style={{ color: "var(--text-muted)" }} />}
                  </div>
                </button>
                <AnimatePresence initial={false}>
                  {macroOpen && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} style={{ overflow: "hidden" }}>
                      <div className="space-y-4 pt-1">
                        <SliderField label="Calories" unit=" kcal" value={calories} min={800} max={4000} step={50}
                          color="var(--calories)" onChange={setCalories} />
                        <SliderField label="Protéines" unit="g" value={protein} min={30} max={300} step={5}
                          color="var(--protein)" onChange={setProtein} />
                        <SliderField label="Glucides" unit="g" value={carbs} min={50} max={600} step={5}
                          color="var(--carbs)" onChange={setCarbs} />
                        <SliderField label="Lipides" unit="g" value={fat} min={20} max={200} step={5}
                          color="var(--fat)" onChange={setFat} />
                        <SliderField label="Fibres" unit="g" value={fiber} min={10} max={60} step={1}
                          color="var(--fiber)" onChange={setFiber} />
                        <SliderField label="Eau" unit=" ml" value={water} min={500} max={5000} step={250}
                          color="var(--fit-indigo)" onChange={setWater} />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* ── Steps & Sleep ── */}
              <div>
                <p className="label-xs mb-4 flex items-center gap-1.5">
                  <IconShoe size={11} />
                  Activité & Récupération
                </p>
                <div className="space-y-4">
                  <SliderField label="Objectif pas" unit=" pas" value={steps} min={2000} max={20000} step={500}
                    color="var(--steps)" onChange={setSteps} />
                  <SliderField label="Objectif sommeil" unit="h" value={sleep} min={4} max={12} step={0.5}
                    color="var(--fit-indigo)" onChange={setSleep} />

                  {/* Deduct burned calories toggle */}
                  <div className="flex items-center justify-between py-1">
                    <div>
                      <p className="text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>
                        Soustraire les calories brûlées
                      </p>
                      <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                        {deductBurned
                          ? "Budget = Objectif + activité — Budget net affiché"
                          : "Budget = Objectif uniquement — Calories brûlées affichées en info"}
                      </p>
                    </div>
                    <button
                      onClick={() => setDeductBurned(v => !v)}
                      className="relative flex-shrink-0 w-11 h-6 rounded-full transition-colors duration-200"
                      style={{ background: deductBurned ? "var(--fit-green, var(--fiber))" : "rgba(255,255,255,0.12)" }}
                    >
                      <span
                        className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200"
                        style={{ transform: deductBurned ? "translateX(20px)" : "translateX(0)" }}
                      />
                    </button>
                  </div>

                </div>
              </div>

              {/* ── Save ── */}
              <button onClick={handleSave} disabled={saving}
                className="btn btn-primary w-full gap-2 text-[13px]" style={{ height: "40px" }}>
                {saved
                  ? <><IconCircleCheck size={14} /> Sauvegardé</>
                  : saving
                    ? <><IconLoader2 size={12} className="animate-spin" /> Sauvegarde…</>
                    : <><IconDeviceFloppy size={14} /> Sauvegarder les objectifs</>
                }
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Confirmation dialog : changement de plan ── */}
      <AnimatePresence>
        {confirmPlanChange && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center px-4"
            style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
            onClick={() => setConfirmPlanChange(false)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 8 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 8 }}
              transition={{ duration: 0.2 }}
              className="rounded-2xl p-5 max-w-xs w-full space-y-4"
              style={{ background: "var(--glass-bg)", border: "1px solid var(--border-strong)" }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(239,68,68,0.12)" }}>
                  <IconAlertCircle size={20} style={{ color: "var(--danger)" }} />
                </div>
                <div>
                  <p className="font-semibold text-[14px]" style={{ color: "var(--text-primary)" }}>
                    Changer de plan ?
                  </p>
                  <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                    Un plan est déjà actif
                  </p>
                </div>
              </div>
              <p className="text-[12px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                Démarrer un nouveau plan réinitialisera le suivi de progression et les objectifs associés. Cette action ne peut pas être annulée.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmPlanChange(false)}
                  className="flex-1 btn text-[12px]"
                  style={{
                    height: "36px",
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid var(--border)",
                    color: "var(--text-muted)",
                  }}>
                  Annuler
                </button>
                <button
                  onClick={doStartPlan}
                  className="flex-1 btn text-[12px]"
                  style={{
                    height: "36px",
                    background: "rgba(239,68,68,0.15)",
                    border: "1px solid rgba(239,68,68,0.4)",
                    color: "var(--danger)",
                  }}>
                  Confirmer
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Alcool Panel ────────────────────────────────────────────────────────────
