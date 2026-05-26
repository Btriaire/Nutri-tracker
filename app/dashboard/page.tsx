export const dynamic = "force-dynamic";

import { getAdminFirestore } from "@/app/lib/firebase-admin";
import { defaultGoals } from "@/app/lib/nutrition";
import type { DayLog, FitnessDay, UserProfile, WeightPoint } from "@/app/lib/types";
import { format } from "date-fns";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage() {
  const today  = format(new Date(), "yyyy-MM-dd");
  const userId = "owner";

  let goals      = defaultGoals();
  let dayLog: DayLog | null     = null;
  let fitnessDay: FitnessDay | null = null;
  const recentWeight: WeightPoint[] = [];

  try {
    const db = getAdminFirestore();

    const [logSnap, fitnessSnap, profileSnap, recentWeightSnap] = await Promise.all([
      db.doc(`users/${userId}/foodLog/${today}`).get(),
      db.doc(`users/${userId}/fitnessData/${today}`).get(),
      db.doc(`users/${userId}`).get(),
      db.collection(`users/${userId}/fitnessData`).orderBy("date", "desc").limit(14).get(),
    ]);

    const profile = profileSnap.exists ? profileSnap.data() as UserProfile : null;
    goals      = profile?.goals ?? defaultGoals();
    dayLog     = logSnap.exists ? logSnap.data() as DayLog : null;
    fitnessDay = fitnessSnap.exists ? fitnessSnap.data() as FitnessDay : null;

    for (const d of recentWeightSnap.docs) {
      const fd = d.data() as FitnessDay;
      if (fd.withings?.weightKg) recentWeight.push({ kg: fd.withings.weightKg, date: fd.date });
      if (recentWeight.length >= 7) break;
    }
  } catch (e) {
    console.error("Firestore error:", e);
  }

  return (
    <DashboardClient
      date={today}
      goals={goals}
      consumed={dayLog?.totals ?? { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 }}
      burned={fitnessDay?.googleFit?.activeCaloriesBurned ?? null}
      steps={fitnessDay?.googleFit?.steps ?? null}
      weight={recentWeight[0] ?? null}
      previousWeight={recentWeight[1] ?? null}
      recentWeight={[...recentWeight].reverse()}
      waterMl={dayLog?.waterMl ?? 0}
      lang="fr"
    />
  );
}
