import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { nanoid } from "nanoid";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import { getSession } from "@/app/lib/session";
import type { FoodNutrition, Recipe, RecipeIngredient } from "@/app/lib/types";

function sumNutrition(ingredients: RecipeIngredient[]): FoodNutrition {
  const sum: FoodNutrition = { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 };
  const addOpt = (key: keyof FoodNutrition, val: number | undefined) => {
    if (val == null) return;
    const s = sum as unknown as Record<string, number>;
    s[key] = (s[key] ?? 0) + val;
  };
  for (const ing of ingredients) {
    sum.calories += ing.nutrition.calories;
    sum.proteinG += ing.nutrition.proteinG;
    sum.carbsG   += ing.nutrition.carbsG;
    sum.fatG     += ing.nutrition.fatG;
    sum.fiberG   += ing.nutrition.fiberG;
    addOpt("sugarG",        ing.nutrition.sugarG);
    addOpt("saturatedFatG", ing.nutrition.saturatedFatG);
    addOpt("sodiumMg",      ing.nutrition.sodiumMg);
    addOpt("cholesterolMg", ing.nutrition.cholesterolMg);
    addOpt("potassiumMg",   ing.nutrition.potassiumMg);
    addOpt("calciumMg",     ing.nutrition.calciumMg);
    addOpt("ironMg",        ing.nutrition.ironMg);
    addOpt("vitaminCMg",    ing.nutrition.vitaminCMg);
  }
  return sum;
}

function divNutrition(n: FoodNutrition, divisor: number): FoodNutrition {
  if (divisor <= 0) return n;
  const result: FoodNutrition = {
    calories: Math.round(n.calories / divisor),
    proteinG: Math.round(n.proteinG / divisor * 10) / 10,
    carbsG:   Math.round(n.carbsG   / divisor * 10) / 10,
    fatG:     Math.round(n.fatG     / divisor * 10) / 10,
    fiberG:   Math.round(n.fiberG   / divisor * 10) / 10,
  };
  const keys: (keyof FoodNutrition)[] = ["sugarG","saturatedFatG","sodiumMg","cholesterolMg","potassiumMg","calciumMg","ironMg","vitaminCMg"];
  for (const k of keys) {
    const v = (n as unknown as Record<string, unknown>)[k];
    if (typeof v === "number") (result as unknown as Record<string, unknown>)[k] = Math.round(v / divisor * 10) / 10;
  }
  return result;
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db   = getAdminFirestore();
  const snap = await db.collection(`users/${session.userId}/recipes`).orderBy("name").get();
  const recipes = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Recipe[];
  return NextResponse.json({ recipes });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as Pick<Recipe, "name" | "description" | "servings" | "ingredients" | "tags">;
  if (!body.name || !body.ingredients?.length) {
    return NextResponse.json({ error: "name and ingredients required" }, { status: 400 });
  }

  const servings    = Math.max(1, body.servings ?? 1);
  const totalGrams  = body.ingredients.reduce((s, i) => s + i.grams, 0);
  const totalNutrition = sumNutrition(body.ingredients);
  const perServing     = divNutrition(totalNutrition, servings);
  const per100g        = divNutrition(totalNutrition, totalGrams / 100);

  const db  = getAdminFirestore();
  const id  = nanoid(12);
  const now = FieldValue.serverTimestamp();

  await db.doc(`users/${session.userId}/recipes/${id}`).set({
    id,
    name:             body.name,
    description:      body.description ?? null,
    servings,
    totalGrams,
    gramsPerServing:  Math.round(totalGrams / servings),
    ingredients:      body.ingredients,
    nutrition:        perServing,
    nutritionPer100g: per100g,
    tags:             body.tags ?? [],
    createdAt:        now,
    updatedAt:        now,
  });

  return NextResponse.json({ id });
}
