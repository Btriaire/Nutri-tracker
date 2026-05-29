export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import { defaultGoals } from "@/app/lib/nutrition";
import type { DayLog, FitnessDay, HealthEntry, UserProfile, AISynthesisResult } from "@/app/lib/types";

// ─── Output types ─────────────────────────────────────────────────────────────

export interface DayNutrition {
  date:      string;
  calories:  number;
  proteinG:  number;
  carbsG:    number;
  fatG:      number;
  fiberG:    number;
  waterMl:   number;
}

export interface DayActivity {
  date:         string;
  steps:        number | null;
  activeMin:    number | null;
  caloriesBurned: number | null;
  sleepMin:     number | null;
}

export interface DayHealth {
  date:    string;
  weightKg: number | null;
  bodyFatPct: number | null;
  hrAvg:   number | null;
  sys:     number | null;
  dia:     number | null;
  spO2:    number | null;
  tempC:   number | null;
  symptomsCount: number;
}

export interface TopSymptom {
  name:     string;
  category: string;
  count:    number;
}

export interface SymptomHistoryDay {
  date:     string;
  symptoms: { name: string; category: string; severity?: string; time?: string }[];
  synthesis?: { alertLevel: string; alertLabel: string; summary: string } | null;
}

export interface ReportData {
  meta: {
    from:        string;
    to:          string;
    totalDays:   number;
    generatedAt: string;
  };
  profile: {
    displayName:    string;
    email:          string;
    photoUrl:       string | null;
    goals: {
      dailyCalories:  number;
      proteinGrams:   number;
      carbsGrams:     number;
      fatGrams:       number;
      fiberGrams:     number;
      waterMl:        number;
      stepsGoal:      number;
      sleepGoalMin:   number;
      targetWeightKg: number | null;
    };
  };
  nutrition: {
    daysLogged:    number;
    avgCalories:   number;
    avgProteinG:   number;
    avgCarbsG:     number;
    avgFatG:       number;
    avgFiberG:     number;
    avgWaterMl:    number;
    pctCalGoal:    number;
    pctWaterGoal:  number;
    daily:         DayNutrition[];
  };
  activity: {
    daysWithData:      number;
    avgSteps:          number;
    avgActiveMin:      number;
    avgCaloriesBurned: number;
    avgSleepH:         number;
    totalSessions:     number;
    pctStepsGoal:      number;
    pctSleepGoal:      number;
    daily:             DayActivity[];
  };
  health: {
    weightStart:  number | null;
    weightEnd:    number | null;
    weightDelta:  number | null;
    bodyFatEnd:   number | null;
    avgHR:        number | null;
    avgSys:       number | null;
    avgDia:       number | null;
    latestSpO2:   number | null;
    symptomsTotal: number;
    topSymptoms:  TopSymptom[];
    medicationsTotal: number;
    daily:        DayHealth[];
    symptomHistory: SymptomHistoryDay[];
  };
  latestSynthesis: AISynthesisResult | null;
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to   = searchParams.get("to");
  if (!from || !to) return NextResponse.json({ error: "from & to required" }, { status: 400 });

  const db     = getAdminFirestore();
  const userId = session.userId;

  // ── Fetch everything in parallel ──────────────────────────────────────────
  const [foodSnaps, fitnessSnaps, healthSnaps, profileSnap] = await Promise.all([
    db.collection(`users/${userId}/foodLog`)
      .where("date", ">=", from).where("date", "<=", to)
      .orderBy("date", "asc").get(),
    db.collection(`users/${userId}/fitnessData`)
      .where("date", ">=", from).where("date", "<=", to)
      .orderBy("date", "asc").get(),
    db.collection(`users/${userId}/healthLog`)
      .where("date", ">=", from).where("date", "<=", to)
      .orderBy("date", "asc").get(),
    db.doc(`users/${userId}`).get(),
  ]);

  const profile = profileSnap.exists ? (profileSnap.data() as UserProfile) : null;
  const goals   = profile?.goals ?? defaultGoals();

  // ── Nutrition aggregation ─────────────────────────────────────────────────
  const dailyNutrition: DayNutrition[] = foodSnaps.docs.map(d => {
    const log = d.data() as DayLog;
    const t   = log.totals ?? { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 };
    return {
      date:     log.date ?? d.id,
      calories: Math.round(t.calories  ?? 0),
      proteinG: Math.round(t.proteinG  ?? 0),
      carbsG:   Math.round(t.carbsG    ?? 0),
      fatG:     Math.round(t.fatG      ?? 0),
      fiberG:   Math.round(t.fiberG    ?? 0),
      waterMl:  Math.round(log.waterMl ?? 0),
    };
  });

  const daysLogged = dailyNutrition.length;
  const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;

