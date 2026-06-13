export const dynamic = "force-dynamic";

import { getAdminFirestore } from "@/app/lib/firebase-admin";
import type { FitnessDay, NutritionGoals, UserProfile } from "@/app/lib/types";
import { defaultGoals } from "@/app/lib/nutrition";
import { format, subDays } from "date-fns";
import ActivityClient from "@/app/activity/ActivityClient";
import type { ActivityHistoryPoint } from "@/app/activity/page";

function stripTimestamps(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== "object") return obj;
  const maybeTs = obj as { toMillis?: () => number };
  if (typeof maybeTs.toMillis === "function") return maybeTs.toMillis();
  if (Array.isArray(obj)) return obj.map(stripTimestamps);
  return Object.fromEntries(
    Object.entries(obj as Record<string, unknown>).map(([k, v]) => [k, stripTimestamps(v)])
  );
}

const EMOJI: Record<number, string> = {
  1: "🏃", 3: "🏃", 7: "🚴", 8: "🚴", 9: "💪", 17: "🏋️", 46: "🚶",
  82: "🧘", 83: "💃", 93: "🏊", 104: "🥊", 45: "⚽", 54: "🎾",
};

export default async function DesktopActivityPage() {
  const userId = "owner";
  const today  = format(new Date(), "yyyy-MM-dd");
  const from   = format(subDays(new Date(), 13), "yyyy-MM-dd");
  let fitnessDay: FitnessDay | null = null;
  let manualActivities: unknown[]   = [];
  let goals: NutritionGoals         = defaultGoals();
  let history: ActivityHistoryPoint[] = [];

  try {
    const db = getAdminFirestore();
    const [fitSnap, actSnap, profileSnap, fitHistSnap, manualHistSnap] = await Promise.all([
      db.doc(`users/${userId}/fitnessData/${today}`).get(),
      db.collection(`users/${userId}/manualActivities`).where("date", "==", today).get(),
      db.doc(`users/${userId}`).get(),
      db.collection(`users/${userId}/fitnessData`)
        .where("date", ">=", from).where("date", "<", today)
        .orderBy("date", "asc").get(),
      db.collection(`users/${userId}/manualActivities`)
        .where("date", ">=", from).where("date", "<", today)
        .get(),
    ]);

    if (fitSnap.exists) fitnessDay = stripTimestamps(fitSnap.data()) as FitnessDay;
    manualActivities = actSnap.docs.map(d => ({
      ...stripTimestamps(d.data()) as Record<string, unknown>,
      id: d.id,
    }));
    if (profileSnap.exists) goals = (profileSnap.data() as UserProfile).goals ?? defaultGoals();

    const histMap = new Map<string, ActivityHistoryPoint>();
    for (const d of fitHistSnap.docs) {
      const fd   = stripTimestamps(d.data()) as FitnessDay;
      const gf   = fd.googleFit;
      const date = (fd.date as string) ?? d.id;
      const sessions = ((gf?.sessions ?? []) as { name: string; activityType: number; durationMin: number; calories?: number | null }[])
        .map(s => ({ name: s.name, emoji: EMOJI[s.activityType] ?? "🏅", durationMin: s.durationMin, calories: s.calories ?? null }));
      histMap.set(date, {
        date,
        steps:      (gf?.steps as number)                ?? 0,
        activeKcal: (gf?.activeCaloriesBurned as number) ?? 0,
        activeMin:  (gf?.activeMinutes as number)        ?? 0,
        sportMin:   sessions.reduce((a, s) => a + s.durationMin, 0),
        sportKcal:  sessions.reduce((a, s) => a + (s.calories ?? 0), 0),
        sessions,
      });
    }
    for (const d of manualHistSnap.docs) {
      const m    = stripTimestamps(d.data()) as Record<string, unknown>;
      const date = m.date as string;
      if (!date) continue;
      const entry = histMap.get(date) ?? { date, steps: 0, activeKcal: 0, activeMin: 0, sportMin: 0, sportKcal: 0, sessions: [] };
      const dur  = (m.durationMin as number)    ?? 0;
      const kcal = (m.caloriesBurned as number) ?? 0;
      entry.sportMin  += dur;
      entry.sportKcal += kcal;
      entry.sessions.push({ name: (m.customName as string) || "Activité", emoji: EMOJI[m.actType as number] ?? "🏅", durationMin: dur, calories: kcal || null });
      histMap.set(date, entry);
    }
    history = [...histMap.values()].sort((a, b) => a.date.localeCompare(b.date));
  } catch (e) {
    console.error(e);
  }

  return (
    <ActivityClient
      date={today}
      fitnessDay={fitnessDay}
      initialManualActivities={manualActivities}
      goals={goals}
      history={history}
    />
  );
}
