import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";
import { getAdminFirestore } from "@/app/lib/firebase-admin";

export const dynamic = "force-dynamic";

export interface FastingSession {
  date:          string;
  active:        boolean;
  startedAtMs:   number | null;
  durationH:     number;
  completedAtMs?: number;
}

// GET /api/fasting?date=YYYY-MM-DD
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const date = req.nextUrl.searchParams.get("date") ?? "";
  if (!date) return NextResponse.json({ session: null });

  const db   = getAdminFirestore();
  const snap = await db.doc(`users/${session.userId}/fastingLog/${date}`).get();
  return NextResponse.json({ session: snap.exists ? (snap.data() as FastingSession) : null });
}

// POST /api/fasting  { date, action: "start"|"stop", durationH? }
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    date:      string;
    action:    "start" | "stop";
    durationH?: number;
  };
  const { date, action, durationH = 16 } = body;

  const db  = getAdminFirestore();
  const ref = db.doc(`users/${session.userId}/fastingLog/${date}`);

  if (action === "start") {
    const data: FastingSession = {
      date,
      active:      true,
      startedAtMs: Date.now(),
      durationH,
    };
    await ref.set(data);
    return NextResponse.json({ ok: true, session: data });
  }

  // action === "stop"
  const snap     = await ref.get();
  const existing = snap.exists ? (snap.data() as FastingSession) : null;
  if (!existing) return NextResponse.json({ ok: false });

  const updated: FastingSession = {
    ...existing,
    active:       false,
    completedAtMs: Date.now(),
  };
  await ref.set(updated);
  return NextResponse.json({ ok: true, session: updated });
}
