export const dynamic = "force-dynamic";

import { getAdminFirestore } from "@/app/lib/firebase-admin";
import { defaultGoals } from "@/app/lib/nutrition";
import type { DayLog, UserProfile } from "@/app/lib/types";
import { format } from "date-fns";
import LogClient from "./LogClient";

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
    dayLog = logSnap.exists ? logSnap.data() as DayLog : null;
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
