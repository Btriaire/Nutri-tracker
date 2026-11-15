import { NextRequest, NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { nanoid } from "nanoid";
import { getSession } from "@/app/lib/session";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import { calcTotals } from "@/app/lib/nutrition";
import { PERIOD_FOOD_PREFIX } from "@/app/lib/day-status";
import { dayPlanEntries, sanitizeDayPlan, sanitizePeriodParams, datesBetween, type DayPlan } from "@/app/lib/period-plan";
import { sanitizeMealShares, DEFAULT_MEAL_SHARES, type MealShares } from "@/app/lib/meal-shares";
import type { DayLog, FoodEntry, UserProfile } from "@/app/lib/types";

export const dynamic = "force-dynamic";

async function writeDay(db: FirebaseFirestore.Firestore, U: string, date: string, periodId: string, plan: DayPlan, shares: MealShares): Promise<"written" | "skipped"> {
  const foodLogRef = db.doc(`${U}/foodLog/${date}`);
  const estimatedDaysRef = db.doc(`${U}/estimatedDays/${date}`);

  return db.runTransaction(async (tx) => {
    const [foodLogSnap, estimatedDaysSnap] = await Promise.all([
      tx.get(foodLogRef),
      tx.get(estimatedDaysRef)
    ]);

    const existing = foodLogSnap.exists ? (foodLogSnap.data() as DayLog) : { date, entries: [], totals: { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 }, waterMl: 0, updatedAt: Timestamp.now() };
    const keep = (existing.entries ?? []).filter(entry => entry.foodId !== PERIOD_FOOD_PREFIX + periodId);

    const sameMine = estimatedDaysSnap.exists && estimatedDaysSnap.data()?.periodId === periodId;
    if (keep.length > 0 && !sameMine) return "skipped";

    const newEntries = dayPlanEntries(plan, periodId, shares).map(entry => ({
      ...entry,
      id: nanoid(),
      loggedAt: Timestamp.now()
    }));

    const entries = [...keep, ...newEntries];
    const totals = calcTotals(entries);

    tx.set(foodLogRef, { ...existing, date, entries, totals, updatedAt: Timestamp.now() });
    tx.set(estimatedDaysRef, { periodId, plan, updatedAt: Timestamp.now() });

    return "written";
  });
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getAdminFirestore();
  const U = `users/${session.userId}`;
  const { searchParams } = new URL(req.url);

  if (searchParams.has("date")) {
    const date = searchParams.get("date");
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "Invalid date" }, { status: 400 });
    }

    const estimatedDaysRef = db.doc(`${U}/estimatedDays/${date}`);
    const estimatedDaysSnap = await estimatedDaysRef.get();

    return NextResponse.json({ day: estimatedDaysSnap.exists ? estimatedDaysSnap.data() : null });
  } else {
    const estimatedPeriodsRef = db.collection(`${U}/estimatedPeriods`);
    const estimatedPeriodsSnap = await estimatedPeriodsRef.orderBy("createdAt", "desc").limit(50).get();

    const periods = estimatedPeriodsSnap.docs.map(doc => {
      const data = doc.data();
      const createdAt = data.createdAt as Timestamp;
      return {
        id: doc.id,
        ...data,
        createdAt: createdAt.toDate().toISOString()
      };
    });

    return NextResponse.json({ periods });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getAdminFirestore();
  const U = `users/${session.userId}`;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const params = sanitizePeriodParams(body.params);
  if (!params) {
    return NextResponse.json({ error: "Période invalide." }, { status: 400 });
  }

  const rawDays = Array.isArray(body.days) ? body.days : [];
  if (rawDays.length > 93) {
    return NextResponse.json({ error: "Période invalide." }, { status: 400 });
  }

  const days: DayPlan[] = [];
  for (const rawDay of rawDays) {
    const day = sanitizeDayPlan(rawDay);
    if (!day) {
      return NextResponse.json({ error: "Période invalide." }, { status: 400 });
    }
    days.push(day);
  }

  const validDates = datesBetween(params.from, params.to);
  if (days.some(day => !validDates.includes(day.date))) {
    return NextResponse.json({ error: "Période invalide." }, { status: 400 });
  }

  const id = nanoid(10);
  const userDoc = await db.doc(`users/${session.userId}`).get();
  const profile = userDoc.exists ? (userDoc.data() as UserProfile) : null;
  const shares = sanitizeMealShares(profile?.mealShares) ?? DEFAULT_MEAL_SHARES;

  let added = 0;
  let skipped = 0;
  const writtenDates: string[] = [];

  for (const day of days) {
    const result = await writeDay(db, U, day.date, id, day, shares);
    if (result === "written") {
      added++;
      writtenDates.push(day.date);
    } else {
      skipped++;
    }
  }

  await db.doc(`${U}/estimatedPeriods/${id}`).set({
    params,
    added,
    skipped,
    dates: writtenDates,
    createdAt: Timestamp.now()
  });

  return NextResponse.json({ id, added, skipped }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getAdminFirestore();
  const U = `users/${session.userId}`;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  if (!body.date || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  const plan = sanitizeDayPlan(body.plan);
  if (!plan || plan.date !== body.date) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const estimatedDaysRef = db.doc(`${U}/estimatedDays/${body.date}`);
  const estimatedDaysSnap = await estimatedDaysRef.get();

  if (!estimatedDaysSnap.exists) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const estimatedDaysData = estimatedDaysSnap.data();
  if (!estimatedDaysData) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const periodId = estimatedDaysData.periodId as string;
  const userDoc = await db.doc(`users/${session.userId}`).get();
  const profile = userDoc.exists ? (userDoc.data() as UserProfile) : null;
  const shares = sanitizeMealShares(profile?.mealShares) ?? DEFAULT_MEAL_SHARES;

  const result = await writeDay(db, U, body.date, periodId, { ...plan, confirmed: true }, shares);

  if (result === "skipped") {
    return NextResponse.json({ error: "Conflict" }, { status: 409 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getAdminFirestore();
  const U = `users/${session.userId}`;
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id || !/^[A-Za-z0-9_-]{1,32}$/.test(id)) {
    return NextResponse.json({ error: "ID required" }, { status: 400 });
  }

  const periodRef = db.doc(`${U}/estimatedPeriods/${id}`);
  const periodSnap = await periodRef.get();

  if (!periodSnap.exists) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const periodData = periodSnap.data();
  if (!periodData) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const dates = (periodData.dates as string[]) ?? [];
  let days = 0;

  for (const date of dates) {
    const foodLogRef = db.doc(`${U}/foodLog/${date}`);
    const estimatedDaysRef = db.doc(`${U}/estimatedDays/${date}`);

    await db.runTransaction(async (tx) => {
      const [foodLogSnap, estimatedDaysSnap] = await Promise.all([
        tx.get(foodLogRef),
        tx.get(estimatedDaysRef)
      ]);

      if (foodLogSnap.exists) {
        const existing = foodLogSnap.data() as DayLog;
        const entries = (existing.entries ?? []).filter(entry => entry.foodId !== PERIOD_FOOD_PREFIX + id);

        if (entries.length > 0) {
          const totals = calcTotals(entries);
          tx.set(foodLogRef, { ...existing, entries, totals, updatedAt: Timestamp.now() });
        } else {
          tx.set(foodLogRef, { ...existing, entries: [], totals: calcTotals([]), updatedAt: Timestamp.now() });
        }
      }

      if (estimatedDaysSnap.exists) {
        const estData = estimatedDaysSnap.data();
        if (estData && estData.periodId === id) {
          tx.delete(estimatedDaysRef);
        }
      }
    });

    days++;
  }

  await periodRef.delete();

  return NextResponse.json({ ok: true, days });
}
