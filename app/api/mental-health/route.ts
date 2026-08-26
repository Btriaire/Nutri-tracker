import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import { format, subDays } from "date-fns";

export const dynamic = "force-dynamic";

const CRON_SECRET = process.env.CRON_SECRET || "";

// Server-to-server auth for automated pushes (Halcyon-PaLaMa), same
// convention as app/api/cron/sync-integrations/route.ts and
// app/api/meditation/route.ts — bypasses the session cookie, which a
// cross-origin app can never carry anyway.
function isAutomatedRequest(req: NextRequest): boolean {
  const secret = req.headers.get("x-cron-secret");
  return !!secret && !!CRON_SECRET && secret === CRON_SECRET;
}

export interface MentalHealthEntry {
  date:          string;
  stressLevel?:  number; // 1–5 (1=très calme, 5=très stressé)
  energy?:       number;
  mood:          number;
  moodX?:        number; // position sur le cercle humeur (-1..1, valence) — modèle Halcyon-PaLaMa
  moodY?:        number; // position sur le cercle humeur (-1..1, arousal)
  anxiety?:      number;
  focus?:        number;
  sleepQuality?: number;
  social?:       number;
  tags?:         string[]; // e.g. quick mood keywords from Halcyon-PaLaMa
  notes?:        string;
  loggedAt:      { seconds: number; nanoseconds: number };
}

export interface MoodPoint {
  date:   string;
  mood:   number | null;
  stress: number | null;
  energy: number | null;
}

export async function GET(req: NextRequest) {
  // GET has no automated-request use case — always require a real session.
  // (Adding this route to middleware.ts's PUBLIC_PREFIXES only bypasses the
  // cookie *gate*; without this check GET would become fully public.)
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
  const automated = isAutomatedRequest(req);
  const body = await req.json() as Omit<MentalHealthEntry, "loggedAt">;

  // The automated path (Halcyon-PaLaMa) only ever sends {mood, tags} — no
  // date, no detailed fields. Validate it explicitly since it's now a real
  // externally-authenticated write path, unlike the manual widget's payload
  // which the UI itself already constrains.
  if (automated) {
    const mood = Number(body.mood);
    if (!Number.isInteger(mood) || mood < 1 || mood > 5) {
      return NextResponse.json({ error: "Invalid mood" }, { status: 400 });
    }
    const tags = Array.isArray(body.tags)
      ? body.tags.filter((t): t is string => typeof t === "string").slice(0, 10)
      : [];

    const db = getAdminFirestore();
    // Prefer the caller's own local calendar date over this server's UTC
    // clock — this route runs in UTC, which lands a push made near local
    // midnight (west of Greenwich) under the wrong day otherwise. Falls
    // back to server-UTC "today" only for older callers that don't send one.
    const date =
      typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date)
        ? body.date
        : format(new Date(), "yyyy-MM-dd");
    // {merge: true} is what keeps this quick push from wiping out a
    // same-day detailed entry (stress/anxiety/focus/sleep/social) made via
    // the manual widget, and vice versa — see measurements/route.ts for the
    // same precedent.
    await db.doc(`users/owner/mentalHealth/${date}`).set(
      { mood, tags, date, loggedAt: Timestamp.now() },
      { merge: true }
    );
    return NextResponse.json({ ok: true });
  }

  const db = getAdminFirestore();
  const date = body.date ?? format(new Date(), "yyyy-MM-dd");
  await db.doc(`users/owner/mentalHealth/${date}`).set(
    { ...body, date, loggedAt: Timestamp.now() },
    { merge: true }
  );
  return NextResponse.json({ ok: true });
}
