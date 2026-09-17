"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import type { ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format, addDays, subDays, isToday, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import {
  IconPlus, IconTrash, IconClock, IconBolt, IconHeart, IconMoon, IconShoe, IconFlame,
  IconBookmark, IconX, IconCheck, IconLoader2, IconCamera, IconPencil, IconChevronDown,
  IconMaximize, IconChevronLeft, IconChevronRight, IconMap, IconRuler, IconGauge, IconMicrophone, IconBarbell, IconTrendingUp,
} from "@tabler/icons-react";
import type { FitnessDay, ManualActivity, NutritionGoals, GoogleFitSession } from "@/app/lib/types";
import RouteMap from "@/app/components/RouteMap";
import { ACTIVITY_OPTIONS, MET, isMuscu, EMPTY_FORM } from "@/app/lib/activity-form";
import ActivityFormBody from "@/app/components/ActivityFormBody";
import ActivityHistory from "@/app/components/ActivityHistory";
import ActivitySVGIcon from "@/app/components/ActivitySVGIcon";
import MetricChip from "@/app/components/MetricChip";
import type { FormState } from "@/app/lib/activity-form";

// GPS activity types (outdoor — may have location data)
const GPS_ACTIVITY_TYPES = new Set([3, 7, 10, 19, 25, 29, 37, 39, 41, 46, 48, 49, 51, 53, 57, 63, 68, 75]);
function isGpsActivity(type: number): boolean { return GPS_ACTIVITY_TYPES.has(type); }
import AIInsightBox from "@/app/components/AIInsightBox";
import type { WorkoutTemplate } from "@/app/api/workout-templates/route";
import SportSearchModal from "@/app/components/SportSearchModal";
import VoiceActivityModal from "@/app/components/VoiceActivityModal";
import GymSessionModal from "@/app/components/GymSessionModal";
import GymProgressModal from "@/app/components/GymProgressModal";
import ActivityCategoryPicker from "@/app/components/ActivityCategoryPicker";
import ActivityDetailSheet from "@/app/components/ActivityDetailSheet";
import type { ActivitySaveData } from "@/app/components/ActivityDetailSheet";
import type { ExerciseEntry } from "@/app/lib/exercise-catalog";
import type { ActivityHistoryPoint } from "./page";


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

// ─── Activity color palette ───────────────────────────────────────────────────
function getActivityColor(type: number): string {
  const m: Record<number, string> = {
    1: "var(--calories)", 8: "var(--calories)",    // Running — orange
    7: "#3b82f6", 2: "#3b82f6",    // Cycling — blue
    17: "#a855f7", 60: "#a855f7",  // Weights — purple
    46: "#22c55e", 79: "#22c55e",  // Walking — green
    93: "#06b6d4",                  // Swimming — cyan
    82: "#ec4899",                  // Yoga — pink
    9:  "#ef4444",                  // HIIT — red
    83: "#8b5cf6",                  // Dance — violet
    45: "#16a34a",                  // Football — dark green
    54: "#eab308",                  // Tennis — yellow
    104: "#dc2626",                 // Boxing — crimson
  };
  return m[type] ?? "var(--carbs)";
}

interface Props {
  date:                    string;   // today's date (server-rendered)
  fitnessDay:              FitnessDay | null;
  initialManualActivities: unknown[];
  goals?:                  NutritionGoals;
  history?:                ActivityHistoryPoint[];
}

