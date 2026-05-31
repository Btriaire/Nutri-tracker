"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  IconPlus, IconTrash, IconClock, IconBolt, IconHeart, IconMoon, IconShoe, IconFlame,
  IconBookmark, IconX, IconCheck, IconLoader2, IconCamera,
} from "@tabler/icons-react";
import type { FitnessDay, ManualActivity, NutritionGoals } from "@/app/lib/types";
import AIInsightBox from "@/app/components/AIInsightBox";
import type { WorkoutTemplate } from "@/app/api/workout-templates/route";
import SportSearchModal from "@/app/components/SportSearchModal";
import type { ExerciseEntry } from "@/app/lib/exercise-catalog";

const ACTIVITY_OPTIONS = [
  { type: 0,   emoji: "🏅", label: "Activité libre" },
  { type: 1,   emoji: "🏃", label: "Course à pied" },
  { type: 7,   emoji: "🚴", label: "Vélo" },
  { type: 17,  emoji: "🏋️", label: "Musculation" },
  { type: 46,  emoji: "🚶", label: "Marche" },
  { type: 93,  emoji: "🏊", label: "Natation" },
  { type: 82,  emoji: "🧘", label: "Yoga" },
  { type: 9,   emoji: "💪", label: "Aérobic / HIIT" },
  { type: 83,  emoji: "💃", label: "Danse" },
  { type: 45,  emoji: "⚽", label: "Football" },
  { type: 54,  emoji: "🎾", label: "Tennis" },
  { type: 104, emoji: "🥊", label: "Boxe" },
];

const MET: Record<number, number> = {
  0: 5, 1: 9, 7: 7, 17: 6, 46: 3.5, 93: 8, 82: 3, 9: 8, 83: 5, 45: 7, 54: 6, 104: 9,
};

const MUSCU_TYPES = new Set([17, 60]);
function isMuscu(type: number) { return MUSCU_TYPES.has(type); }

function estimateCalories(type: number, durationMin: number, weightKg = 75): number {
  const met = MET[type] ?? 5;
  return Math.round((met * weightKg * durationMin) / 60);
}

function estimateMusculationCalories(sets: string, reps: string, weightKg: string): number {
  const s = parseInt(sets) || 3;
  const r = parseInt(reps) || 10;
  const w = parseFloat(weightKg) || 10;
  return Math.round(s * r * w * 0.04 + s * 2.5 * 4);
}

function musculationDuration(sets: string): number {
  return Math.max(5, (parseInt(sets) || 3) * 2.5);
}

function activityEmoji(type: number): string {
  return ACTIVITY_OPTIONS.find((a) => a.type === type)?.emoji ?? "🏅";
}

interface Props {
  date:                    string;
  fitnessDay:              FitnessDay | null;
  initialManualActivities: unknown[];
  goals?:                  NutritionGoals;
}

// ─── Shared activity form state ───────────────────────────────────────────────

interface FormState {
  actType:        number;
  duration:       string;
  customName:     string;
  calories:       string;
  // Musculation-specific
  sets:           string;
  reps:           string;
  weightKg:       string;
  variableWeight: boolean;
  weightPerSet:   string[];
}

const EMPTY_FORM: FormState = {
  actType:        0,
  duration:       "30",
  customName:     "",
  calories:       "",
  sets:           "3",
  reps:           "10",
  weightKg:       "",
  variableWeight: false,
  weightPerSet:   [],
};

