import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import { defaultGoals } from "@/app/lib/nutrition";
import type { DayLog, FitnessDay, UserProfile, DashboardData, WeightPoint } from "@/app/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") ?? new Date().toISOString().slice(0, 10);

  const db = getAdminFirestore();
  const userId = session.userId;

  // Read in parallel
  const [logSnap, fitnessSnap, profileSnap] = await Promise.all([
    db.doc(`users/${userId}/foodLog/${date}`).get(),
    db.doc(`users/${userId}/fitnessData/${date}`).get(),
    db.doc(`users/${userId}`).get(),
  ]);

  const profile = profileSnap.exists ? profileSnap.data() as UserProfile : null;
  const goals = profile?.goals ?? defaultGoals();

  const dayLog = logSnap.exists ? logSnap.data() as DayLog : null;
  const fitnessDay = fitnessSnap.exists ? fitnessSnap.data() as FitnessDay : null;

  const consumed = dayLog?.totals ?? { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 };
  const burned   = fitnessDay?.googleFit?.activeCaloriesBurned ?? null;
  const steps    = fitnessDay?.googleFit?.steps ?? null;

  // Fetch recent weight (last 7 entries)
  const weightSnap = await db
    .collection(`users/${userId}/fitnessData`)
    .orderBy("date", "desc")
    .limit(14)
    .get();

  const recentWeight: WeightPoint[] = [];
  for (const d of weightSnap.docs) {
    const fd = d.data() as FitnessDay;
    if (fd.withings?.weightKg) {
      recentWeight.push({ kg: fd.withings.weightKg, date: fd.date });
    }
    if (recentWeight.length >= 7) break;
  }

  const weight = recentWeight[0] ?? null;
  const previous = recentWeight[1] ?? null;

  const netCalories = consumed.calories - (burned ?? 0);
  const waterMl     = dayLog?.waterMl ?? 0;

  const data: DashboardData & { previous?: WeightPoint | null } = {
    date,
    goals,
    consumed,
    netCalories,
    burned,
    steps,
    stepsGoal: 10000,
    weight,
    recentWeight: recentWeight.reverse(),
    waterMl,
    previous,
  };

  return NextResponse.json(data);
}
