export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import { format } from "date-fns";
import { extractMicronutrientsFromFood } from "@/app/lib/micronutrient-extractor";
import { getMicronutrientLibraryEntry, scaleProfile } from "@/app/lib/micronutrient-library";
import type {
  DayLog, FoodEntry, MicronutrientIntake,
  SupplementLog, SupplementProduct,
} from "@/app/lib/types";

const USER = "owner";

function entryTime(entry: FoodEntry): string {
  const seconds = Number((entry.loggedAt as unknown as { seconds?: number })?.seconds ?? 0);
  return format(new Date(seconds ? seconds * 1000 : Date.now()), "HH:mm");
}

/**
 * Rebuilds a day's micronutrientLogs doc from scratch out of the food entries and
 * supplement intakes that are actually still logged for that day. Exists because the
 * old POST handler here did a read → push → set per intake, and under the routine
 * concurrency of "several foods/supplements logged close together" that raced: every
 * concurrent write read the same snapshot and the last one to finish silently clobbered
 * the others, so real days ended up missing most of their micronutrients (worse for
 * later meals, since more writers had already raced by then). The POST handler itself
 * is now race-safe (arrayUnion), but that doesn't undo damage already done to days
 * logged before the fix — this is the repair path for those.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { date } = await req.json() as { date: string };
  if (!date) return NextResponse.json({ error: "date required" }, { status: 400 });

  const db = getAdminFirestore();

  const [foodSnap, suppLogSnap, suppProductsSnap] = await Promise.all([
    db.doc(`users/${USER}/foodLog/${date}`).get(),
    db.doc(`users/${USER}/supplementLogs/${date}`).get(),
    db.collection(`users/${USER}/supplements`).get(),
  ]);

  const entries = foodSnap.exists ? ((foodSnap.data() as DayLog).entries ?? []) : [];
  const supplementIntakes = suppLogSnap.exists ? ((suppLogSnap.data() as SupplementLog).intakes ?? []) : [];
  const productsById = new Map(suppProductsSnap.docs.map(d => [d.id, d.data() as SupplementProduct]));

  const now = Timestamp.now();
  const intakes: MicronutrientIntake[] = [];

  for (const entry of entries) {
    const time = entryTime(entry);
    const structured = extractMicronutrientsFromFood(entry.nutrition, entry.name, time);

    // Reuse the cached per-food profile (same cache /api/food-micronutrient-ai reads/writes)
    // without re-hitting Groq — a bulk repair pass isn't the place for live AI calls, and
    // virtually every food here was already looked up once when it was originally logged.
    const libEntry = await getMicronutrientLibraryEntry(entry.name);
    let combined = structured;
    if (libEntry?.per100g?.length) {
      const scaled = scaleProfile(libEntry.per100g, entry.servingGrams)
        .map(m => ({ code: m.code, amount: m.amount, unit: m.unit, source: entry.name, time }));
      const scaledCodes = new Set(scaled.map(m => m.code));
      combined = [...scaled, ...structured.filter(m => !scaledCodes.has(m.code))];
    }

    for (const m of combined) {
      intakes.push({ code: m.code, amount: m.amount, unit: m.unit, source: m.source, time: m.time, loggedAt: now });
    }
  }

  for (const intake of supplementIntakes) {
    const product = productsById.get(intake.supplementId);
    for (const m of product?.micronutrients ?? []) {
      intakes.push({ code: m.code, amount: m.amount, unit: m.unit, source: intake.supplementName, time: intake.time, loggedAt: now });
    }
  }

  await db.doc(`users/${USER}/micronutrientLogs/${date}`).set({ date, intakes, updatedAt: now });

  return NextResponse.json({ ok: true, count: intakes.length });
}
