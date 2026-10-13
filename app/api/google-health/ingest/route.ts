export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/app/lib/firebase-admin";

interface GoogleHealthPayload {
  token:            string;
  userId?:          string;
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
  bodyFatPct?:      number;
  bloodPressure?:   { systolic: number; diastolic: number; time?: string };
  glucoseMmol?:     number;
  workouts?:        { type: string; durationMin: number; calories: number }[];
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as GoogleHealthPayload | null;
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const queryToken = req.nextUrl.searchParams.get("token")?.trim();
  const token = (typeof body.token === "string" ? body.token.trim() : queryToken) ?? "";
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 401 });

  const db = getAdminFirestore();

  // Find user matching token
  let targetUserId = body.userId?.trim() || "owner";
  let userDoc = await db.doc(`users/${targetUserId}`).get();
  let storedToken = (userDoc.data() as { integrations?: { googleHealth?: { token?: string } } })
    ?.integrations?.googleHealth?.token;

  if (!storedToken || storedToken !== token) {
    // If not matching targetUserId, search across users collection
    const usersSnap = await db.collection("users").get();
    let found = false;
    for (const d of usersSnap.docs) {
      const t = (d.data() as { integrations?: { googleHealth?: { token?: string } } })
        ?.integrations?.googleHealth?.token;
      if (t === token) {
        targetUserId = d.id;
        userDoc = d;
        storedToken = t;
        found = true;
        break;
      }
    }
    if (!found) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }
  }

  const date = body.date ?? new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  const docRef = db.doc(`users/${targetUserId}/fitnessData/${date}`);
  const existingSnap = await docRef.get();
  const existing = (existingSnap.data()?.googleHealth ?? {}) as Record<string, unknown>;

  const NUMERIC_FIELDS = new Set<keyof GoogleHealthPayload>([
    "steps", "activeCalories", "restingCalories", "activeMinutes", "heartRateAvg", "heartRateResting",
    "hrv", "spO2", "sleepMinutes", "sleepLightMinutes", "sleepDeepMinutes",
    "sleepRemMinutes", "distanceKm", "vo2Max", "weightKg", "bodyFatPct", "glucoseMmol",
  ]);

  const googleHealth: Record<string, unknown> = {
    ...existing,
    syncedAt: FieldValue.serverTimestamp(),
  };

  const candidateFields: (keyof GoogleHealthPayload)[] = [
    "steps", "activeCalories", "restingCalories", "activeMinutes", "heartRateAvg", "heartRateResting",
    "hrv", "spO2", "sleepMinutes", "sleepLightMinutes", "sleepDeepMinutes",
    "sleepRemMinutes", "distanceKm", "vo2Max", "weightKg", "bodyFatPct", "workouts",
  ];

  for (const field of candidateFields) {
    const raw = body[field];
    if (raw !== undefined) {
      if (NUMERIC_FIELDS.has(field)) {
        const n = typeof raw === "number" ? raw : parseFloat(String(raw));
        if (Number.isFinite(n)) googleHealth[field] = n;
      } else {
        googleHealth[field] = raw;
      }
    }
  }

  await docRef.set(
    { date, googleHealth },
    { merge: true },
  );

  // Sync Blood Pressure to healthLog if provided
  if (body.bloodPressure && typeof body.bloodPressure.systolic === "number" && typeof body.bloodPressure.diastolic === "number") {
    const healthRef = db.doc(`users/${targetUserId}/healthLog/${date}`);
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    await healthRef.set({
      date,
      bloodPressure: FieldValue.arrayUnion({
        systolic:  body.bloodPressure.systolic,
        diastolic: body.bloodPressure.diastolic,
        time:      body.bloodPressure.time || `${hh}:${mm}`,
        moment:    now.getHours() < 12 ? "morning" : now.getHours() >= 18 ? "evening" : "other",
        source:    "google_health",
      }),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  }

  // Update lastSyncedAt on user profile
  await db.doc(`users/${targetUserId}`).set(
    { integrations: { googleHealth: { lastSyncedAt: FieldValue.serverTimestamp() } } },
    { merge: true },
  );

  return NextResponse.json({ ok: true, date, userId: targetUserId });
}
