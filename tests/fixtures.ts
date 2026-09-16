import type { FoodEntry, MealType } from "@/app/lib/types";

/** Entrée de journal minimale mais conforme au type FoodEntry. */
export function foodEntry(over: Partial<FoodEntry> & { name?: string } = {}): FoodEntry {
  const name = over.name ?? "aliment test";
  return {
    id:           over.id ?? name + Math.random().toString(36).slice(2, 7),
    meal:         over.meal ?? ("lunch" as MealType),
    foodId:       "test-food",
    source:       "custom",
    name,
    servingLabel: "1 portion",
    servingGrams: over.servingGrams ?? 100,
    servingQty:   1,
    servingUnit:  "portion",
    loggedAt:     null as never,
    nutrition:    { calories: 100, proteinG: 5, carbsG: 10, fatG: 3, fiberG: 1 },
    ...over,
  };
}
