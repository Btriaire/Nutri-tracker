import { mealAnchors, analyzeMealGlucose, type MealGlucoseStatus } from "./glucose";
import type { FoodEntry, GlucoseReading, MealType } from "./types";

// Calculs de la vue globale (Progres > Glycemie) : modules purs, testes. Aucune interpretation medicale :
// ce sont des statistiques descriptives sur les lectures et les repas de l'utilisateur.

export const MG_DL_PER_MMOL = 18.016;
export const CURVE_OFFSETS = [0, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180];   // minutes apres le repas

const r1 = (v: number) => Math.round(v * 10) / 10;
const r2 = (v: number) => Math.round(v * 100) / 100;
const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;

export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return NaN;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

// ─── Vue d'ensemble ──────────────────────────────────────────────────────────

export interface Overview {
  readings: number;
  avgMmol: number | null;
  sdMmol: number | null;
  cvPct: number | null;        // coefficient de variation : < 36 % = glycemie stable (consensus CGM)
  gmiPct: number | null;       // GMI = 3,31 + 0,02392 x moyenne (mg/dL) : estimation, pas une HbA1c de laboratoire
}

export function overview(readings: GlucoseReading[]): Overview {
  if (readings.length === 0) return { readings: 0, avgMmol: null, sdMmol: null, cvPct: null, gmiPct: null };
  const v = readings.map((r) => r.mmol);
  const m = mean(v);
  const sd = Math.sqrt(mean(v.map((x) => (x - m) ** 2)));
  return {
    readings: v.length,
    avgMmol: r1(m),
    sdMmol: r1(sd),
    cvPct: Math.round((sd / m) * 100),
    gmiPct: r1(3.31 + 0.02392 * m * MG_DL_PER_MMOL),
  };
}

export interface RangeBreakdown { veryLow: number; low: number; inRange: number; high: number; veryHigh: number }   // pourcentages

/** Temps passe par tranche : tres bas < 3,0 ; bas ; dans la cible ; haut ; tres haut > 13,9 mmol/L (reperes du consensus CGM). */
export function rangeBreakdown(readings: GlucoseReading[], target: { min: number; max: number }): RangeBreakdown | null {
  if (readings.length === 0) return null;
  const veryLowCut = Math.min(3.0, target.min), veryHighCut = Math.max(13.9, target.max);
  const c = { veryLow: 0, low: 0, inRange: 0, high: 0, veryHigh: 0 };
  for (const { mmol } of readings) {
    if (mmol < veryLowCut) c.veryLow++;
    else if (mmol < target.min) c.low++;
    else if (mmol <= target.max) c.inRange++;
    else if (mmol <= veryHighCut) c.high++;
    else c.veryHigh++;
  }
  const n = readings.length;
  return { veryLow: r1((c.veryLow / n) * 100), low: r1((c.low / n) * 100), inRange: r1((c.inRange / n) * 100), high: r1((c.high / n) * 100), veryHigh: r1((c.veryHigh / n) * 100) };
}

// ─── Journee type (profil ambulatoire) ───────────────────────────────────────

export interface AgpPoint { hour: number; p10: number; p25: number; p50: number; p75: number; p90: number; n: number }

/** Mediane et bandes (10-90 %, 25-75 %) de la glycemie par tranche de 30 min de la journee, sur toute la periode.
 *  `tzOffsetMin` = minutes EST de UTC (Paris ete = 120). Un creneau a moins de 5 lectures n'est pas affiche. */
export function ambulatoryProfile(readings: GlucoseReading[], tzOffsetMin: number, binMinutes = 30): AgpPoint[] {
  const bins = new Map<number, number[]>();
  for (const r of readings) {
    const local = r.timeMs + tzOffsetMin * 60_000;
    const minuteOfDay = ((Math.floor(local / 60_000) % 1440) + 1440) % 1440;
    const b = Math.floor(minuteOfDay / binMinutes);
    (bins.get(b) ?? bins.set(b, []).get(b)!).push(r.mmol);
  }
  return [...bins.entries()]
    .filter(([, v]) => v.length >= 5)
    .sort((a, b) => a[0] - b[0])
    .map(([b, v]) => {
      const s = [...v].sort((x, y) => x - y);
      return { hour: (b * binMinutes) / 60, p10: r1(percentile(s, 0.1)), p25: r1(percentile(s, 0.25)), p50: r1(percentile(s, 0.5)), p75: r1(percentile(s, 0.75)), p90: r1(percentile(s, 0.9)), n: v.length };
    });
}

/** Heure locale moyenne d'un repas (heures decimales, de 4 a 28), pour poser les reperes verticaux sur la journee type. */
export function typicalHour(timesMs: number[], tzOffsetMin: number): number | null {
  if (timesMs.length === 0) return null;
  const mins = timesMs.map((t) => (((Math.floor((t + tzOffsetMin * 60_000) / 60_000) % 1440) + 1440) % 1440));
  // un diner apres minuit (00:30) ne doit pas ramener la moyenne a midi : on ramene les heures < 4 h a 24 h+
  const adj = mins.map((m) => (m < 240 ? m + 1440 : m));
  // Plage 4 h -> 28 h : minuit vaut 24 h (bord droit de la journee), pas 0 h (bord gauche).
  return r2(mean(adj) / 60);
}

