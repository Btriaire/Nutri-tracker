import { getSession } from "@/app/lib/session";
import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export const dynamic = "force-dynamic";


// POST /api/sleep  { date, sleepMinutes }
// Writes to `manualSleep` — a separate key never overwritten by Google Fit / Withings sync.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const USER = session.userId;
  const body = await req.json() as { date?: string; sleepMinutes?: number };

  if (!body.date || !/^\d{4}-\d{2}-\d{2}$/.test(body.date))
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });

  const min = Math.round(body.sleepMinutes ?? 0);
  if (min < 1 || min > 1440)
    return NextResponse.json({ error: "Invalid sleepMinutes" }, { status: 400 });

  const db = getAdminFirestore();
  await db.doc(`users/${USER}/fitnessData/${body.date}`).set(
    { date: body.date, manualSleep: { sleepMinutes: min, updatedAt: FieldValue.serverTimestamp() } },
    { merge: true },
  );

  return NextResponse.json({ ok: true, date: body.date, sleepMinutes: min });
}

// DELETE /api/sleep?date=YYYY-MM-DD  — clears the manual override
export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const USER = session.userId;
  const date = new URL(req.url).searchParams.get("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date))
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });

  const db = getAdminFirestore();
  await db.doc(`users/${USER}/fitnessData/${date}`).set(
    { manualSleep: { sleepMinutes: null } },
    { merge: true },
  );

  return NextResponse.json({ ok: true });
}