  const avgCalories  = avg(dailyNutrition.map(d => d.calories));
  const avgProteinG  = avg(dailyNutrition.map(d => d.proteinG));
  const avgCarbsG    = avg(dailyNutrition.map(d => d.carbsG));
  const avgFatG      = avg(dailyNutrition.map(d => d.fatG));
  const avgFiberG    = avg(dailyNutrition.map(d => d.fiberG));
  const avgWaterMl   = avg(dailyNutrition.map(d => d.waterMl));

  // ── Activity aggregation ──────────────────────────────────────────────────
  const dailyActivity: DayActivity[] = fitnessSnaps.docs.map(d => {
    const fd = d.data() as FitnessDay;
    const gf = fd.googleFit;
    const ah = fd.appleHealth;
    return {
      date:           fd.date ?? d.id,
      steps:          gf?.steps           ?? ah?.steps            ?? null,
      activeMin:      gf?.activeMinutes   ?? ah?.activeMinutes    ?? null,
      caloriesBurned: gf?.activeCaloriesBurned ?? ah?.activeCalories ?? null,
      sleepMin:       gf?.sleepMinutes    ?? ah?.sleepMinutes     ?? null,
    };
  });

  const withData   = dailyActivity.filter(d => d.steps !== null || d.activeMin !== null);
  const stepsArr   = dailyActivity.filter(d => d.steps   !== null).map(d => d.steps!);
  const activeArr  = dailyActivity.filter(d => d.activeMin !== null).map(d => d.activeMin!);
  const calBArr    = dailyActivity.filter(d => d.caloriesBurned !== null).map(d => d.caloriesBurned!);
  const sleepArr   = dailyActivity.filter(d => d.sleepMin !== null).map(d => d.sleepMin!);

  const avgSteps          = avg(stepsArr);
  const avgActiveMin      = avg(activeArr);
  const avgCaloriesBurned = avg(calBArr);
  const avgSleepMin       = sleepArr.length ? Math.round(sleepArr.reduce((a, b) => a + b, 0) / sleepArr.length) : 0;
  const avgSleepH         = Math.round(avgSleepMin / 60 * 10) / 10;

  const totalSessions = fitnessSnaps.docs.reduce((acc, d) => {
    const fd = d.data() as FitnessDay;
    return acc + (fd.googleFit?.sessions?.length ?? 0);
  }, 0);

  // ── Health aggregation ────────────────────────────────────────────────────
  const dailyHealth: DayHealth[] = [];
  const allSymptoms: { name: string; category: string }[] = [];
  let medicationsTotal = 0;

  const weightPoints: { date: string; kg: number }[] = [];
  const hrArr:  number[] = [];
  const sysArr: number[] = [];
  const diaArr: number[] = [];
  let latestSpO2: number | null = null;
  let bodyFatEnd: number | null = null;

  for (const d of fitnessSnaps.docs) {
    const fd = d.data() as FitnessDay;
    if (fd.withings?.weightKg)   weightPoints.push({ date: fd.date ?? d.id, kg: fd.withings.weightKg });
    if (fd.withings?.bodyFatPct) bodyFatEnd = fd.withings.bodyFatPct;
  }

  for (const d of healthSnaps.docs) {
    const h = d.data() as HealthEntry;
    const date = h.date ?? d.id;

    const bpReadings = h.bloodPressure ?? [];
    const sys = bpReadings.length ? Math.round(bpReadings.reduce((s, r) => s + r.systolic,  0) / bpReadings.length) : null;
    const dia = bpReadings.length ? Math.round(bpReadings.reduce((s, r) => s + r.diastolic, 0) / bpReadings.length) : null;

    if (sys) sysArr.push(sys);
    if (dia) diaArr.push(dia);
    if (h.restingHR) hrArr.push(h.restingHR);
    if (h.spO2)      latestSpO2 = h.spO2;

    // match fitnessData for HR and weight on same date
    const fitnessDoc = fitnessSnaps.docs.find(f => (f.data() as FitnessDay).date === date || f.id === date);
    const gfHR  = (fitnessDoc?.data() as FitnessDay | undefined)?.googleFit?.heartRateAvg ?? null;
    const wHR   = (fitnessDoc?.data() as FitnessDay | undefined)?.withings?.weightKg ?? null;

    if (gfHR && !h.restingHR) hrArr.push(gfHR);

    for (const s of h.symptoms ?? []) allSymptoms.push({ name: s.name, category: s.category });
    medicationsTotal += (h.medications ?? []).length;

    dailyHealth.push({
      date,
      weightKg:    wHR,
      bodyFatPct:  (fitnessDoc?.data() as FitnessDay | undefined)?.withings?.bodyFatPct ?? null,
      hrAvg:       h.restingHR ?? gfHR,
      sys,
      dia,
      spO2:        h.spO2     ?? null,
      tempC:       h.temperatureC ?? null,
      symptomsCount: (h.symptoms ?? []).length,
    });
  }

