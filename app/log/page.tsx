export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getSession } from "@/app/lib/session";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import { defaultGoals } from "@/app/lib/nutrition";
import type { DayLog, UserProfile } from "@/app/lib/types";
import { format } from "date-fns";
import LogClient from "./LogClient";

export default async function LogPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const today = format(new Date(), "yyyy-MM-dd");
  const db = getAdminFirestore();

  const [logSnap, profileSnap] = await Promise.all([
    db.doc(`users/${session.userId}/foodLog/${today}`).get(),
    db.doc(`users/${session.userId}`).get(),
  ]);

  const dayLog = logSnap.exists ? logSnap.data() as DayLog : null;
  const goals = profileSnap.exists
    ? (profileSnap.data() as UserProfile).goals
    : defaultGoals();
  const lang = profileSnap.exists ? (profileSnap.data() as UserProfile).lang ?? "fr" : "fr";

  return <LogClient date={today} initialLog={dayLog} goals={goals} lang={lang} />;
}
