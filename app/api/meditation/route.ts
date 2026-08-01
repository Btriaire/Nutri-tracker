export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { format } from "date-fns";

const USER = "owner";
const CRON_SECRET = process.env.CRON_SECRET || "";

// Server-to-server auth for automated pushes (Halcyon-PaLaMa), same
// convention as app/api/cron/sync-integrations/route.ts — bypasses the
// session cookie, which a cross-origin app can never carry anyway.
function isAutomatedRequest(req: NextRequest): boolean {
  const secret = req.headers.get("x-cron-secret");
  return !!secret && !!CRON_SECRET && secret === CRON_SECRET;
}

export interface MeditationSession {
  id?:          string;
  programId:    string;
  programLabel: string;
  durationMin:  number;
  completedAt:  string;  // ISO string
  date:         string;  // YYYY-MM-DD
}

// GET — last 30 sessions
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db   = getAdminFirestore();
  const snap = await db
    .collection(`users/${USER}/meditationSessions`)
    .orderBy("completedAt", "desc")
    .limit(30)
    .get();

  const sessions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return NextResponse.json({ sessions });
}

// POST — save a completed session
export async function POST(req: NextRequest) {
  const session = isAutomatedRequest(req)
    ? { userId: "owner", email: "", name: "" }
    : await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { programId: string; programLabel: string; durationMin: number };

  const db  = getAdminFirestore();
  const now = new Date();
  const ref = db.collection(`users/${USER}/meditationSessions`).doc();

  await ref.set({
    programId:    body.programId,
    programLabel: body.programLabel,
    durationMin:  body.durationMin,
    completedAt:  now.toISOString(),
    date:         format(now, "yyyy-MM-dd"),
    createdAt:    FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ ok: true, id: ref.id });
}