  // Top symptoms
  const symCount: Record<string, TopSymptom> = {};
  for (const s of allSymptoms) {
    if (!symCount[s.name]) symCount[s.name] = { name: s.name, category: s.category, count: 0 };
    symCount[s.name].count++;
  }
  const topSymptoms = Object.values(symCount).sort((a, b) => b.count - a.count).slice(0, 5);

  // Symptom history (days with at least one symptom, sorted newest first)
  const symptomHistory: SymptomHistoryDay[] = healthSnaps.docs
    .map(d => {
      const h = d.data() as HealthEntry;
      return {
        date:     h.date ?? d.id,
        symptoms: (h.symptoms ?? []).map(s => ({
          name:     s.name,
          category: s.category,
          severity: s.severity,
          time:     s.time,
        })),
        synthesis: h.aiSynthesis
          ? { alertLevel: h.aiSynthesis.alertLevel, alertLabel: h.aiSynthesis.alertLabel, summary: h.aiSynthesis.summary }
          : null,
      };
    })
    .filter(d => d.symptoms.length > 0)
    .sort((a, b) => b.date.localeCompare(a.date));

  // Latest AI synthesis found in the period
  const allSyntheses = healthSnaps.docs
    .map(d => (d.data() as HealthEntry).aiSynthesis)
    .filter((s): s is AISynthesisResult => !!s)
    .sort((a, b) => (b.generatedAt ?? "").localeCompare(a.generatedAt ?? ""));
  const latestSynthesis = allSyntheses[0] ?? null;

  const avgHR  = hrArr.length  ? Math.round(hrArr.reduce((a, b) => a + b, 0)  / hrArr.length)  : null;
  const avgSys = sysArr.length ? Math.round(sysArr.reduce((a, b) => a + b, 0) / sysArr.length) : null;
  const avgDia = diaArr.length ? Math.round(diaArr.reduce((a, b) => a + b, 0) / diaArr.length) : null;

  const weightStart = weightPoints[0]?.kg ?? null;
  const weightEnd   = weightPoints[weightPoints.length - 1]?.kg ?? null;
  const weightDelta = weightStart && weightEnd ? Math.round((weightEnd - weightStart) * 10) / 10 : null;

  // ── Compute total calendar days ───────────────────────────────────────────
  const msPerDay   = 86400e3;
  const fromMs     = new Date(from).getTime();
  const toMs       = new Date(to).getTime();
  const totalDays  = Math.round((toMs - fromMs) / msPerDay) + 1;

  const data: ReportData = {
    meta: {
      from,
      to,
      totalDays,
      generatedAt: new Date().toISOString(),
    },
    profile: {
      displayName:    profile?.displayName ?? "Utilisateur",
      email:          profile?.email       ?? "",
      photoUrl:       profile?.photoUrl    ?? null,
      goals: {
        dailyCalories:  goals.dailyCalories,
        proteinGrams:   goals.proteinGrams,
        carbsGrams:     goals.carbsGrams,
        fatGrams:       goals.fatGrams,
        fiberGrams:     goals.fiberGrams,
        waterMl:        goals.waterMl,
        stepsGoal:      goals.stepsGoal ?? 10000,
        sleepGoalMin:   goals.sleepGoalMin ?? 480,
        targetWeightKg: goals.targetWeightKg ?? null,
      },
    },
    nutrition: {
      daysLogged,
      avgCalories,
      avgProteinG,
      avgCarbsG,
      avgFatG,
      avgFiberG,
      avgWaterMl,
      pctCalGoal:   goals.dailyCalories ? Math.round(avgCalories / goals.dailyCalories * 100) : 0,
      pctWaterGoal: goals.waterMl       ? Math.round(avgWaterMl  / goals.waterMl * 100)       : 0,
      daily: dailyNutrition,
    },
    activity: {
      daysWithData:  withData.length,
      avgSteps,
      avgActiveMin,
      avgCaloriesBurned,
      avgSleepH,
      totalSessions,
      pctStepsGoal: goals.stepsGoal   ? Math.round(avgSteps   / (goals.stepsGoal  ?? 10000) * 100) : 0,
      pctSleepGoal: goals.sleepGoalMin ? Math.round(avgSleepH / ((goals.sleepGoalMin ?? 480) / 60) * 100) : 0,
      daily: dailyActivity,
    },
    health: {
      weightStart,
      weightEnd,
      weightDelta,
      bodyFatEnd,
      avgHR,
      avgSys,
      avgDia,
      latestSpO2,
      symptomsTotal: allSymptoms.length,
      topSymptoms,
      medicationsTotal,
      daily: dailyHealth,
      symptomHistory,
    },
    latestSynthesis,
  };

  return NextResponse.json(data);
}
