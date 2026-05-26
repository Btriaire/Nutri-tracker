"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { X, Spinner, Check } from "@phosphor-icons/react";
import type { CustomFood, FoodNutrition } from "@/app/lib/types";

interface Props {
  existing?: CustomFood;
  onSaved:   (id: string) => void;
  onCancel:  () => void;
}

type FieldKey = keyof FoodNutrition;

interface FieldDef { key: FieldKey; label: string; unit: string; required?: boolean }

const MACRO_FIELDS: FieldDef[] = [
  { key: "calories",  label: "Calories",  unit: "kcal", required: true },
  { key: "proteinG",  label: "Protéines", unit: "g",    required: true },
  { key: "carbsG",    label: "Glucides",  unit: "g",    required: true },
  { key: "fatG",      label: "Lipides",   unit: "g",    required: true },
  { key: "fiberG",    label: "Fibres",    unit: "g",    required: true },
];

const SECONDARY_FIELDS: FieldDef[] = [
  { key: "sugarG",        label: "Sucres",       unit: "g"  },
  { key: "saturatedFatG", label: "AG saturés",   unit: "g"  },
  { key: "sodiumMg",      label: "Sodium",       unit: "mg" },
  { key: "cholesterolMg", label: "Cholestérol",  unit: "mg" },
  { key: "potassiumMg",   label: "Potassium",    unit: "mg" },
  { key: "calciumMg",     label: "Calcium",      unit: "mg" },
  { key: "ironMg",        label: "Fer",          unit: "mg" },
  { key: "vitaminCMg",    label: "Vitamine C",   unit: "mg" },
  { key: "vitaminDUg",    label: "Vitamine D",   unit: "µg" },
  { key: "waterG",        label: "Eau",          unit: "g"  },
  { key: "alcoholG",      label: "Alcool",       unit: "g"  },
  { key: "caffeineG",     label: "Caféine",      unit: "g"  },
];

function emptyNutrition(): Partial<Record<FieldKey, string>> {
  return { calories: "", proteinG: "", carbsG: "", fatG: "", fiberG: "" };
}

function foodToForm(food: CustomFood): Partial<Record<FieldKey, string>> {
  const result: Partial<Record<FieldKey, string>> = {};
  for (const k of [...MACRO_FIELDS, ...SECONDARY_FIELDS] as FieldDef[]) {
    const v = food.nutrition[k.key];
    result[k.key] = v != null ? String(v) : "";
  }
  return result;
}

function parseField(v: string): number | undefined {
  const n = parseFloat(v);
  return isNaN(n) ? undefined : n;
}

export default function CustomFoodForm({ existing, onSaved, onCancel }: Props) {
  const [name, setName]       = useState(existing?.name ?? "");
  const [brand, setBrand]     = useState(existing?.brand ?? "");
  const [category, setCategory] = useState(existing?.category ?? "");
  const [servingG, setServingG] = useState(String(existing?.servingSizeG ?? 100));
  const [servingLabel, setServingLabel] = useState(existing?.servingLabel ?? "100g");
  const [fields, setFields]   = useState<Partial<Record<FieldKey, string>>>(
    existing ? foodToForm(existing) : emptyNutrition(),
  );
  const [showMore, setShowMore] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState("");

  const setField = (key: FieldKey, val: string) =>
    setFields((prev) => ({ ...prev, [key]: val }));

  const handleSave = async () => {
    if (!name.trim()) { setError("Le nom est requis"); return; }
    const sg = parseFloat(servingG) || 100;

    const nutrition: FoodNutrition = {
      calories: parseField(fields.calories ?? "") ?? 0,
      proteinG: parseField(fields.proteinG ?? "") ?? 0,
      carbsG:   parseField(fields.carbsG   ?? "") ?? 0,
      fatG:     parseField(fields.fatG     ?? "") ?? 0,
      fiberG:   parseField(fields.fiberG   ?? "") ?? 0,
    };

    for (const { key } of SECONDARY_FIELDS) {
      const v = parseField(fields[key] ?? "");
      if (v != null) (nutrition as unknown as Record<string, unknown>)[key] = v;
    }

    setSaving(true);
    setError("");
    try {
      const url    = existing ? `/api/custom-foods/${existing.id}` : "/api/custom-foods";
      const method = existing ? "PUT" : "POST";
      const res    = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          brand: brand.trim() || undefined,
          category: category.trim() || undefined,
          servingSizeG: sg,
          servingLabel: servingLabel.trim() || `${sg}g`,
          nutrition,
        }),
      });
      const json = await res.json() as { id?: string; error?: string };
      if (!res.ok) { setError(json.error ?? "Erreur"); return; }
      onSaved(existing?.id ?? json.id!);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Name + brand */}
      <div className="space-y-3">
        <div>
          <label className="label-xs block mb-1.5">Nom *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="Ex. Poulet rôti maison" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label-xs block mb-1.5">Marque</label>
            <input value={brand} onChange={(e) => setBrand(e.target.value)} className="input" placeholder="Optionnel" />
          </div>
          <div>
            <label className="label-xs block mb-1.5">Catégorie</label>
            <input value={category} onChange={(e) => setCategory(e.target.value)} className="input" placeholder="Optionnel" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label-xs block mb-1.5">Taille portion (g)</label>
            <input type="number" min="1" value={servingG} onChange={(e) => setServingG(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label-xs block mb-1.5">Label portion</label>
            <input value={servingLabel} onChange={(e) => setServingLabel(e.target.value)} className="input" placeholder="Ex. 1 tranche" />
          </div>
        </div>
      </div>

      {/* Macros per serving */}
      <div>
        <p className="label-xs mb-2">Valeurs nutritionnelles (par portion)</p>
        <div className="grid grid-cols-2 gap-2">
          {MACRO_FIELDS.map(({ key, label, unit }) => (
            <div key={key}>
              <label className="label-xs block mb-1">{label} ({unit}){" *"}</label>
              <input
                type="number" min="0" step="0.1"
                value={fields[key] ?? ""}
                onChange={(e) => setField(key, e.target.value)}
                className="input"
                placeholder="0"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Secondary nutrients */}
      <div>
        <button
          onClick={() => setShowMore((v) => !v)}
          className="text-[12px] t-muted underline underline-offset-2"
        >
          {showMore ? "Masquer les détails" : "+ Ajouter micronutriments"}
        </button>
        {showMore && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            className="overflow-hidden mt-2"
          >
            <div className="grid grid-cols-2 gap-2">
              {SECONDARY_FIELDS.map(({ key, label, unit }) => (
                <div key={key}>
                  <label className="label-xs block mb-1">{label} ({unit})</label>
                  <input
                    type="number" min="0" step="0.01"
                    value={fields[key] ?? ""}
                    onChange={(e) => setField(key, e.target.value)}
                    className="input"
                    placeholder="—"
                  />
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>

      {error && <p className="text-[12px]" style={{ color: "#f87171" }}>{error}</p>}

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button onClick={onCancel} className="btn btn-ghost flex-1 gap-2">
          <X size={12} />
          Annuler
        </button>
        <button onClick={handleSave} disabled={saving} className="btn btn-primary flex-1 gap-2">
          {saving ? <Spinner size={13} className="animate-spin" /> : <Check size={12} />}
          {existing ? "Mettre à jour" : "Créer l'aliment"}
        </button>
      </div>
    </div>
  );
}
