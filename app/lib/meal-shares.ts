// repartition des calories entre les repas, propre a chaque utilisateur (pourcentages entiers, total 100).
import type { MealType } from "./types";
export const MEAL_SHARE_ORDER: MealType[] = ["breakfast","morning_snack","lunch","snacks","dinner"];
export type MealShares = Record<MealType, number>;
export const DEFAULT_MEAL_SHARES: MealShares = { breakfast: 25, morning_snack: 0, lunch: 35, snacks: 10, dinner: 30 };
export const MEAL_SHARE_LABELS: Record<MealType, string> = { breakfast: "Petit-déjeuner", morning_snack: "Collation du matin", lunch: "Déjeuner", snacks: "Collation", dinner: "Dîner" };
export function sanitizeMealShares(x: unknown): MealShares | null {
    if (typeof x !== 'object' || x === null || Array.isArray(x)) {
        return null;
    }
    const mealShares = x as Partial<MealShares>;
    const requiredKeys: MealType[] = ["breakfast", "morning_snack", "lunch", "snacks", "dinner"];
    for (const key of requiredKeys) {
        if (!(key in mealShares) || typeof mealShares[key] !== 'number' || !Number.isInteger(mealShares[key]!) || mealShares[key]! < 0 || mealShares[key]! > 100) {
            return null;
        }
    }
    const sum = requiredKeys.reduce((acc, key) => acc + mealShares[key]!, 0);
    if (sum !== 100) {
        return null;
    }
    return {
        breakfast: mealShares.breakfast!,
        morning_snack: mealShares.morning_snack!,
        lunch: mealShares.lunch!,
        snacks: mealShares.snacks!,
        dinner: mealShares.dinner!
    };
}
