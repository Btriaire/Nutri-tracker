#!/usr/bin/env node
/**
 * Seeds 6 predefined calorie-target menus (400/600/800/1200/1500/2000 kcal)
 * into the user's recipes collection so they show up in the Recettes library.
 *
 * Usage: npx tsx scripts/seed-predefined-menus.ts
 */

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import * as path from "path";
import * as dotenv from "dotenv";
import { randomUUID } from "crypto";

dotenv.config({ path: path.join(__dirname, "../.env.local") });

const projectId   = process.env.FIREBASE_ADMIN_PROJECT_ID!.trim();
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL!.trim();
const privateKey  = process.env.FIREBASE_ADMIN_PRIVATE_KEY!.replace(/\\n/g, "\n").trim();

if (!projectId || !clientEmail || !privateKey) {
  console.error("Missing Firebase Admin env vars");
  process.exit(1);
}

const app = getApps().length
  ? getApps()[0]
  : initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
const db = getFirestore(app);

const USER = "owner";

interface Per100g {
  calories: number; proteinG: number; carbsG: number; fatG: number;
  fiberG: number; sugarG: number; saturatedFatG: number;
}

// Reference nutrition per 100g (approximate CIQUAL/USDA-style values)
const FOODS: Record<string, Per100g> = {
  "Yaourt grec nature 0%":        { calories: 57,  proteinG: 10,   carbsG: 4,    fatG: 0.5, fiberG: 0,    sugarG: 4,    saturatedFatG: 0.1 },
  "Flocons d'avoine":             { calories: 375, proteinG: 13,   carbsG: 60,   fatG: 7,   fiberG: 10,   sugarG: 1,    saturatedFatG: 1.2 },
  "Fruits rouges":                { calories: 50,  proteinG: 1,    carbsG: 11,   fatG: 0.4, fiberG: 5,    sugarG: 6,    saturatedFatG: 0 },
  "Amandes":                      { calories: 580, proteinG: 21,   carbsG: 20,   fatG: 50,  fiberG: 12,   sugarG: 4,    saturatedFatG: 4 },
  "Blanc de poulet cuit":         { calories: 165, proteinG: 31,   carbsG: 0,    fatG: 3.6, fiberG: 0,    sugarG: 0,    saturatedFatG: 1 },
  "Riz complet cuit":             { calories: 123, proteinG: 2.6,  carbsG: 25,   fatG: 1,   fiberG: 1.8,  sugarG: 0.4,  saturatedFatG: 0.2 },
  "Brocolis cuits":               { calories: 35,  proteinG: 2.4,  carbsG: 7,    fatG: 0.4, fiberG: 3.3,  sugarG: 1.7,  saturatedFatG: 0.1 },
  "Huile d'olive":                { calories: 884, proteinG: 0,    carbsG: 0,    fatG: 100, fiberG: 0,    sugarG: 0,    saturatedFatG: 14 },
  "Saumon cuit":                  { calories: 208, proteinG: 22,   carbsG: 0,    fatG: 13,  fiberG: 0,    sugarG: 0,    saturatedFatG: 3 },
  "Quinoa cuit":                  { calories: 120, proteinG: 4.4,  carbsG: 21,   fatG: 1.9, fiberG: 2.8,  sugarG: 0.9,  saturatedFatG: 0.2 },
  "Légumes rôtis":                { calories: 40,  proteinG: 1.5,  carbsG: 8,    fatG: 0.5, fiberG: 2.5,  sugarG: 4,    saturatedFatG: 0.1 },
  "Avocat":                       { calories: 160, proteinG: 2,    carbsG: 8.5,  fatG: 15,  fiberG: 6.7,  sugarG: 0.7,  saturatedFatG: 2.1 },
  "Steak haché 5% MG":            { calories: 137, proteinG: 21,   carbsG: 0,    fatG: 5,   fiberG: 0,    sugarG: 0,    saturatedFatG: 2 },
  "Pâtes complètes cuites":       { calories: 124, proteinG: 5,    carbsG: 25,   fatG: 1,   fiberG: 3.5,  sugarG: 0.8,  saturatedFatG: 0.2 },
  "Parmesan râpé":                { calories: 392, proteinG: 35,   carbsG: 3.2,  fatG: 26,  fiberG: 0,    sugarG: 0.9,  saturatedFatG: 16 },
  "Pain complet":                 { calories: 247, proteinG: 8.8,  carbsG: 41,   fatG: 3.4, fiberG: 6.5,  sugarG: 4,    saturatedFatG: 0.7 },
  "Banane":                       { calories: 89,  proteinG: 1.1,  carbsG: 23,   fatG: 0.3, fiberG: 2.6,  sugarG: 12,   saturatedFatG: 0.1 },
  "Chocolat noir 70%":            { calories: 598, proteinG: 7.8,  carbsG: 46,   fatG: 43,  fiberG: 11,   sugarG: 24,   saturatedFatG: 25 },
  "Pois chiches cuits":           { calories: 164, proteinG: 8.9,  carbsG: 27,   fatG: 2.6, fiberG: 7.6,  sugarG: 4.8,  saturatedFatG: 0.3 },
  "Thon nature (au naturel)":     { calories: 116, proteinG: 26,   carbsG: 0,    fatG: 1,   fiberG: 0,    sugarG: 0,    saturatedFatG: 0.3 },
  "Œufs entiers":                 { calories: 155, proteinG: 13,   carbsG: 1.1,  fatG: 11,  fiberG: 0,    sugarG: 1.1,  saturatedFatG: 3.1 },
  "Beurre de cacahuète":          { calories: 588, proteinG: 25,   carbsG: 20,   fatG: 50,  fiberG: 6,    sugarG: 9,    saturatedFatG: 10 },
};

