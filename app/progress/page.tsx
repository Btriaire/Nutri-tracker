export const dynamic = "force-dynamic";

import { getAdminFirestore } from "@/app/lib/firebase-admin";
import { defaultGoals } from "@/app/lib/nutrition";
import type { UserProfile, NutritionPlan } from "@/app/lib/types";
import ProgressClient from "./ProgressClient";

export default async function ProgressPage() {
  const userId = "owner";
  let goals = defaultGoals();
  let targetWeightKg: number | null = null;
  let currentWeightKg: number | null = null;
  let plan: NutritionPlan | undefined;
  let targetDate: string | undefined;

  try {
    const db = getAdminFirestore();
    const [profileSnap, fitnessSnap] = await Promise.all([
      db.doc(`users/${userId}`).get(),
      db.collection(`users/${userId}/fitnessData`).orderBy("date", "desc").limit(7).get(),
    ]);
    const profile = profileSnap.exists ? profileSnap.data() as UserProfile : null;
    goals = profile?.goals ?? defaultGoals();
    targetWeightKg = goals.targetWeightKg ?? null;
    targetDate = goals.targetDate ?? plan?.projectedTargetDate ?? undefined;
    plan = profile?.goals?.plan ?? undefined;
    // targetDate from plan takes precedence if goals doesn't have one
    if (!targetDate && plan?.projectedTargetDate) targetDate = plan.projectedTargetDate;
    for (const d of fitnessSnap.docs) {
      const fd = d.data() as { withings?: { weightKg?: number }; googleFit?: { weightKg?: number } };
      const kg = fd.withings?.weightKg ?? fd.googleFit?.weightKg ?? null;
      if (kg) { currentWeightKg = kg; break; }
    }
  } catch (e) {
    console.error(e);
  }

  return (
    <ProgressClient
      goals={goals}
      currentWeightKg={currentWeightKg}
      targetWeightKg={targetWeightKg}
      targetDate={targetDate}
      age={goals.age}
      plan={plan}
    />
  );
}
