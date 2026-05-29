import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import type { HealthEntry } from "@/app/lib/types";

export const dynamic = "force-dynamic";

function strip(e: HealthEntry) {
  return {
    date:          e.date,
    bloodPressure: e.bloodPressure ?? [],
    restingHR:     e.restingHR     ?? null,
    bloodGlucose:  e.bloodGlucose  ?? null,
    spO2:          e.spO2          ?? null,
    temperatureC:  e.temperatureC  ?? null,
    notes:         e.notes         ?? null,
    medications:   e.medications   ?? [],
    symptoms:      e.symptoms      ?? [],
    aiSynthesis:   e.aiSynthesis   ?? null,
  };
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  const days = parseInt(searchParams.get("days") ?? "1");

  const db = getAdminFirestore();

  if (!date) return NextResponse.json(null);

  if (days <= 1) {
    const doc = await db.doc(`users/${session.userId}/healthLog/${date}`).get();
    return NextResponse.json(doc.exists ? strip(doc.data() as HealthEntry) : null);
  }

  const snap = await db.collection(`users/${session.userId}/healthLog`)
    .where("date", "<=", date)
    .orderBy("date", "asc")
    .limit(days)
    .get();
  return NextResponse.json(snap.docs.map(d => strip(d.data() as HealthEntry)));
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as Partial<HealthEntry> & { date: string };
  const { date, ...updates } = body;
  if (!date) return NextResponse.json({ error: "date required" }, { status: 400 });

  const db = getAdminFirestore();
  const ref = db.doc(`users/${session.userId}/healthLog/${date}`);

  // Remove undefined fields so Firestore merge doesn't break
  const clean = Object.fromEntries(
    Object.entries(updates).filter(([, v]) => v !== undefined)
  );

  await ref.set({ date, ...clean, updatedAt: Timestamp.now() }, { merge: true });

  const snap = await ref.get();
  return NextResponse.json(strip(snap.data() as HealthEntry));
}
