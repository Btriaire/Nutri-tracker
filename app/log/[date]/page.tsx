export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import { defaultGoals } from "@/app/lib/nutrition";
import type { DayLog, FoodEntry, UserProfile, TrackedNutrients, DietProgramPrefs } from "@/app/lib/types";
import LogClient from "../LogClient";

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

interface Props {
  params: Promise<{ date: string }>;
}

export default async function LogDatePage({ params }: Props) {
  const { date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) redirect("/log");

  const userId = "owner";
  let dayLog: DayLog | null = null;
  let goals = defaultGoals();
  let lang: "fr" | "en" = "fr";
  let trackedNutrients: TrackedNutrients | undefined = undefined;
  let dietProgram: DietProgramPrefs | undefined = undefined;

  try {
    const db = getAdminFirestore();
    const [logSnap, profileSnap] = await Promise.all([
      db.doc(`users/${userId}/foodLog/${date}`).get(),
      db.doc(`users/${userId}`).get(),
    ]);
    if (logSnap.exists) dayLog = serializeDayLog(logSnap.data() as DayLog);
    if (profileSnap.exists) {
      const profile = profileSnap.data() as UserProfile;
      goals             = profile.goals ?? defaultGoals();
      lang              = profile.lang ?? "fr";
      trackedNutrients  = profile.chartPrefs?.trackedNutrients;
      dietProgram       = profile.dietProgram;
    }
  } catch (e) {
    console.error("Firestore error:", e);
  }

  return <LogClient date={date} initialLog={dayLog} goals={goals} lang={lang} trackedNutrients={trackedNutrients} dietProgram={dietProgram} />;
}
