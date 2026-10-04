import { NextRequest, NextResponse } from "next/server";
import { FieldPath } from "firebase-admin/firestore";
import { addDays, format, parseISO, subDays } from "date-fns";
import { getSession } from "@/app/lib/session";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import { recordReads } from "@/app/lib/quota-tracker";
import { computeDayStats, mergeReadings, DEFAULT_GLUCOSE_TARGET } from "@/app/lib/glucose";
import { overview, rangeBreakdown, ambulatoryProfile, mealRows, typicalHour } from "@/app/lib/glucose-insights";
import type { DayLog, GlucoseDay, MealType, UserProfile } from "@/app/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * GET /api/glucose/insights?days=30&tz=120&to=YYYY-MM-DD
 * Vue globale de la glycemie : tout est calcule ici (journee type, tranches, repas, courbes moyennes) pour que le
 * telephone ne recoive que quelques Ko au lieu de milliers de lectures. `tz` = minutes EST de UTC (Paris ete = 120).
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const p = req.nextUrl.searchParams;
  const days = Math.min(Math.max(parseInt(p.get("days") ?? "30", 10) || 30, 7), 120);
  const tz = Math.min(Math.max(parseInt(p.get("tz") ?? "0", 10) || 0, -720), 840);
  const toParam = p.get("to");
  const to = toParam && /^\d{4}-\d{2}-\d{2}$/.test(toParam) ? toParam : format(new Date(), "yyyy-MM-dd");
  const from = format(subDays(parseISO(to), days - 1), "yyyy-MM-dd");
  const tail = format(addDays(parseISO(to), 1), "yyyy-MM-dd");   // les lectures apres minuit du dernier jour

  const db = getAdminFirestore();
  const [profileSnap, glucoseSnap, foodSnap] = await Promise.all([
    db.doc(`users/${session.userId}`).get(),
    db.collection(`users/${session.userId}/glucoseLog`)
      .where(FieldPath.documentId(), ">=", from).where(FieldPath.documentId(), "<=", tail).get(),
    db.collection(`users/${session.userId}/foodLog`)
      .where(FieldPath.documentId(), ">=", from).where(FieldPath.documentId(), "<=", to).get(),
  ]);
  void recordReads(1 + glucoseSnap.size + foodSnap.size);

  const goals = (profileSnap.data() as UserProfile | undefined)?.goals;
  const target = { min: goals?.glucoseTargetMinMmol ?? DEFAULT_GLUCOSE_TARGET.min, max: goals?.glucoseTargetMaxMmol ?? DEFAULT_GLUCOSE_TARGET.max };

  const glucoseDays = glucoseSnap.docs.map((d) => ({ date: d.id, readings: (d.data() as Partial<GlucoseDay>).readings ?? [] }));
  const all = mergeReadings([], glucoseDays.flatMap((d) => d.readings));
  // Les statistiques portent sur la periode demandee ; la queue du lendemain ne sert qu'aux reponses des repas tardifs.
  const periodReadings = glucoseDays.filter((d) => d.date <= to).flatMap((d) => d.readings);
  const period = mergeReadings([], periodReadings);

  const meals = mealRows(all, foodSnap.docs.map((d) => ({ date: d.id, ...(d.data() as Pick<DayLog, "entries" | "mealTimes">) })));
  const typical = Object.fromEntries(
    (["breakfast", "lunch", "snacks", "dinner"] as MealType[]).map((m) => [m, typicalHour(meals.filter((r) => r.meal === m).map((r) => r.timeMs), tz)]),
  );

  return NextResponse.json({
    enabled: !!goals?.glucoseTracking,
    from, to, days,
    target,
    daysWithData: glucoseDays.filter((d) => d.date <= to && d.readings.length > 0).length,
    overview: overview(period),
    range: rangeBreakdown(period, target),
    agp: ambulatoryProfile(period, tz),
    daily: glucoseDays.filter((d) => d.date <= to && d.readings.length > 0).sort((a, b) => a.date.localeCompare(b.date)).map((d) => ({ date: d.date, ...computeDayStats(d.readings, target) })),
    meals,
    typicalHours: typical,
  });
}