interface MenuDef {
  name: string;
  description: string;
  targetKcal: number;
  tags: string[];
  ingredients: { name: string; grams: number }[];
}

const MENUS: MenuDef[] = [
  {
    name: "Petit-déjeuner protéiné — 400 kcal",
    description: "Yaourt grec, flocons d'avoine, fruits rouges et amandes. Riche en protéines, idéal pour un début de journée léger.",
    targetKcal: 400,
    tags: ["menu-predefini", "400kcal"],
    ingredients: [
      { name: "Yaourt grec nature 0%", grams: 200 },
      { name: "Flocons d'avoine",      grams: 35 },
      { name: "Fruits rouges",         grams: 80 },
      { name: "Amandes",               grams: 20 },
    ],
  },
  {
    name: "Poulet, riz complet et brocolis — 600 kcal",
    description: "Le classique repas équilibré : poulet grillé, riz complet et brocolis vapeur.",
    targetKcal: 600,
    tags: ["menu-predefini", "600kcal"],
    ingredients: [
      { name: "Blanc de poulet cuit", grams: 150 },
      { name: "Riz complet cuit",     grams: 180 },
      { name: "Brocolis cuits",       grams: 150 },
      { name: "Huile d'olive",        grams: 10 },
    ],
  },
  {
    name: "Saumon, quinoa et légumes rôtis — 800 kcal",
    description: "Saumon cuit, quinoa et légumes rôtis à l'avocat — riche en oméga-3 et fibres.",
    targetKcal: 800,
    tags: ["menu-predefini", "800kcal"],
    ingredients: [
      { name: "Saumon cuit",     grams: 200 },
      { name: "Quinoa cuit",     grams: 200 },
      { name: "Légumes rôtis",   grams: 200 },
      { name: "Avocat",          grams: 30 },
    ],
  },
  {
    name: "Plateau complet du midi — 1200 kcal",
    description: "Steak haché, pâtes complètes, légumes rôtis, parmesan, pain complet et une touche sucrée — un repas copieux et complet.",
    targetKcal: 1200,
    tags: ["menu-predefini", "1200kcal"],
    ingredients: [
      { name: "Steak haché 5% MG",      grams: 200 },
      { name: "Pâtes complètes cuites", grams: 300 },
      { name: "Légumes rôtis",          grams: 200 },
      { name: "Parmesan râpé",          grams: 20 },
      { name: "Pain complet",           grams: 40 },
      { name: "Banane",                 grams: 60 },
      { name: "Chocolat noir 70%",      grams: 15 },
      { name: "Huile d'olive",          grams: 10 },
      { name: "Amandes",                grams: 15 },
    ],
  },
  {
    name: "Grand plateau protéiné — 1500 kcal",
    description: "Thon, riz complet, pois chiches, avocat et légumes verts — riche en protéines et en fibres pour un repas conséquent.",
    targetKcal: 1500,
    tags: ["menu-predefini", "1500kcal"],
    ingredients: [
      { name: "Thon nature (au naturel)", grams: 200 },
      { name: "Riz complet cuit",         grams: 250 },
      { name: "Pois chiches cuits",       grams: 150 },
      { name: "Avocat",                   grams: 100 },
      { name: "Légumes rôtis",            grams: 150 },
      { name: "Huile d'olive",            grams: 15 },
      { name: "Fruits rouges",            grams: 100 },
      { name: "Pain complet",             grams: 60 },
      { name: "Amandes",                  grams: 25 },
    ],
  },
  {
    name: "Menu complet journée type — 2000 kcal",
    description: "Un menu très complet et varié (œufs, poulet, riz, pâtes, fruits, oléagineux) couvrant une large part des besoins d'une journée.",
    targetKcal: 2000,
    tags: ["menu-predefini", "2000kcal"],
    ingredients: [
      { name: "Œufs entiers",             grams: 100 },
      { name: "Pain complet",             grams: 70 },
      { name: "Avocat",                   grams: 50 },
      { name: "Blanc de poulet cuit",     grams: 180 },
      { name: "Riz complet cuit",         grams: 200 },
      { name: "Brocolis cuits",           grams: 150 },
      { name: "Pâtes complètes cuites",   grams: 150 },
      { name: "Huile d'olive",            grams: 15 },
      { name: "Yaourt grec nature 0%",    grams: 150 },
      { name: "Fruits rouges",            grams: 100 },
      { name: "Banane",                   grams: 100 },
      { name: "Amandes",                  grams: 40 },
      { name: "Beurre de cacahuète",      grams: 15 },
      { name: "Chocolat noir 70%",        grams: 20 },
    ],
  },
];

