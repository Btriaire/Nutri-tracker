import type { FoodNutrition } from "./types";

// Valeurs pour 100 g renvoyees par les modeles (voix, photo, recherche IA).
export interface AiPer100g {
  calories: number;
  proteinG: number;
  carbsG:   number;
  fatG:     number;
  fiberG:   number;
  sodiumMg?:      number;
  saturatedFatG?: number;
}

/** Consigne a ajouter aux prompts : sans elle, le modele ne renvoie jamais sodium ni graisses saturees. */
export const AI_SODIUM_SAT_RULES =
  `- "sodiumMg" = SODIUM en milligrammes pour 100 g (le sodium, pas le sel : sel en g x 400 = sodium en mg ; ex. pain ≈ 500, jambon cuit ≈ 750, fruit frais ≈ 2). "saturatedFatG" = graisses saturées en grammes pour 100 g, toujours ≤ "fatG". Pour un plat composé, donne les valeurs du plat entier.`;

// Plausibilite : une valeur hors plage est ecartee (le serveur la remplacera par une estimation CIQUAL)
// plutot que d'etre enregistree telle quelle. 39 340 mg = sodium du sel pur, le maximum physique pour 100 g.
function plausible(v: unknown, max: number): number | undefined {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= max ? n : undefined;
}

export function aiScaleToGrams(per100g: AiPer100g, grams: number): FoodNutrition {
  const r = grams / 100;
  const fat = Number(per100g.fatG) || 0;
  const sodium = plausible(per100g.sodiumMg, 39_340);
  let sat = plausible(per100g.saturatedFatG, 100);
  if (sat !== undefined && sat > fat + 0.5) sat = undefined;   // incoherent : plus de saturees que de lipides

  return {
    calories: Math.round(per100g.calories * r),
    proteinG: Math.round(per100g.proteinG * r * 10) / 10,
    carbsG:   Math.round(per100g.carbsG   * r * 10) / 10,
    fatG:     Math.round(fat * r * 10) / 10,
    fiberG:   Math.round(per100g.fiberG   * r * 10) / 10,
    ...(sodium !== undefined ? { sodiumMg: Math.round(sodium * r) } : {}),
    ...(sat !== undefined ? { saturatedFatG: Math.round(sat * r * 10) / 10 } : {}),
  };
}