export default function ActivityClient({ date: initialDate, fitnessDay: initialFitnessDay, initialManualActivities, goals, history = [] }: Props) {
  // ── Date navigation state ─────────────────────────────────────────────────
  const [date,       setDate]       = useState(initialDate);
  const [fitnessDay, setFitnessDay] = useState<FitnessDay | null>(initialFitnessDay);
  const [navLoading, setNavLoading] = useState(false);

  const isOnToday = isToday(parseISO(date + "T12:00:00"));
  const dateLabel = isOnToday
    ? "Aujourd'hui"
    : format(parseISO(date + "T12:00:00"), "EEEE d MMM", { locale: fr });

  const navigate = async (newDate: string) => {
    if (newDate > initialDate) return;
    setNavLoading(true);
    setDate(newDate);
    try {
      const res  = await fetch(`/api/activity-day?date=${newDate}`);
      const data = await res.json() as { fitnessDay: FitnessDay | null; manualActivities: ManualActivity[] };
      setFitnessDay(data.fitnessDay);
      setActivities(data.manualActivities);
      setSessionEdits(
        (data.fitnessDay?.sessionEdits as Record<string, { name?: string; calories?: number | null; durationMin?: number }>) ?? {}
      );
    } catch {
      setFitnessDay(null);
      setActivities([]);
    } finally {
      setNavLoading(false);
    }
  };

  const gf = fitnessDay?.googleFit;

  // Weight for MET calculations — prefer Withings measurement, fallback to goals, then 75kg
  const userWeightKg = fitnessDay?.withings?.weightKg ?? goals?.currentWeightKg ?? 75;

  const [activities,  setActivities]  = useState<ManualActivity[]>(initialManualActivities as ManualActivity[]);
  const [templates,   setTemplates]   = useState<WorkoutTemplate[]>([]);
  const [loadingTpl,  setLoadingTpl]  = useState(true);

  // ── Log form
  const [showForm,  setShowForm]  = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [saveErrDetail, setSaveErrDetail] = useState("");
  // Global toast for background saves (NutriTrack-Sport direct, launchTemplate)
  const [toast,    setToast]    = useState<{ msg: string; ok: boolean } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = (msg: string, ok: boolean) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, ok });
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  };
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

  // ── Séances types collapsed by default
  const [showTemplates,  setShowTemplates]  = useState(false);

  // ── Sport search modal
  const [showSportSearch, setShowSportSearch] = useState(false);
  const [showVoice,       setShowVoice]       = useState(false);
  const [showGym,         setShowGym]         = useState(false);
  const [showGymProgress, setShowGymProgress] = useState(false);

  // ── Category picker favorites (localStorage)
  const [actFavorites, setActFavorites] = useState<string[]>([]);
  useEffect(() => {
    try {
      const saved = localStorage.getItem("actCatFavorites");
      if (saved) setActFavorites(JSON.parse(saved) as string[]);
    } catch { /* ignore */ }
  }, []);
  const toggleFav = (id: string) => {
    setActFavorites(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      localStorage.setItem("actCatFavorites", JSON.stringify(next));
      return next;
    });
  };

  // ── Activity detail sheet (from category picker)
  const [detailExercise, setDetailExercise] = useState<ExerciseEntry | null>(null);
  const [detailColor,    setDetailColor]    = useState("#38bdf8");
  const [detailColor2,   setDetailColor2]   = useState("#6366f1");
  const [detailSaving,   setDetailSaving]   = useState(false);

  const handleCategorySelect = (exercise: ExerciseEntry, c1: string, c2: string) => {
    setDetailExercise(exercise);
    setDetailColor(c1);
    setDetailColor2(c2);
  };

  const handleDetailSave = async (data: ActivitySaveData) => {
    setDetailSaving(true);
    try {
      const res = await fetch("/api/activity", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ date, ...data }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        showToast(`Erreur ${res.status}${text ? " — " + text.slice(0, 60) : ""}`, false);
        return;
      }
      const json = await res.json() as { activity?: ManualActivity };
      if (json.activity) {
        setActivities(prev => [json.activity!, ...prev]);
        showToast(`✓ ${data.name} ajouté · ${Math.round(data.durationMin)} min · ${data.caloriesBurned ?? 0} kcal`, true);
        setDetailExercise(null);
      } else {
        showToast("Réponse inattendue du serveur", false);
      }
    } catch (err) {
      showToast(`Erreur réseau — ${String(err).slice(0, 50)}`, false);
    } finally {
      setDetailSaving(false);
    }
  };

  // ── Template photo editing
  const tplPhotoEditRef  = useRef<HTMLInputElement>(null);
  const [editingTplId,   setEditingTplId]   = useState<string | null>(null);

  // ── Activity editing + photo
  const [editingActivityId,  setEditingActivityId]  = useState<string | null>(null);
  const [editForm,           setEditForm]           = useState<FormState>(EMPTY_FORM);
  const [editSaving,         setEditSaving]         = useState(false);
  const actPhotoInputRef = useRef<HTMLInputElement>(null);
  const [photoForActivityId, setPhotoForActivityId] = useState<string | null>(null);
  const [photoZoom, setPhotoZoom] = useState<{ url: string; activityId: string } | null>(null);

  // ── Google Fit session editing
  // sessionEdits: local copy of edits (seeded from fitnessDay.sessionEdits)
  const [sessionEdits,        setSessionEdits]       = useState<Record<string, { name?: string; calories?: number | null; durationMin?: number }>>(
    (fitnessDay?.sessionEdits as Record<string, { name?: string; calories?: number | null; durationMin?: number }>) ?? {}
  );
  const [editingGFitId,      setEditingGFitId]      = useState<string | null>(null);
  const [gfitEditForm,       setGfitEditForm]       = useState({ name: "", calories: "", durationMin: "" });
  const [gfitEditSaving,     setGfitEditSaving]     = useState(false);
  const [openRouteId,        setOpenRouteId]        = useState<string | null>(null);

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
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.error("[activity save] HTTP", res.status, text);
        setSaveErrDetail(`Erreur ${res.status}${text ? ` — ${text.slice(0, 80)}` : ""}`);
        setSaveError(true);
        return;
      }
      const json = await res.json() as { activity?: ManualActivity };
      if (json.activity) {
        setActivities((prev) => [json.activity!, ...prev]);
        setShowForm(false);
        setForm(EMPTY_FORM);
        setSaveErrDetail("");
        setShowTemplates(false);
      } else {
        setSaveErrDetail("Réponse inattendue du serveur");
        setSaveError(true);
      }
    } catch (err) {
      console.error("[activity save] catch", err);
      setSaveErrDetail(String(err));
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
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.error("[launchTemplate] HTTP", res.status, text);
        showToast(`Erreur ${res.status} — ${text.slice(0, 60) || "sauvegarde échouée"}`, false);
        return;
      }
      const json = await res.json() as { activity?: ManualActivity };
      if (json.activity) {
        setActivities((prev) => [json.activity!, ...prev]);
        showToast(`✓ ${tpl.name} enregistré`, true);
        setShowTemplates(false);
      } else {
        showToast("Réponse inattendue du serveur", false);
      }
    } catch (err) {
      console.error("[launchTemplate] catch", err);
      showToast(`Erreur réseau`, false);
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
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.error("[sport save] HTTP", res.status, text);
        showToast(`Erreur ${res.status} — ${text.slice(0, 60) || "sauvegarde échouée"}`, false);
        return;
      }
      const json = await res.json() as { activity?: ManualActivity };
      if (json.activity) {
        setActivities((prev) => [json.activity!, ...prev]);
        showToast(`✓ ${exercise.name} ajouté (30 min · ${caloriesBurned} kcal)`, true);
      } else {
        showToast("Réponse inattendue du serveur", false);
      }
    } catch (err) {
      console.error("[sport save] catch", err);
      showToast(`Erreur réseau — ${String(err).slice(0, 60)}`, false);
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

  // ── Save edit to existing activity
  const handleEditSave = async (actId: string) => {
    setEditSaving(true);
    try {
      const muscu = isMuscu(editForm.actType);
      const body: Record<string, unknown> = {
        name:           editForm.customName.trim() || undefined,
        caloriesBurned: editForm.calories ? parseInt(editForm.calories, 10) : null,
        durationMin:    muscu ? musculationDuration(editForm.sets) : parseInt(editForm.duration, 10),
      };
      if (muscu) {
        body.sets     = parseInt(editForm.sets)  || 3;
        body.reps     = parseInt(editForm.reps)  || 10;
        body.weightKg = parseFloat(editForm.weightKg) || null;
      }
      const res = await fetch(`/api/activity/${actId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) return;
      setActivities((prev) => prev.map((a) => a.id !== actId ? a : {
        ...a,
        name:           (body.name as string) || a.name,
        caloriesBurned: body.caloriesBurned as number | null,
        durationMin:    body.durationMin as number,
        ...(muscu ? { sets: body.sets as number, reps: body.reps as number, weightKg: body.weightKg as number } : {}),
      }));
      setEditingActivityId(null);
    } catch { /* ignore */ }
    finally { setEditSaving(false); }
  };

  // ── Upload + save photo for an activity
  const handleActivityPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !photoForActivityId) return;
    e.target.value = "";
    const actId = photoForActivityId;
    setPhotoForActivityId(null);
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
        await fetch(`/api/activity/${actId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ photoDataUrl: dataUrl }),
        });
        setActivities((prev) => prev.map((a) => a.id === actId ? { ...a, photoDataUrl: dataUrl } : a));
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  };

  // ── Save GFit session edit
  const handleGFitEditSave = async (sessionId: string) => {
    setGfitEditSaving(true);
    try {
      const body: Record<string, unknown> = { date, sessionId };
      if (gfitEditForm.name.trim())         body.name        = gfitEditForm.name.trim();
      if (gfitEditForm.durationMin.trim())  body.durationMin = parseInt(gfitEditForm.durationMin, 10);
      if (gfitEditForm.calories.trim())     body.calories    = parseInt(gfitEditForm.calories, 10);

      const res = await fetch("/api/gfit-session", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) return;

      setSessionEdits((prev) => ({
        ...prev,
        [sessionId]: {
          ...(prev[sessionId] ?? {}),
          ...(body.name        !== undefined ? { name:        body.name as string }  : {}),
          ...(body.durationMin !== undefined ? { durationMin: body.durationMin as number } : {}),
          ...(body.calories    !== undefined ? { calories:    body.calories as number }    : {}),
        },
      }));
      setEditingGFitId(null);
    } catch { /* ignore */ }
    finally { setGfitEditSaving(false); }
  };

  const totalBurned = [
    gf?.activeCaloriesBurned ?? 0,
    ...activities.map((a) => a.caloriesBurned ?? 0),
  ].reduce((s, v) => s + v, 0);


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
          className="flex flex-col gap-2 mb-3 sm:flex-row sm:items-start sm:justify-between"
        >
          <div className="hidden md:block">
            <h1 className="text-[22px] font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
              Activité sportive
            </h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowVoice(true)}
              aria-label="Dicter mon activité"
              className="flex items-center justify-center rounded-xl transition-all active:scale-95"
              style={{
                width: 38, height: 38,
                background: "rgba(56,189,248,0.12)",
                border: "1px solid rgba(56,189,248,0.4)",
                color: "var(--info)",
              }}
            >
              <IconMicrophone size={17} />
            </button>
            <button
              onClick={() => setShowGym(true)}
              aria-label="Séance salle de sport"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-medium transition-all active:scale-95"
              style={{
                background: "rgba(56,189,248,0.12)",
                border: "1px solid rgba(56,189,248,0.4)",
                color: "var(--info)",
              }}
            >
              <IconBarbell size={15} /> Salle
            </button>
            <button
              onClick={() => setShowGymProgress(true)}
              aria-label="Progression salle"
              className="flex items-center justify-center rounded-xl transition-all active:scale-95"
              style={{
                width: 38, height: 38,
                background: "rgba(56,189,248,0.12)",
                border: "1px solid rgba(56,189,248,0.4)",
                color: "var(--info)",
              }}
            >
              <IconTrendingUp size={17} />
            </button>
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

        {/* Date nav */}
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.03 }}
          className="flex items-center justify-between mb-5 glass px-4 py-2.5"
        >
          <button
            onClick={() => navigate(format(subDays(parseISO(date + "T12:00:00"), 1), "yyyy-MM-dd"))}
            className="btn-icon flex-shrink-0"
          >
            <IconChevronLeft size={14} />
          </button>
          <span className="text-[13px] font-medium capitalize" style={{ color: "var(--text-primary)" }}>
            {navLoading
              ? <IconLoader2 size={14} className="animate-spin" />
              : dateLabel}
          </span>
          <button
            onClick={() => navigate(format(addDays(parseISO(date + "T12:00:00"), 1), "yyyy-MM-dd"))}
            disabled={isOnToday}
            className="btn-icon flex-shrink-0"
            style={{ opacity: isOnToday ? 0.3 : 1 }}
          >
            <IconChevronRight size={14} />
          </button>
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
              <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{label}</span>
            </div>
          ))}
        </motion.div>

        {/* ── Category picker ── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.07 }}
        >
          <ActivityCategoryPicker
            actFavorites={actFavorites}
            onToggleFav={toggleFav}
            onSelectExercise={handleCategorySelect}
            userWeightKg={userWeightKg}
          />
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
                <p className="text-[12px] mt-2 text-center" style={{ color: "var(--danger)" }}>
                  {saveErrDetail || "Erreur lors de la sauvegarde — réessaye"}
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
            {/* Clickable header to expand/collapse */}
            <button
              onClick={() => setShowTemplates((x) => !x)}
              className="flex items-center gap-2 flex-1 min-w-0"
              type="button"
            >
              <IconBookmark size={15} style={{ color: "var(--protein)" }} />
              <p className="label-xs">Séances types</p>
              {templates.length > 0 && (
                <span className="text-[11px] px-1.5 py-0.5 rounded-full ml-0.5"
                  style={{ background: "rgba(167,139,250,0.15)", color: "var(--protein)" }}>
                  {templates.length}
                </span>
              )}
              <motion.span
                animate={{ rotate: showTemplates ? 180 : 0 }}
                transition={{ duration: 0.2 }}
                style={{ display: "inline-flex", marginLeft: "auto", color: "var(--text-muted)" }}
              >
                <IconChevronDown size={13} />
              </motion.span>
            </button>
            <button
              onClick={() => setShowTplForm((x) => !x)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ml-2"
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

          {/* Template list — collapsible */}
          <AnimatePresence initial={false}>
            {showTemplates && (
              <motion.div
                key="tpl-list"
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.22 }}
                style={{ overflow: "hidden" }}
              >
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
            )}
          </AnimatePresence>
        </motion.div>

        {/* ── Activités du jour (Google Fit + Manuelles fusionnées) ─────────── */}
        {(() => {
          type UnifiedItem =
            | { kind: "gfit";   session:  GoogleFitSession; sortMs: number }
            | { kind: "manual"; activity: ManualActivity;   sortMs: number };

          const unified: UnifiedItem[] = [
            ...(gf?.sessions ?? []).map((s): UnifiedItem => ({
              kind: "gfit", session: s, sortMs: s.startMs,
            })),
            ...activities.map((a): UnifiedItem => ({
              kind: "manual", activity: a,
              sortMs: (a.loggedAt as { seconds?: number })?.seconds
                ? (a.loggedAt as { seconds: number }).seconds * 1000
                : Date.now(),
            })),
          ].sort((a, b) => a.sortMs - b.sortMs);

          if (unified.length === 0) return null;

          return (
            <motion.div
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.08 }}
              className="glass p-4 mb-4"
            >
              <p className="label-xs mb-3">Activités du jour</p>
              <div className="space-y-3">
                <AnimatePresence>
                  {unified.map((item) => {

                    /* ── Google Fit session ── */
                    if (item.kind === "gfit") {
                      const s        = item.session;
                      const edit     = sessionEdits[s.id] ?? {};
                      const dispName = edit.name        ?? s.name;
                      const dispDur  = edit.durationMin ?? s.durationMin;
                      const dispCal  = edit.calories !== undefined ? edit.calories : s.calories;
                      const isEditing = editingGFitId === s.id;
                      const hasGps   = isGpsActivity(s.activityType);
                      const showRoute = openRouteId === s.id;
                      const actColor = getActivityColor(s.activityType);

                      const gfMetrics: { value: string; unit: string; color: string; icon: ReactNode }[] = [
                        { value: String(dispDur), unit: "min", color: actColor, icon: <IconClock size={13} stroke={1.8}/> },
                      ];
                      if (dispCal != null && dispCal > 0)
                        gfMetrics.push({ value: String(Math.round(dispCal)), unit: "kcal", color: "var(--danger)", icon: <IconFlame size={13} stroke={1.8}/> });
                      if (s.distanceM != null)
                        gfMetrics.push({
                          value: s.distanceM >= 1000 ? (s.distanceM / 1000).toFixed(2) : String(s.distanceM),
                          unit: s.distanceM >= 1000 ? "km" : "m",
                          color: "var(--fiber)", icon: <IconRuler size={13} stroke={1.8}/>,
                        });
                      if (s.avgSpeedKmh != null)
                        gfMetrics.push({ value: String(s.avgSpeedKmh), unit: "km/h", color: "var(--fat)", icon: <IconGauge size={13} stroke={1.8}/> });
                      if (s.steps != null && s.steps > 0)
                        gfMetrics.push({ value: s.steps.toLocaleString("fr-FR"), unit: "pas", color: "var(--steps)", icon: <IconShoe size={13} stroke={1.8}/> });
                      if (s.heartRateAvg != null)
                        gfMetrics.push({ value: String(s.heartRateAvg), unit: "bpm moy.", color: "var(--danger)", icon: <IconHeart size={13} stroke={1.8}/> });
                      if (s.heartRateMax != null)
                        gfMetrics.push({ value: String(s.heartRateMax), unit: "bpm max", color: "#dc2626", icon: <IconHeart size={13} stroke={2.2}/> });

                      return (
                        <motion.div key={`gfit-${s.id}`}
                          initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}
                          className="flex flex-col gap-2"
                        >
                          {/* Card */}
                          <div className="rounded-2xl overflow-hidden" style={{
                            background: `linear-gradient(135deg, color-mix(in srgb, ${actColor} 9%, transparent) 0%, color-mix(in srgb, ${actColor} 2%, transparent) 70%)`,
                            border: `1px solid color-mix(in srgb, ${actColor} 19%, transparent)`,
                          }}>
                            <div className="p-3.5">
                              {/* Header */}
                              <div className="flex items-start gap-3 mb-3">
                                <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                                  style={{ background: `color-mix(in srgb, ${actColor} 13%, transparent)`, border: `1px solid color-mix(in srgb, ${actColor} 22%, transparent)` }}>
                                  <ActivitySVGIcon type={s.activityType} color={actColor} size={26}/>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[14px] font-bold leading-tight mb-1" style={{ color: "var(--text-primary)" }}>
                                    {dispName}
                                    {edit.name && <span className="text-[11px] ml-1.5" style={{ color: "var(--protein)" }}>✎</span>}
                                  </p>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full"
                                      style={{ background: "rgba(251,191,36,0.15)", color: "var(--carbs)" }}>GFIT</span>
                                    <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                                      {new Date(s.startMs).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-0.5 flex-shrink-0">
                                  {hasGps && (
                                    <button onClick={() => setOpenRouteId(showRoute ? null : s.id)}
                                      className="btn-icon w-8 h-8" title="Carte GPS"
                                      style={{ color: showRoute ? "var(--calories)" : "var(--text-muted)" }}>
                                      <IconMap size={14}/>
                                    </button>
                                  )}
                                  <button
                                    onClick={() => {
                                      if (isEditing) { setEditingGFitId(null); return; }
                                      setEditingGFitId(s.id);
                                      setGfitEditForm({
                                        name:        edit.name        ?? s.name,
                                        durationMin: String(edit.durationMin ?? s.durationMin),
                                        calories:    String(edit.calories !== undefined ? (edit.calories ?? "") : (s.calories ?? "")),
                                      });
                                    }}
                                    className="btn-icon w-8 h-8"
                                    style={{ color: isEditing ? "var(--protein)" : "var(--text-muted)" }}>
                                    <IconPencil size={13}/>
                                  </button>
                                </div>
                              </div>

                              {/* Metrics grid */}
                              <div className="grid gap-2"
                                style={{ gridTemplateColumns: `repeat(${Math.min(gfMetrics.length, 5)}, 1fr)` }}>
                                {gfMetrics.map((m, i) => <MetricChip key={i} {...m}/>)}
                              </div>
                            </div>
                          </div>

                          {/* Route map */}
                          <AnimatePresence>
                            {showRoute && (
                              <motion.div key={`route-${s.id}`}
                                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25 }}
                                style={{ overflow: "hidden" }}>
                                <RouteMap startMs={s.startMs} endMs={s.endMs} height={180}/>
                              </motion.div>
                            )}
                          </AnimatePresence>

                          {/* GFit inline edit */}
                          <AnimatePresence>
                            {isEditing && (
                              <motion.div key={`gfit-edit-${s.id}`}
                                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }}
                                style={{ overflow: "hidden" }}>
                                <div className="pt-1 pb-2 space-y-2">
                                  <input value={gfitEditForm.name}
                                    onChange={(e) => setGfitEditForm((f) => ({ ...f, name: e.target.value }))}
                                    placeholder="Nom de la séance" className="input text-[12px] w-full"/>
                                  <div className="flex gap-2">
                                    <div className="flex-1 flex items-center gap-1.5 input px-2 py-1.5">
                                      <IconClock size={12} style={{ color: "var(--text-muted)", flexShrink: 0 }}/>
                                      <input type="number" min="1" value={gfitEditForm.durationMin}
                                        onChange={(e) => setGfitEditForm((f) => ({ ...f, durationMin: e.target.value }))}
                                        className="w-full bg-transparent text-[12px] outline-none" placeholder="min"/>
                                    </div>
                                    <div className="flex-1 flex items-center gap-1.5 input px-2 py-1.5">
                                      <IconFlame size={12} style={{ color: "var(--fit-red)", flexShrink: 0 }}/>
                                      <input type="number" min="0" value={gfitEditForm.calories}
                                        onChange={(e) => setGfitEditForm((f) => ({ ...f, calories: e.target.value }))}
                                        className="w-full bg-transparent text-[12px] outline-none" placeholder="kcal"/>
                                    </div>
                                  </div>
                                  <div className="flex gap-2">
                                    <button onClick={() => setEditingGFitId(null)} className="flex-1 btn btn-ghost text-[11px]">Annuler</button>
                                    <button onClick={() => handleGFitEditSave(s.id)} disabled={gfitEditSaving}
                                      className="flex-1 btn btn-primary gap-1.5 text-[11px]">
                                      {gfitEditSaving ? <><IconLoader2 size={11} className="animate-spin"/>…</> : <><IconCheck size={11}/>Enregistrer</>}
                                    </button>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      );
                    }

                    /* ── Activité manuelle ── */
                    const a = item.activity;
                    const actColor = getActivityColor(a.activityType);

                    const mMetrics: { value: string; unit: string; color: string; icon: ReactNode }[] = [];
                    if (a.sets) {
                      mMetrics.push({ value: `${a.sets}×${a.reps ?? "?"}`, unit: "reps", color: actColor, icon: <IconBolt size={13} stroke={1.8}/> });
                      if (a.weightKg) mMetrics.push({ value: String(a.weightKg), unit: "kg", color: actColor, icon: <IconRuler size={13} stroke={1.8}/> });
                    } else {
                      mMetrics.push({ value: String(a.durationMin), unit: "min", color: actColor, icon: <IconClock size={13} stroke={1.8}/> });
                    }
                    if (a.caloriesBurned)
                      mMetrics.push({ value: String(a.caloriesBurned), unit: "kcal", color: "var(--danger)", icon: <IconFlame size={13} stroke={1.8}/> });

                    return (
                      <motion.div key={`manual-${a.id}`}
                        initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}
                        className="flex flex-col gap-2"
                      >
                        {/* Card */}
                        <div className="rounded-2xl overflow-hidden" style={{
                          background: `linear-gradient(135deg, color-mix(in srgb, ${actColor} 9%, transparent) 0%, color-mix(in srgb, ${actColor} 2%, transparent) 70%)`,
                          border: `1px solid color-mix(in srgb, ${actColor} 19%, transparent)`,
                        }}>
                          <div className="p-3.5">
                            {/* Header */}
                            <div className="flex items-start gap-3 mb-3">
                              <button type="button"
                                onClick={() => {
                                  if (a.photoDataUrl) { setPhotoZoom({ url: a.photoDataUrl, activityId: a.id }); }
                                  else { setPhotoForActivityId(a.id); actPhotoInputRef.current?.click(); }
                                }}
                                className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 overflow-hidden relative group"
                                style={{ background: `color-mix(in srgb, ${actColor} 13%, transparent)`, border: `1px solid color-mix(in srgb, ${actColor} 22%, transparent)` }}
                                title={a.photoDataUrl ? "Agrandir" : "Ajouter photo"}>
                                {a.photoDataUrl
                                  ? <img src={a.photoDataUrl} className="w-12 h-12 object-cover" alt=""/>
                                  : <ActivitySVGIcon type={a.activityType} color={actColor} size={26}/>
                                }
                                <div className="absolute inset-0 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                  style={{ background: "rgba(0,0,0,0.5)" }}>
                                  {a.photoDataUrl
                                    ? <IconMaximize size={13} style={{ color: "white" }}/>
                                    : <IconCamera size={13} style={{ color: "white" }}/>}
                                </div>
                              </button>
                              <div className="flex-1 min-w-0">
                                <p className="text-[14px] font-bold leading-tight mb-1" style={{ color: "var(--text-primary)" }}>
                                  {a.name}
                                </p>
                                <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full"
                                  style={{ background: "rgba(99,179,237,0.15)", color: "var(--fat)" }}>MANUEL</span>
                              </div>
                              <div className="flex items-center gap-0.5 flex-shrink-0">
                                <button
                                  onClick={() => {
                                    if (editingActivityId === a.id) { setEditingActivityId(null); return; }
                                    setEditingActivityId(a.id);
                                    setEditForm({
                                      actType: a.activityType, duration: String(a.durationMin), customName: a.name,
                                      calories: String(a.caloriesBurned ?? ""), sets: String(a.sets ?? "3"),
                                      reps: String(a.reps ?? "10"), weightKg: String(a.weightKg ?? ""),
                                      variableWeight: false, weightPerSet: [],
                                    });
                                  }}
                                  className="btn-icon w-8 h-8"
                                  style={{ color: editingActivityId === a.id ? "var(--protein)" : "var(--text-muted)" }}>
                                  <IconPencil size={13}/>
                                </button>
                                <button onClick={() => handleDelete(a.id)} className="btn-icon w-8 h-8" style={{ color: "var(--danger)" }}>
                                  <IconTrash size={13}/>
                                </button>
                              </div>
                            </div>

                            {/* Metrics grid */}
                            <div className="grid gap-2"
                              style={{ gridTemplateColumns: `repeat(${Math.min(mMetrics.length, 4)}, 1fr)` }}>
                              {mMetrics.map((m, i) => <MetricChip key={i} {...m}/>)}
                            </div>
                          </div>
                        </div>

                        {/* Manual inline edit */}
                        <AnimatePresence>
                          {editingActivityId === a.id && (
                            <motion.div key={`edit-${a.id}`}
                              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }}
                              style={{ overflow: "hidden" }}>
                              <div className="pt-1 pb-2 space-y-2">
                                <input value={editForm.customName}
                                  onChange={(e) => setEditForm((f) => ({ ...f, customName: e.target.value }))}
                                  placeholder="Nom de l'activité" className="input text-[12px] w-full"/>
                                {isMuscu(editForm.actType) ? (
                                  <div className="flex gap-2">
                                    <div className="flex-1 flex flex-col gap-1">
                                      <p className="text-[11px] uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Séries</p>
                                      <input type="number" min="1" value={editForm.sets}
                                        onChange={(e) => setEditForm((f) => updateMusculationCalories({ ...f, sets: e.target.value }))}
                                        className="input text-[12px] text-center"/>
                                    </div>
                                    <div className="flex-1 flex flex-col gap-1">
                                      <p className="text-[11px] uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Reps</p>
                                      <input type="number" min="1" value={editForm.reps}
                                        onChange={(e) => setEditForm((f) => updateMusculationCalories({ ...f, reps: e.target.value }))}
                                        className="input text-[12px] text-center"/>
                                    </div>
                                    <div className="flex-1 flex flex-col gap-1">
                                      <p className="text-[11px] uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Poids kg</p>
                                      <input type="number" min="0" step="0.5" value={editForm.weightKg}
                                        onChange={(e) => setEditForm((f) => updateMusculationCalories({ ...f, weightKg: e.target.value }))}
                                        className="input text-[12px] text-center" placeholder="—"/>
                                    </div>
                                    <div className="flex-1 flex flex-col gap-1">
                                      <p className="text-[11px] uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Kcal</p>
                                      <input type="number" min="0" value={editForm.calories}
                                        onChange={(e) => setEditForm((f) => ({ ...f, calories: e.target.value }))}
                                        className="input text-[12px] text-center"/>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex gap-2">
                                    <div className="flex-1 flex items-center gap-1.5 input px-2 py-1.5">
                                      <IconClock size={12} style={{ color: "var(--text-muted)", flexShrink: 0 }}/>
                                      <input type="number" min="1" value={editForm.duration}
                                        onChange={(e) => setEditForm((f) => ({ ...f, duration: e.target.value }))}
                                        className="w-full bg-transparent text-[12px] outline-none" placeholder="min"/>
                                    </div>
                                    <div className="flex-1 flex items-center gap-1.5 input px-2 py-1.5">
                                      <IconFlame size={12} style={{ color: "var(--fit-red)", flexShrink: 0 }}/>
                                      <input type="number" min="0" value={editForm.calories}
                                        onChange={(e) => setEditForm((f) => ({ ...f, calories: e.target.value }))}
                                        className="w-full bg-transparent text-[12px] outline-none" placeholder="kcal"/>
                                    </div>
                                  </div>
                                )}
                                <div className="flex gap-2">
                                  <button onClick={() => setEditingActivityId(null)} className="flex-1 btn btn-ghost text-[11px]">Annuler</button>
                                  <button onClick={() => handleEditSave(a.id)} disabled={editSaving}
                                    className="flex-1 btn btn-primary gap-1.5 text-[11px]">
                                    {editSaving ? <><IconLoader2 size={11} className="animate-spin"/>…</> : <><IconCheck size={11}/>Enregistrer</>}
                                  </button>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </motion.div>
          );
        })()}

        {/* Sleep */}
        {gf?.sleepMinutes && (
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.12 }}
            className="card flex items-center gap-3 mb-4"
          >
            <IconMoon size={16} style={{ color: "var(--fit-indigo)" }} />
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

        {(gf?.sessions?.length ?? 0) === 0 && activities.length === 0 && !showForm && (
          <div className="flex flex-col items-center gap-3 py-12">
            <span className="text-5xl">🏃</span>
            <p className="text-[14px] font-medium" style={{ color: "var(--text-secondary)" }}>
              {isOnToday ? "Aucune activité aujourd'hui" : "Aucune activité ce jour"}
            </p>
            <p className="text-[12px] text-center" style={{ color: "var(--text-muted)" }}>
              {isOnToday ? "Lancez une séance type ou ajoutez manuellement." : "Naviguez vers un autre jour ou revenez à aujourd'hui."}
            </p>
          </div>
        )}

        {/* ── Historique 14 jours ─────────────────────────────────────────────── */}
        {history.length > 0 && <ActivityHistory history={history} stepsGoal={goals?.stepsGoal ?? 10000} />}

      </div>

      {/* ── Toast ── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key="toast"
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="fixed bottom-24 left-1/2 z-50 max-w-xs w-[90vw] px-4 py-3 rounded-2xl text-[13px] font-medium text-center"
            style={{
              transform: "translateX(-50%)",
              background: toast.ok ? "var(--ok-bg)" : "var(--danger-bg)",
              border: `1px solid ${toast.ok ? "color-mix(in srgb, var(--ok) 40%, transparent)" : "color-mix(in srgb, var(--danger) 40%, transparent)"}`,
              color: toast.ok ? "var(--ok)" : "var(--danger)",
              backdropFilter: "blur(12px)",
            }}
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Activity detail sheet (from category picker) */}
      <ActivityDetailSheet
        exercise={detailExercise}
        catColor={detailColor}
        catColor2={detailColor2}
        weightKg={userWeightKg}
        saving={detailSaving}
        onSave={handleDetailSave}
        onClose={() => setDetailExercise(null)}
      />

      {/* Sport Search Modal */}
      <SportSearchModal
        open={showSportSearch}
        onClose={() => setShowSportSearch(false)}
        onSelect={handleSportSelect}
        onCustomize={handleSportCustomize}
        onSave={handleSportSave}
      />

      {/* Voice Activity Modal (Nutri-IA) */}
      <AnimatePresence>
        {showVoice && (
          <VoiceActivityModal
            date={date}
            onClose={() => setShowVoice(false)}
            onAdded={() => {
              setShowVoice(false);
              navigate(date);
              showToast("✓ Activité(s) ajoutée(s) par Nutri-IA", true);
            }}
          />
        )}
      </AnimatePresence>

      {/* Gym Session Modal (Salle de sport) */}
      <AnimatePresence>
        {showGym && (
          <GymSessionModal
            date={date}
            onClose={() => setShowGym(false)}
            onSaved={() => {
              setShowGym(false);
              navigate(date);
              showToast("✓ Séance enregistrée", true);
            }}
          />
        )}
      </AnimatePresence>

      {/* Gym Progress Modal */}
      <AnimatePresence>
        {showGymProgress && (
          <GymProgressModal onClose={() => setShowGymProgress(false)} />
        )}
      </AnimatePresence>

      {/* Hidden input for template photo editing */}
      <input
        type="file"
        accept="image/*"
        ref={tplPhotoEditRef}
        className="hidden"
        onChange={handleTplPhotoEdit}
      />

      {/* Hidden input for activity photo */}
      <input
        type="file"
        accept="image/*"
        ref={actPhotoInputRef}
        className="hidden"
        onChange={handleActivityPhotoUpload}
      />

      {/* ── Photo lightbox ── */}
      <AnimatePresence>
        {photoZoom && (
          <motion.div
            key="photo-lightbox"
            className="fixed inset-0 z-50 flex flex-col items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ background: "rgba(0,0,0,0.88)", backdropFilter: "blur(8px)" }}
            onClick={() => setPhotoZoom(null)}
          >
            {/* Image */}
            <motion.img
              src={photoZoom.url}
              alt=""
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1,    opacity: 1 }}
              exit={{ scale: 0.85,    opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              onClick={e => e.stopPropagation()}
              className="rounded-2xl object-contain shadow-2xl"
              style={{ maxWidth: "min(90vw, 480px)", maxHeight: "70vh" }}
            />

            {/* Action row */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1,  y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.2, delay: 0.05 }}
              className="flex items-center gap-3 mt-5"
              onClick={e => e.stopPropagation()}
            >
              {/* Replace photo */}
              <button
                onClick={() => {
                  setPhotoForActivityId(photoZoom.activityId);
                  setPhotoZoom(null);
                  setTimeout(() => actPhotoInputRef.current?.click(), 50);
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-medium transition-all"
                style={{ background: "rgba(255,255,255,0.1)", color: "white", border: "1px solid rgba(255,255,255,0.2)" }}>
                <IconCamera size={14} />
                Remplacer
              </button>
              {/* Close */}
              <button
                onClick={() => setPhotoZoom(null)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-medium transition-all"
                style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.12)" }}>
                <IconX size={14} />
                Fermer
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

