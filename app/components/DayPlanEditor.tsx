"use client"

import { useId } from "react";
import type { DayPlan, EcartType, EcartSize } from "@/app/lib/period-plan";

export default function DayPlanEditor({ plan, onChange, compact }: { plan: DayPlan; onChange: (next: DayPlan) => void; compact?: boolean }) {
  const id = useId();

  const handleKcalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    if (!isNaN(value)) {
      onChange({ ...plan, kcal: value });
    }
  };

  const handleQualityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({ ...plan, quality: e.target.value as "balanced" | "unbalanced" });
  };

  const handleEcartChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === "") {
      onChange({ ...plan, ecart: null });
    } else {
      const [type, size] = value.split(":") as [EcartType, EcartSize];
      onChange({ ...plan, ecart: { type, size } });
    }
  };

  const handleDrinksChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...plan, drinks: Number(e.target.value) });
  };

  const handleFeelingChange = (field: keyof typeof plan.feeling) => (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({ ...plan, feeling: { ...plan.feeling, [field]: Number(e.target.value) } });
  };

  const handleNoteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange({ ...plan, note: e.target.value });
  };

  const handleConfirmedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...plan, confirmed: e.target.checked });
  };

  const date = new Date(plan.date + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  const legend = date.charAt(0).toUpperCase() + date.slice(1);

  return (
    <fieldset className="rounded-lg border border-[var(--border)] p-3 flex flex-col gap-2">
      <legend>{legend}</legend>
      <div className="grid grid-cols-2 gap-2">
        <label htmlFor={`${id}-kcal`}>Calories</label>
        <input
          id={`${id}-kcal`}
          type="number"
          min={1000}
          max={5000}
          step={50}
          value={plan.kcal}
          onChange={handleKcalChange}
          className="min-h-[44px] text-sm bg-[var(--layer-2)] text-[var(--text-primary)] rounded-lg px-2"
        />
        <label htmlFor={`${id}-quality`}>Qualité</label>
        <select
          id={`${id}-quality`}
          value={plan.quality}
          onChange={handleQualityChange}
          className="min-h-[44px] text-sm bg-[var(--layer-2)] text-[var(--text-primary)] rounded-lg px-2"
        >
          <option value="balanced">Équilibrée</option>
          <option value="unbalanced">Déséquilibrée</option>
        </select>
        <label htmlFor={`${id}-ecart`}>Écart</label>
        <select
          id={`${id}-ecart`}
          value={plan.ecart ? `${plan.ecart.type}:${plan.ecart.size}` : ""}
          onChange={handleEcartChange}
          className="min-h-[44px] text-sm bg-[var(--layer-2)] text-[var(--text-primary)] rounded-lg px-2"
        >
          <option value="">Aucun</option>
          <option value="repas:petit">Repas, petit</option>
          <option value="repas:moyen">Repas, moyen</option>
          <option value="repas:gros">Repas, gros</option>
          <option value="sucre:petit">Sucré, petit</option>
          <option value="sucre:moyen">Sucré, moyen</option>
          <option value="sucre:gros">Sucré, gros</option>
          <option value="apero:petit">Apéritif, petit</option>
          <option value="apero:moyen">Apéritif, moyen</option>
          <option value="apero:gros">Apéritif, gros</option>
        </select>
        <label htmlFor={`${id}-drinks`}>Verres d&apos;alcool</label>
        <input
          id={`${id}-drinks`}
          type="number"
          min={0}
          max={15}
          step={1}
          value={plan.drinks}
          onChange={handleDrinksChange}
          className="min-h-[44px] text-sm bg-[var(--layer-2)] text-[var(--text-primary)] rounded-lg px-2"
        />
        <label htmlFor={`${id}-energy`}>Énergie</label>
        <select
          id={`${id}-energy`}
          value={plan.feeling.energy}
          onChange={handleFeelingChange("energy")}
          className="min-h-[44px] text-sm bg-[var(--layer-2)] text-[var(--text-primary)] rounded-lg px-2"
        >
          <option value={1}>1 très bas</option>
          <option value={2}>2 bas</option>
          <option value={3}>3 moyen</option>
          <option value={4}>4 bien</option>
          <option value={5}>5 très bien</option>
        </select>
        <label htmlFor={`${id}-mood`}>Humeur</label>
        <select
          id={`${id}-mood`}
          value={plan.feeling.mood}
          onChange={handleFeelingChange("mood")}
          className="min-h-[44px] text-sm bg-[var(--layer-2)] text-[var(--text-primary)] rounded-lg px-2"
        >
          <option value={1}>1 très bas</option>
          <option value={2}>2 bas</option>
          <option value={3}>3 moyen</option>
          <option value={4}>4 bien</option>
          <option value={5}>5 très bien</option>
        </select>
        <label htmlFor={`${id}-sleep`}>Sommeil</label>
        <select
          id={`${id}-sleep`}
          value={plan.feeling.sleep}
          onChange={handleFeelingChange("sleep")}
          className="min-h-[44px] text-sm bg-[var(--layer-2)] text-[var(--text-primary)] rounded-lg px-2"
        >
          <option value={1}>1 très bas</option>
          <option value={2}>2 bas</option>
          <option value={3}>3 moyen</option>
          <option value={4}>4 bien</option>
          <option value={5}>5 très bien</option>
        </select>
      </div>
      {!compact && (
        <>
          <label htmlFor={`${id}-note`}>Note</label>
          <textarea
            id={`${id}-note`}
            maxLength={300}
            value={plan.note}
            onChange={handleNoteChange}
            className="min-h-[44px] text-sm bg-[var(--layer-2)] text-[var(--text-primary)] rounded-lg px-2"
          />
        </>
      )}
      <label className="flex items-center gap-2 min-h-[44px]">
        <input
          type="checkbox"
          checked={plan.confirmed}
          onChange={handleConfirmedChange}
          className="min-h-[44px] text-sm bg-[var(--layer-2)] text-[var(--text-primary)] rounded-lg px-2"
        />
        Je confirme ce jour (compté dans les analyses)
      </label>
    </fieldset>
  );
}
