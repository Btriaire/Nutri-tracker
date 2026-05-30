export const dynamic = "force-dynamic";

import { getAdminFirestore } from "@/app/lib/firebase-admin";
import type { FitnessDay, NutritionGoals, UserProfile } from "@/app/lib/types";
import { defaultGoals } from "@/app/lib/nutrition";
import { format } from "date-fns";
import ActivityClient from "./ActivityClient";

/**
 * Recursively converts every Firestore Timestamp to a plain number (ms since epoch),
 * so the object is safe to pass as a Server→Client Component prop.
 */
function stripTimestamps(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== "object") return obj;
  // Firestore Timestamp has toMillis()
  const maybeTs = obj as { toMillis?: () => number };
  if (typeof maybeTs.toMillis === "function") return maybeTs.toMillis();
  if (Array.isArray(obj)) return obj.map(stripTimestamps);
  return Object.fromEntries(
    Object.entries(obj as Record<string, unknown>).map(([k, v]) => [k, stripTimestamps(v)])
  );
}

export default async function ActivityPage() {
  const userId = "owner";
  const today = format(new Date(), "yyyy-MM-dd");
  let fitnessDay: FitnessDay | null = null;
  let manualActivities: unknown[] = [];
  let goals: NutritionGoals = defaultGoals();

  try {
    const db = getAdminFirestore();
    const [fitSnap, actSnap, profileSnap] = await Promise.all([
      db.doc(`users/${userId}/fitnessData/${today}`).get(),
      db.collection(`users/${userId}/manualActivities`)
        .where("date", "==", today)
        .get(),
      db.doc(`users/${userId}`).get(),
    ]);
    if (fitSnap.exists) {
      // Strip ALL Timestamps recursively — any Firestore Timestamp in the tree
      // will throw "Only plain objects" if passed to a Client Component as-is.
      fitnessDay = stripTimestamps(fitSnap.data()) as FitnessDay;
    }
    manualActivities = actSnap.docs.map((d) => {
      const data = stripTimestamps(d.data()) as Record<string, unknown>;
      return { ...data, id: d.id };
    });
    if (profileSnap.exists) {
      goals = (profileSnap.data() as UserProfile).goals ?? defaultGoals();
    }
  } catch (e) {
    console.error(e);
  }

  return (
    <ActivityClient
      date={today}
      fitnessDay={fitnessDay}
      initialManualActivities={manualActivities}
      goals={goals}
    />
  );
}
