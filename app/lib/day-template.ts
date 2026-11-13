// journee type pour rattraper un jour non saisi : estimation moyenne repartie sur les repas, jamais une mesure.
import type { FoodEntry, MealType } from "./types";

export const TEMPLATE_FOOD_ID = "journee-type";
export type DayQuality = "balanced" | "unbalanced";

const MEALS: { meal: MealType; share: number; label: string }[] = [
  { meal: "breakfast", share: 0.25, label: "petit-déjeuner" },
  { meal: "lunch", share: 0.35, label: "déjeuner" },
  { meal: "snacks", share: 0.10, label: "collation" },
  { meal: "dinner", share: 0.30, label: "dîner" },
];

const PROFILES = {
  balanced: { protein: 0.20, fat: 0.30, carbs: 0.50, fiberPer1000: 15, sugar: 0.09, satFat: 0.09, sodiumPer1000: 900 },
  unbalanced: { protein: 0.13, fat: 0.40, carbs: 0.47, fiberPer1000: 7, sugar: 0.20, satFat: 0.15, sodiumPer1000: 1700 },
};

export function dayTemplate(kcal: number, quality: DayQuality): Omit<FoodEntry, "id" | "loggedAt">[] {
  if (!Number.isFinite(kcal) || kcal < 1000 || kcal > 5000) throw new Error("kcal invalide");
  const p = PROFILES[quality];
  const name = `Journée type ${quality === "balanced" ? "équilibrée" : "déséquilibrée"}`;
  const entries: Omit<FoodEntry, "id" | "loggedAt">[] = [];
  let used = 0;
  for (let i = 0; i < MEALS.length; i++) {
    const m = MEALS[i];
    const isLast = i === MEALS.length - 1;
    const mealKcal = isLast ? kcal - used : Math.round(kcal * m.share);
    used += mealKcal;
    const proteinG = (mealKcal * p.protein) / 4;
    const carbsG = (mealKcal * p.carbs) / 4;
    const fatG = (mealKcal * p.fat) / 9;
    const fiberG = (p.fiberPer1000 * mealKcal) / 1000;
    const sugarG = (mealKcal * p.sugar) / 4;
    const satFatG = (mealKcal * p.satFat) / 9;
    const sodiumMg = Math.round((p.sodiumPer1000 * mealKcal) / 1000);
    const saltG = Math.round(((sodiumMg * 2.5) / 1000) * 10) / 10;
    entries.push({
      meal: m.meal,
      foodId: TEMPLATE_FOOD_ID,
      source: "custom",
      name: `${name} : ${m.label}`,
      servingLabel: "1 repas estimé",
      servingGrams: Math.round((kcal * m.share) / 1.5),
      servingQty: 1,
      servingUnit: "repas",
      notes: "Estimation pour un jour non saisi, pas une mesure",
      nutrition: {
        calories: mealKcal,
        proteinG: Math.round(proteinG * 10) / 10,
        carbsG: Math.round(carbsG * 10) / 10,
        fatG: Math.round(fatG * 10) / 10,
        fiberG: Math.round(fiberG * 10) / 10,
        sugarG: Math.round(sugarG * 10) / 10,
        saturatedFatG: Math.round(satFatG * 10) / 10,
        sodiumMg,
        saltG,
      },
    });
  }
  return entries;
}
