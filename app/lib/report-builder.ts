import { FieldPath } from "firebase-admin/firestore";
import { summarizeForReport, FACE_METRICS_VERSION, type FaceMetrics, type FaceReportSummary } from "./face-metrics";
import { EYE_METRICS_VERSION, eyeIndexes, eyeSignals, type EyeScanData } from "./eye-metrics";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import { defaultGoals } from "@/app/lib/nutrition";
import { mealGlucoseResponses, computeDayStats, DEFAULT_GLUCOSE_TARGET } from "@/app/lib/glucose";
import type { GlucoseDay, MealType } from "@/app/lib/types";
import { MICRONUTRIENT_DB, mergeCustomNutrients } from "@/app/lib/micronutrients";
import { generateReportSynthesis, type ReportSynthesis } from "@/app/lib/report-synthesis";
import type {
  DayLog, FitnessDay, HealthEntry, UserProfile, AISynthesisResult,
  SupplementProduct, SupplementLog, MicronutrientDay, MicronutrientCode,
  FaceScanEntry, SupplementFrequency, MicronutrientInfo,
} from "@/app/lib/types";
import type { MeasurementEntry } from "@/app/api/measurements/route";
import { MEASUREMENT_FIELDS, type MeasurementField } from "@/app/lib/measurement-fields";

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

export interface SupplementAdherenceRow {
  id:            string;
  name:          string;
  frequency:     SupplementFrequency;
  expectedTotal: number;
  actualTotal:   number;
  adherencePct:  number;
  daysMissed:    number; // days with 0 intake out of totalDays
}

export interface MicronutrientRow {
  code:       MicronutrientCode;
  label:      string;
  unit:       string;
  avgPerDay:  number;
  rda:        number | null;
  pctRda:     number | null;
  status:     "carence" | "ok" | "exces" | "inconnu";
}

export interface FaceScanRow {
  date:       string;
  scorecard:  { amaigrissement: number; fatigue: number; teint: number; hydratation: number };
}


export interface FoodFrequencyRow {
  name:             string;
  count:            number;
  avgCalories:      number;
  avgSugarG:        number;
  avgSodiumMg:      number;
  avgSaturatedFatG: number;
  avgFiberG:        number;
}

export interface SymptomHistoryDay {
  date:     string;
  symptoms: { name: string; category: string; severity?: string; time?: string }[];
  synthesis?: { alertLevel: string; alertLabel: string; summary: string } | null;
}

export interface GlucoseDailyRow {
  date:           string;
  avgMmol:        number | null;
  minMmol:        number | null;
  maxMmol:        number | null;
  timeInRangePct: number | null;
}

export interface GlucoseMealRow {
  date:      string;
  meal:      string;
  carbsG:    number;
  preMmol:   number;
  peakMmol:  number;
  minutesToPeak: number;
  deltaMmol: number;      // hausse : pic - avant
}

export interface GlucoseSummary {
  enabled:        boolean;
  targetMinMmol:  number;
  targetMaxMmol:  number;
  daysWithData:   number;
  avgMmol:        number | null;
  minMmol:        number | null;
  maxMmol:        number | null;
  timeInRangePct: number | null;
  daily:          GlucoseDailyRow[];
  notableMeals:   GlucoseMealRow[];
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
    foodFrequency: FoodFrequencyRow[];
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
    fatMassEnd:   number | null;
    visceralFatStart: number | null;   // indice Withings (meastype 170)
    visceralFatEnd:   number | null;
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
  supplements: {
    productsCount:   number;
    totalIntakes:    number;
    overallAdherencePct: number;
    perProduct:      SupplementAdherenceRow[];
  };
  micronutrients: {
    daysLogged:  number;
    perNutrient: MicronutrientRow[];
    deficiencies: MicronutrientRow[]; // subset with status "carence", sorted worst first
  };
  faceScan: {
    scansCount: number;
    first:      FaceScanRow | null;
    latest:     FaceScanRow | null;
    delta:      { amaigrissement: number; fatigue: number; teint: number; hydratation: number } | null;
    entries:    FaceScanRow[];
    /** Mesures objectives (points du visage + couleur) sur TOUT l'historique, pas seulement la periode. */
    objective?: FaceReportSummary | null;
    /** Scans de l'oeil de la periode : index du dernier et signaux a surveiller. */
    eye?: { count: number; latestDate: string; indexes: { secheresse: number | null; fatigue: number | null; coloration: number | null }; perEye?: Record<"A" | "B", Record<string, number | null>> | null; mbiS: number | null; signals: string[] } | null;
  };
  measurements: {
    entriesCount: number;
    first:        MeasurementEntry | null;
    latest:       MeasurementEntry | null;
    delta:        Partial<Record<MeasurementField, number>> | null;
    entries:      MeasurementEntry[];
  };
  glucose: GlucoseSummary;
  latestSynthesis: AISynthesisResult | null;
  reportSynthesis: ReportSynthesis | null;
}

