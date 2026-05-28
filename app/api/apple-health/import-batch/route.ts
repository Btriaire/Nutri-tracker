export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import { getSession } from "@/app/lib/session";

const USER_ID = "owner";

interface DayRecord {
  date:             string;
  steps:            number;
  activeCalories:   number;
  activeMinutes:    number;
  heartRateAvg:     number | null;
  heartRateResting: number | null;
  hrv:              number | null;
  spO2:             number | null;
  sleepMinutes:     number | null;
  sleepDeepMinutes: number | null;
  sleepRemMinutes:  number | null;
  distanceKm:       number | null;
  vo2Max:           number | null;
  weightKg:         number | null;
  workouts:         { type: string; durationMin: number; calories: number }[];
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { days } = await req.json() as { days: DayRecord[] };
  if (!Array.isArray(days) || days.length === 0) {
    return NextResponse.json({ error: "No days provided" }, { status: 400 });
  }

  const db  = getAdminFirestore();
  const ts  = FieldValue.serverTimestamp();

  // Firestore batch max = 500 ops
  const CHUNK = 400;
  let written = 0;

  for (let i = 0; i < days.length; i += CHUNK) {
    const batch = db.batch();
    for (const day of days.slice(i, i + CHUNK)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day.date)) continue;
      const ref = db.doc(`users/${USER_ID}/fitnessData/${day.date}`);
      batch.set(ref, { date: day.date, appleHealth: { ...day, syncedAt: ts } }, { merge: true });
      written++;
    }
    await batch.commit();
  }

  await db.doc(`users/${USER_ID}`).set(
    { integrations: { appleHealth: { connected: true, lastSyncedAt: ts } } },
    { merge: true },
  );

  return NextResponse.json({ ok: true, written });
}
