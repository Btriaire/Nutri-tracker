export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import { format, subDays } from "date-fns";

const USER = "owner";
const CRON_SECRET = process.env.CRON_SECRET || "";

// Server-to-server auth for VibeFit (PaLaMa fitness PWA), same convention as
// app/api/meditation/route.ts and app/api/mental-health/route.ts — this route
// has no session-cookie use case at all, it's automated-only.
function isAuthorized(req: NextRequest): boolean {
  const secret = req.headers.get("x-cron-secret");
  return !!secret && !!CRON_SECRET && secret === CRON_SECRET;
}

interface WeightPush {
  type: "weight";
  weightKg: number;
  date?: string; // YYYY-MM-DD, defaults to server-UTC today
}

interface FoodPush {
  type: "food";
  date?: string;
  name: string;
  calories: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  sugarG?: number;
}

interface ActivityPush {
  type: "activity";
  date?: string;
  name: string;
  activityType: number; // Google Fit activity code, same convention as /api/activity
  durationMin: number;
  caloriesBurned?: number;
}

// GET ?type=googlefit&days=N — last N days of Google Fit summaries already
// synced into fitnessData/{date}.googleFit (steps, sleep, active calories,
// heart rate, workout sessions). VibeFit has no Google OAuth of its own —
// it reads whatever nutri-tracker already pulled, same source-of-truth idea
// as the weight lookup below.
async function getGoogleFitRange(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const days = Math.min(30, Math.max(1, Number(searchParams.get("days")) || 7));
  const db = getAdminFirestore();
  const today = new Date();

  const out: Array<{ date: string } & Record<string, unknown>> = [];
  for (let i = 0; i < days; i++) {
    const date = format(subDays(today, i), "yyyy-MM-dd");
    const snap = await db.doc(`users/${USER}/fitnessData/${date}`).get();
    const gf = snap.exists ? snap.data()!.googleFit : null;
    if (!gf) continue;
    out.push({
      date,
      steps: gf.steps ?? 0,
      activeCaloriesBurned: gf.activeCaloriesBurned ?? 0,
      activeMinutes: gf.activeMinutes ?? 0,
      heartRateAvg: gf.heartRateAvg ?? null,
      sleepMinutes: gf.sleepMinutes ?? null,
      sessions: gf.sessions ?? [],
    });
  }
  return NextResponse.json({ days: out });
}

// GET — latest known weight (Withings first, VibeFit fallback), for VibeFit
// to pull on load and adopt if more recent than its own local log.
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  if (searchParams.get("type") === "googlefit") return getGoogleFitRange(req);

  const db = getAdminFirestore();
  const today = new Date();

  for (let i = 0; i < 14; i++) {
    const date = format(subDays(today, i), "yyyy-MM-dd");
    const snap = await db.doc(`users/${USER}/fitnessData/${date}`).get();
    if (!snap.exists) continue;
    const data = snap.data()!;
    const withingsKg = data.withings?.weightKg ?? null;
    const vibefitKg = data.vibefit?.weightKg ?? null;
    if (withingsKg !== null || vibefitKg !== null) {
      const withingsMeasuredAt = data.withings?.measuredAt ?? null;
      const vibefitMeasuredAt = data.vibefit?.measuredAt instanceof Timestamp ? data.vibefit.measuredAt.toMillis() : null;
      // Prefer whichever source has the more recent timestamp; Withings wins ties (existing convention).
      if (vibefitKg !== null && withingsKg !== null && vibefitMeasuredAt && vibefitMeasuredAt > (withingsMeasuredAt ?? 0)) {
        return NextResponse.json({ weightKg: vibefitKg, date, source: "vibefit" });
      }
      return NextResponse.json({ weightKg: withingsKg ?? vibefitKg, date, source: withingsKg !== null ? "withings" : "vibefit" });
    }
  }

  return NextResponse.json({ weightKg: null, date: null, source: null });
}

// POST — push a weigh-in or a food entry from VibeFit.
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as WeightPush | FoodPush | ActivityPush;
  const date = body.date && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : format(new Date(), "yyyy-MM-dd");
  const db = getAdminFirestore();

  if (body.type === "weight") {
    const weightKg = Number(body.weightKg);
    if (!Number.isFinite(weightKg) || weightKg <= 0) {
      return NextResponse.json({ error: "Invalid weightKg" }, { status: 400 });
    }
    // {merge: true} on the parent doc, replacing only the `vibefit` sub-object —
    // never touches `withings`/`manualSleep`/etc. written by other sources.
    await db.doc(`users/${USER}/fitnessData/${date}`).set(
      { date, vibefit: { weightKg, measuredAt: Timestamp.now() } },
      { merge: true },
    );
    return NextResponse.json({ ok: true });
  }

  if (body.type === "food") {
    const calories = Number(body.calories);
    if (!body.name || !Number.isFinite(calories)) {
      return NextResponse.json({ error: "Invalid food entry" }, { status: 400 });
    }
    const ref = db.doc(`users/${USER}/foodLog/${date}`);
    const entry = {
      id: `vibefit-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
      name: body.name,
      calories,
      proteinG: body.proteinG ?? 0,
      carbsG: body.carbsG ?? 0,
      fatG: body.fatG ?? 0,
      fiberG: 0,
      sugarG: body.sugarG ?? 0,
      source: "vibefit",
      loggedAt: Timestamp.now(),
    };

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const existing = snap.exists
        ? snap.data()!
        : { date, entries: [], totals: { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0, sugarG: 0 } };

      const entries = [...(existing.entries ?? []), entry];
      const totals = entries.reduce(
        (acc: { calories: number; proteinG: number; carbsG: number; fatG: number; fiberG: number; sugarG: number }, e: typeof entry) => ({
          calories: acc.calories + (e.calories ?? 0),
          proteinG: acc.proteinG + (e.proteinG ?? 0),
          carbsG: acc.carbsG + (e.carbsG ?? 0),
          fatG: acc.fatG + (e.fatG ?? 0),
          fiberG: acc.fiberG + (e.fiberG ?? 0),
          sugarG: acc.sugarG + (e.sugarG ?? 0),
        }),
        { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0, sugarG: 0 },
      );

      tx.set(ref, { ...existing, date, entries, totals, updatedAt: Timestamp.now() });
    });

    return NextResponse.json({ ok: true, entry });
  }

  if (body.type === "activity") {
    const durationMin = Math.max(1, Number(body.durationMin) || 1);
    if (!body.name) {
      return NextResponse.json({ error: "Invalid activity" }, { status: 400 });
    }
    const id = crypto.randomUUID();
    const activity = {
      id,
      date,
      name: body.name,
      activityType: Number(body.activityType) || 0,
      durationMin,
      caloriesBurned: body.caloriesBurned != null ? Number(body.caloriesBurned) : null,
      source: "vibefit",
      loggedAt: Timestamp.now(),
    };
    await db.doc(`users/${USER}/manualActivities/${id}`).set(activity);
    return NextResponse.json({ ok: true, activity });
  }

  return NextResponse.json({ error: "Unknown type" }, { status: 400 });
}
