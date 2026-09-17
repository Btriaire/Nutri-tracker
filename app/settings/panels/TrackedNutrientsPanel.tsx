"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { IconCircleCheck, IconLoader2, IconChevronDown, IconChevronUp, IconDeviceFloppy } from "@tabler/icons-react";
import type { TrackedNutrients } from "@/app/lib/types";

const DEFAULT_TRACKED: TrackedNutrients = { protein: false, sodium: false, sugar: false, saturatedFat: false };

// Références internationales par nutriment
const NUTRIENT_REFS = {
  protein: {
    type: "min" as const,
    unit: "g",
    label: "Protéines",
    emoji: "💪",
    color: "var(--protein)",
    field: "proteinGrams" as const,
    refs: [
      { label: "OMS",   value: 0.8,  per_kg: true,  desc: "0,8 g/kg — minimum recommandé" },
      { label: "EFSA",  value: 0.83, per_kg: true,  desc: "0,83 g/kg — référence européenne" },
      { label: "Sport", value: 1.6,  per_kg: true,  desc: "1,6 g/kg — activité sportive régulière" },
    ],
    note: "Objectif minimum · à augmenter selon l'activité physique",
    typeLabel: "Objectif quotidien",
  },
  sodium: {
    type: "max" as const,
    unit: "mg",
    label: "Sel / Sodium",
    emoji: "🧂",
    color: "var(--warn)",
    field: "sodiumMg" as const,
    refs: [
      { label: "OMS",   value: 2000, per_kg: false, desc: "2 000 mg/j = 5 g de sel — recommandation forte" },
      { label: "EFSA",  value: 2000, per_kg: false, desc: "2 000 mg/j — objectif européen" },
      { label: "FDA",   value: 2300, per_kg: false, desc: "2 300 mg/j — valeur de référence US" },
      { label: "ANSES", value: 1500, per_kg: false, desc: "1 500 mg/j — objectif optimal France" },
    ],
    note: "Maximum à ne pas dépasser · priorité en cas d'HTA",
    typeLabel: "Maximum quotidien",
  },
  sugar: {
    type: "max" as const,
    unit: "g",
    label: "Sucres",
    emoji: "🍬",
    color: "var(--weight)",
    field: "sugarGrams" as const,
    refs: [
      { label: "OMS strict", value: 25, per_kg: false, desc: "<25 g/j — idéal (<5% énergie sur 2000 kcal)" },
      { label: "OMS",        value: 50, per_kg: false, desc: "<50 g/j — sucres libres (<10% énergie)" },
      { label: "FDA",        value: 50, per_kg: false, desc: "50 g/j — valeur de référence US" },
    ],
    note: "Sucres libres/ajoutés uniquement · exclut sucres naturels des fruits",
    typeLabel: "Maximum quotidien",
  },
  saturatedFat: {
    type: "max" as const,
    unit: "g",
    label: "Lipides saturés",
    emoji: "🧈",
    color: "var(--fat)",
    field: "saturatedFatGrams" as const,
    refs: [
      { label: "OMS",   value: 22, per_kg: false, desc: "<22 g/j — <10% énergie sur 2000 kcal" },
      { label: "EFSA",  value: 22, per_kg: false, desc: "<10% énergie totale · référence européenne" },
      { label: "FDA",   value: 20, per_kg: false, desc: "20 g/j — valeur de référence US" },
      { label: "ANSES", value: 27, per_kg: false, desc: "<12% énergie · recommandation française" },
    ],
    note: "Viandes grasses, charcuterie, fromage, huile coco/palme",
    typeLabel: "Maximum quotidien",
  },
} as const;

type NutrientKey = keyof typeof NUTRIENT_REFS;

