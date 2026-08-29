// Parser for the "Health Auto Export" iOS app's REST API JSON payload.
// Shape confirmed against a real open-source consumer of this exact format
// (github.com/irvinlim/apple-health-ingester) since HealthyApps' own docs
// don't publish a full example:
//
//   { "data": { "metrics": [ { "name": "step_count", "units": "count",
//       "data": [ { "date": "2026-08-28 00:04:00 +0800", "qty": 42 } ] } ],
//     "workouts": [...] } }
//
// "sleep_analysis" is special-cased: with "Aggregate Sleep Data" on (the
// setting we tell users to enable), its `data` entries carry
// sleepStart/sleepEnd/asleep/deep/rem/core/awake (in hours) instead of qty.

export interface DailyHealthFields {
  steps?:             number;
  activeCalories?:    number;
  restingCalories?:   number;
  activeMinutes?:     number;
  heartRateAvg?:      number;
  heartRateResting?:  number;
  hrv?:               number;
  spO2?:              number;
  sleepMinutes?:      number;
  sleepLightMinutes?: number;
  sleepDeepMinutes?:  number;
  sleepRemMinutes?:   number;
  distanceKm?:        number;
  vo2Max?:            number;
  weightKg?:          number;
}

interface HaePoint {
  date?: string;
  qty?: number;
  Avg?: number;
  [key: string]: unknown;
}
interface HaeAggregatedSleep {
  sleepStart?: string;
  sleepEnd?:   string;
  asleep?: number; deep?: number; rem?: number; core?: number; awake?: number;
}
interface HaeMetric {
  name?:  string;
  units?: string;
  data?:  (HaePoint | HaeAggregatedSleep)[];
}
export interface HaePayload {
  data?: { metrics?: HaeMetric[] };
}

// day-bucket accumulator: SUM fields collect every value, LAST fields keep
// only the most recent (by date) — resolved into DailyHealthFields at the end.
interface Bucket {
  sums:  Partial<Record<keyof DailyHealthFields, number>>;
  avgs:  Partial<Record<keyof DailyHealthFields, number[]>>;
  lasts: Partial<Record<keyof DailyHealthFields, { date: string; value: number }>>;
}

const SUM_FIELDS  = new Set<keyof DailyHealthFields>([
  "steps", "activeCalories", "restingCalories", "activeMinutes", "distanceKm",
  "sleepMinutes", "sleepLightMinutes", "sleepDeepMinutes", "sleepRemMinutes",
]);
const AVG_FIELDS  = new Set<keyof DailyHealthFields>(["heartRateAvg", "heartRateResting", "hrv", "spO2"]);
const LAST_FIELDS = new Set<keyof DailyHealthFields>(["vo2Max", "weightKg"]);

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

// HealthKit identifier → our field, keyed by normalized name. Several
// aliases per field since exact strings aren't fully documented upstream.
const METRIC_MAP: Record<string, keyof DailyHealthFields> = {
  step_count:                     "steps",
  steps:                          "steps",
  active_energy:                  "activeCalories",
  basal_energy_burned:            "restingCalories",
  resting_energy:                 "restingCalories",
  apple_exercise_time:            "activeMinutes",
  exercise_time:                  "activeMinutes",
  heart_rate:                     "heartRateAvg",
  resting_heart_rate:             "heartRateResting",
  heart_rate_variability:         "hrv",
  heart_rate_variability_sdnn:    "hrv",
  blood_oxygen_saturation:        "spO2",
  oxygen_saturation:              "spO2",
  walking_running_distance:       "distanceKm",
  distance_walking_running:       "distanceKm",
  vo2_max:                        "vo2Max",
  weight_body_mass:               "weightKg",
  body_mass:                      "weightKg",
  weight:                         "weightKg",
};

