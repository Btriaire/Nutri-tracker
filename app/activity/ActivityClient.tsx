"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Plus, Trash, Timer, Lightning, Heart, Moon, Footprints, Fire,
  BookmarkSimple, Play, X, Check, Spinner,
} from "@phosphor-icons/react";
import type { FitnessDay, ManualActivity } from "@/app/lib/types";
import type { WorkoutTemplate } from "@/app/api/workout-templates/route";

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

function estimateCalories(type: number, durationMin: number, weightKg = 75): number {
  const met = MET[type] ?? 5;
  return Math.round((met * weightKg * durationMin) / 60);
}

function activityEmoji(type: number): string {
  return ACTIVITY_OPTIONS.find((a) => a.type === type)?.emoji ?? "🏅";
}

interface Props {
  date:                    string;
  fitnessDay:              FitnessDay | null;
  initialManualActivities: unknown[];
}

// ─── Shared activity form state ───────────────────────────────────────────────

interface FormState {
  actType:    number;
  duration:   string;
  customName: string;
  calories:   string;
}

const EMPTY_FORM: FormState = { actType: 0, duration: "30", customName: "", calories: "" };

export default function ActivityClient({ date, fitnessDay, initialManualActivities }: Props) {
  const today = format(new Date(date + "T12:00:00"), "EEEE d MMMM", { locale: fr });
  const gf    = fitnessDay?.googleFit;

  const [activities,  setActivities]  = useState<ManualActivity[]>(initialManualActivities as ManualActivity[]);
  const [templates,   setTemplates]   = useState<WorkoutTemplate[]>([]);
  const [loadingTpl,  setLoadingTpl]  = useState(true);

  // ── Log form
  const [showForm,  setShowForm]  = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [form,      setForm]      = useState<FormState>(EMPTY_FORM);

  // ── Template creation form
  const [showTplForm,  setShowTplForm]  = useState(false);
  const [savingTpl,    setSavingTpl]    = useState(false);
  const [savedTpl,     setSavedTpl]     = useState(false);
  const [tplForm,      setTplForm]      = useState<FormState & { notes: string }>(
    { ...EMPTY_FORM, notes: "" }
  );

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
    setF({ ...f, duration: val, calories: d > 0 ? String(estimateCalories(f.actType, d)) : f.calories });
  };
  const updateFormType = (type: number, f: FormState, setF: (v: FormState) => void) => {
    const d = parseInt(f.duration, 10);
    setF({ ...f, actType: type, calories: d > 0 ? String(estimateCalories(type, d)) : f.calories });
  };

  // ── Log activity
  const handleSave = async () => {
    if (!form.duration || parseInt(form.duration, 10) < 1) return;
    setSaving(true);
    try {
      const res  = await fetch("/api/activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          name:           form.customName.trim() || undefined,
          activityType:   form.actType,
          durationMin:    parseInt(form.duration, 10),
          caloriesBurned: form.calories ? parseInt(form.calories, 10) : null,
        }),
      });
      const json = await res.json() as { activity?: ManualActivity };
      if (json.activity) setActivities((prev) => [json.activity!, ...prev]);
    } catch { /* close form regardless */ }
    finally {
      setSaving(false);
      setShowForm(false);
      setForm(EMPTY_FORM);
    }
  };

  // ── Delete activity
  const handleDelete = async (id: string) => {
    await fetch(`/api/activity/${id}`, { method: "DELETE" });
    setActivities((prev) => prev.filter((a) => a.id !== id));
  };

  // ── Save template
  const handleSaveTemplate = async () => {
    if (!tplForm.customName.trim() || !tplForm.duration) return;
    setSavingTpl(true);
    try {
      const res  = await fetch("/api/workout-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:               tplForm.customName.trim(),
          activityType:       tplForm.actType,
          defaultDurationMin: parseInt(tplForm.duration, 10),
          defaultCalories:    tplForm.calories ? parseInt(tplForm.calories, 10) : null,
          notes:              tplForm.notes.trim() || undefined,
        }),
      });
      const json = await res.json() as { template?: WorkoutTemplate };
      if (json.template) setTemplates((prev) => [json.template!, ...prev]);
      setSavedTpl(true);
      setTimeout(() => { setSavedTpl(false); setShowTplForm(false); setTplForm({ ...EMPTY_FORM, notes: "" }); }, 900);
    } catch { /* ignore */ }
    finally { setSavingTpl(false); }
  };

  // ── Delete template
  const handleDeleteTemplate = async (id: string) => {
    await fetch(`/api/workout-templates/${id}`, { method: "DELETE" });
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  };

  // ── Launch template → pre-fill log form
  const launchTemplate = (tpl: WorkoutTemplate) => {
    setForm({
      actType:    tpl.activityType,
      duration:   String(tpl.defaultDurationMin),
      customName: tpl.name,
      calories:   tpl.defaultCalories ? String(tpl.defaultCalories) : String(estimateCalories(tpl.activityType, tpl.defaultDurationMin)),
    });
    setShowForm(true);
  };

  const totalBurned = [
    gf?.activeCaloriesBurned ?? 0,
    ...activities.map((a) => a.caloriesBurned ?? 0),
  ].reduce((s, v) => s + v, 0);

  const selectedOpt = ACTIVITY_OPTIONS.find((a) => a.type === form.actType) ?? ACTIVITY_OPTIONS[0];

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
          <button onClick={() => setShowForm((x) => !x)} className="btn btn-primary gap-2 px-3 py-2 text-[13px]">
            <Plus size={14} weight="bold" /> Ajouter
          </button>
        </motion.div>

        {/* Summary row */}
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.05 }}
          className="grid grid-cols-4 gap-2 mb-5"
        >
          {[
            { icon: Footprints, label: "Pas",         value: gf?.steps ? gf.steps.toLocaleString("fr-FR") : "—", color: "var(--steps)" },
            { icon: Fire,       label: "Kcal brûlées", value: totalBurned || "—",                                   color: "var(--calories)" },
            { icon: Lightning,  label: "Min. actives", value: gf?.activeMinutes ?? "—",                              color: "var(--carbs)" },
            { icon: Heart,      label: "FC moy.",       value: gf?.heartRateAvg ? `${gf.heartRateAvg} bpm` : "—",  color: "#f87171" },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="card flex flex-col gap-1 items-center text-center p-2">
              <Icon size={18} weight="fill" style={{ color }} />
              <span className="text-[14px] font-bold tabular-nums" style={{ color }}>{value}</span>
              <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>{label}</span>
            </div>
          ))}
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
                  <X size={13} style={{ color: "var(--text-muted)" }} />
                </button>
              </div>

              <ActivityFormBody
                form={form}
                onChange={setForm}
                onDurationChange={(v) => updateFormDuration(v, form, setForm)}
                onTypeChange={(t) => updateFormType(t, form, setForm)}
              />

              <div className="flex gap-3 mt-4">
                <button onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }} className="flex-1 btn btn-ghost">Annuler</button>
                <button onClick={handleSave} disabled={saving || !form.duration}
                  className="flex-1 btn btn-primary gap-2">
                  {saving ? <><Spinner size={13} className="animate-spin" /> Sauvegarde…</> : <><Plus size={13} weight="bold" />Ajouter</>}
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
              <BookmarkSimple size={15} weight="fill" style={{ color: "var(--protein)" }} />
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
              <Plus size={11} weight="bold" />
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
                    namePlaceholder="Nom de la séance (requis)"
                    nameRequired
                  />

                  <input
                    value={tplForm.notes}
                    onChange={(e) => setTplForm((p) => ({ ...p, notes: e.target.value }))}
                    placeholder="Notes (optionnel)"
                    className="input text-[12px]"
                  />

                  <div className="flex gap-2">
                    <button onClick={() => { setShowTplForm(false); setTplForm({ ...EMPTY_FORM, notes: "" }); }}
                      className="flex-1 btn btn-ghost text-[12px]">Annuler</button>
                    <button
                      onClick={handleSaveTemplate}
                      disabled={savingTpl || savedTpl || !tplForm.customName.trim()}
                      className="flex-1 btn btn-primary gap-1.5 text-[12px]"
                    >
                      {savedTpl   ? <><Check size={12} weight="bold" /> Sauvegardé !</>
                       : savingTpl ? <><Spinner size={12} className="animate-spin" /> …</>
                       : <><BookmarkSimple size={12} /> Sauvegarder</>}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Template list */}
          {loadingTpl ? (
            <div className="flex justify-center py-4">
              <Spinner size={16} className="animate-spin" style={{ color: "var(--text-muted)" }} />
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
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)" }}>
                    {activityEmoji(tpl.activityType)}
                  </div>
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
                    style={{ background: "rgba(167,139,250,0.15)", border: "1px solid rgba(167,139,250,0.4)", color: "var(--protein)" }}>
                    <Plus size={12} weight="bold" /> Saisir
                  </button>
                  <button onClick={() => handleDeleteTemplate(tpl.id)}
                    className="btn-icon w-7 h-7 flex-shrink-0" style={{ color: "var(--text-muted)" }}>
                    <Trash size={12} />
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
                  <div className="flex-1">
                    <p className="text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>{s.name}</p>
                    <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                      {new Date(s.startMs).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Timer size={14} style={{ color: "var(--text-muted)" }} />
                    <span className="text-[12px]" style={{ color: "var(--text-secondary)" }}>{s.durationMin} min</span>
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
                        {a.durationMin} min{a.caloriesBurned ? ` · ${a.caloriesBurned} kcal` : ""}
                      </p>
                    </div>
                    <button onClick={() => handleDelete(a.id)} className="btn-icon w-7 h-7 flex-shrink-0"
                      style={{ color: "#f87171" }}>
                      <Trash size={12} />
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
            <Moon size={16} weight="fill" style={{ color: "#818cf8" }} />
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
    </div>
  );
}

// ─── Shared form body ─────────────────────────────────────────────────────────

function ActivityFormBody({
  form, onChange, onDurationChange, onTypeChange, namePlaceholder, nameRequired,
}: {
  form:             FormState;
  onChange:         (v: FormState) => void;
  onDurationChange: (v: string) => void;
  onTypeChange:     (t: number) => void;
  namePlaceholder?: string;
  nameRequired?:    boolean;
}) {
  const selectedOpt = ACTIVITY_OPTIONS.find((a) => a.type === form.actType) ?? ACTIVITY_OPTIONS[0];
  return (
    <>
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

      {/* Duration + calories */}
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
    </>
  );
}
