import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore } from "@/app/lib/firebase-admin";

export const dynamic = "force-dynamic";

const USER = "owner";

// POST /api/sleep  { date, sleepMinutes }
export async function POST(req: NextRequest) {
  const body = await req.json() as { date?: string; sleepMinutes?: number };

  if (!body.date || !/^\d{4}-\d{2}-\d{2}$/.test(body.date))
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });

  const min = Math.round(body.sleepMinutes ?? 0);
  if (min < 0 || min > 1440)
    return NextResponse.json({ error: "Invalid sleepMinutes" }, { status: 400 });

  const db = getAdminFirestore();
  const ref = db.doc(`users/${USER}/fitnessData/${body.date}`);

  await ref.set(
    { googleFit: { sleepMinutes: min, sleepManual: true } },
    { merge: true },
  );

  return NextResponse.json({ ok: true, date: body.date, sleepMinutes: min });
}

// DELETE /api/sleep?date=YYYY-MM-DD
export async function DELETE(req: NextRequest) {
  const date = new URL(req.url).searchParams.get("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date))
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });

  const db = getAdminFirestore();
  await db.doc(`users/${USER}/fitnessData/${date}`).set(
    { googleFit: { sleepMinutes: null, sleepManual: false } },
    { merge: true },
  );

  return NextResponse.json({ ok: true });
}
