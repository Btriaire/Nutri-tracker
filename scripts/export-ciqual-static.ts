#!/usr/bin/env node
/**
 * One-off: dump the `ciqual_foods` Firestore collection (already in CiqualDoc shape)
 * to a static JSON file, so food-api.ts can stop querying Firestore for it.
 * CIQUAL is a static reference table — it never changes at runtime, so it doesn't
 * belong in Firestore consuming read quota on every cold start.
 *
 * Run: npx tsx scripts/export-ciqual-static.ts
 */

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

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

async function main() {
  const snap = await db.collection("ciqual_foods").get();
  const docs = snap.docs.map((d) => d.data());
  console.log(`Fetched ${docs.length} ciqual_foods docs`);

  const outDir = path.join(__dirname, "../app/lib/data");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "ciqual-foods.json");
  fs.writeFileSync(outPath, JSON.stringify(docs));

  const sizeMb = (fs.statSync(outPath).size / 1024 / 1024).toFixed(2);
  console.log(`Wrote ${outPath} (${sizeMb} MB)`);
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
