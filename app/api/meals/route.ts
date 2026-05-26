import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { nanoid } from "nanoid";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import type { SavedMeal, SavedMealEntry, FoodNutrition } from "@/app/lib/types";

function sumNutrition(entries: SavedMealEntry[]): FoodNutrition {
  return entries.reduce<FoodNutrition>(
    (acc, e) => ({
      calories:   acc.calories   + e.nutrition.calories,
      proteinG:   acc.proteinG   + e.nutrition.proteinG,
      carbsG:     acc.carbsG     + e.nutrition.carbsG,
      fatG:       acc.fatG       + e.nutrition.fatG,
      fiberG:     acc.fiberG     + e.nutrition.fiberG,
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 },
  );
}

export async function GET() {
  const db   = getAdminFirestore();
  const snap = await db.collection("users/owner/savedMeals").orderBy("name").get();
  const meals = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as SavedMeal[];
  return NextResponse.json({ meals });
}

export async function POST(req: Request) {
  const body = await req.json() as { name: string; icon?: string; entries: SavedMealEntry[] };
  if (!body.name || !body.entries?.length) {
    return NextResponse.json({ error: "name and entries required" }, { status: 400 });
  }

  const db  = getAdminFirestore();
  const id  = nanoid(12);
  const now = FieldValue.serverTimestamp();

  await db.doc(`users/owner/savedMeals/${id}`).set({
    id,
    name:           body.name,
    icon:           body.icon ?? "🍽️",
    entries:        body.entries,
    totalNutrition: sumNutrition(body.entries),
    createdAt:      now,
    updatedAt:      now,
  });

  return NextResponse.json({ id });
}
