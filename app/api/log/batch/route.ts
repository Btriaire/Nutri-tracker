import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import { calcTotals } from "@/app/lib/nutrition";
import type { DayLog, FoodEntry } from "@/app/lib/types";
import { nanoid } from "nanoid";
import { Timestamp } from "firebase-admin/firestore";

// POST /api/log/batch — add multiple food entries to one day in one transaction
export async function POST(req: NextRequest) {
  const body = await req.json() as {
    date:    string;
    entries: Omit<FoodEntry, "id" | "loggedAt">[];
  };

  if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }
  if (!body.entries?.length) {
    return NextResponse.json({ error: "entries required" }, { status: 400 });
  }

  const db  = getAdminFirestore();
  const ref = db.doc(`users/owner/foodLog/${body.date}`);

  const newEntries: FoodEntry[] = body.entries.map((e) => ({
    ...e,
    id:       nanoid(),
    loggedAt: Timestamp.now(),
  }));

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const existing = snap.exists
      ? (snap.data() as DayLog)
      : { date: body.date, entries: [], totals: { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 }, waterMl: 0, updatedAt: Timestamp.now() };

    const entries = [...existing.entries, ...newEntries];
    const totals  = calcTotals(entries);
    tx.set(ref, { ...existing, entries, totals, updatedAt: Timestamp.now() });
  });

  return NextResponse.json({ ok: true, added: newEntries.length }, { status: 201 });
}
