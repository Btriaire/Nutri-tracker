import type { FoodNutrition, MicronutrientIntake, MicronutrientCode } from "./types";
import { format } from "date-fns";
import { Timestamp } from "firebase-admin/firestore";

/**
 * Extract micronutrients from food nutrition data and prepare them for logging.
 * Maps FoodNutrition fields → MicronutrientIntake array
 */
export function extractMicronutrientsFromFood(
  nutrition: FoodNutrition,
  source: string,
  time: string = format(new Date(), "HH:mm")
): MicronutrientIntake[] {
  const intakes: MicronutrientIntake[] = [];

  // Minerals
  if (nutrition.magneziumMg) {
    intakes.push({
      code: "magnesium",
      amount: nutrition.magneziumMg,
      unit: "mg",
      source,
      time,
      loggedAt: Timestamp.now(),
    });
  }
  if (nutrition.zincMg) {
    intakes.push({
      code: "zinc",
      amount: nutrition.zincMg,
      unit: "mg",
      source,
      time,
      loggedAt: Timestamp.now(),
    });
  }
  if (nutrition.vitaminDUg) {
    intakes.push({
      code: "vitamin_d",
      amount: nutrition.vitaminDUg,
      unit: "µg",
      source,
      time,
      loggedAt: Timestamp.now(),
    });
  }
  if (nutrition.ironMg) {
    intakes.push({
      code: "iron",
      amount: nutrition.ironMg,
      unit: "mg",
      source,
      time,
      loggedAt: Timestamp.now(),
    });
  }
  if (nutrition.calciumMg) {
    intakes.push({
      code: "calcium",
      amount: nutrition.calciumMg,
      unit: "mg",
      source,
      time,
      loggedAt: Timestamp.now(),
    });
  }
  if (nutrition.potassiumMg) {
    intakes.push({
      code: "potassium",
      amount: nutrition.potassiumMg,
      unit: "mg",
      source,
      time,
      loggedAt: Timestamp.now(),
    });
  }
  // Vitamins
  if (nutrition.vitaminCMg) {
    intakes.push({
      code: "vitamin_c",
      amount: nutrition.vitaminCMg,
      unit: "mg",
      source,
      time,
      loggedAt: Timestamp.now(),
    });
  }
  if (nutrition.vitaminB12Ug) {
    intakes.push({
      code: "vitamin_b12",
      amount: nutrition.vitaminB12Ug,
      unit: "µg",
      source,
      time,
      loggedAt: Timestamp.now(),
    });
  }
  if (nutrition.vitaminB9Ug) {
    intakes.push({
      code: "folate",
      amount: nutrition.vitaminB9Ug,
      unit: "µg",
      source,
      time,
      loggedAt: Timestamp.now(),
    });
  }

  return intakes.filter(i => i.amount > 0);
}

/**
 * Batch log micronutrients to Firestore
 */
export async function logMicronutrients(
  date: string,
  intakes: MicronutrientIntake[]
): Promise<void> {
  if (!intakes.length) return;

  try {
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
        })
      )
    );
  } catch (e) {
    console.warn("[micronutrient-extraction]", e);
  }
}
