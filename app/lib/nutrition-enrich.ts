import ciqualFoods from "./data/ciqual-foods.json";
import { buildCiqualIndex, estimateMissing, type CiqualLite, type CiqualIndex } from "./nutrition-match";
import type { FoodNutrition } from "./types";

let index: CiqualIndex | null = null;
const getIndex = () => (index ??= buildCiqualIndex(ciqualFoods as unknown as CiqualLite[]));

/**
 * Complete sodium et graisses saturees manquants d'un aliment (sans jamais ecraser une valeur connue).
 * `grams` = poids consomme ; `nutrition` est deja a l'echelle de ce poids. Les champs estimes sont
 * listes dans `nutrition.estimated` pour que l'interface puisse les distinguer des valeurs mesurees.
 */
export function enrichNutrition(name: string, grams: number, nutrition: FoodNutrition): FoodNutrition {
  const est = estimateMissing({ name, grams, nutrition }, getIndex());
  if (est.sodiumMg === undefined && est.saturatedFatG === undefined) return nutrition;

  const out: FoodNutrition = { ...nutrition };
  const estimated = new Set(nutrition.estimated ?? []);

  if (est.sodiumMg !== undefined) {
    out.sodiumMg = est.sodiumMg;
    if (est.sodiumSource !== "salt") estimated.add("sodiumMg");   // sel -> sodium est une identite, pas une estimation
    if (out.saltG === undefined) out.saltG = Math.round((est.sodiumMg / 400) * 10) / 10;
  }
  if (est.saturatedFatG !== undefined) {
    out.saturatedFatG = est.saturatedFatG;
    estimated.add("saturatedFatG");
  }
  if (estimated.size) out.estimated = [...estimated];
  return out;
}
