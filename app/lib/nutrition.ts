import type { ActivityLevel, DayTotals, FoodEntry, FoodNutrition, Gender, NutritionGoals } from "./types";

export function calcTotals(entries: FoodEntry[]): DayTotals {
  return entries.reduce(
    (acc, e) => ({
      calories:       acc.calories + (e.nutrition.calories ?? 0),
      proteinG:       acc.proteinG + (e.nutrition.proteinG ?? 0),
      carbsG:         acc.carbsG   + (e.nutrition.carbsG   ?? 0),
      fatG:           acc.fatG     + (e.nutrition.fatG     ?? 0),
      fiberG:         acc.fiberG   + (e.nutrition.fiberG   ?? 0),
      sugarG:         (acc.sugarG  ?? 0) + (e.nutrition.sugarG  ?? 0),
      sodiumMg:       (acc.sodiumMg ?? 0) + (e.nutrition.sodiumMg ?? 0),
      saturatedFatG:  (acc.saturatedFatG ?? 0) + (e.nutrition.saturatedFatG ?? 0),
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0, sugarG: 0, sodiumMg: 0, saturatedFatG: 0 },
  );
}

export function pct(value: number, goal: number): number {
  if (goal <= 0) return 0;
  return Math.min(Math.round((value / goal) * 100), 999);
}

function r1(v: number) { return Math.round(v * 10) / 10; }
function r0(v: number) { return Math.round(v); }
function sc<T extends number | undefined>(v: T, ratio: number, round: (n: number) => number): T extends number ? number : undefined {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (v != null ? round(v * ratio) : undefined) as any;
}

export function scaleNutrition(nutrition: FoodNutrition, servingGrams: number): FoodNutrition {
  const ratio = servingGrams / 100;
  return {
    calories:       r0(nutrition.calories * ratio),
    proteinG:       r1(nutrition.proteinG * ratio),
    carbsG:         r1(nutrition.carbsG   * ratio),
    fatG:           r1(nutrition.fatG     * ratio),
    fiberG:         r1(nutrition.fiberG   * ratio),
    sugarG:         sc(nutrition.sugarG,        ratio, r1),
    starchG:        sc(nutrition.starchG,       ratio, r1),
    saturatedFatG:  sc(nutrition.saturatedFatG, ratio, r1),
    monounsatFatG:  sc(nutrition.monounsatFatG, ratio, r1),
    polyunsatFatG:  sc(nutrition.polyunsatFatG, ratio, r1),
    transFatG:      sc(nutrition.transFatG,     ratio, r1),
    cholesterolMg:  sc(nutrition.cholesterolMg, ratio, r0),
    sodiumMg:       sc(nutrition.sodiumMg,      ratio, r0),
    saltG:          sc(nutrition.saltG,         ratio, r1),
    potassiumMg:    sc(nutrition.potassiumMg,   ratio, r0),
    calciumMg:      sc(nutrition.calciumMg,     ratio, r0),
    magneziumMg:    sc(nutrition.magneziumMg,   ratio, r0),
    phosphorusMg:   sc(nutrition.phosphorusMg,  ratio, r0),
    ironMg:         sc(nutrition.ironMg,        ratio, r1),
    zincMg:         sc(nutrition.zincMg,        ratio, r1),
    vitaminAUg:     sc(nutrition.vitaminAUg,    ratio, r0),
    vitaminCMg:     sc(nutrition.vitaminCMg,    ratio, r1),
    vitaminDUg:     sc(nutrition.vitaminDUg,    ratio, r1),
    vitaminB12Ug:   sc(nutrition.vitaminB12Ug,  ratio, r1),
    vitaminB9Ug:    sc(nutrition.vitaminB9Ug,   ratio, r0),
    waterG:         sc(nutrition.waterG,        ratio, r1),
    alcoholG:       sc(nutrition.alcoholG,      ratio, r1),
    caffeineG:      sc(nutrition.caffeineG,     ratio, r1),
  };
}

export function defaultGoals(): NutritionGoals {
  return {
    dailyCalories:  2000,
    proteinGrams:   150,
    carbsGrams:     220,
    fatGrams:       65,
    fiberGrams:     30,
    waterMl:        2000,
    targetWeightKg: null,
    weeklyGoal:     "maintain",
    activityLevel:  "moderate",
    stepsGoal:      10000,
    sleepGoalMin:   420,
  };
}

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary:   1.2,
  light:       1.375,
  moderate:    1.55,
  active:      1.725,
  very_active: 1.9,
};

export function calcTDEE(
  weightKg:      number,
  heightCm:      number,
  age:           number,
  gender:        Gender,
  activityLevel: ActivityLevel,
): number {
  const bmr = gender === "male"
    ? 10 * weightKg + 6.25 * heightCm - 5 * age + 5
    : 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
  return Math.round(bmr * ACTIVITY_MULTIPLIERS[activityLevel]);
}
