#!/usr/bin/env node
/**
 * Seeds 6 generic single-line meals (400/600/800/1200/1500/2000 kcal) into
 * the user's custom foods — quick-log entries with no ingredient detail,
 * for when you're in a hurry or don't remember exactly what you ate.
 *
 * Usage: npx tsx scripts/seed-generic-meals.ts
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

// Generic balanced macro split (25% protein / 45% carbs / 30% fat) plus a
// standard ~14g fiber / 1000 kcal reference — used only when the user is in
// a hurry and doesn't want to detail what they actually ate.
const CALORIE_TARGETS = [400, 600, 800, 1200, 1500, 2000];

function genericNutrition(calories: number) {
  return {
    calories,
    proteinG: Math.round((calories * 0.25) / 4 * 10) / 10,
    carbsG:   Math.round((calories * 0.45) / 4 * 10) / 10,
    fatG:     Math.round((calories * 0.30) / 9 * 10) / 10,
    fiberG:   Math.round((calories / 1000) * 14 * 10) / 10,
  };
}

async function main() {
  for (const kcal of CALORIE_TARGETS) {
    const id  = randomUUID().slice(0, 12);
    const now = FieldValue.serverTimestamp();

    await db.doc(`users/${USER}/customFoods/${id}`).set({
      id,
      name:            `Repas générique ${kcal} kcal`,
      category:        "Générique",
      servingSizeG:    100,
      servingLabel:    "1 portion",
      servingOptions:  [{ label: "1 portion", grams: 100, isDefault: true }],
      nutrition:       genericNutrition(kcal),
      createdAt:       now,
      updatedAt:       now,
    });

    console.log(`✔ Repas générique ${kcal} kcal créé`);
  }
  console.log("Done.");
}

main().catch((e) => { console.error(e); process.exit(1); });