export default function TrackedNutrientsPanel() {
  const [open,        setOpen]       = useState(false);
  const [tracked,     setTracked]    = useState<TrackedNutrients>(DEFAULT_TRACKED);
  const [chartPrefs,  setChartPrefs] = useState<Record<string, unknown>>({});
  const [goals,       setGoals]      = useState({
    proteinGrams:      50,
    sodiumMg:          2000,
    sugarGrams:        50,
    saturatedFatGrams: 20,
  });
  const [weightKg,  setWeightKg]  = useState<number>(70);
  const [saving,    setSaving]    = useState(false);
  const [saved,     setSaved]     = useState(false);

  useEffect(() => {
    fetch("/api/goals")
      .then(r => r.json())
      .then((d: {
        chartPrefs?: Record<string, unknown> & { trackedNutrients?: TrackedNutrients };
        goals?: { proteinGrams?: number; sodiumMg?: number; sugarGrams?: number; saturatedFatGrams?: number; currentWeightKg?: number; targetWeightKg?: number };
      }) => {
        if (d.chartPrefs) {
          setChartPrefs(d.chartPrefs);
          if (d.chartPrefs.trackedNutrients) setTracked(d.chartPrefs.trackedNutrients);
        }
        setGoals({
          proteinGrams:      d.goals?.proteinGrams      ?? 50,
          sodiumMg:          d.goals?.sodiumMg          ?? 2000,
          sugarGrams:        d.goals?.sugarGrams        ?? 50,
          saturatedFatGrams: d.goals?.saturatedFatGrams ?? 20,
        });
        const w = d.goals?.currentWeightKg ?? d.goals?.targetWeightKg ?? 70;
        if (w) setWeightKg(w);
      })
      .catch(() => {});
  }, []);

  const toggle = (key: keyof TrackedNutrients) =>
    setTracked(prev => ({ ...prev, [key]: !prev[key] }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch("/api/goals", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proteinGrams:      goals.proteinGrams,
          sodiumMg:          goals.sodiumMg,
          sugarGrams:        goals.sugarGrams,
          saturatedFatGrams: goals.saturatedFatGrams,
        }),
      });
      await fetch("/api/goals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chartPrefs: { ...chartPrefs, trackedNutrients: tracked } }),
      });
      setSaved(true);
      setTimeout(() => { setSaved(false); setOpen(false); }, 1200);
    } finally { setSaving(false); }
  };

  const activeCount = Object.values(tracked).filter(Boolean).length;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.07 }} className="glass p-4 mb-4">

      {/* Header */}
      <button className="w-full flex items-center gap-3" onClick={() => setOpen(v => !v)}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0"
          style={{ background: "rgba(236,72,153,0.12)" }}>🔬</div>
        <div className="flex-1 min-w-0 text-left">
          <p className="font-semibold text-[13.5px]" style={{ color: "var(--text-primary)" }}>Suivi nutritionnel avancé</p>
          <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            {activeCount === 0
              ? "OMS · EFSA · FDA · ANSES — activez les paramètres"
              : `${activeCount} paramètre${activeCount > 1 ? "s" : ""} actif${activeCount > 1 ? "s" : ""} · références internationales`}
          </p>
        </div>
        {open ? <IconChevronUp size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
               : <IconChevronDown size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />}
      </button>

      <AnimatePresence initial={false}>
      {open && (
      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
        exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }} style={{ overflow: "hidden" }}>
        <div className="mt-4 space-y-3">

          {/* Source badge */}
          <div className="flex items-center gap-1.5 flex-wrap px-1">
            {(["OMS", "EFSA", "FDA", "ANSES"] as const).map(org => (
              <span key={org} className="text-[11px] font-bold px-1.5 py-0.5 rounded"
                style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
                {org}
              </span>
            ))}
            <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>Références internationales</span>
          </div>

          {(Object.keys(NUTRIENT_REFS) as NutrientKey[]).map((key) => {
            const cfg = NUTRIENT_REFS[key];
            const isActive = tracked[key as keyof TrackedNutrients];
            const currentVal = goals[cfg.field];
            const isMax = cfg.type === "max";

            // Compute preset value for per_kg refs
            const presetVal = (ref: typeof cfg.refs[number]) =>
              ref.per_kg ? Math.round(ref.value * weightKg) : ref.value;

            // Reference range for bar indicator
            const maxRef = Math.max(...cfg.refs.map(r => presetVal(r)));

            return (
              <div key={key} className="rounded-xl overflow-hidden"
                style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${isActive ? "rgba(255,255,255,0.12)" : "var(--border)"}` }}>

                {/* Row header */}
                <div className="flex items-center gap-3 px-3 py-2.5">
                  <span className="text-base">{cfg.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>{cfg.label}</p>
                    <p className="text-[11px]" style={{ color: isMax ? "var(--danger)" : "var(--protein)" }}>
                      {isMax ? "MAX recommandé" : "MIN recommandé"}
                    </p>
                  </div>
                  {/* Toggle */}
                  <button onClick={() => toggle(key as keyof TrackedNutrients)}
                    className="relative flex-shrink-0 w-[44px] h-[24px] rounded-full transition-all"
                    style={{ background: isActive ? cfg.color : "rgba(255,255,255,0.1)", border: "1px solid var(--border)" }}>
                    <span className="absolute top-[2px] w-[18px] h-[18px] rounded-full transition-all"
                      style={{ background: "#fff", left: isActive ? "calc(100% - 20px)" : "2px", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
                  </button>
                </div>

                {/* Expanded content when active */}
                <AnimatePresence initial={false}>
                {isActive && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }} style={{ overflow: "hidden" }}>
                    <div className="px-3 pb-3 space-y-3"
                      style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>

                      {/* Reference presets */}
                      <div>
                        <p className="text-[11px] uppercase tracking-wide mt-2.5 mb-1.5 font-semibold"
                          style={{ color: "var(--text-muted)" }}>Références</p>
                        <div className="flex flex-col gap-1">
                          {cfg.refs.map((ref, i) => {
                            const val = presetVal(ref);
                            const isSelected = currentVal === val;
                            return (
                              <button key={i}
                                onClick={() => setGoals(prev => ({ ...prev, [cfg.field]: val }))}
                                className="flex items-center justify-between px-2.5 py-2 rounded-lg text-left transition-all"
                                style={{
                                  background: isSelected ? `color-mix(in srgb, ${cfg.color} 9%, transparent)` : "rgba(255,255,255,0.03)",
                                  border: `1px solid ${isSelected ? cfg.color : "var(--border)"}`,
                                }}>
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] font-bold px-1.5 py-0.5 rounded"
                                    style={{
                                      background: isSelected ? `color-mix(in srgb, ${cfg.color} 15%, transparent)` : "rgba(255,255,255,0.06)",
                                      color: isSelected ? cfg.color : "var(--text-muted)",
                                      border: `1px solid ${isSelected ? cfg.color : "var(--border)"}`,
                                      minWidth: "44px",
                                      textAlign: "center",
                                    }}>
                                    {ref.label}
                                  </span>
                                  <span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>{ref.desc}</span>
                                </div>
                                <span className="text-[12px] font-bold tabular-nums flex-shrink-0 ml-2"
                                  style={{ color: isSelected ? cfg.color : "var(--text-primary)" }}>
                                  {val} <span className="text-[11px] font-normal" style={{ color: "var(--text-muted)" }}>{cfg.unit}</span>
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Note */}
                      <p className="text-[11px] italic px-0.5" style={{ color: "var(--text-muted)" }}>
                        {cfg.note}
                        {key === "protein" && weightKg && <span> · basé sur {weightKg} kg</span>}
                      </p>

                      {/* Custom input */}
                      <div className="flex items-center gap-2">
                        <p className="text-[11px] flex-1" style={{ color: "var(--text-secondary)" }}>
                          {cfg.typeLabel}
                        </p>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            value={currentVal}
                            onChange={e => setGoals(prev => ({ ...prev, [cfg.field]: Number(e.target.value) }))}
                            className="w-20 h-8 rounded-lg text-center text-[13px] font-medium"
                            style={{
                              background: "rgba(255,255,255,0.06)",
                              border: `1px solid ${cfg.color}`,
                              color: "var(--text-primary)",
                            }}
                          />
                          <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{cfg.unit}</span>
                        </div>
                      </div>

                      {/* Visual bar */}
                      <div>
                        <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                          <div className="h-full rounded-full transition-all" style={{
                            width: `${Math.min(currentVal / (maxRef * 1.3) * 100, 100)}%`,
                            background: isMax && currentVal > maxRef ? "var(--danger)" : cfg.color,
                          }} />
                        </div>
                        <div className="flex justify-between text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
                          <span>0</span>
                          <span>Objectif : {currentVal} {cfg.unit}</span>
                          <span>Réf. max : {maxRef} {cfg.unit}</span>
                        </div>
                      </div>

                    </div>
                  </motion.div>
                )}
                </AnimatePresence>
              </div>
            );
          })}

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-semibold transition-all"
            style={{
              background: saved ? "rgba(34,197,94,0.12)" : "linear-gradient(135deg,rgba(236,72,153,0.15),rgba(168,85,247,0.12))",
              border: `1px solid ${saved ? "rgba(34,197,94,0.4)" : "rgba(236,72,153,0.3)"}`,
              color: saved ? "var(--ok)" : "var(--weight)",
            }}
          >
            {saving ? <IconLoader2 size={13} className="animate-spin" /> : saved ? <IconCircleCheck size={13} /> : <IconDeviceFloppy size={13} />}
            {saved ? "Enregistré !" : "Enregistrer"}
          </button>
        </div>
      </motion.div>
      )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Programme diététique ───────────────────────────────────────────────────
