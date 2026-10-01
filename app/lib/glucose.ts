import type { GlucoseReading } from "@/app/lib/types";

// Plage "time in range" par defaut (3,9-10,0 mmol/L) : c'est le consensus international ATTD/CGM
// pour le suivi au quotidien, pas une prescription — l'utilisateur peut la regler dans Reglages.
export const DEFAULT_GLUCOSE_TARGET = { min: 3.9, max: 10.0 };

// Fenetres de recherche autour d'un repas : "avant" = derniere lecture connue dans les 60 min
// precedentes ; "post-prandial" = lecture la plus proche de +120 min, cherchee entre +90 et +180 min
// (CGM releve toutes les ~5 min, donc une fenetre large absorbe les trous de synchro).
const PRE_MEAL_WINDOW_MS = 60 * 60_000;
const POST_MEAL_TARGET_MS = 120 * 60_000;
const POST_MEAL_WINDOW_MS = [90 * 60_000, 180 * 60_000] as const;

export interface MealGlucoseMatch {
  pre:  GlucoseReading | null;
  post: GlucoseReading | null;
  /** post.mmol - pre.mmol, seulement si les deux existent. */
  deltaMmol: number | null;
}

/** Associe a un horaire de repas la derniere lecture avant, et celle la plus proche de +2h apres.
 *  `readings` n'a pas besoin d'etre trie. */
export function matchMealGlucose(readings: GlucoseReading[], mealTimeMs: number): MealGlucoseMatch {
  let pre: GlucoseReading | null = null;
  for (const r of readings) {
    if (r.timeMs > mealTimeMs || r.timeMs < mealTimeMs - PRE_MEAL_WINDOW_MS) continue;
    if (!pre || r.timeMs > pre.timeMs) pre = r;
  }

  let post: GlucoseReading | null = null;
  let bestDist = Infinity;
  for (const r of readings) {
    const delta = r.timeMs - mealTimeMs;
    if (delta < POST_MEAL_WINDOW_MS[0] || delta > POST_MEAL_WINDOW_MS[1]) continue;
    const dist = Math.abs(delta - POST_MEAL_TARGET_MS);
    if (dist < bestDist) { bestDist = dist; post = r; }
  }

  return { pre, post, deltaMmol: pre && post ? Math.round((post.mmol - pre.mmol) * 10) / 10 : null };
}

export interface GlucoseDayStats {
  avgMmol:        number | null;
  minMmol:        number | null;
  maxMmol:        number | null;
  timeInRangePct: number | null;
}

export function computeDayStats(
  readings: GlucoseReading[],
  target: { min: number; max: number } = DEFAULT_GLUCOSE_TARGET,
): GlucoseDayStats {
  if (readings.length === 0) return { avgMmol: null, minMmol: null, maxMmol: null, timeInRangePct: null };
  const values = readings.map((r) => r.mmol);
  const inRange = values.filter((v) => v >= target.min && v <= target.max).length;
  return {
    avgMmol:        Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10,
    minMmol:        Math.round(Math.min(...values) * 10) / 10,
    maxMmol:        Math.round(Math.max(...values) * 10) / 10,
    timeInRangePct: Math.round((inRange / values.length) * 100),
  };
}

/** Deduplique deux flux de lectures (ex. existant + nouvellement synchronise) par (timeMs, source). */
export function mergeReadings(existing: GlucoseReading[], incoming: GlucoseReading[]): GlucoseReading[] {
  const key = (r: GlucoseReading) => `${r.timeMs}:${r.source}`;
  const byKey = new Map(existing.map((r) => [key(r), r]));
  for (const r of incoming) byKey.set(key(r), r);
  return [...byKey.values()].sort((a, b) => a.timeMs - b.timeMs);
}

export const MEAL_RELATION_LABEL: Record<Exclude<GlucoseReading["mealRelation"], null>, string> = {
  none:         "",
  fasting:      "à jeun",
  before_meal:  "avant repas",
  after_meal:   "après repas",
};
