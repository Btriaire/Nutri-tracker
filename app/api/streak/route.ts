export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import { recordReads } from "@/app/lib/quota-tracker";
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

  // Also fetch goals + cached streak stats
  const profileSnap = await db.doc(`users/${USER}`).get();
  const profileData = profileSnap.exists ? profileSnap.data() as {
    goals?: { dailyCalories?: number };
    streakCache?: { longestStreak: number; totalLoggedDays: number; lastLoggedDate: string | null; computedDate: string };
  } : undefined;
  const goalCalories: number = profileData?.goals?.dailyCalories ?? 2000;
  void recordReads(snap.size + 1);

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

  // Longest streak (over full history). A day only ever *adds* to this, so it's
  // safe to cache on the profile doc and only re-scan the whole foodLog collection
  // once per day instead of on every dashboard mount — this used to be an unbounded
  // full-collection scan on every single request.
  let longestStreak: number;
  let totalLoggedDays: number;
  let lastLoggedDate: string | null;

  if (profileData?.streakCache?.computedDate === today) {
    ({ longestStreak, totalLoggedDays, lastLoggedDate } = profileData.streakCache);
    // The cache may have been computed earlier today, before today's first entry —
    // reconcile with the already-fetched (bounded, always-fresh) 112-day window
    // instead of re-scanning the whole collection again.
    if (logMap.has(today) && lastLoggedDate !== today) {
      totalLoggedDays += 1;
      lastLoggedDate = today;
    }
    longestStreak = Math.max(longestStreak, currentStreak);
  } else {
    const allSnap = await db.collection(`users/${USER}/foodLog`)
      .orderBy("date", "asc")
      .get();
    void recordReads(allSnap.size);

    const allDates: string[] = [];
    for (const doc of allSnap.docs) {
      const log = doc.data() as DayLog;
      const cal = log.totals?.calories ?? log.entries?.reduce((s, e) => s + (e.nutrition?.calories ?? 0), 0) ?? 0;
      if (cal > 0) allDates.push(log.date);
    }

    longestStreak = 0;
    let streak = 0;
    let prevDate: string | null = null;
    for (const date of allDates) {
      if (prevDate) {
        const gap = differenceInDays(parseISO(date), parseISO(prevDate));
        streak = gap === 1 ? streak + 1 : 1;
      } else {
        streak = 1;
      }
      if (streak > longestStreak) longestStreak = streak;
      prevDate = date;
    }

    totalLoggedDays = allDates.length;
    lastLoggedDate  = allDates.length > 0 ? allDates[allDates.length - 1] : null;

    await db.doc(`users/${USER}`).set({
      streakCache: { longestStreak, totalLoggedDays, lastLoggedDate, computedDate: today },
    }, { merge: true });
  }

  // Weekly avg days (last 4 weeks = 28 days)
  let loggedLast28 = 0;
  for (let i = 0; i < 28; i++) {
    const d = format(subDays(new Date(), i), "yyyy-MM-dd");
    if ((logMap.get(d) ?? 0) > 0) loggedLast28++;
  }
  const weeklyAvgDays = Math.round((loggedLast28 / 4) * 10) / 10;

  return NextResponse.json({
    currentStreak,
    longestStreak,
    totalLoggedDays,
    lastLoggedDate,
    heatmap,
    weeklyAvgDays,
  } satisfies StreakData);
}
