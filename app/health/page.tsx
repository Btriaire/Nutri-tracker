export const dynamic = "force-dynamic";

import { getAdminFirestore } from "@/app/lib/firebase-admin";
import { format, subDays } from "date-fns";
import type { HealthEntry } from "@/app/lib/types";
import HealthClient from "./HealthClient";

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
  };
}

export default async function HealthPage() {
  const today  = format(new Date(), "yyyy-MM-dd");
  const userId = "owner";
  let entry: HealthData | null = null;
  const trend: HealthData[] = [];

  try {
    const db   = getAdminFirestore();
    const from = format(subDays(new Date(), 29), "yyyy-MM-dd");

    const [todaySnap, trendSnap] = await Promise.all([
      db.doc(`users/${userId}/healthLog/${today}`).get(),
      db.collection(`users/${userId}/healthLog`)
        .where("date", ">=", from)
        .where("date", "<=", today)
        .orderBy("date", "asc")
        .get(),
    ]);

    if (todaySnap.exists) entry = strip(todaySnap.data() as HealthEntry);
    for (const d of trendSnap.docs) trend.push(strip(d.data() as HealthEntry));
  } catch (e) {
    console.error("Firestore error:", e);
  }

  return <HealthClient date={today} initialEntry={entry} trend={trend} />;
}
