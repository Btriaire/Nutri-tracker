import type { FoodNutrition } from "./types";
import { scaleNutrition } from "./nutrition";

export type MatchLevel = "close" | "medium" | "far" | "na";

export interface SubstitutionMacroRow {
  key:         "proteinG" | "carbsG" | "sugarG" | "fatG" | "saturatedFatG";
  label:       string;
  unit:        string;
  sourceValue: number;
  targetValue: number;
  diffPct:     number | null; // (target - source) / source
  match:       MatchLevel;
}

export interface SubstitutionResult {
  sourceGrams:  number;
  targetGrams:  number;
  sourceCalories: number;
  targetCalories: number;
  rows:         SubstitutionMacroRow[];
  overallMatch: Exclude<MatchLevel, "na">;
}

// Tolerant thresholds — food composition varies a lot within a single category
// (e.g. two brands of bread), so "close" means roughly comparable, not identical.
const CLOSE_THRESHOLD  = 0.15;
const MEDIUM_THRESHOLD = 0.35;

function classify(diffPct: number | null): MatchLevel {
  if (diffPct == null) return "na";
  const abs = Math.abs(diffPct);
  if (abs <= CLOSE_THRESHOLD)  return "close";
  if (abs <= MEDIUM_THRESHOLD) return "medium";
  return "far";
}

const ROW_DEFS: { key: SubstitutionMacroRow["key"]; label: string; unit: string }[] = [
  { key: "proteinG",      label: "Protéines",    unit: "g" },
  { key: "carbsG",        label: "Glucides",     unit: "g" },
  { key: "sugarG",        label: "dont Sucres",  unit: "g" },
  { key: "fatG",          label: "Lipides",      unit: "g" },
  { key: "saturatedFatG", label: "dont Saturés", unit: "g" },
];

/**
 * Given two foods expressed per-100g and a quantity of the source food,
 * computes the quantity of the target food with (roughly) the same calories,
 * plus a proximity comparison for the other macros at those two quantities.
 */
export function computeSubstitution(
  sourcePer100g: FoodNutrition,
  targetPer100g: FoodNutrition,
  sourceGrams:   number,
): SubstitutionResult {
  const source = scaleNutrition(sourcePer100g, sourceGrams);
  const targetCaloriesPer100g = Math.max(targetPer100g.calories, 1);
  const targetGrams = Math.round((source.calories / targetCaloriesPer100g) * 100);
  const target = scaleNutrition(targetPer100g, targetGrams);

  const rows: SubstitutionMacroRow[] = ROW_DEFS.map(({ key, label, unit }) => {
    const sourceValue = source[key] ?? 0;
    const targetValue = target[key] ?? 0;
    const diffPct = sourceValue > 0
      ? (targetValue - sourceValue) / sourceValue
      : (targetValue > 0 ? 1 : null);
    return { key, label, unit, sourceValue, targetValue, diffPct, match: classify(diffPct) };
  });

  const scored = rows.filter((r) => r.match !== "na");
  const overallMatch: SubstitutionResult["overallMatch"] =
    scored.length === 0                        ? "medium"
    : scored.every((r) => r.match === "close")  ? "close"
    : scored.some((r) => r.match === "far")     ? "far"
    : "medium";

  return {
    sourceGrams,
    targetGrams,
    sourceCalories: source.calories,
    targetCalories: target.calories,
    rows,
    overallMatch,
  };
}

// ─── Spontaneous suggestions ────────────────────────────────────────────────

/**
 * Share of calories coming from each macro, per-100g — scale-invariant, so it
 * predicts how close computeSubstitution's iso-calorie result will land
 * without having to run the full comparison for every candidate.
 */
function macroCalorieShares(n: FoodNutrition): { protein: number; carbs: number; fat: number } {
  const proteinKcal = Math.max(n.proteinG, 0) * 4;
  const carbKcal     = Math.max(n.carbsG,   0) * 4;
  const fatKcal       = Math.max(n.fatG,     0) * 9;
  const total = Math.max(proteinKcal + carbKcal + fatKcal, 1);
  return { protein: proteinKcal / total, carbs: carbKcal / total, fat: fatKcal / total };
}

/** Lower = more nutritionally similar (0 = identical macro-calorie split). */
export function profileDistance(aPer100g: FoodNutrition, bPer100g: FoodNutrition): number {
  const a = macroCalorieShares(aPer100g);
  const b = macroCalorieShares(bPer100g);
  return Math.abs(a.protein - b.protein) + Math.abs(a.carbs - b.carbs) + Math.abs(a.fat - b.fat);
}

