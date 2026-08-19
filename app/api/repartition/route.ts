import { NextRequest, NextResponse } from "next/server";
import { FieldPath } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import { getSession } from "@/app/lib/session";
import { checkDietCompliance, DIET_PROGRAM_NAME } from "@/app/lib/diet-program";
import { inferFoodCategory } from "@/app/lib/food-substitution";
import { MICRONUTRIENT_DB } from "@/app/lib/micronutrients";
import { defaultGoals } from "@/app/lib/nutrition";
import type { DayLog, MicronutrientDay, UserProfile, MicronutrientCode } from "@/app/lib/types";

export const dynamic = "force-dynamic";

const USER = "owner";

const CATEGORY_LABELS: Record<string, string> = {
  feculents:     "Féculents",
  legumineuses:  "Légumineuses",
  viande:        "Viande",
  poisson:       "Poisson",
  oeuf:          "Œufs",
  laitage:       "Laitages",
  legume:        "Légumes",
  fruit:         "Fruits",
  oleagineux:    "Oléagineux",
  corpsgras:     "Corps gras",
  sucrerie:      "Sucreries",
  boisson:       "Boissons",
  autre:         "Autres",
};

interface Insight { label: string; detail: string; days?: number }

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to   = searchParams.get("to");
  if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
  }

  const db = getAdminFirestore();
  const [logSnap, microSnap, profileSnap] = await Promise.all([
    db.collection(`users/${USER}/foodLog`)
      .where(FieldPath.documentId(), ">=", from).where(FieldPath.documentId(), "<=", to)
      .orderBy(FieldPath.documentId(), "asc").get(),
    db.collection(`users/${USER}/micronutrientLogs`)
      .where(FieldPath.documentId(), ">=", from).where(FieldPath.documentId(), "<=", to)
      .orderBy(FieldPath.documentId(), "asc").get(),
    db.doc(`users/${USER}`).get(),
  ]);

  const profile     = (profileSnap.exists ? profileSnap.data() : {}) as Partial<UserProfile>;
  const goals        = profile.goals ?? defaultGoals();
  const dietProgram  = profile.dietProgram;
  const dietEnabled  = !!dietProgram?.enabled;
  const dietExceptions = dietProgram?.exceptions ?? [];

  const dayLogs = logSnap.docs.map((d) => d.data() as DayLog);
  const rangeDayCount = Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000) + 1;
  const loggedDays = dayLogs.length;

  // ── Macros ────────────────────────────────────────────────────────────────
  let sumCalories = 0, sumProtein = 0, sumCarbs = 0, sumFat = 0, sumSugar = 0, sumSatFat = 0;
  for (const log of dayLogs) {
    sumCalories += log.totals?.calories ?? 0;
    sumProtein  += log.totals?.proteinG ?? 0;
    sumCarbs    += log.totals?.carbsG ?? 0;
    sumFat      += log.totals?.fatG ?? 0;
    sumSugar    += log.totals?.sugarG ?? 0;
    sumSatFat   += log.totals?.saturatedFatG ?? 0;
  }
  const denom = Math.max(loggedDays, 1);
  const avgCalories = sumCalories / denom;
  const avgProtein  = sumProtein / denom;
  const avgCarbs    = sumCarbs / denom;
  const avgFat      = sumFat / denom;
  const avgSugar    = sumSugar / denom;
  const avgSatFat   = sumSatFat / denom;

  const proteinKcal = avgProtein * 4, carbsKcal = avgCarbs * 4, fatKcal = avgFat * 9;
  const macroKcalTotal = Math.max(proteinKcal + carbsKcal + fatKcal, 1);

  // ── Food groups (by share of calories, weighted per entry) ─────────────────
  const categoryCalories = new Map<string, number>();
  const categoryMealCount = new Map<string, number>();
  for (const log of dayLogs) {
    for (const entry of log.entries ?? []) {
      const cat = inferFoodCategory(entry.name);
      categoryCalories.set(cat, (categoryCalories.get(cat) ?? 0) + (entry.nutrition?.calories ?? 0));
      categoryMealCount.set(cat, (categoryMealCount.get(cat) ?? 0) + 1);
    }
  }
  const totalCatCalories = Math.max([...categoryCalories.values()].reduce((s, v) => s + v, 0), 1);
  const foodGroups = [...categoryCalories.entries()]
    .map(([cat, cal]) => ({
      category: cat,
      label:    CATEGORY_LABELS[cat] ?? cat,
      calories: Math.round(cal),
      pct:      Math.round((cal / totalCatCalories) * 1000) / 10,
      count:    categoryMealCount.get(cat) ?? 0,
    }))
    .sort((a, b) => b.calories - a.calories);

  // ── Micronutrients: average daily coverage vs RDA over the whole range ─────
  const microTotals = new Map<string, number>();
  const microSeen = new Set<string>();
  for (const doc of microSnap.docs) {
    const day = doc.data() as MicronutrientDay;
    for (const intake of day.intakes ?? []) {
      microTotals.set(intake.code, (microTotals.get(intake.code) ?? 0) + intake.amount);
      microSeen.add(intake.code);
    }
  }
  const micronutrients = [...microSeen]
    .map((code) => {
      const info = MICRONUTRIENT_DB[code as MicronutrientCode];
      if (!info?.recommendedDailyIntake) return null;
      const avgAmount = (microTotals.get(code) ?? 0) / rangeDayCount;
      const pctAjr = Math.round((avgAmount / info.recommendedDailyIntake) * 1000) / 10;
      return { code, label: info.label, symbol: info.symbol, pctAjr: Math.min(pctAjr, 200) };
    })
    .filter((m): m is NonNullable<typeof m> => m !== null)
    .sort((a, b) => a.pctAjr - b.pctAjr);

  // ── Sugar threshold (WHO/ANSES: <10% of calories from free sugars, <5% ideal) ─
  const sugarLimitG  = goals.sugarGrams ?? Math.round((goals.dailyCalories * 0.10) / 4);
  const sugarGoodG   = Math.round((goals.dailyCalories * 0.05) / 4);

  // ── Per-day adherence + diet compliance ─────────────────────────────────────
  let daysOverCalories = 0, daysProteinGoalHit = 0, daysWaterGoalHit = 0, daysSugarOverLimit = 0;
  let calorieOvershootSum = 0;
  let dietConformeDays = 0, dietEcartDays = 0;
  const violationReasons = new Map<string, number>();

  for (const log of dayLogs) {
    const cal = log.totals?.calories ?? 0;
    if (cal > goals.dailyCalories * 1.15) {
      daysOverCalories++;
      calorieOvershootSum += cal - goals.dailyCalories;
    }
    if ((log.totals?.proteinG ?? 0) >= goals.proteinGrams * 0.9) daysProteinGoalHit++;
    if ((log.waterMl ?? 0) >= goals.waterMl) daysWaterGoalHit++;
    if ((log.totals?.sugarG ?? 0) > sugarLimitG) daysSugarOverLimit++;

    if (dietEnabled && !log.dietPaused) {
      const report = checkDietCompliance(log.entries ?? [], dietExceptions);
      if (report.day.status === "conforme") dietConformeDays++;
      else if (report.day.status === "ecarts") dietEcartDays++;
      for (const violations of Object.values(report.violationsByEntryId)) {
        for (const v of violations) {
          violationReasons.set(v.reason, (violationReasons.get(v.reason) ?? 0) + 1);
        }
      }
    }
  }

  const concerns: Insight[] = [];
  const goodHabits: Insight[] = [];

  if (daysSugarOverLimit > 0) {
    concerns.push({
      label: "Sucre au-dessus du seuil",
      detail: `${daysSugarOverLimit}j/${loggedDays} · moy. ${Math.round(avgSugar)}g vs <${sugarLimitG}g (10% des calories)`,
      days: daysSugarOverLimit,
    });
  } else if (avgSugar <= sugarGoodG && loggedDays > 0) {
    goodHabits.push({ label: "Sucre bien maîtrisé", detail: `moy. ${Math.round(avgSugar)}g/j, sous 5% des calories`, days: loggedDays });
  }

  if (daysOverCalories > 0) {
    concerns.push({
      label: "Dépassement calorique",
      detail: `${daysOverCalories}j/${loggedDays} · +${Math.round(calorieOvershootSum / daysOverCalories)} kcal en moyenne`,
      days: daysOverCalories,
    });
  }

  const topViolation = [...violationReasons.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topViolation) {
    concerns.push({ label: topViolation[0], detail: `${topViolation[1]}x sur la période`, days: topViolation[1] });
  }
  if (dietEnabled && dietConformeDays >= Math.ceil(loggedDays * 0.6) && loggedDays > 0) {
    goodHabits.push({ label: `${DIET_PROGRAM_NAME} respecté`, detail: `${dietConformeDays}j/${loggedDays} sans écart`, days: dietConformeDays });
  }

  const worstMicro = micronutrients[0];
  if (worstMicro && worstMicro.pctAjr < 70) {
    concerns.push({ label: `${worstMicro.label} sous les apports recommandés`, detail: `${worstMicro.pctAjr}% AJR en moyenne`, days: 0 });
  }
  const bestMicro = [...micronutrients].sort((a, b) => b.pctAjr - a.pctAjr)[0];
  if (bestMicro && bestMicro.pctAjr >= 90) {
    goodHabits.push({ label: `${bestMicro.label} bien couvert`, detail: `${bestMicro.pctAjr}% AJR en moyenne`, days: 0 });
  }

  if (daysProteinGoalHit >= Math.ceil(loggedDays * 0.6) && loggedDays > 0) {
    goodHabits.push({ label: "Objectif protéines atteint", detail: `${daysProteinGoalHit}j/${loggedDays}`, days: daysProteinGoalHit });
  }
  if (daysWaterGoalHit >= Math.ceil(loggedDays * 0.6) && loggedDays > 0) {
    goodHabits.push({ label: "Hydratation dans l'objectif", detail: `${daysWaterGoalHit}j/${loggedDays}`, days: daysWaterGoalHit });
  }

  const sortByDays = (a: Insight, b: Insight) => (b.days ?? 0) - (a.days ?? 0);
  concerns.sort(sortByDays);
  goodHabits.sort(sortByDays);

  return NextResponse.json({
    from, to, loggedDays, rangeDayCount,
    macros: {
      avgCalories: Math.round(avgCalories),
      proteinG: Math.round(avgProtein * 10) / 10,
      carbsG:   Math.round(avgCarbs * 10) / 10,
      fatG:     Math.round(avgFat * 10) / 10,
      sugarG:   Math.round(avgSugar * 10) / 10,
      saturatedFatG: Math.round(avgSatFat * 10) / 10,
      proteinPct: Math.round((proteinKcal / macroKcalTotal) * 1000) / 10,
      carbsPct:   Math.round((carbsKcal   / macroKcalTotal) * 1000) / 10,
      fatPct:     Math.round((fatKcal     / macroKcalTotal) * 1000) / 10,
    },
    foodGroups,
    micronutrients,
    insights: {
      concerns:   concerns.slice(0, 3),
      goodHabits: goodHabits.slice(0, 3),
    },
    dietEnabled,
    dietConformeDays,
    dietEcartDays,
  });
}
