export const dynamic = "force-dynamic";

import { getAdminFirestore } from "@/app/lib/firebase-admin";
import { format, subDays } from "date-fns";
import type { GoogleFitDay, UserProfile, WithingsActivityDay } from "@/app/lib/types";
// WithingsActivityDay used for fallback steps/calories when Google Fit isn't connected
import StepsClient from "./StepsClient";

export interface StepsPoint {
  date:           string;
  steps:          number;
  activeMinutes:  number;
  activeCalories: number;
  distanceKm:     number | null;
}

export default async function StepsPage() {
  const userId = "owner";
  const db     = getAdminFirestore();
  const today  = new Date();

  const dates: string[] = [];
  for (let i = 29; i >= 0; i--) dates.push(format(subDays(today, i), "yyyy-MM-dd"));

  const [profileSnap, ...snaps] = await Promise.all([
    db.doc(`users/${userId}`).get(),
    ...dates.map((d) => db.doc(`users/${userId}/fitnessData/${d}`).get()),
  ]);

  const profile  = profileSnap.exists ? profileSnap.data() as UserProfile : null;
  const stepsGoal = profile?.goals?.stepsGoal ?? 10000;

  const points: StepsPoint[] = snaps.map((snap, i) => {
    const data = snap.exists ? snap.data() as { googleFit?: GoogleFitDay; withingsActivity?: WithingsActivityDay } : undefined;
    const gf   = data?.googleFit;
    const wa   = data?.withingsActivity;
    return {
      date:           dates[i],
      // Google Fit preferred; fallback to Withings activity tracker
      steps:          gf?.steps          ?? wa?.steps          ?? 0,
      activeMinutes:  gf?.activeMinutes  ?? (wa ? (wa.moderateMinutes ?? 0) + (wa.intenseMinutes ?? 0) : 0),
      activeCalories: gf?.activeCaloriesBurned ?? wa?.activeCalories ?? 0,
      distanceKm:     wa?.distanceM != null && gf?.steps == null ? wa.distanceM / 1000 : null,
    };
  });

  return <StepsClient points={points} stepsGoal={stepsGoal} />;
}
