export const dynamic = "force-dynamic";

import { getAdminFirestore } from "@/app/lib/firebase-admin";
import { format, subDays } from "date-fns";
import type { GoogleFitDay, UserProfile } from "@/app/lib/types";
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
    const gf = snap.exists
      ? (snap.data() as { googleFit?: GoogleFitDay }).googleFit
      : undefined;
    return {
      date:           dates[i],
      steps:          gf?.steps ?? 0,
      activeMinutes:  gf?.activeMinutes ?? 0,
      activeCalories: gf?.activeCaloriesBurned ?? 0,
      distanceKm:     null, // not yet stored
    };
  });

  return <StepsClient points={points} stepsGoal={stepsGoal} />;
}
