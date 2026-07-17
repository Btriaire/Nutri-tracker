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
 * Force micronutrient detection: structured data from food-search sources
 * (USDA/Edamam search endpoints in particular) is often abbreviated to just
 * calories/macros with no vitamin/mineral detail, and even CIQUAL/OFF rarely
 * cover the full micronutrient list for a given food. Always check the
 * per-food micronutrient library (cached, reused across all users/quantities)
 * — a cache hit costs one Firestore read, so there's no reason to gate this
 * behind "is the structured data sparse enough". Only a genuine cache miss
 * triggers a Groq call, which then gets cached for every future lookup of
 * that food.
 */
export async function extractMicronutrientsForced(
  nutrition: FoodNutrition,
  name: string,
  grams: number,
  source: string,
  time: string
): Promise<ExtractedMicronutrient[]> {
  const structured = extractMicronutrientsFromFood(nutrition, source, time);

  try {
    const res = await fetch("/api/food-micronutrient-ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, grams }),
    });
    if (!res.ok) return structured;
    const data = await res.json() as { micronutrients?: { code: MicronutrientCode; amount: number; unit: string }[] };
    const aiCodes = new Set((data.micronutrients ?? []).map(m => m.code));
    // Keep any structured values the AI didn't cover, prefer AI where both exist (AI accounts for the exact food/quantity)
    const structuredExtra = structured.filter(m => !aiCodes.has(m.code));
    const aiIntakes: ExtractedMicronutrient[] = (data.micronutrients ?? []).map(m => ({
      code: m.code, amount: m.amount, unit: m.unit, source, time,
    }));
    return [...aiIntakes, ...structuredExtra];
  } catch (e) {
    console.warn("[micronutrient-ai-fallback]", e);
    return structured;
  }
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
