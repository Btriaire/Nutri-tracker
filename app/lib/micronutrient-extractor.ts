import type { FoodNutrition, MicronutrientCode } from "./types";

export interface ExtractedMicronutrient {
  code:   MicronutrientCode;
  amount: number;
  unit:   string;
  source: string;
  time:   string;
}

const FIELD_MAP: { field: keyof FoodNutrition; code: MicronutrientCode; unit: string }[] = [
  { field: "magneziumMg",  code: "magnesium",   unit: "mg" },
  { field: "zincMg",       code: "zinc",        unit: "mg" },
  { field: "vitaminDUg",   code: "vitamin_d",   unit: "µg" },
  { field: "ironMg",       code: "iron",        unit: "mg" },
  { field: "calciumMg",    code: "calcium",     unit: "mg" },
  { field: "potassiumMg",  code: "potassium",   unit: "mg" },
  { field: "vitaminCMg",   code: "vitamin_c",   unit: "mg" },
  { field: "vitaminB12Ug", code: "vitamin_b12", unit: "µg" },
  { field: "vitaminB9Ug",  code: "folate",      unit: "µg" },
];

/**
 * Extract micronutrients from a food's nutrition data, ready to POST to
 * /api/micronutrient-intakes (the server assigns the real Firestore timestamp).
 */
export function extractMicronutrientsFromFood(
  nutrition: FoodNutrition,
  source: string,
  time: string
): ExtractedMicronutrient[] {
  return FIELD_MAP
    .map(({ field, code, unit }) => ({ code, unit, amount: nutrition[field] as number | undefined }))
    .filter((m): m is { code: MicronutrientCode; unit: string; amount: number } => !!m.amount && m.amount > 0)
    .map(m => ({ ...m, source, time }));
}

/**
 * Batch log micronutrients to Firestore via the API route.
 */
export async function logMicronutrients(
  date: string,
  intakes: ExtractedMicronutrient[]
): Promise<void> {
  if (!intakes.length) return;

  await Promise.all(
    intakes.map(intake =>
      fetch("/api/micronutrient-intakes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          code: intake.code,
          amount: intake.amount,
          unit: intake.unit,
          source: intake.source,
          time: intake.time,
        }),
      }).catch(err => console.warn("[micronutrient-extraction]", err))
    )
  );
}