function dateKey(raw?: string): string | null {
  const m = raw?.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

function convert(field: keyof DailyHealthFields, qty: number, units?: string): number {
  const u = units?.toLowerCase().trim();
  if (field === "activeCalories" || field === "restingCalories") {
    return u === "kj" ? qty / 4.184 : qty;
  }
  if (field === "distanceKm") {
    if (u === "mi") return qty * 1.60934;
    if (u === "m")  return qty / 1000;
    return qty;
  }
  if (field === "weightKg") {
    return u === "lb" ? qty * 0.453592 : qty;
  }
  if (field === "spO2") {
    return qty <= 1 ? qty * 100 : qty;
  }
  return qty;
}

function getBucket(buckets: Map<string, Bucket>, date: string): Bucket {
  let b = buckets.get(date);
  if (!b) { b = { sums: {}, avgs: {}, lasts: {} }; buckets.set(date, b); }
  return b;
}

function addValue(buckets: Map<string, Bucket>, date: string, field: keyof DailyHealthFields, value: number) {
  const b = getBucket(buckets, date);
  if (SUM_FIELDS.has(field)) {
    b.sums[field] = (b.sums[field] ?? 0) + value;
  } else if (AVG_FIELDS.has(field)) {
    (b.avgs[field] ??= []).push(value);
  } else if (LAST_FIELDS.has(field)) {
    const prev = b.lasts[field];
    if (!prev || date >= prev.date) b.lasts[field] = { date, value };
  }
}

/** Parses a Health Auto Export REST API payload into one entry per calendar
 *  day found in it (a scheduled export can cover more than just "today"). */
export function parseHaePayload(payload: HaePayload): Map<string, DailyHealthFields> {
  const buckets = new Map<string, Bucket>();

  for (const metric of payload.data?.metrics ?? []) {
    if (!metric.name) continue;
    const normalized = normalizeName(metric.name);

    if (normalized === "sleep_analysis") {
      for (const point of metric.data ?? []) {
        const sleep = point as HaeAggregatedSleep;
        const date = dateKey(sleep.sleepEnd);
        if (!date) continue;
        if (typeof sleep.asleep === "number") addValue(buckets, date, "sleepMinutes", Math.round(sleep.asleep * 60));
        if (typeof sleep.core   === "number") addValue(buckets, date, "sleepLightMinutes", Math.round(sleep.core * 60));
        if (typeof sleep.deep   === "number") addValue(buckets, date, "sleepDeepMinutes",  Math.round(sleep.deep * 60));
        if (typeof sleep.rem    === "number") addValue(buckets, date, "sleepRemMinutes",   Math.round(sleep.rem * 60));
      }
      continue;
    }

    const field = METRIC_MAP[normalized];
    if (!field) continue;

    for (const point of metric.data ?? []) {
      const p = point as HaePoint;
      const date = dateKey(p.date);
      if (!date) continue;
      const raw = field === "heartRateAvg" && typeof p.Avg === "number" ? p.Avg : p.qty;
      if (typeof raw !== "number" || !Number.isFinite(raw)) continue;
      addValue(buckets, date, field, convert(field, raw, metric.units));
    }
  }

  const result = new Map<string, DailyHealthFields>();
  for (const [date, b] of buckets) {
    const fields: DailyHealthFields = { ...b.sums };
    for (const [field, values] of Object.entries(b.avgs) as [keyof DailyHealthFields, number[]][]) {
      fields[field] = Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 10) / 10;
    }
    for (const [field, last] of Object.entries(b.lasts) as [keyof DailyHealthFields, { date: string; value: number }][]) {
      fields[field] = Math.round(last.value * 10) / 10;
    }
    // Round sums to whole numbers except distance (keep 2dp of precision).
    for (const field of SUM_FIELDS) {
      if (fields[field] === undefined) continue;
      fields[field] = field === "distanceKm" ? Math.round(fields[field]! * 100) / 100 : Math.round(fields[field]!);
    }
    result.set(date, fields);
  }
  return result;
}
