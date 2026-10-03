import type { FoodEntry, GlucoseReading, MealType } from "@/app/lib/types";

// Plage "time in range" par defaut (3,9-10,0 mmol/L) : c'est le consensus international ATTD/CGM
// pour le suivi au quotidien, pas une prescription — l'utilisateur peut la regler dans Reglages.
export const DEFAULT_GLUCOSE_TARGET = { min: 3.9, max: 10.0 };

// Fenetres de recherche autour d'un repas : "avant" = derniere lecture connue dans les 60 min
// precedentes ; "post-prandial" = lecture la plus proche de +120 min, cherchee entre +90 et +180 min
// (CGM releve toutes les ~5 min, donc une fenetre large absorbe les trous de synchro).
const PRE_MEAL_WINDOW_MS = 60 * 60_000;
const POST_MEAL_TARGET_MS = 120 * 60_000;
const POST_MEAL_WINDOW_MS = [90 * 60_000, 180 * 60_000] as const;
export const MEAL_GRAPH_WINDOW_MS = [30 * 60_000, 150 * 60_000] as const;

export interface MealGlucoseMatch {
  pre:  GlucoseReading | null;
  post: GlucoseReading | null;
  /** post.mmol - pre.mmol, seulement si les deux existent. */
  deltaMmol: number | null;
}

/** Lectures à afficher autour d'un repas : 30 min avant jusqu'à 2 h 30 après. */
export function readingsAroundMeal(readings: GlucoseReading[], mealTimeMs: number): GlucoseReading[] {
  const from = mealTimeMs - MEAL_GRAPH_WINDOW_MS[0];
  const to = mealTimeMs + MEAL_GRAPH_WINDOW_MS[1];
  return readings.filter((r) => r.timeMs >= from && r.timeMs <= to).sort((a, b) => a.timeMs - b.timeMs);
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

// ─── Reponse glycemique d'un repas (lien journal <-> glycemie) ───────────────

const PEAK_WINDOW_MS = 180 * 60_000;

export interface MealGlucoseResponse {
  mealTimeMs:      number;
  pre:             GlucoseReading | null;
  post:            GlucoseReading | null;   // ~2 h apres
  peak:            GlucoseReading | null;   // maximum entre le repas et +3 h (ou le repas suivant)
  minutesToPeak:   number | null;
  riseMmol:        number | null;           // pic - avant, jamais negatif
  deltaMmol:       number | null;           // 2 h - avant
  carbsG:          number;
  risePer10gCarbs: number | null;           // hausse pour 10 g de glucides (repas >= 10 g seulement)
}

/** Heure d'un aliment loggue (le client recoit {seconds} ou {_seconds}). */
export function entryTimeMs(e: Pick<FoodEntry, "loggedAt">): number | null {
  const ts = e.loggedAt as unknown as { _seconds?: number; seconds?: number } | undefined;
  const sec = ts?._seconds ?? ts?.seconds;
  return sec ? sec * 1000 : null;
}

/**
 * Reponse glycemique d'UN repas. `windowEndMs` borne l'analyse (repas suivant) : une lecture qui suit
 * deja un autre repas ne doit pas etre attribuee a celui-ci. Renvoie null sans aucune lecture exploitable.
 */
export function analyzeMealGlucose(
  readings: GlucoseReading[],
  mealTimeMs: number,
  carbsG: number,
  windowEndMs: number = mealTimeMs + PEAK_WINDOW_MS,
): MealGlucoseResponse | null {
  const end = Math.min(windowEndMs, mealTimeMs + PEAK_WINDOW_MS);
  const usable = readings.filter((r) => r.timeMs <= end);
  const { pre, post, deltaMmol } = matchMealGlucose(usable, mealTimeMs);

  let peak: GlucoseReading | null = null;
  for (const r of usable) {
    if (r.timeMs < mealTimeMs) continue;
    if (!peak || r.mmol > peak.mmol) peak = r;
  }
  if (!pre && !post && !peak) return null;

  const riseMmol = pre && peak ? Math.max(0, Math.round((peak.mmol - pre.mmol) * 10) / 10) : null;
  return {
    mealTimeMs, pre, post, peak,
    minutesToPeak: peak ? Math.round((peak.timeMs - mealTimeMs) / 60_000) : null,
    riseMmol,
    deltaMmol,
    carbsG: Math.round(carbsG),
    risePer10gCarbs: riseMmol !== null && carbsG >= 10 ? Math.round((riseMmol / (carbsG / 10)) * 10) / 10 : null,
  };
}

/** Reponse de chaque repas du jour (heure = premier aliment du repas), chacun borne par le repas suivant. */
export function mealGlucoseResponses(
  entries: FoodEntry[],
  readings: GlucoseReading[],
): Partial<Record<MealType, MealGlucoseResponse>> {
  const meals = (["breakfast", "lunch", "snacks", "dinner"] as MealType[])
    .map((meal) => {
      const mine = entries.filter((e) => e.meal === meal);
      const times = mine.map(entryTimeMs).filter((t): t is number => t !== null);
      if (times.length === 0) return null;
      return { meal, timeMs: Math.min(...times), carbsG: mine.reduce((s, e) => s + (e.nutrition?.carbsG ?? 0), 0) };
    })
    .filter((m): m is NonNullable<typeof m> => m !== null)
    .sort((a, b) => a.timeMs - b.timeMs);

  const out: Partial<Record<MealType, MealGlucoseResponse>> = {};
  meals.forEach((m, i) => {
    const next = meals[i + 1]?.timeMs;
    const r = analyzeMealGlucose(readings, m.timeMs, m.carbsG, next);
    if (r) out[m.meal] = r;
  });
  return out;
}
