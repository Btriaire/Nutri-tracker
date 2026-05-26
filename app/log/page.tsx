export const dynamic = "force-dynamic";

import { getAdminFirestore } from "@/app/lib/firebase-admin";
import { defaultGoals } from "@/app/lib/nutrition";
import type { DayLog, FoodEntry, UserProfile } from "@/app/lib/types";
import { format } from "date-fns";
import LogClient from "./LogClient";

function serializeDayLog(raw: DayLog): DayLog {
  return {
    ...raw,
    updatedAt: { seconds: raw.updatedAt?.seconds ?? 0, nanoseconds: 0 } as DayLog["updatedAt"],
    entries: (raw.entries ?? []).map((e: FoodEntry) => ({
      ...e,
      loggedAt: { seconds: e.loggedAt?.seconds ?? 0, nanoseconds: 0 } as FoodEntry["loggedAt"],
    })),
  };
}

export default async function LogPage() {
  const today  = format(new Date(), "yyyy-MM-dd");
  const userId = "owner";

  let dayLog: DayLog | null = null;
  let goals = defaultGoals();
  let lang: "fr" | "en" = "fr";

  try {
    const db = getAdminFirestore();
    const [logSnap, profileSnap] = await Promise.all([
      db.doc(`users/${userId}/foodLog/${today}`).get(),
      db.doc(`users/${userId}`).get(),
    ]);
    if (logSnap.exists) {
      dayLog = serializeDayLog(logSnap.data() as DayLog);
    }
    if (profileSnap.exists) {
      const profile = profileSnap.data() as UserProfile;
      goals = profile.goals;
      lang  = profile.lang ?? "fr";
    }
  } catch (e) {
    console.error("Firestore error:", e);
  }

  return <LogClient date={today} initialLog={dayLog} goals={goals} lang={lang} />;
}