// ─── Builder ────────────────────────────────────────────────────────────────

export async function buildReportData(userId: string, from: string, to: string): Promise<ReportData> {
  const db = getAdminFirestore();

  // ── Fetch everything in parallel ──────────────────────────────────────────
  const [
    foodSnaps, fitnessSnaps, healthSnaps, profileSnap,
    supplementProductsSnap, supplementLogsSnap, micronutrientLogsSnap, faceScansSnap,
    customNutrientsSnap, measurementsSnap, glucoseSnap,
  ] = await Promise.all([
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
    db.collection(`users/${userId}/supplements`).get(),
    db.collection(`users/${userId}/supplementLogs`)
      .where(FieldPath.documentId(), ">=", from).where(FieldPath.documentId(), "<=", to)
      .orderBy(FieldPath.documentId(), "asc").get(),
    db.collection(`users/${userId}/micronutrientLogs`)
      .where(FieldPath.documentId(), ">=", from).where(FieldPath.documentId(), "<=", to)
      .orderBy(FieldPath.documentId(), "asc").get(),
    db.collection(`users/${userId}/faceScans`)
      .where("date", ">=", from).where("date", "<=", to)
      .orderBy("date", "asc").get(),
    db.collection(`users/${userId}/customNutrients`).get(),
    // Mensurations : mensuelles et rares, on prend tout l'historique dispo (pas borné à
    // from/to) pour toujours pouvoir montrer l'évolution "depuis le début", même sur un
    // rapport courte période.
    db.collection(`users/${userId}/measurements`).orderBy("month", "asc").limit(800).get(),
    db.collection(`users/${userId}/glucoseLog`)
      .where("__name__", ">=", from).where("__name__", "<=", to)
      .get(),
  ]);

  // User-defined nutrients (see /api/custom-nutrients) — merged so the micronutrient
  // rows below get a proper label/unit/color instead of falling back to the raw code.
  mergeCustomNutrients(customNutrientsSnap.docs.map(d => d.data() as MicronutrientInfo));

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

  // ── Food frequency (for the AI food-habits synthesis) ─────────────────────
  const foodStats = new Map<string, { name: string; count: number; totalCalories: number; sugarG: number; sodiumMg: number; saturatedFatG: number; fiberG: number }>();
  for (const d of foodSnaps.docs) {
    const log = d.data() as DayLog;
    for (const e of log.entries ?? []) {
      const key = e.name.trim().toLowerCase();
      if (!key) continue;
      const s = foodStats.get(key) ?? { name: e.name.trim(), count: 0, totalCalories: 0, sugarG: 0, sodiumMg: 0, saturatedFatG: 0, fiberG: 0 };
      s.count++;
      s.totalCalories  += e.nutrition?.calories ?? 0;
      s.sugarG         += e.nutrition?.sugarG ?? 0;
      s.sodiumMg       += e.nutrition?.sodiumMg ?? 0;
      s.saturatedFatG  += e.nutrition?.saturatedFatG ?? 0;
      s.fiberG         += e.nutrition?.fiberG ?? 0;
      foodStats.set(key, s);
    }
  }
  const foodFrequency: FoodFrequencyRow[] = Array.from(foodStats.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 40)
    .map(s => ({
      name: s.name,
      count: s.count,
      avgCalories: Math.round(s.totalCalories / s.count),
      avgSugarG: Math.round(s.sugarG / s.count),
      avgSodiumMg: Math.round(s.sodiumMg / s.count),
      avgSaturatedFatG: Math.round((s.saturatedFatG / s.count) * 10) / 10,
      avgFiberG: Math.round((s.fiberG / s.count) * 10) / 10,
    }));

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
  let fatMassEnd: number | null = null;
  let visceralFatStart: number | null = null;
  let visceralFatEnd: number | null = null;

  for (const d of fitnessSnaps.docs) {
    const fd = d.data() as FitnessDay;
    if (fd.withings?.weightKg)   weightPoints.push({ date: fd.date ?? d.id, kg: fd.withings.weightKg });
    if (fd.withings?.bodyFatPct) bodyFatEnd = fd.withings.bodyFatPct;
    if (fd.withings?.fatMassKg)  fatMassEnd = fd.withings.fatMassKg;
    if (fd.withings?.visceralFat != null) {
      visceralFatStart ??= fd.withings.visceralFat;   // docs tries par date croissante : le premier = debut de periode
      visceralFatEnd = fd.withings.visceralFat;
    }
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

  // ── Supplements adherence ─────────────────────────────────────────────────
  const FREQ_COUNT: Record<SupplementFrequency, number> = { once: 1, twice: 2, thrice: 3, four_times: 4 };
  const supplementProducts: SupplementProduct[] = supplementProductsSnap.docs.map(d => d.data() as SupplementProduct);

  const intakeCountByProduct = new Map<string, number>();
  const intakeDaysByProduct  = new Map<string, Set<string>>();
  let totalIntakes = 0;
  for (const d of supplementLogsSnap.docs) {
    const log = d.data() as SupplementLog;
    for (const intake of log.intakes ?? []) {
      totalIntakes++;
      intakeCountByProduct.set(intake.supplementId, (intakeCountByProduct.get(intake.supplementId) ?? 0) + 1);
      if (!intakeDaysByProduct.has(intake.supplementId)) intakeDaysByProduct.set(intake.supplementId, new Set());
      intakeDaysByProduct.get(intake.supplementId)!.add(log.date);
    }
  }

  const perProduct: SupplementAdherenceRow[] = supplementProducts.map(p => {
    const expectedTotal = FREQ_COUNT[p.frequency] * totalDays;
    const actualTotal   = intakeCountByProduct.get(p.id) ?? 0;
    const daysTaken      = intakeDaysByProduct.get(p.id)?.size ?? 0;
    return {
      id: p.id,
      name: p.name,
      frequency: p.frequency,
      expectedTotal,
      actualTotal,
      adherencePct: expectedTotal ? Math.min(100, Math.round(actualTotal / expectedTotal * 100)) : 0,
      daysMissed: Math.max(0, totalDays - daysTaken),
    };
  });
  const overallAdherencePct = perProduct.length
    ? Math.round(perProduct.reduce((a, r) => a + r.adherencePct, 0) / perProduct.length)
    : 0;

  // ── Micronutrients (from logged supplement intakes) ──────────────────────
  const micronutrientTotals = new Map<MicronutrientCode, number>();
  const micronutrientDaysSet = new Set<string>();
  for (const d of micronutrientLogsSnap.docs) {
    const log = d.data() as MicronutrientDay;
    if ((log.intakes ?? []).length) micronutrientDaysSet.add(log.date);
    for (const intake of log.intakes ?? []) {
      micronutrientTotals.set(intake.code, (micronutrientTotals.get(intake.code) ?? 0) + intake.amount);
    }
  }
  const perNutrient: MicronutrientRow[] = Array.from(micronutrientTotals.entries()).map(([code, total]) => {
    const info = MICRONUTRIENT_DB[code];
    const avgPerDay = totalDays ? Math.round((total / totalDays) * 100) / 100 : 0;
    const rda = info?.recommendedDailyIntake ?? null;
    const pctRda = rda ? Math.round((avgPerDay / rda) * 100) : null;
    const status: MicronutrientRow["status"] =
      pctRda === null ? "inconnu" : pctRda < 70 ? "carence" : pctRda > 150 ? "exces" : "ok";
    return { code, label: info?.label ?? code, unit: info?.unit ?? "", avgPerDay, rda, pctRda, status };
  }).sort((a, b) => (a.pctRda ?? 0) - (b.pctRda ?? 0));
  const deficiencies = perNutrient.filter(n => n.status === "carence");

  // ── Face scan ──────────────────────────────────────────────────────────────
  // Older entries may predate the scorecard field/shape — skip anything malformed.
  const faceScanEntries: FaceScanRow[] = faceScansSnap.docs
    .map(d => d.data() as FaceScanEntry)
    .filter(e => {
      const s = e.analysis?.scorecard;
      return s && typeof s.amaigrissement === "number" && typeof s.fatigue === "number"
        && typeof s.teint === "number" && typeof s.hydratation === "number";
    })
    .map(e => ({ date: e.date, scorecard: e.analysis.scorecard }));
  // Mesures objectives : tout l'historique (la reference personnelle a besoin de toutes les photos)
  const faceMetricsSnap = await db.collection(`users/${userId}/faceScans`).select("date", "metrics").get();
  const faceObjective = summarizeForReport(faceMetricsSnap.docs
    .map(d => d.data() as { date: string; metrics?: FaceMetrics })
    .filter((h): h is { date: string; metrics: FaceMetrics } => h.metrics?.version === FACE_METRICS_VERSION && h.date <= to));
  const eyeSnap = await db.collection(`users/${userId}/eyeScans`).select("date", "time", "metrics", "plr", "conjunctiva", "mbiS", "indexesEye").get();
  const eyeAll = eyeSnap.docs.map(d => d.data() as EyeScanData & { time: string; indexesEye?: Record<"A" | "B", Record<string, number | null>> })
    .filter(e => e.metrics?.version === EYE_METRICS_VERSION && e.date <= to)
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const eyePeriod = eyeAll.filter(e => e.date >= from);
  const eyeLatest = eyePeriod[eyePeriod.length - 1];
  const eyeSummary = eyeLatest ? {
    count: eyePeriod.length,
    latestDate: eyeLatest.date,
    indexes: eyeIndexes(eyeLatest, eyeAll),
    perEye: eyeLatest.indexesEye ?? null,
    mbiS: eyeLatest.mbiS ?? null,
    signals: eyeSignals(eyeLatest, eyeAll).filter(s => s.level !== "ok").map(s => s.text),
  } : null;
  const faceScanFirst  = faceScanEntries[0] ?? null;
  const faceScanLatest = faceScanEntries[faceScanEntries.length - 1] ?? null;
  const faceScanDelta = (faceScanFirst && faceScanLatest && faceScanFirst !== faceScanLatest)
    ? {
        amaigrissement: faceScanLatest.scorecard.amaigrissement - faceScanFirst.scorecard.amaigrissement,
        fatigue:        faceScanLatest.scorecard.fatigue        - faceScanFirst.scorecard.fatigue,
        teint:          faceScanLatest.scorecard.teint          - faceScanFirst.scorecard.teint,
        hydratation:    faceScanLatest.scorecard.hydratation    - faceScanFirst.scorecard.hydratation,
      }
    : null;

  // ── Mensurations ─────────────────────────────────────────────────────────
  const measurementEntries: MeasurementEntry[] = measurementsSnap.docs.map(d => {
    const raw = d.data() as MeasurementEntry & { loggedAt: { seconds: number } };
    return { ...raw, loggedAt: { seconds: raw.loggedAt?.seconds ?? 0, nanoseconds: 0 } };
  }).sort((a, b) => a.loggedAt.seconds - b.loggedAt.seconds);
  const measurementsFirst  = measurementEntries[0] ?? null;
  const measurementsLatest = measurementEntries[measurementEntries.length - 1] ?? null;
  const measurementsDelta = (measurementsFirst && measurementsLatest && measurementsFirst !== measurementsLatest)
    ? MEASUREMENT_FIELDS.reduce((acc, key) => {
        const a = measurementsFirst[key], b = measurementsLatest[key];
        if (typeof a === "number" && typeof b === "number") acc[key] = Math.round((b - a) * 10) / 10;
        return acc;
      }, {} as Partial<Record<MeasurementField, number>>)
    : null;

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
      foodFrequency,
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
      fatMassEnd,
      visceralFatStart,
      visceralFatEnd,
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
    supplements: {
      productsCount: supplementProducts.length,
      totalIntakes,
      overallAdherencePct,
      perProduct,
    },
    micronutrients: {
      daysLogged: micronutrientDaysSet.size,
      perNutrient,
      deficiencies,
    },
    faceScan: {
      scansCount: faceScanEntries.length,
      first:  faceScanFirst,
      latest: faceScanLatest,
      delta:  faceScanDelta,
      entries: faceScanEntries,
      objective: faceObjective,
      eye: eyeSummary,
    },
    measurements: {
      entriesCount: measurementEntries.length,
      first:        measurementsFirst,
      latest:       measurementsLatest,
      delta:        measurementsDelta,
      entries:      measurementEntries,
    },
    glucose: buildGlucoseSummary(glucoseSnap.docs.map(d => d.data() as GlucoseDay), foodSnaps.docs.map(d => d.data() as DayLog), goals),
    latestSynthesis,
    reportSynthesis: null,
  };

  data.reportSynthesis = await generateReportSynthesis(data);
  return data;
}

