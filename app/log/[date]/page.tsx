export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import { defaultGoals } from "@/app/lib/nutrition";
import type { DayLog, UserProfile } from "@/app/lib/types";
import LogClient from "../LogClient";

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

  try {
    const db = getAdminFirestore();
    const [logSnap, profileSnap] = await Promise.all([
      db.doc(`users/${userId}/foodLog/${date}`).get(),
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

  return <LogClient date={date} initialLog={dayLog} goals={goals} lang={lang} />;
}
