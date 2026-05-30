export const dynamic = "force-dynamic";

import { getAdminFirestore } from "@/app/lib/firebase-admin";
import { defaultGoals } from "@/app/lib/nutrition";
import type { DayLog, FitnessDay, UserProfile, WeightPoint, DayTrendPoint, NutritionPlan, TrackedNutrients } from "@/app/lib/types";
import type { RecentPhoto } from "@/app/api/photos/recent/route";
import { format } from "date-fns";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage() {
  const today  = format(new Date(), "yyyy-MM-dd");
  const userId = "owner";

  let goals             = defaultGoals();
  let displayName       = "";
  let photoUrl:         string | undefined;
  let plan:             NutritionPlan | undefined;
  let trackedNutrients: TrackedNutrients | undefined;
  let dayLog: DayLog | null         = null;
  let fitnessDay: FitnessDay | null = null;
  const recentWeight: WeightPoint[] = [];
  const trendPoints: DayTrendPoint[] = [];
  let recentPhotos: RecentPhoto[] = [];

  try {
    const db = getAdminFirestore();
    const trendFrom = format(new Date(Date.now() - 13 * 86400000), "yyyy-MM-dd");

    const [logSnap, fitnessSnap, profileSnap, recentWeightSnap, trendLogSnap, photosSnap] = await Promise.all([
      db.doc(`users/${userId}/foodLog/${today}`).get(),
      db.doc(`users/${userId}/fitnessData/${today}`).get(),
      db.doc(`users/${userId}`).get(),
      db.collection(`users/${userId}/fitnessData`).orderBy("date", "desc").limit(14).get(),
      db.collection(`users/${userId}/foodLog`)
        .where("date", ">=", trendFrom)
        .where("date", "<=", today)
        .orderBy("date", "asc")
        .get(),
      db.collection(`users/${userId}/dayPhotos`).orderBy("date", "desc").limit(14).get(),
    ]);

    const profile = profileSnap.exists ? profileSnap.data() as UserProfile : null;
    goals             = profile?.goals ?? defaultGoals();
    displayName       = profile?.displayName ?? "";
    photoUrl          = profile?.photoUrl ?? undefined;
    plan              = profile?.goals?.plan ?? undefined;
    trackedNutrients  = profile?.chartPrefs?.trackedNutrients;
    dayLog      = logSnap.exists ? logSnap.data() as DayLog : null;
    fitnessDay  = fitnessSnap.exists ? fitnessSnap.data() as FitnessDay : null;

    const fitnessMap = new Map<string, FitnessDay>();
    for (const d of recentWeightSnap.docs) {
      fitnessMap.set(d.id, d.data() as FitnessDay);
      const fd = d.data() as FitnessDay;
      const kg = fd.withings?.weightKg ?? fd.googleFit?.weightKg ?? null;
      if (kg) recentWeight.push({ kg, date: fd.date });
      if (recentWeight.length >= 7) break;
    }

    for (const d of trendLogSnap.docs) {
      const log = d.data() as DayLog;
      const fit = fitnessMap.get(log.date);
      trendPoints.push({
        date:      log.date,
        calories:  Math.round(log.totals?.calories ?? 0),
        proteinG:  Math.round(log.totals?.proteinG ?? 0),
        carbsG:    Math.round(log.totals?.carbsG ?? 0),
        fatG:      Math.round(log.totals?.fatG ?? 0),
        steps:     fit?.googleFit?.steps ?? undefined,
        weightKg:  fit?.withings?.weightKg ?? fit?.googleFit?.weightKg ?? undefined,
        burned:    fit?.googleFit?.activeCaloriesBurned ?? undefined,
      });
    }
    // Recent photos
    for (const doc of photosSnap.docs) {
      const data = doc.data() as { date: string; photos?: { id: string; dataUrl: string; addedAt: string }[] };
      if (data.photos && data.photos.length > 0) {
        recentPhotos.push({ date: data.date, photo: data.photos[0] });
      }
    }
  } catch (e) {
    console.error("Firestore error:", e);
  }

  return (
    <DashboardClient
      date={today}
      displayName={displayName}
      photoUrl={photoUrl}
      goals={goals}
      consumed={dayLog?.totals ?? { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 }}
      burned={fitnessDay?.googleFit?.activeCaloriesBurned ?? null}
      steps={fitnessDay?.googleFit?.steps ?? null}
      stepsGoal={goals.stepsGoal ?? 10000}
      activeMinutes={fitnessDay?.googleFit?.activeMinutes ?? null}
      heartRate={fitnessDay?.googleFit?.heartRateAvg ?? null}
      sleepMinutes={fitnessDay?.manualSleep?.sleepMinutes ?? fitnessDay?.googleFit?.sleepMinutes ?? null}
      sleepGoalMin={goals.sleepGoalMin ?? 420}
      sessions={fitnessDay?.googleFit?.sessions ?? []}
      weight={recentWeight[0] ?? null}
      previousWeight={recentWeight[1] ?? null}
      recentWeight={[...recentWeight].reverse()}
      trendPoints={trendPoints}
      waterMl={dayLog?.waterMl ?? 0}
      plan={plan}
      lang="fr"
      trackedNutrients={trackedNutrients}
      recentPhotos={recentPhotos}
    />
  );
}
