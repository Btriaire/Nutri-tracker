export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import { format, subDays } from "date-fns";
import type { DayLog, FoodEntry, MealType } from "@/app/lib/types";

const USER = "owner";
const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snacks"];

export interface MealTimingPoint {
  date:       string;
  meal:       MealType;
  minutesSinceMidnight: number; // 0-1439
  calories:   number;
}

export interface MealTimingStats {
  meal:        MealType;
  avgMinutes:  number;          // average time of day for this meal
  stdMinutes:  number;          // standard deviation in minutes
  count:       number;          // number of logged instances
  points:      { date: string; minutes: number; calories: number }[];
}

export interface MealTimingData {
  stats:  MealTimingStats[];
  points: MealTimingPoint[];   // raw points for timeline
  days:   number;              // number of days analyzed
}

function msToMinutes(ts: { _seconds?: number; seconds?: number } | null | undefined): number | null {
  if (!ts) return null;
  const sec = (ts as { _seconds?: number })._seconds ?? (ts as { seconds?: number }).seconds;
  if (sec == null) return null;
  const d = new Date(sec * 1000);
  return d.getHours() * 60 + d.getMinutes();
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

// Circular mean for times (wrap-around at midnight)
function circularMean(minutes: number[]): number {
  if (!minutes.length) return 0;
  const sinSum = minutes.reduce((a, m) => a + Math.sin((m / 1440) * 2 * Math.PI), 0);
  const cosSum = minutes.reduce((a, m) => a + Math.cos((m / 1440) * 2 * Math.PI), 0);
  const angle  = Math.atan2(sinSum / minutes.length, cosSum / minutes.length);
  const raw    = ((angle / (2 * Math.PI)) * 1440 + 1440) % 1440;
  return Math.round(raw);
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db    = getAdminFirestore();
  const today = format(new Date(), "yyyy-MM-dd");
  const from  = format(subDays(new Date(), 29), "yyyy-MM-dd"); // last 30 days

  const snap = await db
    .collection(`users/${USER}/foodLog`)
    .where("date", ">=", from)
    .where("date", "<=", today)
    .orderBy("date", "desc")
    .get();

  const allPoints: MealTimingPoint[] = [];

  for (const doc of snap.docs) {
    const log = doc.data() as DayLog;
    for (const entry of (log.entries ?? []) as FoodEntry[]) {
      const min = msToMinutes(entry.loggedAt as unknown as { _seconds?: number; seconds?: number });
      if (min == null) continue;
      allPoints.push({
        date:                 log.date,
        meal:                 entry.meal,
        minutesSinceMidnight: min,
        calories:             Math.round(entry.nutrition?.calories ?? 0),
      });
    }
  }

  // Build per-meal stats
  const stats: MealTimingStats[] = MEAL_TYPES.map(meal => {
    const pts = allPoints.filter(p => p.meal === meal);
    const times = pts.map(p => p.minutesSinceMidnight);

    return {
      meal,
      avgMinutes: times.length ? circularMean(times) : 0,
      stdMinutes: Math.round(stdDev(times)),
      count:      pts.length,
      points:     pts.map(p => ({ date: p.date, minutes: p.minutesSinceMidnight, calories: p.calories })),
    };
  });

  // Count distinct days that have at least one entry with loggedAt
  const daysWithTiming = new Set(allPoints.map(p => p.date)).size;

  return NextResponse.json({
    stats,
    points: allPoints,
    days:   daysWithTiming,
  } satisfies MealTimingData);
}
