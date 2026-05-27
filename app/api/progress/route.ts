import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import type { DayLog, FitnessDay, DayTrendPoint } from "@/app/lib/types";

export const dynamic = "force-dynamic";

const USER = "owner";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to   = searchParams.get("to");

  if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to))
    return NextResponse.json({ error: "Invalid date range" }, { status: 400 });

  const db = getAdminFirestore();

  const [logSnap, fitnessSnap] = await Promise.all([
    db.collection(`users/${USER}/foodLog`)
      .where("date", ">=", from).where("date", "<=", to).orderBy("date", "asc").get(),
    db.collection(`users/${USER}/fitnessData`)
      .where("date", ">=", from).where("date", "<=", to).orderBy("date", "asc").get(),
  ]);

  const fitnessMap = new Map<string, FitnessDay>();
  for (const d of fitnessSnap.docs) fitnessMap.set(d.id, d.data() as FitnessDay);

  const points: DayTrendPoint[] = logSnap.docs.map((d) => {
    const log     = d.data() as DayLog;
    const fitness = fitnessMap.get(log.date);
    const gf      = fitness?.googleFit;
    return {
      date:          log.date,
      calories:      Math.round(log.totals?.calories ?? 0),
      proteinG:      Math.round(log.totals?.proteinG ?? 0),
      carbsG:        Math.round(log.totals?.carbsG ?? 0),
      fatG:          Math.round(log.totals?.fatG ?? 0),
      waterMl:       log.waterMl ?? 0,
      steps:         gf?.steps ?? undefined,
      weightKg:      fitness?.withings?.weightKg ?? gf?.weightKg ?? undefined,
      burned:        gf?.activeCaloriesBurned ?? undefined,
      activeMinutes: gf?.activeMinutes ?? undefined,
      sleepMinutes:  gf?.sleepMinutes ?? undefined,
      heartRateAvg:  gf?.heartRateAvg ?? undefined,
    };
  });

  // Fitness-only days (weight without food log)
  for (const [date, fitness] of fitnessMap) {
    if (!logSnap.docs.find((d) => d.id === date)) {
      const gf      = fitness.googleFit;
      const weightKg = fitness.withings?.weightKg ?? gf?.weightKg ?? undefined;
      if (weightKg || gf?.steps || gf?.activeMinutes) {
        points.push({
          date,
          calories:      0,
          proteinG:      0,
          carbsG:        0,
          fatG:          0,
          steps:         gf?.steps ?? undefined,
          weightKg,
          burned:        gf?.activeCaloriesBurned ?? undefined,
          activeMinutes: gf?.activeMinutes ?? undefined,
          sleepMinutes:  gf?.sleepMinutes ?? undefined,
          heartRateAvg:  gf?.heartRateAvg ?? undefined,
        });
      }
    }
  }

  points.sort((a, b) => a.date.localeCompare(b.date));
  return NextResponse.json({ points });
}
