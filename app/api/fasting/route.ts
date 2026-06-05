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

// POST /api/fasting  { date, action: "start"|"stop"|"update", durationH?, startedAtMs? }
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    date:          string;
    action:        "start" | "stop" | "update";
    durationH?:    number;
    startedAtMs?:  number;   // optional custom start time (ms)
  };
  const { date, action, durationH = 16, startedAtMs } = body;

  const db  = getAdminFirestore();
  const ref = db.doc(`users/${session.userId}/fastingLog/${date}`);

  if (action === "start") {
    const data: FastingSession = {
      date,
      active:      true,
      startedAtMs: startedAtMs ?? Date.now(),
      durationH,
    };
    await ref.set(data);
    return NextResponse.json({ ok: true, session: data });
  }

  if (action === "update") {
    // Retroactively change the start time of an existing active session
    const snap     = await ref.get();
    const existing = snap.exists ? (snap.data() as FastingSession) : null;
    if (!existing || !existing.active) return NextResponse.json({ ok: false });
    const updated: FastingSession = {
      ...existing,
      startedAtMs: startedAtMs ?? existing.startedAtMs,
    };
    await ref.set(updated);
    return NextResponse.json({ ok: true, session: updated });
  }

  // action === "stop"
  const snap     = await ref.get();
  const existing = snap.exists ? (snap.data() as FastingSession) : null;
  if (!existing) return NextResponse.json({ ok: false });

  const updated: FastingSession = {
    ...existing,
    active:        false,
    completedAtMs: Date.now(),
  };
  await ref.set(updated);
  return NextResponse.json({ ok: true, session: updated });
}
