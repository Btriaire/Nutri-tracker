export const dynamic = "force-dynamic";

import { getAdminFirestore } from "@/app/lib/firebase-admin";
import { format, subDays } from "date-fns";
import type { GoogleFitDay } from "@/app/lib/types";
import CardioClient from "./CardioClient";
import type { CardioPoint } from "@/app/api/cardio/route";

export default async function CardioPage() {
  const userId = "owner";
  const db     = getAdminFirestore();
  const today  = new Date();

  const dates: string[] = [];
  for (let i = 29; i >= 0; i--) dates.push(format(subDays(today, i), "yyyy-MM-dd"));

  const snaps = await Promise.all(
    dates.map((d) => db.doc(`users/${userId}/fitnessData/${d}`).get())
  );

  const points: CardioPoint[] = snaps.map((snap, i) => {
    const gf = snap.exists
      ? (snap.data() as { googleFit?: GoogleFitDay }).googleFit
      : undefined;
    return {
      date:         dates[i],
      hrAvg:        gf?.heartRateAvg ?? null,
      hrMin:        null,
      hrMax:        null,
      activeMin:    gf?.activeMinutes ?? 0,
      steps:        gf?.steps ?? 0,
      sleepMinutes: gf?.sleepMinutes ?? null,
    };
  });

  return <CardioClient points={points} />;
}
