import { NextRequest, NextResponse } from "next/server";
import { FieldPath } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import type { DayLog, FitnessDay, DayTrendPoint, HealthEntry } from "@/app/lib/types";

export const dynamic = "force-dynamic";

const USER = "owner";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to   = searchParams.get("to");

  if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to))
    return NextResponse.json({ error: "Invalid date range" }, { status: 400 });

  const db = getAdminFirestore();

  // Query by document ID (which IS the date string YYYY-MM-DD).
  // This is more reliable than querying on a "date" field which may be
  // missing from documents created via merge:true paths (e.g. water-only days).
  const [logSnap, fitnessSnap, healthSnap] = await Promise.all([
    db.collection(`users/${USER}/foodLog`)
      .where(FieldPath.documentId(), ">=", from)
      .where(FieldPath.documentId(), "<=", to)
      .orderBy(FieldPath.documentId(), "asc")
      .get(),
    db.collection(`users/${USER}/fitnessData`)
      .where(FieldPath.documentId(), ">=", from)
      .where(FieldPath.documentId(), "<=", to)
      .orderBy(FieldPath.documentId(), "asc")
      .get(),
    db.collection(`users/${USER}/healthLog`)
      .where(FieldPath.documentId(), ">=", from)
      .where(FieldPath.documentId(), "<=", to)
      .orderBy(FieldPath.documentId(), "asc")
      .get(),
  ]);

  const fitnessMap = new Map<string, FitnessDay>();
  for (const d of fitnessSnap.docs) fitnessMap.set(d.id, d.data() as FitnessDay);

  // BP from healthLog: pick the average reading of the day (manual or Withings)
  const bpMap = new Map<string, { sys: number; dia: number }>();
  for (const d of healthSnap.docs) {
    const h = d.data() as HealthEntry;
    // healthLog can have either bloodPressure[] array OR systolic/diastolic fields (Withings sync)
    const readings = h.bloodPressure ?? [];
    if (readings.length > 0) {
      const sys = Math.round(readings.reduce((s, r) => s + r.systolic,  0) / readings.length);
      const dia = Math.round(readings.reduce((s, r) => s + r.diastolic, 0) / readings.length);
      bpMap.set(d.id, { sys, dia });
    } else {
      // Withings auto-sync stores systolic/diastolic directly on the doc
      const direct = d.data() as { systolic?: number; diastolic?: number };
      if (direct.systolic && direct.diastolic) {
        bpMap.set(d.id, { sys: direct.systolic, dia: direct.diastolic });
      }
    }
  }

  const points: DayTrendPoint[] = logSnap.docs.map((d) => {
    const log     = d.data() as DayLog;
    const fitness = fitnessMap.get(d.id);
    const gf      = fitness?.googleFit;
    const bp      = bpMap.get(d.id);
    const mh      = log.mealHunger ?? {};
    return {
      date:             d.id,
      calories:         Math.round(log.totals?.calories ?? 0),
      proteinG:         Math.round(log.totals?.proteinG ?? 0),
      carbsG:           Math.round(log.totals?.carbsG ?? 0),
      fatG:             Math.round(log.totals?.fatG ?? 0),
      fiberG:           (log.totals?.fiberG ?? 0) > 0 ? Math.round(log.totals!.fiberG) : undefined,
      sugarG:           (log.totals?.sugarG ?? 0) > 0 ? Math.round(log.totals!.sugarG!) : undefined,
      sodiumMg:         (log.totals?.sodiumMg ?? 0) > 0 ? Math.round(log.totals!.sodiumMg!) : undefined,
      saturatedFatG:    (log.totals?.saturatedFatG ?? 0) > 0 ? Math.round(log.totals!.saturatedFatG!) : undefined,
      waterMl:          log.waterMl ?? 0,
      steps:            gf?.steps ?? undefined,
      weightKg:         fitness?.withings?.weightKg ?? gf?.weightKg ?? undefined,
      burned:           gf?.activeCaloriesBurned ?? undefined,
      activeMinutes:    gf?.activeMinutes ?? undefined,
      sleepMinutes:     gf?.sleepMinutes ?? undefined,
      heartRateAvg:     gf?.heartRateAvg ?? undefined,
      systolicBP:       bp?.sys,
      diastolicBP:      bp?.dia,
      hungerBreakfast:  mh.breakfast ?? undefined,
      hungerLunch:      mh.lunch ?? undefined,
      hungerDinner:     mh.dinner ?? undefined,
      hungerSnacks:     mh.snacks ?? undefined,
    };
  });

  // Fitness-only days (weight without food log) + BP-only days
  const loggedDates = new Set(logSnap.docs.map(d => d.id));
  const allDates    = new Set([...fitnessMap.keys(), ...bpMap.keys()]);
  for (const date of allDates) {
    if (loggedDates.has(date)) continue;
    const fitness  = fitnessMap.get(date);
    const gf       = fitness?.googleFit;
    const weightKg = fitness?.withings?.weightKg ?? gf?.weightKg ?? undefined;
    const bp       = bpMap.get(date);
    if (weightKg || gf?.steps || gf?.activeMinutes || bp) {
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
        systolicBP:    bp?.sys,
        diastolicBP:   bp?.dia,
      });
    }
  }

  points.sort((a, b) => a.date.localeCompare(b.date));
  return NextResponse.json({ points });
}
