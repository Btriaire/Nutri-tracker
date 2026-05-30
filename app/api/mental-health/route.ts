import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import { format, subDays } from "date-fns";

export const dynamic = "force-dynamic";

export interface MentalHealthEntry {
  date:         string;
  stressLevel:  number; // 1–5 (1=très calme, 5=très stressé)
  energy:       number;
  mood:         number;
  anxiety:      number;
  focus:        number;
  sleepQuality: number;
  social:       number;
  notes?:       string;
  loggedAt:     { seconds: number; nanoseconds: number };
}

export interface MoodPoint {
  date:   string;
  mood:   number | null;
  stress: number | null;
  energy: number | null;
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  // ── History mode: ?days=N ────────────────────────────────────────────────
  const daysParam = searchParams.get("days");
  if (daysParam !== null) {
    const days  = Math.min(Math.max(parseInt(daysParam, 10) || 30, 1), 365);
    const today = format(new Date(), "yyyy-MM-dd");
    const from  = format(subDays(new Date(), days - 1), "yyyy-MM-dd");

    const db   = getAdminFirestore();
    const snap = await db
      .collection("users/owner/mentalHealth")
      .where("date", ">=", from)
      .where("date", "<=", today)
      .orderBy("date", "asc")
      .get();

    // Build a dense array covering every day in the range (null for missing)
    const entryMap: Record<string, MentalHealthEntry> = {};
    for (const doc of snap.docs) {
      const raw = doc.data() as MentalHealthEntry;
      entryMap[raw.date] = raw;
    }

    const points: MoodPoint[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const dateStr = format(subDays(new Date(), i), "yyyy-MM-dd");
      const e       = entryMap[dateStr];
      points.push({
        date:   dateStr,
        mood:   e?.mood         ?? null,
        stress: e?.stressLevel  ?? null,
        energy: e?.energy       ?? null,
      });
    }

    return NextResponse.json({ points });
  }

  // ── Single-day mode: ?date= (default) ───────────────────────────────────
  const date = searchParams.get("date") ?? format(new Date(), "yyyy-MM-dd");
  const db   = getAdminFirestore();
  const snap = await db.doc(`users/owner/mentalHealth/${date}`).get();
  if (!snap.exists) return NextResponse.json({ entry: null });
  const raw = snap.data()!;
  return NextResponse.json({
    entry: {
      ...raw,
      loggedAt: { seconds: (raw.loggedAt as Timestamp).seconds, nanoseconds: 0 },
    } as MentalHealthEntry,
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json() as Omit<MentalHealthEntry, "loggedAt">;
  const db = getAdminFirestore();
  const date = body.date ?? format(new Date(), "yyyy-MM-dd");
  await db.doc(`users/owner/mentalHealth/${date}`).set({
    ...body,
    date,
    loggedAt: Timestamp.now(),
  });
  return NextResponse.json({ ok: true });
}