// ─── Repas : lignes de donnees ───────────────────────────────────────────────

export interface MealRow {
  date:          string;
  meal:          MealType;
  timeMs:        number;
  status:        MealGlucoseStatus;
  carbsG:        number;
  fiberG:        number;
  fatG:          number;
  proteinG:      number;
  kcal:          number;
  pre:           number | null;
  peak:          number | null;
  post:          number | null;
  rise:          number | null;
  minutesToPeak: number | null;
  /** Ecart a la glycemie d'avant repas, aux decalages CURVE_OFFSETS (null = pas de lecture a ce moment). */
  curve:         (number | null)[];
}

function sliceByTime(sorted: GlucoseReading[], fromMs: number, toMs: number): GlucoseReading[] {
  let lo = 0, hi = sorted.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (sorted[mid].timeMs < fromMs) lo = mid + 1; else hi = mid; }
  const out: GlucoseReading[] = [];
  for (let i = lo; i < sorted.length && sorted[i].timeMs <= toMs; i++) out.push(sorted[i]);
  return out;
}

/** Une ligne par repas de la periode. `readings` = TOUTES les lectures de la periode, triees par heure. */
export function mealRows(
  readings: GlucoseReading[],
  logs: { date: string; entries?: FoodEntry[]; mealTimes?: Partial<Record<MealType, number>> }[],
): MealRow[] {
  const rows: MealRow[] = [];
  for (const log of logs) {
    const anchors = mealAnchors(log.entries ?? [], log.mealTimes);
    anchors.forEach((a, i) => {
      const near = sliceByTime(readings, a.timeMs - 60 * 60_000, a.timeMs + 4 * 3_600_000);
      const res = analyzeMealGlucose(near, a.timeMs, a.carbsG, anchors[i + 1]?.timeMs);
      const pre = res.pre?.mmol ?? null;
      const curve = CURVE_OFFSETS.map((off) => {
        if (pre === null) return null;
        const target = a.timeMs + off * 60_000;
        let best: GlucoseReading | null = null;
        for (const r of near) if (Math.abs(r.timeMs - target) <= 7.5 * 60_000 && (!best || Math.abs(r.timeMs - target) < Math.abs(best.timeMs - target))) best = r;
        // pas de lecture apres le repas suivant : la courbe de ce repas s'arrete la
        const end = anchors[i + 1]?.timeMs;
        if (end !== undefined && target > end) return null;
        return best ? r1(best.mmol - pre) : null;
      });
      rows.push({
        date: log.date, meal: a.meal, timeMs: a.timeMs, status: res.status,
        carbsG: Math.round(a.carbsG), fiberG: r1(a.fiberG), fatG: r1(a.fatG), proteinG: r1(a.proteinG), kcal: Math.round(a.kcal),
        pre, peak: res.peak?.mmol ?? null, post: res.post?.mmol ?? null, rise: res.riseMmol, minutesToPeak: res.minutesToPeak, curve,
      });
    });
  }
  return rows;
}

export interface MealStats {
  meal:        MealType;
  n:           number;                 // repas avec une reponse mesurable
  avgPre:      number | null;
  avgPeak:     number | null;
  avgPost:     number | null;
  avgRise:     number | null;
  avgMinutesToPeak: number | null;
  pctPeakInRange: number | null;       // % de repas dont le pic reste <= borne haute
}

export function mealStats(rows: MealRow[], meal: MealType, target: { min: number; max: number }): MealStats {
  const ok = rows.filter((r) => r.meal === meal && r.status !== "no-data" && r.pre !== null && r.peak !== null);
  const avg = (f: (r: MealRow) => number | null) => {
    const v = ok.map(f).filter((x): x is number => x !== null);
    return v.length ? r1(mean(v)) : null;
  };
  return {
    meal, n: ok.length,
    avgPre: avg((r) => r.pre), avgPeak: avg((r) => r.peak), avgPost: avg((r) => r.post), avgRise: avg((r) => r.rise),
    avgMinutesToPeak: ok.length ? Math.round(mean(ok.map((r) => r.minutesToPeak ?? 0))) : null,
    pctPeakInRange: ok.length ? Math.round((ok.filter((r) => (r.peak ?? 0) <= target.max).length / ok.length) * 100) : null,
  };
}

/** Courbe moyenne apres repas (ecart a l'avant-repas) ; un decalage a moins de 3 repas n'est pas affiche. */
export function meanCurve(rows: MealRow[]): { offset: number; mean: number | null; n: number }[] {
  return CURVE_OFFSETS.map((offset, i) => {
    const v = rows.map((r) => r.curve[i]).filter((x): x is number => x !== null);
    return { offset, mean: v.length >= 3 ? r1(mean(v)) : null, n: v.length };
  });
}

// ─── Impact des macronutriments ──────────────────────────────────────────────

