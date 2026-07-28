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

  // Fetch what's already synced for this date so a partial payload (e.g. a
  // second Shortcut sending only sleep-stage data) merges field-by-field
  // instead of overwriting the whole appleHealth object with 0/null for
  // every field it didn't happen to send.
  const docRef = db.doc(`users/${USER_ID}/fitnessData/${date}`);
  const existingSnap = await docRef.get();
  const existing = (existingSnap.data()?.appleHealth ?? {}) as Record<string, unknown>;

  // Shortcuts often serializes numeric variables as strings in the JSON body
  // (e.g. "63" instead of 63) — coerce to a real number, drop anything that
  // doesn't parse (like an empty string from a missing weight sample) so we
  // don't store NaN or "".
  const NUMERIC_FIELDS = new Set<keyof IngestPayload>([
    "steps", "activeCalories", "activeMinutes", "heartRateAvg", "heartRateResting",
    "hrv", "spO2", "sleepMinutes", "sleepLightMinutes", "sleepDeepMinutes",
    "sleepRemMinutes", "distanceKm", "vo2Max", "weightKg",
  ]);

  const setIfPresent = <K extends keyof IngestPayload>(key: K) => {
    const raw = body[key];
    if (raw === undefined) return {};
    if (NUMERIC_FIELDS.has(key)) {
      const n = typeof raw === "number" ? raw : parseFloat(String(raw));
      return Number.isFinite(n) ? { [key]: n } : {};
    }
    return { [key]: raw };
  };

  const appleHealth = {
    ...existing,
    ...setIfPresent("steps"),
    ...setIfPresent("activeCalories"),
    ...setIfPresent("activeMinutes"),
    ...setIfPresent("heartRateAvg"),
    ...setIfPresent("heartRateResting"),
    ...setIfPresent("hrv"),
    ...setIfPresent("spO2"),
    ...setIfPresent("sleepMinutes"),
    ...setIfPresent("sleepLightMinutes"),
    ...setIfPresent("sleepDeepMinutes"),
    ...setIfPresent("sleepRemMinutes"),
    ...setIfPresent("distanceKm"),
    ...setIfPresent("vo2Max"),
    ...setIfPresent("weightKg"),
    ...setIfPresent("workouts"),
    syncedAt: FieldValue.serverTimestamp(),
  };

  await docRef.set(
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
