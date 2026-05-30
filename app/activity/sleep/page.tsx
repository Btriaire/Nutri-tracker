export const dynamic = "force-dynamic";

import { getAdminFirestore } from "@/app/lib/firebase-admin";
import { format, subDays } from "date-fns";
import type { GoogleFitDay, UserProfile } from "@/app/lib/types";
import SleepClient from "./SleepClient";

export interface SleepPoint {
  date:             string;
  sleepMinutes:     number | null;
  timeInBedMinutes: number | null;
  lightSleepMin:    number | null;
  deepSleepMin:     number | null;
  remSleepMin:      number | null;
  sleepSyncedAt?:   string;
}

export default async function SleepPage() {
  const userId = "owner";
  const db     = getAdminFirestore();
  const today  = new Date();

  const dates: string[] = [];
  for (let i = 29; i >= 0; i--) dates.push(format(subDays(today, i), "yyyy-MM-dd"));

  const [profileSnap, ...snaps] = await Promise.all([
    db.doc(`users/${userId}`).get(),
    ...dates.map((d) => db.doc(`users/${userId}/fitnessData/${d}`).get()),
  ]);

  const profile      = profileSnap.exists ? profileSnap.data() as UserProfile : null;
  const sleepGoalMin = profile?.goals?.sleepGoalMin ?? 420;

  const points: SleepPoint[] = snaps.map((snap, i) => {
    const data = snap.exists ? snap.data() as { googleFit?: GoogleFitDay; manualSleep?: { sleepMinutes: number | null } } : undefined;
    const gf   = data?.googleFit;
    // Manual entry takes priority over Google Fit sync
    const sleepMin = data?.manualSleep?.sleepMinutes ?? gf?.sleepMinutes ?? null;
    return {
      date:             dates[i],
      sleepMinutes:     sleepMin,
      timeInBedMinutes: gf?.timeInBedMinutes ?? null,
      lightSleepMin:    gf?.lightSleepMin    ?? null,
      deepSleepMin:     gf?.deepSleepMin     ?? null,
      remSleepMin:      gf?.remSleepMin      ?? null,
      sleepSyncedAt:    gf?.sleepSyncedAt,
    };
  });

  return <SleepClient points={points} sleepGoalMin={sleepGoalMin} />;
}
