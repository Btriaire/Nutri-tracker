export const dynamic = "force-dynamic";

import { getAdminFirestore } from "@/app/lib/firebase-admin";
import { format, subDays } from "date-fns";
import type { HealthEntry, FitnessDay, NutritionGoals } from "@/app/lib/types";
import type { CardioPoint, WithingsPoint } from "@/app/api/cardio/route";
import HealthClient from "@/app/health/HealthClient";

type HealthData = Omit<HealthEntry, "updatedAt">;

function strip(e: HealthEntry): HealthData {
  return {
    date:          e.date,
    bloodPressure: e.bloodPressure ?? [],
    restingHR:     e.restingHR,
    bloodGlucose:  e.bloodGlucose,
    spO2:          e.spO2,
    temperatureC:  e.temperatureC,
    notes:         e.notes,
    medications:   e.medications  ?? [],
    symptoms:      e.symptoms     ?? [],
    aiSynthesis:   e.aiSynthesis  ?? undefined,
  };
}

export default async function DesktopHealthPage() {
  const today  = format(new Date(), "yyyy-MM-dd");
  const userId = "owner";
  const from   = format(subDays(new Date(), 29), "yyyy-MM-dd");

  let entry: HealthData | null = null;
  const trend: HealthData[]    = [];
  const cardioPoints: CardioPoint[] = [];
  const withingsPoints: WithingsPoint[] = [];
  let age: number | undefined  = undefined;

  try {
    const db = getAdminFirestore();
    const [todaySnap, trendSnap, fitnessSnap, goalsSnap] = await Promise.all([
      db.doc(`users/${userId}/healthLog/${today}`).get(),
      db.collection(`users/${userId}/healthLog`)
        .where("date", ">=", from)
        .where("date", "<=", today)
        .orderBy("date", "asc")
        .get(),
      db.collection(`users/${userId}/fitnessData`)
        .where("date", ">=", from)
        .where("date", "<=", today)
        .orderBy("date", "asc")
        .get(),
      db.doc(`users/${userId}`).get(),
    ]);

    if (todaySnap.exists) entry = strip(todaySnap.data() as HealthEntry);
    for (const d of trendSnap.docs) trend.push(strip(d.data() as HealthEntry));

    for (const d of fitnessSnap.docs) {
      const fd = d.data() as FitnessDay;
      const gf = fd.googleFit;
      const wt = fd.withings;
      const dateStr = fd.date ?? d.id;
      cardioPoints.push({
        date:           dateStr,
        hrAvg:          gf?.heartRateAvg ?? null,
        hrMin:          null,
        hrMax:          null,
        activeMin:      gf?.activeMinutes ?? 0,
        activeCalories: gf?.activeCaloriesBurned ?? 0,
        steps:          gf?.steps ?? 0,
        sleepMinutes:   gf?.sleepMinutes ?? null,
      });
      if (wt && (wt.weightKg || wt.bodyFatPct || wt.muscleMassKg || wt.fatMassKg)) {
        withingsPoints.push({
          date:         dateStr,
          weightKg:     wt.weightKg     ?? null,
          bodyFatPct:   wt.bodyFatPct   ?? null,
          muscleMassKg: wt.muscleMassKg ?? null,
          fatMassKg:    wt.fatMassKg    ?? null,
        });
      }
    }

    if (goalsSnap.exists) {
      const goals = (goalsSnap.data() as { goals?: NutritionGoals })?.goals;
      if (goals?.age) age = goals.age;
    }
  } catch (e) {
    console.error("Firestore error:", e);
  }

  return (
    <HealthClient
      date={today}
      initialEntry={entry}
      trend={trend}
      cardioPoints={cardioPoints}
      withingsPoints={withingsPoints}
      age={age}
    />
  );
}
