export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import { format, subDays, parseISO, differenceInDays } from "date-fns";
import type { DayLog } from "@/app/lib/types";

const USER = "owner";

export interface HeatmapDay {
  date:    string;   // YYYY-MM-DD
  pct:     number;   // 0-100+ (calories / goal * 100)
  calories: number;
  logged:  boolean;
}

export interface StreakData {
  currentStreak:  number;
  longestStreak:  number;
  totalLoggedDays: number;
  lastLoggedDate: string | null;
  heatmap:        HeatmapDay[];  // last 16 weeks = 112 days
  weeklyAvgDays:  number;        // avg logged days per week over last 4 weeks
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db    = getAdminFirestore();
  const today = format(new Date(), "yyyy-MM-dd");
  const from  = format(subDays(new Date(), 111), "yyyy-MM-dd"); // 16 weeks back

  // Fetch all logs in the window
  const snap = await db.collection(`users/${USER}/foodLog`)
    .where("date", ">=", from)
    .where("date", "<=", today)
    .orderBy("date", "desc")
    .get();

  // Also fetch goals for pct calculation
  const profileSnap = await db.doc(`users/${USER}`).get();
  const goalCalories: number = profileSnap.exists
    ? ((profileSnap.data() as { goals?: { dailyCalories?: number } })?.goals?.dailyCalories ?? 2000)
    : 2000;

  // Build map of date → calories
  const logMap = new Map<string, number>();
  for (const doc of snap.docs) {
    const log = doc.data() as DayLog;
    const cal = log.totals?.calories ?? log.entries?.reduce((s, e) => s + (e.nutrition?.calories ?? 0), 0) ?? 0;
    if (cal > 0) logMap.set(log.date, Math.round(cal));
  }

  // Build heatmap array (112 days, oldest first)
  const heatmap: HeatmapDay[] = [];
  for (let i = 111; i >= 0; i--) {
    const date = format(subDays(new Date(), i), "yyyy-MM-dd");
    const calories = logMap.get(date) ?? 0;
    heatmap.push({
      date,
      calories,
      logged: calories > 0,
      pct:    goalCalories > 0 ? Math.round((calories / goalCalories) * 100) : 0,
    });
  }

  // Current streak (from today going back)
  let currentStreak = 0;
  for (let i = 0; i < 365; i++) {
    const d = format(subDays(new Date(), i), "yyyy-MM-dd");
    // Allow today to be empty (day not over yet), start counting from yesterday if today empty
    if (i === 0 && !logMap.has(d)) continue;
    if (logMap.has(d) && (logMap.get(d) ?? 0) > 0) {
      currentStreak++;
    } else if (i > 0) {
      break;
    }
  }

  // Longest streak (over all fetched data + a wider query)
  const allSnap = await db.collection(`users/${USER}/foodLog`)
    .orderBy("date", "asc")
    .get();

  const allDates: string[] = [];
  for (const doc of allSnap.docs) {
    const log = doc.data() as DayLog;
    const cal = log.totals?.calories ?? log.entries?.reduce((s, e) => s + (e.nutrition?.calories ?? 0), 0) ?? 0;
    if (cal > 0) allDates.push(log.date);
  }

  let longestStreak = 0;
  let streak = 0;
  let prevDate: string | null = null;
  for (const date of allDates) {
    if (prevDate) {
      const gap = differenceInDays(parseISO(date), parseISO(prevDate));
      if (gap === 1) {
        streak++;
      } else {
        streak = 1;
      }
    } else {
      streak = 1;
    }
    if (streak > longestStreak) longestStreak = streak;
    prevDate = date;
  }

  // Weekly avg days (last 4 weeks = 28 days)
  let loggedLast28 = 0;
  for (let i = 0; i < 28; i++) {
    const d = format(subDays(new Date(), i), "yyyy-MM-dd");
    if ((logMap.get(d) ?? 0) > 0) loggedLast28++;
  }
  const weeklyAvgDays = Math.round((loggedLast28 / 4) * 10) / 10;

  // Last logged date
  const lastLoggedDate = allDates.length > 0 ? allDates[allDates.length - 1] : null;

  return NextResponse.json({
    currentStreak,
    longestStreak,
    totalLoggedDays: allDates.length,
    lastLoggedDate,
    heatmap,
    weeklyAvgDays,
  } satisfies StreakData);
}
