import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import { calcTotals } from "@/app/lib/nutrition";
import type { DayLog, FoodEntry } from "@/app/lib/types";
import { nanoid } from "nanoid";
import { Timestamp } from "firebase-admin/firestore";
import { getCachedFoodImage } from "@/app/lib/food-image-library";

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

  // Auto-attach a previously captured photo for this exact food name, if the
  // caller didn't already provide one — this is the "image bank" behavior.
  const photoUrl = body.entry.photoUrl ?? (await getCachedFoodImage(body.entry.name)) ?? undefined;

  const newEntry: FoodEntry = {
    ...body.entry,
    ...(photoUrl ? { photoUrl } : {}),
    id: nanoid(),
    loggedAt: Timestamp.now(),
  };

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const existing = snap.exists
      ? (snap.data() as DayLog)
      : { date: body.date, entries: [], totals: { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 }, updatedAt: Timestamp.now() };

    const entries = [...(existing.entries ?? []), newEntry];
    const totals = calcTotals(entries);

    tx.set(ref, { ...existing, entries, totals, updatedAt: Timestamp.now() });
  });

  const snap = await ref.get();
  const day = snap.data() as DayLog;
  return NextResponse.json({ entry: newEntry, totals: day.totals }, { status: 201 });
}

// ─── PATCH /api/log — validate day or update mealHunger ─────────────────────

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    date:        string;
    validated?:  boolean;
    mealHunger?: Partial<Record<string, number>>;
    dayType?:    "work" | "rest" | "travel" | null;
    jetlag?:     boolean | null;
    dietPaused?: boolean | null;
  };
  try { dateKey(body.date); } catch {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  const db  = getAdminFirestore();
  const ref = db.doc(`users/${session.userId}/foodLog/${body.date}`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const update: Record<string, any> = { updatedAt: Timestamp.now() };
  if (body.validated  !== undefined) update.validated  = body.validated;
  if (body.mealHunger !== undefined) update.mealHunger = body.mealHunger;
  if (body.dayType    !== undefined) update.dayType    = body.dayType;
  if (body.jetlag     !== undefined) update.jetlag     = body.jetlag;
  if (body.dietPaused !== undefined) update.dietPaused = body.dietPaused;

  await ref.set(update, { merge: true });

  return NextResponse.json({ ok: true });
}
