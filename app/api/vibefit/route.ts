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

interface RemoteActivity {
  id: string;
  date: string;
  name: string;
  activityType: number;
  durationMin: number;
  caloriesBurned: number | null;
  source: string;
  startMs: number | null;
  distanceM: number | null;
  avgSpeedKmh: number | null;
  heartRateAvg: number | null;
  elevationGainM: number | null;
}

// GET ?type=activities&days=N — the real activity history VibeFit should
// import: mostly Google Fit/HealthKit workout sessions synced into
// fitnessData/{date}.googleFit.sessions (real distance/speed/HR, not just a
// name+duration), plus any manualActivities entries typed directly into
// NutriTracker's own UI. Both exclude source==="vibefit" so a pull never
// re-imports what VibeFit pushed here itself.
async function getActivitiesRange(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const days = Math.min(90, Math.max(1, Number(searchParams.get("days")) || 30));
  const db = getAdminFirestore();
  const today = new Date();
  const fromDate = format(subDays(today, days - 1), "yyyy-MM-dd");

  // No orderBy, same defensive pattern as app/api/activity/route.ts — avoids
  // a composite index requirement; sorted in JS instead.
  const manualSnap = await db
    .collection(`users/${USER}/manualActivities`)
    .where("date", ">=", fromDate)
    .get();
  const manual: RemoteActivity[] = manualSnap.docs
    .map((d) => d.data())
    .filter((a) => a.source !== "vibefit")
    .map((a) => ({
      id: a.id as string,
      date: a.date as string,
      name: a.name as string,
      activityType: a.activityType as number,
      durationMin: a.durationMin as number,
      caloriesBurned: (a.caloriesBurned as number | null) ?? null,
      source: (a.source as string | undefined) ?? "nutritracker",
      startMs: null,
      distanceM: null,
      avgSpeedKmh: null,
      heartRateAvg: null,
      elevationGainM: null,
    }));

  const googleFit: RemoteActivity[] = [];
  for (let i = 0; i < days; i++) {
    const date = format(subDays(today, i), "yyyy-MM-dd");
    const snap = await db.doc(`users/${USER}/fitnessData/${date}`).get();
    const sessions = snap.exists ? (snap.data()?.googleFit?.sessions as Array<Record<string, unknown>> | undefined) : undefined;
    if (!Array.isArray(sessions)) continue;
    for (const s of sessions) {
      googleFit.push({
        id: String(s.id),
        date,
        name: (s.name as string) || "Activité",
        activityType: Number(s.activityType) || 0,
        durationMin: Math.max(1, Math.round(Number(s.durationMin) || 0)),
        caloriesBurned: (s.calories as number | null) ?? null,
        source: "googlefit",
        startMs: (s.startMs as number | null) ?? null,
        distanceM: (s.distanceM as number | null) ?? null,
        avgSpeedKmh: (s.avgSpeedKmh as number | null) ?? null,
        heartRateAvg: (s.heartRateAvg as number | null) ?? null,
        elevationGainM: (s.elevationGainM as number | null) ?? null,
      });
    }
  }

  const activities = [...manual, ...googleFit].sort((a, b) => b.date.localeCompare(a.date));
  return NextResponse.json({ activities });
}

// GET ?type=nutrition&date=YYYY-MM-DD — food logged directly in NutriTracker
// for that day (calories/glucides+sucres/protéines/lipides), excluding
// entries VibeFit itself pushed (source==="vibefit") — those already exist
// in VibeFit's own local nutrition store, so counting them again here would
// double them when VibeFit adds this to its own day total.
async function getNutritionForDay(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") || format(new Date(), "yyyy-MM-dd");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }
  const db = getAdminFirestore();
  const snap = await db.doc(`users/${USER}/foodLog/${date}`).get();
  if (!snap.exists) {
    return NextResponse.json({ date, calories: 0, proteinG: 0, carbsG: 0, fatG: 0, sugarG: 0, entryCount: 0 });
  }
  const data = snap.data()!;
  const entries = ((data.entries ?? []) as Array<Record<string, unknown>>).filter((e) => e.source !== "vibefit");
  // Entries logged in NutriTracker's own UI carry a nested `nutrition` object
  // (FoodEntry shape); only vibefit-pushed entries (excluded above) are flat.
  const totals = entries.reduce(
    (acc: { calories: number; proteinG: number; carbsG: number; fatG: number; sugarG: number }, e) => {
      const n = (e.nutrition as Record<string, unknown> | undefined) ?? e;
      return {
        calories: acc.calories + (Number(n.calories) || 0),
        proteinG: acc.proteinG + (Number(n.proteinG) || 0),
        carbsG: acc.carbsG + (Number(n.carbsG) || 0),
        fatG: acc.fatG + (Number(n.fatG) || 0),
        sugarG: acc.sugarG + (Number(n.sugarG) || 0),
      };
    },
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, sugarG: 0 },
  );
  // Répartition par repas (breakfast/lunch/dinner/snacks) — VibeFit n'avait
  // que le total brut jusqu'ici, pas de quoi afficher "au moins les
  // catégories" côté Diet Deficit.
  const byMeal: Record<string, { calories: number; proteinG: number; carbsG: number; fatG: number; items: string[] }> = {};
  for (const e of entries) {
    const meal = typeof e.meal === "string" ? e.meal : "snacks";
    const n = (e.nutrition as Record<string, unknown> | undefined) ?? e;
    const entry = byMeal[meal] ?? { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, items: [] };
    entry.calories += Number(n.calories) || 0;
    entry.proteinG += Number(n.proteinG) || 0;
    entry.carbsG += Number(n.carbsG) || 0;
    entry.fatG += Number(n.fatG) || 0;
    if (typeof e.name === "string") entry.items.push(e.name);
    byMeal[meal] = entry;
  }
  return NextResponse.json({ date, ...totals, entryCount: entries.length, byMeal });
}

