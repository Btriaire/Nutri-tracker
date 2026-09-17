"use client";

import { ACTIVITY_OPTIONS, isMuscu } from "@/app/lib/activity-form";
import type { FormState } from "@/app/lib/activity-form";

// Corps du formulaire d'ajout/edition d'activite — extrait de ActivityClient.tsx.
// Reutilise a l'identique pour l'ajout ET l'edition (via les callbacks passes
// en props), d'ou son isolement d'origine.
export default function ActivityFormBody({
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
            <span className="text-[11px] leading-tight" style={{ color: form.actType === opt.type ? "var(--protein)" : "var(--text-muted)" }}>
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
                  className="flex-shrink-0 px-2 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
                  title="Poids variable par série"
                  style={{
                    background: form.variableWeight ? "rgba(251,191,36,0.15)" : "rgba(255,255,255,0.06)",
                    border: `1px solid ${form.variableWeight ? "rgba(251,191,36,0.5)" : "var(--border)"}`,
                    color: form.variableWeight ? "var(--carbs)" : "var(--text-muted)",
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
                    <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>S{i + 1}</span>
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