function scale(per100g: Per100g, grams: number) {
  const r = grams / 100;
  return {
    calories:      Math.round(per100g.calories * r),
    proteinG:      Math.round(per100g.proteinG * r * 10) / 10,
    carbsG:        Math.round(per100g.carbsG * r * 10) / 10,
    fatG:          Math.round(per100g.fatG * r * 10) / 10,
    fiberG:        Math.round(per100g.fiberG * r * 10) / 10,
    sugarG:        Math.round(per100g.sugarG * r * 10) / 10,
    saturatedFatG: Math.round(per100g.saturatedFatG * r * 10) / 10,
  };
}

function sumNutrition(ings: { nutrition: ReturnType<typeof scale> }[]) {
  const sum = { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0, sugarG: 0, saturatedFatG: 0 };
  for (const i of ings) {
    sum.calories      += i.nutrition.calories;
    sum.proteinG      += i.nutrition.proteinG;
    sum.carbsG        += i.nutrition.carbsG;
    sum.fatG          += i.nutrition.fatG;
    sum.fiberG        += i.nutrition.fiberG;
    sum.sugarG        += i.nutrition.sugarG;
    sum.saturatedFatG += i.nutrition.saturatedFatG;
  }
  return {
    calories:      Math.round(sum.calories),
    proteinG:      Math.round(sum.proteinG * 10) / 10,
    carbsG:        Math.round(sum.carbsG * 10) / 10,
    fatG:          Math.round(sum.fatG * 10) / 10,
    fiberG:        Math.round(sum.fiberG * 10) / 10,
    sugarG:        Math.round(sum.sugarG * 10) / 10,
    saturatedFatG: Math.round(sum.saturatedFatG * 10) / 10,
  };
}

function divNutrition(n: ReturnType<typeof sumNutrition>, divisor: number) {
  if (divisor <= 0) return n;
  return {
    calories:      Math.round(n.calories / divisor),
    proteinG:      Math.round(n.proteinG / divisor * 10) / 10,
    carbsG:        Math.round(n.carbsG / divisor * 10) / 10,
    fatG:          Math.round(n.fatG / divisor * 10) / 10,
    fiberG:        Math.round(n.fiberG / divisor * 10) / 10,
    sugarG:        Math.round(n.sugarG / divisor * 10) / 10,
    saturatedFatG: Math.round(n.saturatedFatG / divisor * 10) / 10,
  };
}

async function main() {
  for (const menu of MENUS) {
    const ingredients = menu.ingredients.map((ing) => {
      const ref = FOODS[ing.name];
      if (!ref) throw new Error(`Unknown food reference: ${ing.name}`);
      return {
        foodId:    `custom:${ing.name.toLowerCase().replace(/[\s'%]/g, "-")}`,
        source:    "custom" as const,
        name:      ing.name,
        grams:     ing.grams,
        nutrition: scale(ref, ing.grams),
      };
    });

    const totalGrams = ingredients.reduce((s, i) => s + i.grams, 0);
    const totalNutrition = sumNutrition(ingredients);
    const perServing = divNutrition(totalNutrition, 1); // 1 serving = the whole menu
    const per100g = divNutrition(totalNutrition, totalGrams / 100);

    const id = randomUUID().slice(0, 12);
    const now = FieldValue.serverTimestamp();

    await db.doc(`users/${USER}/recipes/${id}`).set({
      id,
      name:             menu.name,
      description:      menu.description,
      servings:         1,
      totalGrams,
      gramsPerServing:  totalGrams,
      ingredients,
      nutrition:        perServing,
      nutritionPer100g: per100g,
      tags:             menu.tags,
      createdAt:        now,
      updatedAt:        now,
    });

    console.log(`✔ ${menu.name} → ${totalNutrition.calories} kcal (cible ${menu.targetKcal} kcal, écart ${(totalNutrition.calories - menu.targetKcal)} kcal)`);
  }
  console.log("Done.");
}

main().catch((e) => { console.error(e); process.exit(1); });
