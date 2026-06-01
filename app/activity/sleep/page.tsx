export const dynamic = "force-dynamic";

import { getAdminFirestore } from "@/app/lib/firebase-admin";
import { format, subDays } from "date-fns";
import type { GoogleFitDay, UserProfile, AppleHealthDay, WithingsSleepDay } from "@/app/lib/types";
import SleepClient from "./SleepClient";

export interface SleepPoint {
  date:             string;
  sleepMinutes:     number | null;
  timeInBedMinutes: number | null;
  lightSleepMin:    number | null;
  deepSleepMin:     number | null;
  remSleepMin:      number | null;
  sleepScore:       number | null;
  sleepSyncedAt?:   string;
  source?:          "withings" | "applehealth" | "googlefit" | "manual";
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
    const data = snap.exists ? snap.data() as {
      googleFit?:    GoogleFitDay;
      appleHealth?:  AppleHealthDay;
      withingsSleep?: WithingsSleepDay;
      manualSleep?:  { sleepMinutes: number | null };
    } : undefined;
    const gf = data?.googleFit;
    const ah = data?.appleHealth;
    const ws = data?.withingsSleep;

    // Sleep total: manual > Withings > Apple Health > Google Fit
    const sleepMin = data?.manualSleep?.sleepMinutes
      ?? (ws?.totalSleepSec  != null ? Math.round(ws.totalSleepSec  / 60) : null)
      ?? ah?.sleepMinutes
      ?? gf?.sleepMinutes
      ?? null;

    // Phases: Withings (best, from ScanWatch/Sleep Analyzer) > Apple Health > Google Fit
    const lightSleepMin = (ws?.lightSleepSec != null ? Math.round(ws.lightSleepSec / 60) : null)
      ?? ah?.sleepLightMinutes
      ?? gf?.lightSleepMin
      ?? null;
    const deepSleepMin  = (ws?.deepSleepSec  != null ? Math.round(ws.deepSleepSec  / 60) : null)
      ?? ah?.sleepDeepMinutes
      ?? gf?.deepSleepMin
      ?? null;
    const remSleepMin   = (ws?.remSleepSec   != null ? Math.round(ws.remSleepSec   / 60) : null)
      ?? ah?.sleepRemMinutes
      ?? gf?.remSleepMin
      ?? null;

    // Determine source
    const source: SleepPoint["source"] =
      data?.manualSleep?.sleepMinutes != null ? "manual"
      : ws?.totalSleepSec  != null ? "withings"
      : ah?.sleepMinutes   != null ? "applehealth"
      : gf?.sleepMinutes   != null ? "googlefit"
      : undefined;

    return {
      date:             dates[i],
      sleepMinutes:     sleepMin,
      timeInBedMinutes: gf?.timeInBedMinutes ?? null,
      lightSleepMin,
      deepSleepMin,
      remSleepMin,
      sleepScore:       ws?.sleepScore ?? null,
      sleepSyncedAt:    gf?.sleepSyncedAt,
      source,
    };
  });

  return <SleepClient points={points} sleepGoalMin={sleepGoalMin} />;
}
