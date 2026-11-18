"use client"

import { useState } from "react";
import { MEAL_SHARE_ORDER, MEAL_SHARE_LABELS } from "@/app/lib/meal-shares";
import type { FoodEntry, MealType } from "@/app/lib/types";

export default function MoveMealSelect({ entry, date, onMoved }: { entry: FoodEntry; date: string; onMoved: (meal: MealType) => void }) {
  const [saving, setSaving] = useState(false);
  const id = `move-${entry.id}`;

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const meal = e.target.value as MealType;
    setSaving(true);

    try {
      const response = await fetch(`/api/log/${encodeURIComponent(entry.id)}?date=${date}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ meal }),
      });

      if (response.ok) {
        onMoved(meal);
      } else {
        alert("Déplacement impossible.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
      <label htmlFor={id} className="text-[12px] text-[var(--text-secondary)]">Déplacer vers</label>
      <select
        id={id}
        className="min-h-[44px] text-[13px] rounded-lg bg-[var(--layer-1)] border border-[var(--border)] text-[var(--text-primary)]"
        value=""
        onChange={handleChange}
        disabled={saving}
      >
        <option value="" disabled>Choisir un repas</option>
        {MEAL_SHARE_ORDER.filter(m => m !== entry.meal).map(m => (
          <option key={m} value={m}>{MEAL_SHARE_LABELS[m]}</option>
        ))}
      </select>
    </div>
  );
}
