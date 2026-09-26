import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import { format } from "date-fns";

export const dynamic = "force-dynamic";

export interface MeasurementEntry {
  month:      string;     // "YYYY-MM"
  date:       string;     // "YYYY-MM-DD" — une entree par jour de saisie
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
    .limit(Math.min(months, 24) * 31)
    .get();

  // Anciens documents (1 par mois, id "YYYY-MM") : pas de champ `date`, on la derive de loggedAt.
  const entries: MeasurementEntry[] = snap.docs.map(d => {
    const raw = d.data() as MeasurementEntry & { loggedAt?: Timestamp };
    const seconds = raw.loggedAt?.seconds ?? 0;
    const date = raw.date ?? (seconds ? format(new Date(seconds * 1000), "yyyy-MM-dd") : `${raw.month}-01`);
    return { ...raw, date, loggedAt: { seconds, nanoseconds: 0 } };
  });
  entries.sort((a, b) => a.date.localeCompare(b.date));

  const cutoff = format(new Date(new Date().setMonth(new Date().getMonth() - Math.min(months, 24))), "yyyy-MM-dd");
  return NextResponse.json({ entries: entries.filter(e => e.date >= cutoff) });
}

export async function POST(req: NextRequest) {
  const body = await req.json() as Omit<MeasurementEntry, "loggedAt" | "month" | "date">;
  const now   = new Date();
  const date  = format(now, "yyyy-MM-dd");
  const month = format(now, "yyyy-MM");
  const db    = getAdminFirestore();

  await db.doc(`users/owner/measurements/${date}`).set({
    ...body,
    date,
    month,
    loggedAt: Timestamp.now(),
  }, { merge: true });

  return NextResponse.json({ ok: true });
}
