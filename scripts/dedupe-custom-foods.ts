#!/usr/bin/env node
/**
 * One-off cleanup: merges duplicate customFoods entries (same name saved
 * multiple times, e.g. via repeated Nutri-IA searches for a staple food)
 * into a single doc, and backfills normalizedName on every surviving doc so
 * the dedup check in /api/custom-foods/route.ts works going forward.
 *
 * Usage: npx tsx scripts/dedupe-custom-foods.ts
 */

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.join(__dirname, "../.env.local") });

const projectId   = process.env.FIREBASE_ADMIN_PROJECT_ID!.trim();
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL!.trim();
const privateKey  = process.env.FIREBASE_ADMIN_PRIVATE_KEY!.replace(/\\n/g, "\n").trim();

const app = getApps().length
  ? getApps()[0]
  : initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
const db = getFirestore(app);

const USER = "owner";

interface Doc {
  ref: FirebaseFirestore.DocumentReference;
  id: string;
  name: string;
  updatedAt?: Timestamp;
  createdAt?: Timestamp;
}

async function main() {
  const snap = await db.collection(`users/${USER}/customFoods`).get();
  console.log(`Fetched ${snap.size} customFoods docs`);

  const groups = new Map<string, Doc[]>();
  for (const d of snap.docs) {
    const data = d.data();
    const normalizedName = String(data.name ?? "").trim().toLowerCase();
    const list = groups.get(normalizedName) ?? [];
    list.push({ ref: d.ref, id: d.id, name: data.name, updatedAt: data.updatedAt, createdAt: data.createdAt });
    groups.set(normalizedName, list);
  }

  let batch = db.batch();
  let ops = 0;
  let deleted = 0;
  let backfilled = 0;

  const flush = async () => {
    if (ops > 0) { await batch.commit(); batch = db.batch(); ops = 0; }
  };

  for (const [normalizedName, docs] of groups) {
    // Keep the most recently updated (fallback: created) doc as canonical.
    const ts = (d: Doc) => (d.updatedAt ?? d.createdAt)?.toMillis() ?? 0;
    docs.sort((a, b) => ts(b) - ts(a));
    const [keep, ...dupes] = docs;

    batch.set(keep.ref, { normalizedName }, { merge: true });
    ops++;
    backfilled++;

    for (const dupe of dupes) {
      batch.delete(dupe.ref);
      ops++;
      deleted++;
      console.log(`  dup: "${dupe.name}" (${dupe.id}) -> kept ${keep.id}`);
    }

    if (ops >= 400) await flush();
  }
  await flush();

  console.log(`Done. ${groups.size} unique foods kept, ${deleted} duplicates deleted, ${backfilled} docs backfilled with normalizedName.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
