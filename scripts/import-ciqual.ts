#!/usr/bin/env node
/**
 * Import Ciqual ANSES food database into Firestore.
 *
 * Usage:
 *   1. Download the JSON from https://ciqual.anses.fr/ → "Télécharger les données"
 *   2. Save it as scripts/ciqual.json
 *   3. Run: npx tsx scripts/import-ciqual.ts
 */

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, WriteBatch } from "firebase-admin/firestore";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.join(__dirname, "../.env.local") });

const projectId   = process.env.FIREBASE_ADMIN_PROJECT_ID!;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL!;
const privateKey  = process.env.FIREBASE_ADMIN_PRIVATE_KEY!.replace(/\\n/g, "\n");

if (!projectId || !clientEmail || !privateKey) {
  console.error("❌  Missing Firebase Admin env vars");
  process.exit(1);
}

const app = getApps().length
  ? getApps()[0]
  : initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });

const db = getFirestore(app);

interface RawCiqualFlat {
  alim_code?: string | number;
  alim_nom_fr?: string;
  alim_grp_nom_fr?: string;
  [key: string]: string | number | undefined;
}

function parseNum(raw: string | number | undefined): number | null {
  if (raw === undefined || raw === null) return null;
  const s = String(raw).trim().replace(",", ".");
  if (s === "-" || s === "" || s === "nd") return null;
  if (s.startsWith("<")) return 0;
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

// Map of Ciqual French field names → per100g doc keys
const FIELD_MAP: Record<string, string> = {
  "Energie, Règlement UE N° 1169/2011 (kcal/100 g)": "calories",
  "Protéines, N x 6.25 (g/100 g)":                   "proteinG",
  "Glucides (g/100 g)":                               "carbsG",
  "Lipides (g/100 g)":                                "fatG",
  "Fibres alimentaires (g/100 g)":                    "fiberG",
  "Sucres (g/100 g)":                                 "sugarG",
  "Amidon (g/100 g)":                                 "starchG",
  "AG saturés (g/100 g)":                             "saturatedFatG",
  "AG monoinsaturés (g/100 g)":                       "monounsatFatG",
  "AG polyinsaturés (g/100 g)":                       "polyunsatFatG",
  "Cholestérol (mg/100 g)":                           "cholesterolMg",
  "Sodium (mg/100 g)":                                "sodiumMg",
  "Sel chlorure de sodium (g/100 g)":                 "saltG",
  "Potassium (mg/100 g)":                             "potassiumMg",
  "Calcium (mg/100 g)":                               "calciumMg",
  "Magnésium (mg/100 g)":                             "magneziumMg",
  "Phosphore (mg/100 g)":                             "phosphorusMg",
  "Fer (mg/100 g)":                                   "ironMg",
  "Zinc (mg/100 g)":                                  "zincMg",
  "Rétinol (µg/100 g)":                               "vitaminAUg",
  "Vitamine C (mg/100 g)":                            "vitaminCMg",
  "Vitamine D (µg/100 g)":                            "vitaminDUg",
  "Vitamine B12 (µg/100 g)":                          "vitaminB12Ug",
  "Vitamine B9 ou Folates totaux (µg/100 g)":         "vitaminB9Ug",
  "Eau (g/100 g)":                                    "waterG",
  "Alcool (g/100 g)":                                 "alcoholG",
};

async function main() {
  const jsonPath = path.join(__dirname, "ciqual.json");
  if (!fs.existsSync(jsonPath)) {
    console.error(`❌  File not found: ${jsonPath}`);
    console.error("   Download from https://ciqual.anses.fr/ and save as scripts/ciqual.json");
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(jsonPath, "utf-8")) as RawCiqualFlat[];
  console.log(`📦  Loaded ${raw.length} Ciqual entries`);

  const collection = db.collection("ciqual_foods");
  let batch: WriteBatch = db.batch();
  let count   = 0;
  let skipped = 0;

  for (const item of raw) {
    const id   = String(item.alim_code ?? "").trim();
    const name = (item.alim_nom_fr ?? "").trim();

    if (!id || !name) { skipped++; continue; }

    const per100g: Record<string, number | null> = {};
    for (const [ciqualKey, docKey] of Object.entries(FIELD_MAP)) {
      per100g[docKey] = parseNum(item[ciqualKey]);
    }

    // Ensure required macros default to 0 if null
    per100g.proteinG = per100g.proteinG ?? 0;
    per100g.carbsG   = per100g.carbsG   ?? 0;
    per100g.fatG     = per100g.fatG     ?? 0;
    per100g.fiberG   = per100g.fiberG   ?? 0;
    const alcoholG   = per100g.alcoholG ?? 0;

    // --- Energy fallback chain ---------------------------------------------
    // Many Ciqual rows have "-" in the primary kcal column. Try, in order:
    //   1. Primary kcal column (already parsed into per100g.calories)
    //   2. Alternate "N x facteur Jones, avec fibres" kcal column
    //   3. kJ columns ÷ 4.184
    //   4. Atwater estimate from macros (4/4/9/7 + 2 kcal/g fibre)
    let calories = per100g.calories;
    if (calories == null || calories === 0) {
      calories =
        parseNum(item["Energie, N x facteur Jones, avec fibres (kcal/100 g)"]);
    }
    if (calories == null || calories === 0) {
      const kj =
        parseNum(item["Energie, Règlement UE N° 1169/2011 (kJ/100 g)"]) ??
        parseNum(item["Energie, N x facteur Jones, avec fibres (kJ/100 g)"]);
      if (kj != null && kj > 0) calories = Math.round(kj / 4.184);
    }
    if (calories == null || calories === 0) {
      const est =
        per100g.proteinG * 4 +
        per100g.carbsG   * 4 +
        per100g.fatG     * 9 +
        alcoholG         * 7 +
        per100g.fiberG   * 2;
      calories = est > 0 ? Math.round(est) : 0;
    }
    per100g.calories = calories;

    const doc = {
      id,
      name,
      nameLower: name.toLowerCase(),
      category:  (item.alim_grp_nom_fr ?? "").trim(),
      per100g,
    };

    batch.set(collection.doc(id), doc);
    count++;

    if (count % 500 === 0) {
      await batch.commit();
      batch = db.batch();
      process.stdout.write(`\r✓  ${count} / ${raw.length}`);
    }
  }

  if (count % 500 !== 0) await batch.commit();

  console.log(`\n\n✅  Imported ${count} foods (${skipped} skipped) into Firestore ciqual_foods`);
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ ", err);
  process.exit(1);
});
