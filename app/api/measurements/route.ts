import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import { format } from "date-fns";

export const dynamic = "force-dynamic";

export interface MeasurementEntry {
  month:      string;     // "YYYY-MM"
  waistCm:    number | null;
  hipsCm:     number | null;
  chestCm:    number | null;
  armsCm:     number | null;
  thighsCm:   number | null;
  neckCm:     number | null;
  calfsCm:    number | null;
  loggedAt:   { seconds: number; nanoseconds: number };
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const months = parseInt(searchParams.get("months") ?? "12", 10);
  const db     = getAdminFirestore();

  const snap = await db
    .collection("users/owner/measurements")
    .orderBy("month", "desc")
    .limit(Math.min(months, 24))
    .get();

  const entries: MeasurementEntry[] = snap.docs.map(d => {
    const raw = d.data() as MeasurementEntry & { loggedAt: Timestamp };
    return {
      ...raw,
      loggedAt: { seconds: raw.loggedAt?.seconds ?? 0, nanoseconds: 0 },
    };
  });

  return NextResponse.json({ entries: entries.reverse() });
}

export async function POST(req: NextRequest) {
  const body = await req.json() as Omit<MeasurementEntry, "loggedAt" | "month">;
  const month = format(new Date(), "yyyy-MM");
  const db    = getAdminFirestore();

  await db.doc(`users/owner/measurements/${month}`).set({
    ...body,
    month,
    loggedAt: Timestamp.now(),
  }, { merge: true });

  return NextResponse.json({ ok: true });
}
