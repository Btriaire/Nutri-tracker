import type { FoodEntry, MealType } from "./types";

export const EGG_DIET_DURATIONS = [3, 5, 7] as const;

export interface EggProgramPrefs {
  startDate: string;
  days: number;
  autoFill: boolean;
  filled: string[];
}

export type EggPlanEntry = Omit<FoodEntry, "id" | "loggedAt">;

const FOODS = {
  blanc: ["Blanc d'oeuf", "blanc", 33, 17, 3.6, 0.2, 0, 0],
  oeuf: ["Oeuf entier", "oeuf", 55, 78, 6.3, 0.6, 5.3, 0],
  laitage: ["Laitage nature 0 %", "pot", 125, 45, 6, 6, 0.2, 0],
  bouillon: ["Bouillon de legumes", "bol", 250, 10, 0.5, 1.5, 0.2, 0.3],
  boisson: ["Cafe ou the sans sucre", "tasse", 200, 0, 0, 0, 0, 0],
} as const;

const MENU = [
  ["breakfast", "blanc", 3],
  ["breakfast", "laitage", 1],
  ["breakfast", "boisson", 1],
  ["lunch", "blanc", 3],
  ["lunch", "oeuf", 1],
  ["lunch", "laitage", 1],
  ["lunch", "bouillon", 1],
  ["dinner", "blanc", 3],
  ["dinner", "oeuf", 1],
  ["dinner", "laitage", 1],
  ["dinner", "bouillon", 1],
] as const;

export function eggDayIndex(startDate: string, date: string): number {
  const [sy, sm, sd] = startDate.split("-").map(Number);
  const [dy, dm, dd] = date.split("-").map(Number);
  const start = Date.UTC(sy, sm - 1, sd);
  const end = Date.UTC(dy, dm - 1, dd);
  return Math.round((end - start) / 86400000);
}

export function eggProgramStatus(
  prefs: EggProgramPrefs | null | undefined,
  date: string
): { active: boolean; day: number; total: number; filled: boolean } {
  if (!prefs) return { active: false, day: 0, total: 0, filled: false };
  const index = eggDayIndex(prefs.startDate, date);
  const active = index >= 0 && index < prefs.days;
  const day = active ? index + 1 : 0;
  const filled = prefs.filled.includes(date);
  return { active, day, total: prefs.days, filled };
}

export function eggPlanForDay(
  dayIndex: number,
  opts?: { morningSnack?: boolean }
): EggPlanEntry[] {
  // opts?.morningSnack is ignored as this program does not include morning snacks
  const entries: EggPlanEntry[] = [];

  for (const [meal, foodId, qty] of MENU) {
    const [name, unit, gramsPerUnit, kcal, protein, carbs, fat, fiber] =
      FOODS[foodId as keyof typeof FOODS];
    const servingGrams = gramsPerUnit * qty;
    const servingLabel = `${qty} ${unit} (${servingGrams} g)`;
    const nutrition = {
      calories: Math.round(kcal * qty),
      proteinG: Math.round(protein * qty * 10) / 10,
      carbsG: Math.round(carbs * qty * 10) / 10,
      fatG: Math.round(fat * qty * 10) / 10,
      fiberG: Math.round(fiber * qty * 10) / 10,
    };

    entries.push({
      meal: meal as MealType,
      foodId: `egg-diet:${foodId}`,
      source: "custom",
      name,
      servingLabel,
      servingGrams,
      servingQty: qty,
      servingUnit: unit,
      notes: "Regime aux oeufs",
      nutrition,
    });
  }

  return entries;
}
