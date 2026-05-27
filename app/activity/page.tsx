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
        .get(),
    ]);
    if (fitSnap.exists) {
      const raw = fitSnap.data() as FitnessDay;
      // Strip Firestore Timestamp (syncedAt) — not serializable to Client Component
      if (raw.googleFit) (raw.googleFit as unknown as Record<string, unknown>).syncedAt = null;
      if (raw.withings)  (raw.withings  as unknown as Record<string, unknown>).syncedAt = null;
      fitnessDay = raw;
    }
    manualActivities = actSnap.docs.map((d) => {
      const data = d.data();
      // Convert loggedAt Timestamp to plain { _seconds } so client can sort
      const loggedAt = data.loggedAt as { seconds?: number } | null | undefined;
      return { ...data, id: d.id, loggedAt: loggedAt ? { _seconds: loggedAt.seconds ?? 0 } : null };
    });
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
