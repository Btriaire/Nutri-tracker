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
  oeuf: ["Oeuf", "oeuf", 55, 78, 6.3, 0.6, 5.3, 0],
  pain: ["Pain complet", "tranche", 30, 74, 3, 13, 1, 2.4],
  kiwi: ["Kiwi vert", "kiwi", 80, 49, 0.9, 10, 0.4, 2.1],
  pamplemousse: ["Pamplemousse", "demi", 150, 50, 0.9, 12, 0.2, 1.5],
  pomme: ["Pomme", "pomme", 150, 78, 0.4, 19, 0.3, 3.3],
  poire: ["Poire", "poire", 150, 84, 0.6, 20, 0.2, 4.5],
  clementine: ["Clementine", "clementine", 70, 33, 0.5, 7.5, 0.1, 1],
  fraises: ["Fraises", "100 g", 100, 32, 0.7, 6, 0.3, 2],
  fruits_rouges: ["Fruits rouges", "100 g", 100, 45, 1, 8, 0.4, 4],
  yaourt: ["Yaourt nature 0 %", "yaourt", 125, 45, 6, 6, 0.2, 0],
  fromage_blanc: ["Fromage blanc 0 %", "100 g", 100, 48, 8, 4, 0.2, 0],
  champignons: ["Champignons poeles", "portion", 100, 22, 3, 0.3, 0.3, 1],
  huile: ["Huile d'olive", "c. a cafe", 5, 45, 0, 0, 5, 0],
  salade_verte: ["Salade verte", "100 g", 100, 15, 1.2, 1.5, 0.2, 1.3],
  salade_composee: ["Salade tomate-concombre", "portion", 200, 40, 2, 7, 0.4, 2.4],
  salade_legumes: ["Salade laitue-tomate-concombre", "portion", 200, 35, 2, 6, 0.4, 2.2],
  courgettes: ["Courgettes poelees", "portion", 200, 34, 2.4, 5, 0.4, 2.2],
  thon: ["Thon au naturel", "portion", 90, 100, 22, 0, 1, 0],
  soupe: ["Soupe de legumes", "bol", 300, 105, 3.5, 17, 2.5, 5],
  epinards: ["Epinards", "portion", 150, 35, 4.3, 2, 0.7, 3.5],
  haricots_verts: ["Haricots verts", "portion", 150, 45, 2.7, 6, 0.3, 4.2],
  jambon: ["Jambon blanc degraisse", "tranche", 40, 42, 7.5, 0.4, 1, 0],
} as const;

const MENUS = [
  [
    ["breakfast", "oeuf", 2],
    ["breakfast", "pain", 1],
    ["breakfast", "kiwi", 1],
    ["morning_snack", "yaourt", 1],
    ["lunch", "oeuf", 3],
    ["lunch", "champignons", 1],
    ["lunch", "huile", 1],
    ["lunch", "salade_verte", 1],
    ["lunch", "pain", 1],
    ["lunch", "pomme", 1],
    ["snacks", "fromage_blanc", 1],
    ["snacks", "fraises", 1],
    ["dinner", "oeuf", 2],
    ["dinner", "huile", 1],
    ["dinner", "courgettes", 1],
    ["dinner", "pain", 1],
  ],
  [
    ["breakfast", "oeuf", 2],
    ["breakfast", "pain", 1],
    ["breakfast", "pamplemousse", 1],
    ["morning_snack", "pomme", 1],
    ["lunch", "oeuf", 2],
    ["lunch", "thon", 1],
    ["lunch", "salade_composee", 1],
    ["lunch", "huile", 1],
    ["lunch", "pain", 1],
    ["lunch", "poire", 1],
    ["snacks", "oeuf", 1],
    ["snacks", "clementine", 1],
    ["dinner", "soupe", 1],
    ["dinner", "oeuf", 2],
    ["dinner", "fromage_blanc", 1],
    ["dinner", "pain", 1],
  ],
  [
    ["breakfast", "oeuf", 2],
    ["breakfast", "pain", 1],
    ["breakfast", "fruits_rouges", 1],
    ["morning_snack", "yaourt", 1],
    ["lunch", "oeuf", 3],
    ["lunch", "epinards", 1],
    ["lunch", "huile", 1],
    ["lunch", "haricots_verts", 1],
    ["lunch", "pain", 1],
    ["lunch", "kiwi", 1],
    ["snacks", "fromage_blanc", 1],
    ["dinner", "salade_legumes", 1],
    ["dinner", "oeuf", 2],
    ["dinner", "jambon", 1],
    ["dinner", "pomme", 1],
    ["dinner", "pain", 1],
  ],
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
  const variant = ((dayIndex % 3) + 3) % 3;
  const menu = MENUS[variant];
  const entries: EggPlanEntry[] = [];
  const foodCounts: Record<string, number> = {};

  for (const [meal, foodId, qty] of menu) {
    if (meal === "morning_snack" && !opts?.morningSnack) continue;
    const key = `${meal}-${foodId}`;
    if (foodCounts[key]) continue;
    foodCounts[key] = 1;

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