export default function ActivityClient({ date, fitnessDay, initialManualActivities, goals }: Props) {
  const today = format(new Date(date + "T12:00:00"), "EEEE d MMMM", { locale: fr });
  const gf    = fitnessDay?.googleFit;

  // Weight for MET calculations — prefer Withings measurement, fallback to goals, then 75kg
  const userWeightKg = fitnessDay?.withings?.weightKg ?? goals?.currentWeightKg ?? 75;

  const [activities,  setActivities]  = useState<ManualActivity[]>(initialManualActivities as ManualActivity[]);
  const [templates,   setTemplates]   = useState<WorkoutTemplate[]>([]);
  const [loadingTpl,  setLoadingTpl]  = useState(true);

  // ── Log form
  const [showForm,  setShowForm]  = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [form,      setForm]      = useState<FormState>(EMPTY_FORM);

  // ── Template creation form
  const [showTplForm,     setShowTplForm]     = useState(false);
  const [savingTpl,       setSavingTpl]       = useState(false);
  const [savedTpl,        setSavedTpl]        = useState(false);
  const [tplForm,         setTplForm]         = useState<FormState & { notes: string }>(
    { ...EMPTY_FORM, notes: "" }
  );
  const [tplPhotoDataUrl, setTplPhotoDataUrl] = useState<string | undefined>(undefined);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // ── Sport search modal
  const [showSportSearch, setShowSportSearch] = useState(false);

  // ── Template photo editing
  const tplPhotoEditRef  = useRef<HTMLInputElement>(null);
  const [editingTplId,   setEditingTplId]   = useState<string | null>(null);

  // Load templates on mount
  useEffect(() => {
    fetch("/api/workout-templates")
      .then((r) => r.json())
      .then((d: { templates: WorkoutTemplate[] }) => setTemplates(d.templates ?? []))
      .catch(() => {})
      .finally(() => setLoadingTpl(false));
  }, []);

  // ── Form helpers
  const updateFormDuration = (val: string, f: FormState, setF: (v: FormState) => void) => {
    const d = parseInt(val, 10);
    setF({ ...f, duration: val, calories: d > 0 ? String(estimateCalories(f.actType, d, userWeightKg)) : f.calories });
  };
  const updateFormType = (type: number, f: FormState, setF: (v: FormState) => void) => {
    const d = parseInt(f.duration, 10);
    if (isMuscu(type)) {
      const kcal = estimateMusculationCalories(f.sets, f.reps, f.weightKg);
      setF({ ...f, actType: type, calories: String(kcal) });
    } else {
      setF({ ...f, actType: type, calories: d > 0 ? String(estimateCalories(type, d, userWeightKg)) : f.calories });
    }
  };

  // ── Musculation field helpers
  const updateMusculationCalories = (f: FormState): FormState => {
    if (!isMuscu(f.actType)) return f;
    return { ...f, calories: String(estimateMusculationCalories(f.sets, f.reps, f.weightKg)) };
  };

  // ── Photo upload for template
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const src = ev.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width  = 72;
        canvas.height = 72;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        // Crop to square then draw at 72x72
        const minDim = Math.min(img.width, img.height);
        const sx = (img.width  - minDim) / 2;
        const sy = (img.height - minDim) / 2;
        ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, 72, 72);
        setTplPhotoDataUrl(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  };

  // ── Log activity
  const handleSave = async () => {
    const muscu = isMuscu(form.actType);
    if (!muscu && (!form.duration || parseInt(form.duration, 10) < 1)) return;
    if (muscu && (!form.sets || parseInt(form.sets) < 1)) return;

    setSaving(true);
    setSaveError(false);
    try {
      const durationMin = muscu
        ? musculationDuration(form.sets)
        : parseInt(form.duration, 10);

      const body: Record<string, unknown> = {
        date,
        name:           form.customName.trim() || undefined,
        activityType:   form.actType,
        durationMin,
        caloriesBurned: form.calories ? parseInt(form.calories, 10) : null,
      };

      if (muscu) {
        body.sets  = parseInt(form.sets)  || 3;
        body.reps  = parseInt(form.reps)  || 10;
        body.weightKg = parseFloat(form.weightKg) || null;
        if (form.variableWeight && form.weightPerSet.length > 0) {
          body.weightPerSet = form.weightPerSet.map((v) => parseFloat(v) || 0);
        }
      }

      const res  = await fetch("/api/activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) { setSaveError(true); return; }
      const json = await res.json() as { activity?: ManualActivity };
      if (json.activity) {
        setActivities((prev) => [json.activity!, ...prev]);
        setShowForm(false);
        setForm(EMPTY_FORM);
      } else {
        setSaveError(true);
      }
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  };

  // ── Delete activity
  const handleDelete = async (id: string) => {
    await fetch(`/api/activity/${id}`, { method: "DELETE" });
    setActivities((prev) => prev.filter((a) => a.id !== id));
  };

  // ── Save template
  const handleSaveTemplate = async () => {
    if (!tplForm.customName.trim()) return;
    const muscu = isMuscu(tplForm.actType);
    if (!muscu && !tplForm.duration) return;

    setSavingTpl(true);
    try {
      const durationMin = muscu
        ? musculationDuration(tplForm.sets)
        : parseInt(tplForm.duration, 10);

      const res  = await fetch("/api/workout-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:               tplForm.customName.trim(),
          activityType:       tplForm.actType,
          defaultDurationMin: durationMin,
          defaultCalories:    tplForm.calories ? parseInt(tplForm.calories, 10) : null,
          notes:              tplForm.notes.trim() || undefined,
          photoDataUrl:       tplPhotoDataUrl,
        }),
      });
      const json = await res.json() as { template?: WorkoutTemplate };
      if (json.template) setTemplates((prev) => [json.template!, ...prev]);
      setSavedTpl(true);
      setTimeout(() => {
        setSavedTpl(false);
        setShowTplForm(false);
        setTplForm({ ...EMPTY_FORM, notes: "" });
        setTplPhotoDataUrl(undefined);
      }, 900);
    } catch { /* ignore */ }
    finally { setSavingTpl(false); }
  };

  // ── Delete template
  const handleDeleteTemplate = async (id: string) => {
    await fetch(`/api/workout-templates/${id}`, { method: "DELETE" });
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  };

  // ── Launch template → save directly (no extra click needed)
  const launchTemplate = async (tpl: WorkoutTemplate) => {
    setSaving(true);
    setSaveError(false);
    try {
      const res = await fetch("/api/activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          name:           tpl.name,
          activityType:   tpl.activityType,
          durationMin:    tpl.defaultDurationMin,
          caloriesBurned: tpl.defaultCalories ?? null,
        }),
      });
      if (!res.ok) { setSaveError(true); return; }
      const json = await res.json() as { activity?: ManualActivity };
      if (json.activity) {
        setActivities((prev) => [json.activity!, ...prev]);
      } else {
        setSaveError(true);
      }
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  };

  // ── Sport search: select exercise — direct save for standard activities,
  //    form pre-fill for musculation (needs sets/reps/weight)
  const handleSportSelect = async (exercise: ExerciseEntry) => {
    if (isMuscu(exercise.activityType)) {
      // Musculation → pre-fill form so user can enter sets/reps/weight
      const kcal = estimateMusculationCalories(EMPTY_FORM.sets, EMPTY_FORM.reps, "");
      setForm((prev) => ({
        ...prev,
        actType:    exercise.activityType,
        customName: exercise.name,
        calories:   String(kcal),
      }));
      setShowForm(true);
      return;
    }
    // Non-musculation → save directly with 30 min default
    const durationMin = 30;
    const caloriesBurned = Math.round(exercise.met * userWeightKg * durationMin / 60);
    setSaving(true);
    setSaveError(false);
    try {
      const res = await fetch("/api/activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          name:           exercise.name,
          activityType:   exercise.activityType,
          durationMin,
          caloriesBurned,
        }),
      });
      if (!res.ok) { setSaveError(true); return; }
      const json = await res.json() as { activity?: ManualActivity };
      if (json.activity) {
        setActivities((prev) => [json.activity!, ...prev]);
      } else {
        setSaveError(true);
      }
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  };

  // ── Sport search: "customize" — always pre-fills the form
  const handleSportCustomize = (exercise: ExerciseEntry) => {
    const durationMin = parseInt(form.duration) || 30;
    const kcal = isMuscu(exercise.activityType)
      ? estimateMusculationCalories(EMPTY_FORM.sets, EMPTY_FORM.reps, "")
      : Math.round(exercise.met * userWeightKg * durationMin / 60);
    setForm((prev) => ({
      ...prev,
      actType:    exercise.activityType,
      customName: exercise.name,
      calories:   String(kcal),
    }));
    setShowForm(true);
  };

  // ── Template photo editing
  const handleTplPhotoEdit = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingTplId) return;
    e.target.value = "";
    const reader = new FileReader();
    reader.onload = (ev) => {
      const src = ev.target?.result as string;
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 72;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const minDim = Math.min(img.width, img.height);
        const sx = (img.width  - minDim) / 2;
        const sy = (img.height - minDim) / 2;
        ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, 72, 72);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
        // PATCH template
        await fetch(`/api/workout-templates/${editingTplId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ photoDataUrl: dataUrl }),
        });
        setTemplates((prev) => prev.map((t) =>
          t.id === editingTplId ? { ...t, photoDataUrl: dataUrl } : t
        ));
        setEditingTplId(null);
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  };

  // ── Sport search: save as template
  const handleSportSave = async (exercise: ExerciseEntry) => {
    try {
      const res = await fetch("/api/workout-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:               exercise.name,
          activityType:       exercise.activityType,
          defaultDurationMin: 30,
          defaultCalories:    exercise.kcalPer30min75kg,
          notes:              exercise.muscles?.join(", ") || undefined,
        }),
      });
      const json = await res.json() as { template?: WorkoutTemplate };
      if (json.template) setTemplates((prev) => [json.template!, ...prev]);
    } catch { /* ignore */ }
  };

  const totalBurned = [
    gf?.activeCaloriesBurned ?? 0,
    ...activities.map((a) => a.caloriesBurned ?? 0),
  ].reduce((s, v) => s + v, 0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const activityInsightData = useMemo(() => ({
    sessions: (fitnessDay?.googleFit?.sessions ?? []).map((s) => ({
      name:        s.name,
      durationMin: s.durationMin,
      calories:    s.calories,
    })),
    manualActivities: activities.map((a) => ({
      name:           a.name,
      durationMin:    a.durationMin,
      caloriesBurned: a.caloriesBurned,
    })),
    steps:         fitnessDay?.googleFit?.steps        ?? null,
    activeMinutes: fitnessDay?.googleFit?.activeMinutes ?? null,
    burned:        totalBurned || null,
    stepsGoal:     goals?.stepsGoal ?? 10000,
    activityPlan:  goals?.activityPlan
      ? { sessionsPerWeek: goals.activityPlan.sessionsPerWeek, weeklyKcalBurned: goals.activityPlan.weeklyKcalBurned }
      : undefined,
  }), [activities.length, totalBurned, fitnessDay]);

  return (
    <div className="relative min-h-screen" style={{ paddingBottom: "80px" }}>
      <div className="bg-orbs" />
      <div className="relative z-10 max-w-md mx-auto px-4 py-6 md:ml-[220px]">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
          className="flex items-start justify-between mb-5"
        >
          <div>
            <p className="label-xs mb-0.5 capitalize">{today}</p>
            <h1 className="text-[22px] font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
              Activité sportive
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSportSearch(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-medium transition-all"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid var(--border)",
                color: "var(--text-secondary)",
              }}
            >
              🔍 Sport
            </button>
            <button onClick={() => setShowForm((x) => !x)} className="btn btn-primary gap-2 px-3 py-2 text-[13px]">
              <IconPlus size={14} /> Ajouter
            </button>
          </div>
        </motion.div>

        {/* Summary row */}
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.05 }}
          className="grid grid-cols-4 gap-2 mb-5"
        >
          {[
            { icon: IconShoe,   label: "Pas",         value: gf?.steps ? gf.steps.toLocaleString("fr-FR") : "—", color: "var(--steps)" },
            { icon: IconFlame,  label: "Kcal brûlées", value: totalBurned || "—",                                   color: "var(--fit-red)" },
            { icon: IconBolt,   label: "Min. actives", value: gf?.activeMinutes ?? "—",                              color: "var(--fit-green)" },
            { icon: IconHeart,  label: "FC moy.",       value: gf?.heartRateAvg ? `${gf.heartRateAvg} bpm` : "—",  color: "var(--fit-red)" },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="card flex flex-col gap-1 items-center text-center p-2">
              <Icon size={18} style={{ color }} />
              <span className="text-[14px] font-bold tabular-nums" style={{ color }}>{value}</span>
              <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>{label}</span>
            </div>
          ))}
        </motion.div>

        {/* ── AI Insight ── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.08 }}
          className="mb-5"
        >
          <AIInsightBox type="activity" data={activityInsightData} delay={800} />
        </motion.div>

        {/* ── Log form ────────────────────────────────────────────────────────── */}
        <AnimatePresence>
          {showForm && (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.22 }}
              className="glass p-5 mb-5"
            >
              <div className="flex items-center justify-between mb-4">
                <p className="label-xs">Nouvelle activité</p>
                <button onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }}
                  className="p-1.5 rounded-lg" style={{ background: "rgba(255,255,255,0.06)" }}>
                  <IconX size={13} style={{ color: "var(--text-muted)" }} />
                </button>
              </div>

              <ActivityFormBody
                form={form}
                onChange={setForm}
                onDurationChange={(v) => updateFormDuration(v, form, setForm)}
                onTypeChange={(t) => updateFormType(t, form, setForm)}
                onMusculationChange={(f) => setForm(updateMusculationCalories(f))}
                onSportSearch={() => setShowSportSearch(true)}
              />

              {saveError && (
                <p className="text-[12px] mt-2 text-center" style={{ color: "#f87171" }}>
                  Erreur lors de la sauvegarde — réessaye
                </p>
              )}
              <div className="flex gap-3 mt-3">
                <button onClick={() => { setShowForm(false); setForm(EMPTY_FORM); setSaveError(false); }} className="flex-1 btn btn-ghost">Annuler</button>
                <button
                  onClick={handleSave}
                  disabled={saving || (!isMuscu(form.actType) && !form.duration)}
                  className="flex-1 btn btn-primary gap-2"
                >
                  {saving ? <><IconLoader2 size={13} className="animate-spin" /> Sauvegarde…</> : <><IconCheck size={13} />Ajouter</>}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Séances types ───────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.07 }}
          className="glass p-4 mb-4"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <IconBookmark size={15} style={{ color: "var(--protein)" }} />
              <p className="label-xs">Séances types</p>
            </div>
            <button
              onClick={() => setShowTplForm((x) => !x)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all"
              style={{
                background: showTplForm ? "rgba(167,139,250,0.12)" : "rgba(255,255,255,0.05)",
                border:     `1px solid ${showTplForm ? "rgba(167,139,250,0.4)" : "var(--border)"}`,
                color:      showTplForm ? "var(--protein)" : "var(--text-secondary)",
              }}>
              <IconPlus size={11} />
              Créer
            </button>
          </div>

          {/* Template creation form */}
          <AnimatePresence>
            {showTplForm && (
              <motion.div
                key="tpl-form"
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.22 }}
                style={{ overflow: "hidden" }}
              >
                <div className="pt-2 pb-4 space-y-3" style={{ borderBottom: "1px solid var(--border)" }}>
                  <p className="text-[11px] font-semibold" style={{ color: "var(--protein)" }}>
                    Nouvelle séance type
                  </p>

                  <ActivityFormBody
                    form={tplForm}
                    onChange={(v) => setTplForm((p) => ({ ...p, ...v }))}
                    onDurationChange={(v) => updateFormDuration(v, tplForm, (f) => setTplForm({ ...tplForm, ...f }))}
                    onTypeChange={(t) => updateFormType(t, tplForm, (f) => setTplForm({ ...tplForm, ...f }))}
                    onMusculationChange={(f) => setTplForm((p) => ({ ...p, ...updateMusculationCalories(f) }))}
                    namePlaceholder="Nom de la séance (requis)"
                    nameRequired
                    onSportSearch={() => setShowSportSearch(true)}
                  />

                  {/* Name + Photo row */}
                  <div className="flex items-center gap-2">
                    <input
                      value={tplForm.notes}
                      onChange={(e) => setTplForm((p) => ({ ...p, notes: e.target.value }))}
                      placeholder="Notes (optionnel)"
                      className="input text-[12px] flex-1"
                    />
                    {/* Photo button */}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      ref={photoInputRef}
                      className="hidden"
                    />
                    <button
                      onClick={() => photoInputRef.current?.click()}
                      className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all overflow-hidden"
                      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--border)" }}
                      type="button"
                      title="Ajouter une photo"
                    >
                      {tplPhotoDataUrl ? (
                        <img src={tplPhotoDataUrl} className="w-8 h-8 rounded-full object-cover" alt="" />
                      ) : (
                        <IconCamera size={16} style={{ color: "var(--text-muted)" }} />
                      )}
                    </button>
                  </div>

                  <div className="flex gap-2">
                    <button onClick={() => { setShowTplForm(false); setTplForm({ ...EMPTY_FORM, notes: "" }); setTplPhotoDataUrl(undefined); }}
                      className="flex-1 btn btn-ghost text-[12px]">Annuler</button>
                    <button
                      onClick={handleSaveTemplate}
                      disabled={savingTpl || savedTpl || !tplForm.customName.trim()}
                      className="flex-1 btn btn-primary gap-1.5 text-[12px]"
                    >
                      {savedTpl   ? <><IconCheck size={12} /> Sauvegardé !</>
                       : savingTpl ? <><IconLoader2 size={12} className="animate-spin" /> …</>
                       : <><IconBookmark size={12} /> Sauvegarder</>}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Template list */}
          {loadingTpl ? (
            <div className="flex justify-center py-4">
              <IconLoader2 size={16} className="animate-spin" style={{ color: "var(--text-muted)" }} />
            </div>
          ) : templates.length === 0 ? (
            <p className="text-[12px] py-3 text-center" style={{ color: "var(--text-muted)" }}>
              Aucune séance type — créez-en une pour accélérer vos saisies
            </p>
          ) : (
            <div className="space-y-2">
              {templates.map((tpl) => (
                <div key={tpl.id} className="flex items-center gap-3 py-2"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  {/* Photo thumbnail — clickable to change photo */}
                  <button
                    type="button"
                    onClick={() => { setEditingTplId(tpl.id); tplPhotoEditRef.current?.click(); }}
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0 overflow-hidden relative group"
                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)" }}
                    title="Changer la photo"
                  >
                    {tpl.photoDataUrl
                      ? <img src={tpl.photoDataUrl} className="w-9 h-9 object-cover" alt="" />
                      : activityEmoji(tpl.activityType)
                    }
                    {/* Camera overlay on hover */}
                    <div className="absolute inset-0 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ background: "rgba(0,0,0,0.5)" }}>
                      <IconCamera size={12} style={{ color: "white" }} />
                    </div>
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium truncate" style={{ color: "var(--text-primary)" }}>
                      {tpl.name}
                    </p>
                    <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                      {tpl.defaultDurationMin} min
                      {tpl.defaultCalories ? ` · ${tpl.defaultCalories} kcal` : ""}
                      {tpl.notes ? ` · ${tpl.notes}` : ""}
                    </p>
                  </div>
                  <button
                    onClick={() => launchTemplate(tpl)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold flex-shrink-0 transition-all active:scale-95"
                    style={{ background: "rgba(167,139,250,0.15)", border: "1px solid rgba(167,139,250,0.4)", color: "var(--protein)" }}
                    disabled={saving}>
                    {saving ? <IconLoader2 size={11} className="animate-spin" /> : <IconCheck size={12} />}
                    Enregistrer
                  </button>
                  <button onClick={() => handleDeleteTemplate(tpl.id)}
                    className="btn-icon w-7 h-7 flex-shrink-0" style={{ color: "var(--text-muted)" }}>
                    <IconTrash size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Google Fit sessions */}
        {(gf?.sessions?.length ?? 0) > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.08 }}
            className="glass p-4 mb-4"
          >
            <p className="label-xs mb-3">Séances Google Fit</p>
            <div className="space-y-2">
              {gf?.sessions?.map((s) => (
                <div key={s.id} className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)" }}>
                    {activityEmoji(s.activityType)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium truncate" style={{ color: "var(--text-primary)" }}>{s.name}</p>
                    <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                      {new Date(s.startMs).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-0.5">
                    <div className="flex items-center gap-1">
                      <IconClock size={12} style={{ color: "var(--text-muted)" }} />
                      <span className="text-[12px] tabular-nums" style={{ color: "var(--text-secondary)" }}>{s.durationMin} min</span>
                    </div>
                    {s.calories != null && s.calories > 0 && (
                      <div className="flex items-center gap-1">
                        <IconFlame size={11} style={{ color: "var(--fit-red, #f87171)" }} />
                        <span className="text-[11px] font-semibold tabular-nums" style={{ color: "var(--fit-red, #f87171)" }}>
                          {Math.round(s.calories)} kcal
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Manual activities */}
        {activities.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.1 }}
            className="glass p-4 mb-4"
          >
            <p className="label-xs mb-3">Activités du jour</p>
            <div className="space-y-2">
              <AnimatePresence>
                {activities.map((a) => (
                  <motion.div key={a.id}
                    initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}
                    className="flex items-center gap-3"
                  >
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)" }}>
                      {activityEmoji(a.activityType)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium truncate" style={{ color: "var(--text-primary)" }}>{a.name}</p>
                      <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                        {a.sets ? `${a.sets}×${a.reps ?? "?"} reps${a.weightKg ? ` · ${a.weightKg}kg` : ""}` : `${a.durationMin} min`}
                        {a.caloriesBurned ? ` · ${a.caloriesBurned} kcal` : ""}
                      </p>
                    </div>
                    <button onClick={() => handleDelete(a.id)} className="btn-icon w-7 h-7 flex-shrink-0"
                      style={{ color: "#f87171" }}>
                      <IconTrash size={12} />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </motion.div>
        )}

        {/* Sleep */}
        {gf?.sleepMinutes && (
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.12 }}
            className="card flex items-center gap-3 mb-4"
          >
            <IconMoon size={16} style={{ color: "#818cf8" }} />
            <div>
              <p className="text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>
                {Math.floor(gf.sleepMinutes / 60)}h{String(gf.sleepMinutes % 60).padStart(2, "0")} de sommeil
              </p>
              <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                {gf.sleepMinutes >= 420 ? "✓ Bonne récupération" : "⚠ Sommeil insuffisant"}
              </p>
            </div>
          </motion.div>
        )}

        {!gf && activities.length === 0 && !showForm && (
          <div className="flex flex-col items-center gap-3 py-12">
            <span className="text-5xl">🏃</span>
            <p className="text-[14px] font-medium" style={{ color: "var(--text-secondary)" }}>Aucune activité aujourd'hui</p>
            <p className="text-[12px] text-center" style={{ color: "var(--text-muted)" }}>
              Lancez une séance type ou ajoutez manuellement.
            </p>
          </div>
        )}
      </div>

      {/* Sport Search Modal */}
      <SportSearchModal
        open={showSportSearch}
        onClose={() => setShowSportSearch(false)}
        onSelect={handleSportSelect}
        onCustomize={handleSportCustomize}
        onSave={handleSportSave}
      />

      {/* Hidden input for template photo editing */}
      <input
        type="file"
        accept="image/*"
        ref={tplPhotoEditRef}
        className="hidden"
        onChange={handleTplPhotoEdit}
      />
    </div>
  );
}

// ─── Shared form body ─────────────────────────────────────────────────────────

function ActivityFormBody({
  form, onChange, onDurationChange, onTypeChange, onMusculationChange,
  namePlaceholder, nameRequired, onSportSearch,
}: {
  form:                 FormState;
  onChange:             (v: FormState) => void;
  onDurationChange:     (v: string) => void;
  onTypeChange:         (t: number) => void;
  onMusculationChange?: (f: FormState) => void;
  namePlaceholder?:     string;
  nameRequired?:        boolean;
  onSportSearch?:       () => void;
}) {
  const selectedOpt = ACTIVITY_OPTIONS.find((a) => a.type === form.actType) ?? ACTIVITY_OPTIONS[0];
  const muscu = isMuscu(form.actType);

  // Sync weightPerSet array length to sets count
  const setsCount = Math.min(20, Math.max(1, parseInt(form.sets) || 3));

  const handleSetsStep = (delta: number) => {
    const next = Math.min(20, Math.max(1, (parseInt(form.sets) || 3) + delta));
    const nextStr = String(next);
    // Update weightPerSet array size
    const newWPS = Array.from({ length: next }, (_, i) => form.weightPerSet[i] ?? form.weightKg ?? "");
    const updated = { ...form, sets: nextStr, weightPerSet: newWPS };
    onMusculationChange ? onMusculationChange(updated) : onChange(updated);
  };

  const handleRepsStep = (delta: number) => {
    const next = Math.min(50, Math.max(1, (parseInt(form.reps) || 10) + delta));
    const updated = { ...form, reps: String(next) };
    onMusculationChange ? onMusculationChange(updated) : onChange(updated);
  };

  const handleWeightChange = (val: string) => {
    const updated = { ...form, weightKg: val };
    onMusculationChange ? onMusculationChange(updated) : onChange(updated);
  };

  const handleWeightPerSetChange = (idx: number, val: string) => {
    const newWPS = [...form.weightPerSet];
    newWPS[idx] = val;
    const updated = { ...form, weightPerSet: newWPS };
    onMusculationChange ? onMusculationChange(updated) : onChange(updated);
  };

  const toggleVariableWeight = () => {
    const next = !form.variableWeight;
    let newWPS = form.weightPerSet;
    if (next && newWPS.length !== setsCount) {
      newWPS = Array.from({ length: setsCount }, (_, i) => form.weightPerSet[i] ?? form.weightKg ?? "");
    }
    const updated = { ...form, variableWeight: next, weightPerSet: newWPS };
    onChange(updated);
  };

  return (
    <>
      {/* NutriTrack-Sport button */}
      {onSportSearch && (
        <button
          type="button"
          onClick={onSportSearch}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-medium mb-3 transition-all"
          style={{
            background: "rgba(167,139,250,0.10)",
            border: "1px solid rgba(167,139,250,0.35)",
            color: "var(--protein)",
          }}
        >
          🔍 NutriTrack-Sport — parcourir les exercices
        </button>
      )}

      {/* Activity grid */}
      <div className="grid grid-cols-4 gap-2 mb-3">
        {ACTIVITY_OPTIONS.map((opt) => (
          <button key={opt.type} onClick={() => onTypeChange(opt.type)}
            className="flex flex-col items-center gap-1 p-2 rounded-xl text-center transition-all"
            style={{
              background: form.actType === opt.type ? "rgba(167,139,250,0.12)" : "rgba(255,255,255,0.03)",
              border: `1px solid ${form.actType === opt.type ? "rgba(167,139,250,0.5)" : "var(--border)"}`,
            }}>
            <span className="text-[18px]">{opt.emoji}</span>
            <span className="text-[9px] leading-tight" style={{ color: form.actType === opt.type ? "var(--protein)" : "var(--text-muted)" }}>
              {opt.label.split(" ")[0]}
            </span>
          </button>
        ))}
      </div>

      {/* Name */}
      <input
        value={form.customName}
        onChange={(e) => onChange({ ...form, customName: e.target.value })}
        placeholder={namePlaceholder ?? `Nom (optionnel, ex: "${selectedOpt.label}")`}
        className="input text-[13px] mb-3"
      />

      {/* Musculation fields OR duration + calories */}
      {muscu ? (
        <div className="space-y-3">
          {/* Séries + Reps */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-xs block mb-1.5">Séries</label>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => handleSetsStep(-1)}
                  className="btn-icon w-8 h-8 text-base">−</button>
                <input
                  type="number"
                  value={form.sets}
                  onChange={(e) => {
                    const n = Math.min(20, Math.max(1, parseInt(e.target.value) || 1));
                    const newWPS = Array.from({ length: n }, (_, i) => form.weightPerSet[i] ?? form.weightKg ?? "");
                    const updated = { ...form, sets: String(n), weightPerSet: newWPS };
                    onMusculationChange ? onMusculationChange(updated) : onChange(updated);
                  }}
                  className="input text-center w-14 tabular-nums" min="1" max="20"
                />
                <button type="button" onClick={() => handleSetsStep(+1)}
                  className="btn-icon w-8 h-8 text-base">+</button>
              </div>
            </div>
            <div>
              <label className="label-xs block mb-1.5">Reps</label>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => handleRepsStep(-1)}
                  className="btn-icon w-8 h-8 text-base">−</button>
                <input
                  type="number"
                  value={form.reps}
                  onChange={(e) => {
                    const n = Math.min(50, Math.max(1, parseInt(e.target.value) || 1));
                    const updated = { ...form, reps: String(n) };
                    onMusculationChange ? onMusculationChange(updated) : onChange(updated);
                  }}
                  className="input text-center w-14 tabular-nums" min="1" max="50"
                />
                <button type="button" onClick={() => handleRepsStep(+1)}
                  className="btn-icon w-8 h-8 text-base">+</button>
              </div>
            </div>
          </div>

          {/* Poids + variable toggle + Kcal */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-xs block mb-1.5">Poids (kg)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={form.weightKg}
                  onChange={(e) => handleWeightChange(e.target.value)}
                  placeholder="Poids corps"
                  className="input flex-1 text-center tabular-nums"
                  min="0"
                  step="0.5"
                />
                <button
                  type="button"
                  onClick={toggleVariableWeight}
                  className="flex-shrink-0 px-2 py-1.5 rounded-lg text-[10px] font-semibold transition-all"
                  title="Poids variable par série"
                  style={{
                    background: form.variableWeight ? "rgba(251,191,36,0.15)" : "rgba(255,255,255,0.06)",
                    border: `1px solid ${form.variableWeight ? "rgba(251,191,36,0.5)" : "var(--border)"}`,
                    color: form.variableWeight ? "#fbbf24" : "var(--text-muted)",
                  }}
                >
                  Var.
                </button>
              </div>
            </div>
            <div>
              <label className="label-xs block mb-1.5">Kcal brûlées</label>
              <input
                type="number"
                value={form.calories}
                onChange={(e) => onChange({ ...form, calories: e.target.value })}
                placeholder="Auto"
                className="input text-center tabular-nums"
                min="0"
              />
            </div>
          </div>

          {/* Per-set weight inputs when variable */}
          {form.variableWeight && setsCount > 0 && (
            <div>
              <label className="label-xs block mb-1.5">Poids par série (kg)</label>
              <div className="flex gap-1.5 flex-wrap">
                {Array.from({ length: setsCount }, (_, i) => (
                  <div key={i} className="flex flex-col items-center gap-0.5">
                    <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>S{i + 1}</span>
                    <input
                      type="number"
                      value={form.weightPerSet[i] ?? ""}
                      onChange={(e) => handleWeightPerSetChange(i, e.target.value)}
                      className="input text-center tabular-nums text-[12px]"
                      style={{ width: "48px", padding: "4px 6px" }}
                      min="0"
                      step="0.5"
                      placeholder="kg"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Duration + calories */
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label-xs block mb-1.5">Durée (min)</label>
            <div className="flex items-center gap-2">
              <button onClick={() => onDurationChange(String(Math.max(5, (parseInt(form.duration) || 30) - 5)))}
                className="btn-icon w-8 h-8 text-base">−</button>
              <input type="number" value={form.duration} onChange={(e) => onDurationChange(e.target.value)}
                className="input text-center w-16 tabular-nums" min="1" />
              <button onClick={() => onDurationChange(String((parseInt(form.duration) || 30) + 5))}
                className="btn-icon w-8 h-8 text-base">+</button>
            </div>
          </div>
          <div>
            <label className="label-xs block mb-1.5">Kcal brûlées</label>
            <input type="number" value={form.calories} onChange={(e) => onChange({ ...form, calories: e.target.value })}
              placeholder="Auto" className="input text-center tabular-nums" min="0" />
          </div>
        </div>
      )}
    </>
  );
}