// GET ?type=nutrition-range&days=N — same totals as getNutritionForDay, but
// for each of the last N days in one call, so VibeFit's Progression overview
// doesn't have to make N separate requests just to plot a trend.
async function getNutritionRange(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const days = Math.min(30, Math.max(1, Number(searchParams.get("days")) || 14));
  const db = getAdminFirestore();
  const today = new Date();

  const out: Array<{ date: string; calories: number; proteinG: number; carbsG: number; fatG: number; sugarG: number; entryCount: number }> = [];
  for (let i = 0; i < days; i++) {
    const date = format(subDays(today, i), "yyyy-MM-dd");
    const snap = await db.doc(`users/${USER}/foodLog/${date}`).get();
    if (!snap.exists) continue;
    const data = snap.data()!;
    const entries = ((data.entries ?? []) as Array<Record<string, unknown>>).filter((e) => e.source !== "vibefit");
    if (entries.length === 0) continue;
    const totals = entries.reduce(
      (acc: { calories: number; proteinG: number; carbsG: number; fatG: number; sugarG: number }, e) => {
        const n = (e.nutrition as Record<string, unknown> | undefined) ?? e;
        return {
          calories: acc.calories + (Number(n.calories) || 0),
          proteinG: acc.proteinG + (Number(n.proteinG) || 0),
          carbsG: acc.carbsG + (Number(n.carbsG) || 0),
          fatG: acc.fatG + (Number(n.fatG) || 0),
          sugarG: acc.sugarG + (Number(n.sugarG) || 0),
        };
      },
      { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, sugarG: 0 },
    );
    out.push({ date, ...totals, entryCount: entries.length });
  }
  return NextResponse.json({ days: out });
}

// GET ?type=cardiac&days=N — FC repos/moyenne (Apple Health en priorité,
// sinon Withings) et tension artérielle (Withings) des N derniers jours où
// au moins une de ces valeurs est connue. VibeFit n'a ni capteur cardiaque
// continu ni tensiomètre connecté ; tout vient d'intégrations déjà actives
// côté NutriTracker.
async function getCardiacRange(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const days = Math.min(60, Math.max(1, Number(searchParams.get("days")) || 14));
  const db = getAdminFirestore();
  const today = new Date();

  const out: Array<{
    date: string;
    heartRateAvg: number | null;
    heartRateResting: number | null;
    systolicBP: number | null;
    diastolicBP: number | null;
    source: string;
  }> = [];
  for (let i = 0; i < days; i++) {
    const date = format(subDays(today, i), "yyyy-MM-dd");
    const snap = await db.doc(`users/${USER}/fitnessData/${date}`).get();
    if (!snap.exists) continue;
    const data = snap.data()!;
    const ah = data.appleHealth;
    const wi = data.withings;
    const heartRateAvg = ah?.heartRateAvg ?? null;
    const heartRateResting = ah?.heartRateResting ?? wi?.restingHR ?? null;
    const systolicBP = wi?.systolicBP ?? null;
    const diastolicBP = wi?.diastolicBP ?? null;
    if (heartRateAvg == null && heartRateResting == null && systolicBP == null && diastolicBP == null) continue;
    out.push({ date, heartRateAvg, heartRateResting, systolicBP, diastolicBP, source: ah ? "apple-health" : "withings" });
  }
  return NextResponse.json({ days: out });
}

// GET ?type=mood&date=YYYY-MM-DD — today's mood entry from NutriTracker's
// "Humeur du jour" widget (users/owner/mentalHealth/{date}), read directly
// via admin Firestore since app/api/mental-health/route.ts is session-gated
// and has no server-to-server path — same rationale as every other read here.
async function getMoodForDay(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") || format(new Date(), "yyyy-MM-dd");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }
  const db = getAdminFirestore();
  const snap = await db.doc(`users/${USER}/mentalHealth/${date}`).get();
  if (!snap.exists) return NextResponse.json({ date, mood: null, stressLevel: null, energy: null, tags: [] });
  const data = snap.data()!;
  return NextResponse.json({
    date,
    mood: data.mood ?? null,
    stressLevel: data.stressLevel ?? null,
    energy: data.energy ?? null,
    tags: Array.isArray(data.tags) ? data.tags : [],
  });
}

// GET — latest known weight (Withings first, VibeFit fallback), for VibeFit
// to pull on load and adopt if more recent than its own local log.
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  if (searchParams.get("type") === "googlefit") return getGoogleFitRange(req);
  if (searchParams.get("type") === "activities") return getActivitiesRange(req);
  if (searchParams.get("type") === "nutrition") return getNutritionForDay(req);
  if (searchParams.get("type") === "nutrition-range") return getNutritionRange(req);
  if (searchParams.get("type") === "mood") return getMoodForDay(req);
  if (searchParams.get("type") === "cardiac") return getCardiacRange(req);

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
