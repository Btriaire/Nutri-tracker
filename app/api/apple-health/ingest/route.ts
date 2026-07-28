export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/app/lib/firebase-admin";

const USER_ID = "owner";

interface IngestPayload {
  token:            string;
  date:             string;            // YYYY-MM-DD
  steps?:           number;
  activeCalories?:  number;
  restingCalories?: number;
  activeMinutes?:   number;
  heartRateAvg?:    number;
  heartRateResting?: number;
  hrv?:             number;
  spO2?:            number;
  sleepMinutes?:    number;
  sleepLightMinutes?: number;
  sleepDeepMinutes?: number;
  sleepRemMinutes?: number;
  distanceKm?:      number;
  vo2Max?:          number;
  weightKg?:        number;
  workouts?:        { type: string; durationMin: number; calories: number }[];
}

export async function POST(req: NextRequest) {
  const body = await req.json() as IngestPayload;

  // Validate token
  const db     = getAdminFirestore();
  const userDoc = await db.doc(`users/${USER_ID}`).get();
  const stored  = (userDoc.data() as { integrations?: { appleHealth?: { token?: string } } })
    ?.integrations?.appleHealth?.token;

  const received = typeof body.token === "string" ? body.token.trim() : body.token;

  if (!stored || received !== stored) {
    // Redacted diagnostic — lengths + first/last 4 chars only, never the full secret.
    const redact = (s: unknown) => {
      if (typeof s !== "string") return `<${typeof s}>`;
      if (s.length <= 8) return `len=${s.length}`;
      return `len=${s.length} ${s.slice(0, 4)}...${s.slice(-4)}`;
    };
    console.warn("[apple-health ingest] token mismatch — received:", redact(received), "stored:", redact(stored));
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const date = body.date ?? new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  const appleHealth = {
    steps:            body.steps            ?? 0,
    activeCalories:   body.activeCalories   ?? 0,
    activeMinutes:    body.activeMinutes     ?? 0,
    heartRateAvg:     body.heartRateAvg     ?? null,
    heartRateResting: body.heartRateResting ?? null,
    hrv:              body.hrv              ?? null,
    spO2:             body.spO2             ?? null,
    sleepMinutes:      body.sleepMinutes      ?? null,
    sleepLightMinutes: body.sleepLightMinutes ?? null,
    sleepDeepMinutes:  body.sleepDeepMinutes  ?? null,
    sleepRemMinutes:   body.sleepRemMinutes   ?? null,
    distanceKm:       body.distanceKm       ?? null,
    vo2Max:           body.vo2Max           ?? null,
    weightKg:         body.weightKg         ?? null,
    workouts:         body.workouts         ?? [],
    syncedAt:         FieldValue.serverTimestamp(),
  };

  await db.doc(`users/${USER_ID}/fitnessData/${date}`).set(
    { date, appleHealth },
    { merge: true },
  );

  // Update lastSyncedAt
  await db.doc(`users/${USER_ID}`).set(
    { integrations: { appleHealth: { lastSyncedAt: FieldValue.serverTimestamp() } } },
    { merge: true },
  );

  return NextResponse.json({ ok: true, date });
}
