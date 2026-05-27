import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import { format } from "date-fns";

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

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date") ?? format(new Date(), "yyyy-MM-dd");
  const db = getAdminFirestore();
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
