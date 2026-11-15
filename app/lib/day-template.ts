// journee type pour rattraper un jour non saisi : estimation moyenne repartie sur les repas, jamais une mesure.
import type { FoodEntry, MealType } from "./types";
import { DEFAULT_MEAL_SHARES, MEAL_SHARE_ORDER, MEAL_SHARE_LABELS, type MealShares } from "./meal-shares";

export const TEMPLATE_FOOD_ID = "journee-type";
export type DayQuality = "balanced" | "unbalanced";

const PROFILES = {
  balanced: { protein: 0.20, fat: 0.30, carbs: 0.50, fiberPer1000: 15, sugar: 0.09, satFat: 0.09, sodiumPer1000: 900 },
  unbalanced: { protein: 0.13, fat: 0.40, carbs: 0.47, fiberPer1000: 7, sugar: 0.20, satFat: 0.15, sodiumPer1000: 1700 },
};

export function dayTemplate(kcal: number, quality: DayQuality, shares: MealShares = DEFAULT_MEAL_SHARES): Omit<FoodEntry, "id" | "loggedAt">[] {
  if (!Number.isFinite(kcal) || kcal < 1000 || kcal > 5000) throw new Error("kcal invalide");
  const p = PROFILES[quality];
  const name = `Journée type ${quality === "balanced" ? "équilibrée" : "déséquilibrée"}`;
  const entries: Omit<FoodEntry, "id" | "loggedAt">[] = [];
  let used = 0;
  const meals = MEAL_SHARE_ORDER.filter(m => shares[m] > 0);
  for (let i = 0; i < meals.length; i++) {
    const m = meals[i];
    const isLast = i === meals.length - 1;
    const share = shares[m] / 100;
    const mealKcal = isLast ? kcal - used : Math.round(kcal * share);
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
      meal: m,
      foodId: TEMPLATE_FOOD_ID,
      source: "custom",
      name: `${name} : ${MEAL_SHARE_LABELS[m]}`,
      servingLabel: "1 repas estimé",
      servingGrams: Math.round((kcal * share) / 1.5),
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
