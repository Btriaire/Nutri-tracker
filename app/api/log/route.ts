import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import { calcTotals } from "@/app/lib/nutrition";
import type { DayLog, FoodEntry } from "@/app/lib/types";
import { nanoid } from "nanoid";
import { Timestamp } from "firebase-admin/firestore";

export const dynamic = "force-dynamic";

function dateKey(date: string) {
  // Validates format YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Invalid date");
  return date;
}

// ─── GET /api/log?date=YYYY-MM-DD ─────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") ?? new Date().toISOString().slice(0, 10);

  try {
    dateKey(date);
  } catch {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  const db = getAdminFirestore();
  const doc = await db.doc(`users/${session.userId}/foodLog/${date}`).get();
  return NextResponse.json({ dayLog: doc.exists ? doc.data() : null });
}

// ─── POST /api/log — add food entry ──────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    date: string;
    entry: Omit<FoodEntry, "id" | "loggedAt">;
  };

  try {
    dateKey(body.date);
  } catch {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  const db = getAdminFirestore();
  const ref = db.doc(`users/${session.userId}/foodLog/${body.date}`);

  const newEntry: FoodEntry = {
    ...body.entry,
    id: nanoid(),
    loggedAt: Timestamp.now(),
  };

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const existing = snap.exists
      ? (snap.data() as DayLog)
      : { date: body.date, entries: [], totals: { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 }, updatedAt: Timestamp.now() };

    const entries = [...existing.entries, newEntry];
    const totals = calcTotals(entries);

    tx.set(ref, { ...existing, entries, totals, updatedAt: Timestamp.now() });
  });

  const snap = await ref.get();
  const day = snap.data() as DayLog;
  return NextResponse.json({ entry: newEntry, totals: day.totals }, { status: 201 });
}