export interface Fit { slope: number; intercept: number; r: number; n: number }

/** Droite des moindres carres y = slope x + intercept, avec la correlation r. Null sous 5 points ou sans variation en x. */
export function linearFit(points: { x: number; y: number }[]): Fit | null {
  const n = points.length;
  if (n < 5) return null;
  const mx = mean(points.map((p) => p.x)), my = mean(points.map((p) => p.y));
  let sxx = 0, syy = 0, sxy = 0;
  for (const p of points) { sxx += (p.x - mx) ** 2; syy += (p.y - my) ** 2; sxy += (p.x - mx) * (p.y - my); }
  if (sxx < 1e-9) return null;
  const slope = sxy / sxx;
  return { slope, intercept: my - slope * mx, r: syy < 1e-9 ? 0 : sxy / Math.sqrt(sxx * syy), n };
}

export type Macro = "carbs" | "fiber" | "fat";
const MACRO_VALUE: Record<Macro, (r: MealRow) => number> = { carbs: (r) => r.carbsG, fiber: (r) => r.fiberG, fat: (r) => r.fatG };

/** Repas exploitables pour l'impact des macros : hausse mesuree. */
export function measurable(rows: MealRow[]): MealRow[] {
  return rows.filter((r) => r.status !== "no-data" && r.rise !== null);
}

export function macroFit(rows: MealRow[], macro: Macro): Fit | null {
  return linearFit(measurable(rows).map((r) => ({ x: MACRO_VALUE[macro](r), y: r.rise as number })));
}

export interface IsolatedEffect { carbsPer10g: number; fiberPer5g: number; fatPer10g: number; n: number; r2: number }

/** Resout A x = b par elimination de Gauss avec pivot partiel. Null si le systeme est singulier. */
function solve(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-9) return null;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = c + 1; r < n; r++) {
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let s = M[i][n];
    for (let k = i + 1; k < n; k++) s -= M[i][k] * x[k];
    x[i] = s / M[i][i];
  }
  return x;
}

/**
 * Effet de chaque macro "toutes choses egales par ailleurs" : regression de la hausse sur glucides (par 10 g), fibres
 * (par 5 g) et lipides (par 10 g). Demande >= 15 repas ; sinon null (trop peu pour separer les trois effets).
 */
export function isolatedEffects(rows: MealRow[]): IsolatedEffect | null {
  const data = measurable(rows);
  if (data.length < 15) return null;
  const X = data.map((r) => [1, r.carbsG / 10, r.fiberG / 5, r.fatG / 10]);
  const y = data.map((r) => r.rise as number);
  const k = 4;
  const XtX = Array.from({ length: k }, (_, i) => Array.from({ length: k }, (_, j) => X.reduce((s, row) => s + row[i] * row[j], 0)));
  const Xty = Array.from({ length: k }, (_, i) => X.reduce((s, row, idx) => s + row[i] * y[idx], 0));
  const beta = solve(XtX, Xty);
  if (!beta) return null;
  const my = mean(y);
  const sst = y.reduce((s, v) => s + (v - my) ** 2, 0);
  const sse = X.reduce((s, row, idx) => s + (y[idx] - row.reduce((a, v, j) => a + v * beta[j], 0)) ** 2, 0);
  return { carbsPer10g: r2(beta[1]), fiberPer5g: r2(beta[2]), fatPer10g: r2(beta[3]), n: data.length, r2: sst < 1e-9 ? 0 : r2(1 - sse / sst) };
}

export interface SplitCompare { macro: Macro; threshold: number; lowAvg: number; highAvg: number; lowN: number; highN: number }

/** A glucides comparables (>= 20 g), hausse moyenne des repas sous / au-dessus de la mediane du macro. Null si < 8 repas. */
export function splitByMacro(rows: MealRow[], macro: Macro): SplitCompare | null {
  const data = measurable(rows).filter((r) => r.carbsG >= 20);
  if (data.length < 8) return null;
  const vals = data.map(MACRO_VALUE[macro]).sort((a, b) => a - b);
  const threshold = r1(percentile(vals, 0.5));
  const low = data.filter((r) => MACRO_VALUE[macro](r) < threshold);
  const high = data.filter((r) => MACRO_VALUE[macro](r) >= threshold);
  if (low.length < 3 || high.length < 3) return null;
  return { macro, threshold, lowAvg: r1(mean(low.map((r) => r.rise as number))), highAvg: r1(mean(high.map((r) => r.rise as number))), lowN: low.length, highN: high.length };
}

// ─── Reponse de /api/glucose/insights (partagee serveur / ecran) ─────────────

export interface InsightsResponse {
  enabled:       boolean;
  from:          string;
  to:            string;
  days:          number;
  target:        { min: number; max: number };
  daysWithData:  number;
  overview:      Overview;
  range:         RangeBreakdown | null;
  agp:           AgpPoint[];
  daily:         { date: string; avgMmol: number | null; minMmol: number | null; maxMmol: number | null; timeInRangePct: number | null }[];
  meals:         MealRow[];
  typicalHours:  Record<MealType, number | null>;
}
