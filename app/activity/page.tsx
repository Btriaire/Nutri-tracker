export const dynamic = "force-dynamic";

import { getAdminFirestore } from "@/app/lib/firebase-admin";
import type { FitnessDay, NutritionGoals, UserProfile } from "@/app/lib/types";
import { defaultGoals } from "@/app/lib/nutrition";
import { format } from "date-fns";
import ActivityClient from "./ActivityClient";

export default async function ActivityPage() {
  const userId = "owner";
  const today = format(new Date(), "yyyy-MM-dd");
  let fitnessDay: FitnessDay | null = null;
  let manualActivities: unknown[] = [];
  let goals: NutritionGoals = defaultGoals();

  try {
    const db = getAdminFirestore();
    const [fitSnap, actSnap, profileSnap] = await Promise.all([
      db.doc(`users/${userId}/fitnessData/${today}`).get(),
      db.collection(`users/${userId}/manualActivities`)
        .where("date", "==", today)
        .get(),
      db.doc(`users/${userId}`).get(),
    ]);
    if (fitSnap.exists) {
      const raw = fitSnap.data() as FitnessDay;
      // Strip all Firestore Timestamps — not serializable to Client Components
      if (raw.googleFit) {
        const gf = raw.googleFit as unknown as Record<string, unknown>;
        gf.syncedAt = null;
      }
      if (raw.withings) {
        const w = raw.withings as unknown as Record<string, unknown>;
        w.syncedAt   = null;
        // measuredAt is also a Timestamp — convert to ms number for safe serialization
        const mt = w.measuredAt as { toMillis?: () => number } | null;
        w.measuredAt = mt?.toMillis?.() ?? null;
      }
      fitnessDay = raw;
    }
    manualActivities = actSnap.docs.map((d) => {
      const data = d.data();
      // Convert loggedAt Timestamp to plain { _seconds } so client can sort
      const loggedAt = data.loggedAt as { seconds?: number } | null | undefined;
      return { ...data, id: d.id, loggedAt: loggedAt ? { _seconds: loggedAt.seconds ?? 0 } : null };
    });
    if (profileSnap.exists) {
      goals = (profileSnap.data() as UserProfile).goals ?? defaultGoals();
    }
  } catch (e) {
    console.error(e);
  }

  return (
    <ActivityClient
      date={today}
      fitnessDay={fitnessDay}
      initialManualActivities={manualActivities}
      goals={goals}
    />
  );
}
