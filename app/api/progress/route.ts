import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import type { DayLog, FitnessDay, DayTrendPoint } from "@/app/lib/types";

export const dynamic = "force-dynamic";

// GET /api/progress?from=YYYY-MM-DD&to=YYYY-MM-DD
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to   = searchParams.get("to");

  if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
  }

  const db = getAdminFirestore();

  const [logSnap, fitnessSnap] = await Promise.all([
    db.collection(`users/${session.userId}/foodLog`)
      .where("date", ">=", from)
      .where("date", "<=", to)
      .orderBy("date", "asc")
      .get(),
    db.collection(`users/${session.userId}/fitnessData`)
      .where("date", ">=", from)
      .where("date", "<=", to)
      .orderBy("date", "asc")
      .get(),
  ]);

  // Index fitness data by date
  const fitnessMap = new Map<string, FitnessDay>();
  for (const d of fitnessSnap.docs) {
    fitnessMap.set(d.id, d.data() as FitnessDay);
  }

  const points: DayTrendPoint[] = logSnap.docs.map((d) => {
    const log     = d.data() as DayLog;
    const fitness = fitnessMap.get(log.date);
    const weightKg = fitness?.withings?.weightKg ?? fitness?.googleFit?.weightKg ?? undefined;
    return {
      date:      log.date,
      calories:  Math.round(log.totals?.calories ?? 0),
      proteinG:  Math.round(log.totals?.proteinG ?? 0),
      carbsG:    Math.round(log.totals?.carbsG ?? 0),
      fatG:      Math.round(log.totals?.fatG ?? 0),
      waterMl:   log.waterMl ?? 0,
      steps:     fitness?.googleFit?.steps ?? undefined,
      weightKg,
      burned:    fitness?.googleFit?.activeCaloriesBurned ?? undefined,
    };
  });

  // Also include fitness-only days (weight data without food log)
  for (const [date, fitness] of fitnessMap) {
    if (!logSnap.docs.find((d) => d.id === date)) {
      const weightKg = fitness.withings?.weightKg ?? fitness.googleFit?.weightKg ?? undefined;
      if (weightKg) {
        points.push({
          date,
          calories: 0,
          proteinG: 0,
          carbsG: 0,
          fatG: 0,
          steps: fitness.googleFit?.steps ?? undefined,
          weightKg,
          burned: fitness.googleFit?.activeCaloriesBurned ?? undefined,
        });
      }
    }
  }

  points.sort((a, b) => a.date.localeCompare(b.date));

  return NextResponse.json({ points });
}
