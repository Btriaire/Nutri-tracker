"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Plus, Trash, Timer, Lightning, Heart, Moon, Footprints, Fire } from "@phosphor-icons/react";
import type { FitnessDay, ManualActivity } from "@/app/lib/types";

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

// Estimate calories burned (rough MET-based)
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
  date:                     string;
  fitnessDay:               FitnessDay | null;
  initialManualActivities:  unknown[];
}

export default function ActivityClient({ date, fitnessDay, initialManualActivities }: Props) {
  const today = format(new Date(date + "T12:00:00"), "EEEE d MMMM", { locale: fr });
  const gf = fitnessDay?.googleFit;

  const [activities, setActivities] = useState<ManualActivity[]>(
    initialManualActivities as ManualActivity[]
  );
  const [showForm,    setShowForm]    = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [actType,     setActType]     = useState(0);
  const [duration,    setDuration]    = useState("30");
  const [customName,  setCustomName]  = useState("");
  const [calories,    setCalories]    = useState("");

  const selectedOpt = ACTIVITY_OPTIONS.find((a) => a.type === actType) ?? ACTIVITY_OPTIONS[0];

  const handleDurationChange = (val: string) => {
    setDuration(val);
    const d = parseInt(val, 10);
    if (d > 0) setCalories(String(estimateCalories(actType, d)));
  };

  const handleTypeChange = (type: number) => {
    setActType(type);
    const d = parseInt(duration, 10);
    if (d > 0) setCalories(String(estimateCalories(type, d)));
  };

  const handleSave = async () => {
    if (!duration || parseInt(duration, 10) < 1) return;
    setSaving(true);
    try {
      const res = await fetch("/api/activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          name:           customName.trim() || undefined,
          activityType:   actType,
          durationMin:    parseInt(duration, 10),
          caloriesBurned: calories ? parseInt(calories, 10) : null,
        }),
      });
      const json = await res.json() as { activity?: ManualActivity };
      if (json.activity) {
        setActivities((prev) => [json.activity!, ...prev]);
      }
      // Always close the form and reset, even if server had an issue
      setShowForm(false);
      setCustomName(""); setDuration("30"); setCalories(""); setActType(0);
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/activity/${id}`, { method: "DELETE" });
    setActivities((prev) => prev.filter((a) => a.id !== id));
  };

  const totalBurned = [
    gf?.activeCaloriesBurned ?? 0,
    ...activities.map((a) => a.caloriesBurned ?? 0),
  ].reduce((s, v) => s + v, 0);

  return (
    <div className="relative min-h-screen" style={{ paddingBottom: "80px" }}>
      <div className="bg-orbs" />
      <div className="relative z-10 max-w-md mx-auto px-4 py-6 md:ml-[220px]">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex items-start justify-between mb-5"
        >
          <div>
            <p className="label-xs mb-0.5 capitalize">{today}</p>
            <h1 className="text-[22px] font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
              Activité sportive
            </h1>
          </div>
          <button
            onClick={() => setShowForm((x) => !x)}
            className="btn btn-primary gap-2 px-3 py-2 text-[13px]"
          >
            <Plus size={14} weight="bold" />
            Ajouter
          </button>
        </motion.div>

        {/* Summary row */}
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="grid grid-cols-4 gap-2 mb-5"
        >
          {[
            { icon: Footprints, label: "Pas", value: gf?.steps ? gf.steps.toLocaleString("fr-FR") : "—", color: "var(--steps)" },
            { icon: Fire,       label: "Kcal brûlées", value: totalBurned || "—", color: "var(--calories)" },
            { icon: Lightning,  label: "Min. actives",  value: gf?.activeMinutes ?? "—", color: "var(--carbs)" },
            { icon: Heart,      label: "FC moy.",       value: gf?.heartRateAvg ? `${gf.heartRateAvg} bpm` : "—", color: "#f87171" },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="card flex flex-col gap-1 items-center text-center p-2">
              <Icon size={18} weight="fill" style={{ color }} />
              <span className="text-[14px] font-bold tabular-nums" style={{ color }}>{value}</span>
              <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>{label}</span>
            </div>
          ))}
        </motion.div>

        {/* Add activity form */}
        <AnimatePresence>
          {showForm && (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.22 }}
              className="glass p-5 mb-5"
            >
              <p className="label-xs mb-4">Nouvelle activité</p>

              {/* Activity type grid */}
              <div className="grid grid-cols-4 gap-2 mb-4">
                {ACTIVITY_OPTIONS.map((opt) => (
                  <button key={opt.type} onClick={() => handleTypeChange(opt.type)}
                    className="flex flex-col items-center gap-1 p-2 rounded-xl text-center transition-all"
                    style={{
                      background: actType === opt.type ? "rgba(167,139,250,0.12)" : "rgba(255,255,255,0.03)",
                      border: `1px solid ${actType === opt.type ? "rgba(167,139,250,0.5)" : "var(--border)"}`,
                    }}>
                    <span className="text-[18px]">{opt.emoji}</span>
                    <span className="text-[9px] leading-tight" style={{ color: actType === opt.type ? "var(--protein)" : "var(--text-muted)" }}>
                      {opt.label.split(" ")[0]}
                    </span>
                  </button>
                ))}
              </div>

              {/* Name (optional) */}
              <input
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder={`Nom (optionnel, ex: "${selectedOpt.label}")`}
                className="input text-[13px] mb-3"
              />

              {/* Duration + calories */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="label-xs block mb-1.5">Durée (min)</label>
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleDurationChange(String(Math.max(5, (parseInt(duration) || 30) - 5)))}
                      className="btn-icon w-8 h-8 text-base">−</button>
                    <input type="number" value={duration} onChange={(e) => handleDurationChange(e.target.value)}
                      className="input text-center w-16 tabular-nums" min="1" />
                    <button onClick={() => handleDurationChange(String((parseInt(duration) || 30) + 5))}
                      className="btn-icon w-8 h-8 text-base">+</button>
                  </div>
                </div>
                <div>
                  <label className="label-xs block mb-1.5">Kcal brûlées</label>
                  <input type="number" value={calories} onChange={(e) => setCalories(e.target.value)}
                    placeholder="Auto"
                    className="input text-center tabular-nums" min="0" />
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setShowForm(false)} className="flex-1 btn btn-ghost">Annuler</button>
                <button onClick={handleSave} disabled={saving || !duration}
                  className="flex-1 btn btn-primary gap-2">
                  {saving ? "…" : <><Plus size={13} weight="bold" />Ajouter</>}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Google Fit sessions */}
        {(gf?.sessions?.length ?? 0) > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.08 }}
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
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="glass p-4 mb-4"
          >
            <p className="label-xs mb-3">Activités manuelles</p>
            <div className="space-y-2">
              <AnimatePresence>
                {activities.map((a) => (
                  <motion.div
                    key={a.id}
                    initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}
                    className="flex items-center gap-3"
                  >
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)" }}>
                      {activityEmoji(a.activityType)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium truncate" style={{ color: "var(--text-primary)" }}>
                        {a.name}
                      </p>
                      <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                        {a.durationMin} min
                        {a.caloriesBurned ? ` · ${a.caloriesBurned} kcal` : ""}
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
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.12 }}
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
          <div className="flex flex-col items-center gap-3 py-16">
            <span className="text-5xl">🏃</span>
            <p className="text-[14px] font-medium" style={{ color: "var(--text-secondary)" }}>Aucune activité</p>
            <p className="text-[12px] text-center" style={{ color: "var(--text-muted)" }}>
              Ajoutez manuellement vos activités ou connectez Google Fit dans les Réglages.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