// ─── Glycemie ──────────────────────────────────────────────────────────────

const GLUCOSE_MEAL_LABEL: Record<MealType, string> = { breakfast: "Petit-déjeuner", lunch: "Déjeuner", dinner: "Dîner", snacks: "Collation" };

function buildGlucoseSummary(glucoseDays: GlucoseDay[], foodLogs: DayLog[], goals: ReturnType<typeof defaultGoals>): GlucoseSummary {
  const target = { min: goals.glucoseTargetMinMmol ?? DEFAULT_GLUCOSE_TARGET.min, max: goals.glucoseTargetMaxMmol ?? DEFAULT_GLUCOSE_TARGET.max };
  const daysWithData = glucoseDays.filter(d => d.readings.length > 0);
  const allReadings = daysWithData.flatMap(d => d.readings);
  const overall = computeDayStats(allReadings, target);

  const daily: GlucoseDailyRow[] = daysWithData
    .map(d => ({ date: d.date, ...computeDayStats(d.readings, target) }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Repas marquants : reponse de chaque repas (heure corrigee si saisie, pic borne par le repas suivant) ; on garde les 3
  // plus fortes hausses (>= 2 mmol/L, au-dela du bruit normal).
  const byDate = new Map(glucoseDays.map(d => [d.date, d.readings]));
  const notableMeals: GlucoseMealRow[] = [];
  for (const log of foodLogs) {
    const readings = byDate.get(log.date);
    if (!readings?.length) continue;
    const responses = mealGlucoseResponses(log.entries ?? [], readings, log.mealTimes);
    for (const [meal, r] of Object.entries(responses) as [MealType, NonNullable<ReturnType<typeof mealGlucoseResponses>[MealType]>][]) {
      if (r.pre && r.peak && r.riseMmol !== null && r.riseMmol >= 2.0) {
        notableMeals.push({ date: log.date, meal: GLUCOSE_MEAL_LABEL[meal], carbsG: r.carbsG, preMmol: r.pre.mmol, peakMmol: r.peak.mmol, minutesToPeak: r.minutesToPeak ?? 0, deltaMmol: r.riseMmol });
      }
    }
  }
  notableMeals.sort((a, b) => b.deltaMmol - a.deltaMmol);

  return {
    enabled: !!goals.glucoseTracking,
    targetMinMmol: target.min,
    targetMaxMmol: target.max,
    daysWithData: daysWithData.length,
    avgMmol: overall.avgMmol,
    minMmol: overall.minMmol,
    maxMmol: overall.maxMmol,
    timeInRangePct: overall.timeInRangePct,
    daily,
    notableMeals: notableMeals.slice(0, 3),
  };
}