/** Quick match label from a profileDistance value (0..2 range), for a suggestion badge. */
export function quickMatchFromDistance(distance: number): Exclude<MatchLevel, "na"> {
  if (distance <= 0.2) return "close";
  if (distance <= 0.5) return "medium";
  return "far";
}

// Positive = candidate is the healthier pick (lower carb- and fat-calorie share than source).
function healthinessBonus(sourcePer100g: FoodNutrition, candidatePer100g: FoodNutrition): number {
  const s = macroCalorieShares(sourcePer100g);
  const c = macroCalorieShares(candidatePer100g);
  return (s.carbs - c.carbs) + (s.fat - c.fat);
}

// Weight given to "healthier" (less carbs, less fat) over pure macro-profile closeness
// when ranking spontaneous suggestions — a candidate a bit further in raw profile but
// clearly lighter on carbs/fat should still surface above a closer but heavier one.
const HEALTH_BIAS = 0.4;

function suggestionScore(sourcePer100g: FoodNutrition, candidatePer100g: FoodNutrition): number {
  return profileDistance(sourcePer100g, candidatePer100g) - HEALTH_BIAS * healthinessBonus(sourcePer100g, candidatePer100g);
}

// Coarse food-family buckets, keyword-matched on the (accent-stripped, lowercased) name —
// good enough to tell "another bread" from "a dairy product", not a full taxonomy.
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  pain:         ["pain", "baguette", "brioche", "biscotte", "krissprol", "wasa", "toast"],
  cereales:     ["riz", "pate", "pates", "quinoa", "avoine", "boulgour", "semoule", "cereale", "muesli", "flocon", "polenta", "ble"],
  legumineuses: ["lentille", "pois chiche", "haricot sec", "haricot blanc", "haricot rouge", "feve", "soja", "tofu", "tempeh", "edamame"],
  viande:       ["poulet", "boeuf", "porc", "dinde", "veau", "agneau", "jambon", "steak", "viande", "lardon", "saucisse", "canard", "bacon"],
  poisson:      ["poisson", "saumon", "thon", "cabillaud", "colin", "truite", "sardine", "crevette", "fruits de mer", "sushi", "sashimi", "maquereau", "merlu"],
  oeuf:         ["oeuf", "œuf"],
  laitage:      ["lait", "yaourt", "yogourt", "fromage", "petit-suisse", "petit suisse", "skyr", "faisselle"],
  legume:       ["carotte", "brocoli", "courgette", "tomate", "epinard", "haricot vert", "salade", "poireau", "legume", "champignon", "aubergine", "poivron", "chou"],
  fruit:        ["pomme", "banane", "fraise", "raisin", "orange", "poire", "peche", "abricot", "kiwi", "ananas", "fruit", "framboise", "myrtille", "cerise", "mangue", "pasteque", "melon"],
  oleagineux:   ["amande", "noix", "noisette", "cacahuete", "pistache", "graine", "cajou"],
  corpsgras:    ["huile", "beurre", "margarine", "creme fraiche"],
  sucrerie:     ["chocolat", "gateau", "biscuit", "bonbon", "confiture", "miel", "patisserie", "glace", "sucre", "viennoiserie"],
  boisson:      ["jus", "soda", "the ", "cafe", "boisson", "smoothie", "eau "],
};

function normalizeForCategory(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Coarse food-family guess from a name — used to rank same-family substitutes first. */
export function inferFoodCategory(name: string): string {
  const n = ` ${normalizeForCategory(name)} `;
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((k) => n.includes(k))) return category;
  }
  return "autre";
}

export function rankBySimilarity<T>(
  source: { name: string; per100g: FoodNutrition },
  candidates: T[],
  getPer100g: (c: T) => FoodNutrition,
  getName:    (c: T) => string,
  limit = 5,
): T[] {
  const sourceCategory = inferFoodCategory(source.name);
  return [...candidates]
    .sort((a, b) => {
      const sameA = inferFoodCategory(getName(a)) === sourceCategory ? 0 : 1;
      const sameB = inferFoodCategory(getName(b)) === sourceCategory ? 0 : 1;
      if (sameA !== sameB) return sameA - sameB; // same food family first
      return suggestionScore(source.per100g, getPer100g(a)) - suggestionScore(source.per100g, getPer100g(b));
    })
    .slice(0, limit);
}
