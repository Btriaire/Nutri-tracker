import { redirect } from "next/navigation";
import { getSession } from "@/app/lib/session";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import { defaultGoals } from "@/app/lib/nutrition";
import type { DayLog, UserProfile } from "@/app/lib/types";
import LogClient from "../LogClient";

interface Props {
  params: Promise<{ date: string }>;
}

export default async function LogDatePage({ params }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { date } = await params;

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) redirect("/log");

  const db = getAdminFirestore();

  const [logSnap, profileSnap] = await Promise.all([
    db.doc(`users/${session.userId}/foodLog/${date}`).get(),
    db.doc(`users/${session.userId}`).get(),
  ]);

  const dayLog = logSnap.exists ? logSnap.data() as DayLog : null;
  const goals = profileSnap.exists
    ? (profileSnap.data() as UserProfile).goals
    : defaultGoals();
  const lang = profileSnap.exists ? (profileSnap.data() as UserProfile).lang ?? "fr" : "fr";

  return <LogClient date={date} initialLog={dayLog} goals={goals} lang={lang} />;
}
