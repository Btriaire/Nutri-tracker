export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import { parseHaePayload, type HaePayload, type DailyHealthFields } from "@/app/lib/health-auto-export";

const USER_ID = "owner";

// Dedicated endpoint for the "Health Auto Export" iOS app's REST API
// automation — separate from /api/apple-health/ingest (the manual-Shortcut
// format) since the two send structurally different JSON. Auth is a
// ?token= query param (not a body field, since HAE's request body format
// is fixed by the app and can't carry extra fields) — same token as the
// Shortcut path, checked against users/{USER_ID}.integrations.appleHealth.token.
export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token")?.trim();

  const db = getAdminFirestore();
  const userDoc = await db.doc(`users/${USER_ID}`).get();
  const stored = (userDoc.data() as { integrations?: { appleHealth?: { token?: string } } })
    ?.integrations?.appleHealth?.token;

  if (!stored || !token || token !== stored) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const payload = await req.json().catch(() => null) as HaePayload | null;
  if (!payload) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const byDate = parseHaePayload(payload);
  if (byDate.size === 0) return NextResponse.json({ ok: true, days: 0 });

  for (const [date, fields] of byDate) {
    const docRef = db.doc(`users/${USER_ID}/fitnessData/${date}`);
    const existing = (await docRef.get()).data()?.appleHealth as Record<string, unknown> | undefined;

    const setIfPresent = <K extends keyof DailyHealthFields>(key: K) => {
      const v = fields[key];
      return v === undefined ? {} : { [key]: v };
    };

    const appleHealth = {
      ...existing,
      ...setIfPresent("steps"),
      ...setIfPresent("activeCalories"),
      ...setIfPresent("restingCalories"),
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
      syncedAt: FieldValue.serverTimestamp(),
    };

    await docRef.set({ date, appleHealth }, { merge: true });
  }

  await db.doc(`users/${USER_ID}`).set(
    { integrations: { appleHealth: { lastSyncedAt: FieldValue.serverTimestamp() } } },
    { merge: true },
  );

  return NextResponse.json({ ok: true, days: byDate.size, dates: [...byDate.keys()] });
}
