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
    const data = snap.exists ? snap.data() as { googleFit?: GoogleFitDay; appleHealth?: import("@/app/lib/types").AppleHealthDay; manualSleep?: { sleepMinutes: number | null } } : undefined;
    const gf   = data?.googleFit;
    const ah   = data?.appleHealth;
    // Manual entry takes priority over Google Fit sync
    const sleepMin = data?.manualSleep?.sleepMinutes ?? gf?.sleepMinutes ?? ah?.sleepMinutes ?? null;
    // Sleep phases: prefer Google Fit segments, fall back to Apple Health
    const lightSleepMin = gf?.lightSleepMin ?? ah?.sleepLightMinutes ?? null;
    const deepSleepMin  = gf?.deepSleepMin  ?? ah?.sleepDeepMinutes  ?? null;
    const remSleepMin   = gf?.remSleepMin   ?? ah?.sleepRemMinutes   ?? null;
    return {
      date:             dates[i],
      sleepMinutes:     sleepMin,
      timeInBedMinutes: gf?.timeInBedMinutes ?? null,
      lightSleepMin,
      deepSleepMin,
      remSleepMin,
      sleepSyncedAt:    gf?.sleepSyncedAt,
    };
  });

  return <SleepClient points={points} sleepGoalMin={sleepGoalMin} />;
}
