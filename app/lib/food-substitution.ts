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
