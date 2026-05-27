export const dynamic = "force-dynamic";

import { getAdminFirestore } from "@/app/lib/firebase-admin";
import type { FitnessDay } from "@/app/lib/types";
import { format } from "date-fns";
import ActivityClient from "./ActivityClient";

export default async function ActivityPage() {
  const userId = "owner";
  const today = format(new Date(), "yyyy-MM-dd");
  let fitnessDay: FitnessDay | null = null;
  let manualActivities: unknown[] = [];

  try {
    const db = getAdminFirestore();
    const [fitSnap, actSnap] = await Promise.all([
      db.doc(`users/${userId}/fitnessData/${today}`).get(),
      db.collection(`users/${userId}/manualActivities`)
        .where("date", "==", today)
        .orderBy("loggedAt", "desc")
        .get(),
    ]);
    fitnessDay = fitSnap.exists ? fitSnap.data() as FitnessDay : null;
    manualActivities = actSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.error(e);
  }

  return (
    <ActivityClient
      date={today}
      fitnessDay={fitnessDay}
      initialManualActivities={manualActivities}
    />
  );
}
