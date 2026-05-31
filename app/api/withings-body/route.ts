export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import { format, subDays } from "date-fns";

const USER = "owner";

export interface BodyCompPoint {
  date:          string;
  // Body composition
  bodyFatPct:    number | null;
  muscleMassKg:  number | null;
  fatMassKg:     number | null;
  // Vital signs
  spO2Pct:       number | null;
  restingHR:     number | null;
  tempCelsius:   number | null;
  // Sleep
  totalSleepH:   number | null;
  deepSleepH:    number | null;
  remSleepH:     number | null;
  lightSleepH:   number | null;
  sleepScore:    number | null;
  hrAvgSleep:    number | null;
  wakeupCount:   number | null;
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const days = Math.min(365, Math.max(7, parseInt(searchParams.get("days") ?? "90", 10)));

  const to   = format(new Date(), "yyyy-MM-dd");
  const from = format(subDays(new Date(), days - 1), "yyyy-MM-dd");

  const db   = getAdminFirestore();
  const snap = await db
    .collection(`users/${USER}/fitnessData`)
    .where("date", ">=", from)
    .where("date", "<=", to)
    .orderBy("date", "asc")
    .get();

  const points: BodyCompPoint[] = snap.docs
    .map((d) => {
      const data   = d.data();
      const w      = data.withings;
      const s      = data.withingsSleep;

      // Only include days that have at least one Withings measurement
      if (!w && !s) return null;

      return {
        date:         d.id,
        bodyFatPct:   w?.bodyFatPct    ?? null,
        muscleMassKg: w?.muscleMassKg  ?? null,
        fatMassKg:    w?.fatMassKg     ?? null,
        spO2Pct:      w?.spO2Pct       ?? null,
        restingHR:    w?.restingHR     ?? null,
        tempCelsius:  w?.tempCelsius   ?? null,
        totalSleepH:  s?.totalSleepSec != null ? Math.round(s.totalSleepSec / 360) / 10 : null,
        deepSleepH:   s?.deepSleepSec  != null ? Math.round(s.deepSleepSec  / 360) / 10 : null,
        remSleepH:    s?.remSleepSec   != null ? Math.round(s.remSleepSec   / 360) / 10 : null,
        lightSleepH:  s?.lightSleepSec != null ? Math.round(s.lightSleepSec / 360) / 10 : null,
        sleepScore:   s?.sleepScore    ?? null,
        hrAvgSleep:   s?.hrAvgSleep    ?? null,
        wakeupCount:  s?.wakeupCount   ?? null,
      } satisfies BodyCompPoint;
    })
    .filter((p): p is BodyCompPoint => p !== null);

  return NextResponse.json({ points, from, to });
}
