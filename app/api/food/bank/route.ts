import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import { getSession } from "@/app/lib/session";
import { nutritionPer100gFromServing } from "@/app/lib/nutrition";
import { inferFoodCategory } from "@/app/lib/food-substitution";
import type { DayLog, FoodNutrition, FoodSource, MealType } from "@/app/lib/types";

export const dynamic = "force-dynamic";

export interface BankFood {
  name:             string;
  brand?:           string;
  source:           FoodSource;
  /** "off:3017624010701" etc — for OFF items, the barcode after "off:" can be
   *  used to fetch Nutri-Score/NOVA/additives on demand (see /api/food/bank/quality). */
  foodId:           string;
  category:         string;
  timesLogged:      number;
  totalGrams:       number;
  firstLoggedDate:  string; // YYYY-MM-DD
  lastLoggedDate:   string;
  nutritionPer100g: FoodNutrition; // from the most recent occurrence
  mealCounts:       Partial<Record<MealType, number>>;
}

// "Vraiment exhaustif" — pas de fenêtre glissante comme /api/food/recent (60j) :
// on parcourt tout l'historique. Un utilisateur normal a quelques centaines de
// jours de logs max, donc un scan complet reste bon marché (~1 lecture/jour).
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db   = getAdminFirestore();
  const snap = await db.collection(`users/${session.userId}/foodLog`).orderBy("date", "asc").get();

  const byName = new Map<string, BankFood>();

  for (const doc of snap.docs) {
    const log = doc.data() as DayLog;
    for (const entry of log.entries ?? []) {
      if (!entry.servingGrams || entry.servingGrams <= 0) continue;
      const key = entry.name.trim().toLowerCase();
      if (!key) continue;

      const existing = byName.get(key);
      if (existing) {
        existing.timesLogged += 1;
        existing.totalGrams  += entry.servingGrams;
        existing.lastLoggedDate = doc.id;
        existing.nutritionPer100g = nutritionPer100gFromServing(entry.nutrition, entry.servingGrams);
        existing.foodId = entry.foodId;
        existing.mealCounts[entry.meal] = (existing.mealCounts[entry.meal] ?? 0) + 1;
        continue;
      }

      byName.set(key, {
        name:             entry.name,
        brand:            entry.brand,
        source:           entry.source,
        foodId:           entry.foodId,
        category:         inferFoodCategory(entry.name),
        timesLogged:      1,
        totalGrams:       entry.servingGrams,
        firstLoggedDate:  doc.id,
        lastLoggedDate:   doc.id,
        nutritionPer100g: nutritionPer100gFromServing(entry.nutrition, entry.servingGrams),
        mealCounts:       { [entry.meal]: 1 },
      });
    }
  }

  const foods = Array.from(byName.values()).sort((a, b) => b.timesLogged - a.timesLogged);

  return NextResponse.json({ foods, daysScanned: snap.size });
}
