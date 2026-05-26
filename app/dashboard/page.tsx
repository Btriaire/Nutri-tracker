export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getSession } from "@/app/lib/session";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import { defaultGoals } from "@/app/lib/nutrition";
import type { DayLog, FitnessDay, UserProfile, WeightPoint } from "@/app/lib/types";
import { format } from "date-fns";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const today = format(new Date(), "yyyy-MM-dd");
  const db = getAdminFirestore();
  const userId = session.userId;

  const [logSnap, fitnessSnap, profileSnap, recentWeightSnap] = await Promise.all([
    db.doc(`users/${userId}/foodLog/${today}`).get(),
    db.doc(`users/${userId}/fitnessData/${today}`).get(),
    db.doc(`users/${userId}`).get(),
    db.collection(`users/${userId}/fitnessData`).orderBy("date", "desc").limit(14).get(),
  ]);

  const profile    = profileSnap.exists ? profileSnap.data() as UserProfile : null;
  const goals      = profile?.goals ?? defaultGoals();
  const dayLog     = logSnap.exists ? logSnap.data() as DayLog : null;
  const fitnessDay = fitnessSnap.exists ? fitnessSnap.data() as FitnessDay : null;

  const recentWeight: WeightPoint[] = [];
  for (const d of recentWeightSnap.docs) {
    const fd = d.data() as FitnessDay;
    if (fd.withings?.weightKg) recentWeight.push({ kg: fd.withings.weightKg, date: fd.date });
    if (recentWeight.length >= 7) break;
  }

  return (
    <DashboardClient
      date={today}
      goals={goals}
      consumed={dayLog?.totals ?? { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 }}
      burned={fitnessDay?.googleFit?.activeCaloriesBurned ?? null}
      steps={fitnessDay?.googleFit?.steps ?? null}
      weight={recentWeight[0] ?? null}
      previousWeight={recentWeight[1] ?? null}
      recentWeight={[...recentWeight].reverse()}
      waterMl={dayLog?.waterMl ?? 0}
      lang={profile?.lang ?? "fr"}
    />
  );
}
