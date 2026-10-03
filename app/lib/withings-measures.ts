// Lecture des mesures Withings (getmeas) — module pur, sans acces reseau ni base, pour etre testable.
//
// Codes (meastype) verifies : page officielle Withings "Body Scan data points" pour la graisse
// viscerale (170), et la bibliotheque python_withings_api pour les autres (5 masse maigre, 8 masse
// grasse, 77 hydratation, 88 masse osseuse). Les anciens codes 41/42/173 ne renvoyaient rien :
// 173 est la masse maigre PAR SEGMENT, pas la graisse viscerale.
//
//   1 poids (kg)         6 % de graisse         8 MASSE GRASSE (kg)
//   9 diastolique        10 systolique          11 pouls
//  54 SpO2              71 temperature          76 masse musculaire (kg)
//  77 hydratation (kg d'eau, converti en %)     88 masse osseuse (kg)
// 170 indice de graisse viscerale (sans unite)
export const MEAS_TYPES = "1,6,8,9,10,11,54,71,76,77,88,170";

export interface MeasureGroup {
  date:     number;    // unix timestamp (s)
  measures: { value: number; type: number; unit: number }[];
}

export interface DayMeasure {
  date:          string;
  weightKg:      number | null;
  bodyFatPct:    number | null;
  bmi:           number | null;
  muscleMassKg:  number | null;
  fatMassKg:     number | null;
  boneMassKg:    number | null;
  hydrationPct:  number | null;
  visceralFat:   number | null;
  spO2Pct:       number | null;
  restingHR:     number | null;
  tempCelsius:   number | null;
  systolicBP:    number | null;
  diastolicBP:   number | null;
  measuredAt:    number | null; // unix ms
}

export function scaleMeas(value: number, unit: number): number {
  return value * Math.pow(10, unit);
}

const r1 = (v: number) => Math.round(v * 10) / 10;
const r2 = (v: number) => Math.round(v * 100) / 100;

function emptyDay(date: string, measuredAt: number): DayMeasure {
  return {
    date, weightKg: null, bodyFatPct: null, bmi: null, muscleMassKg: null, fatMassKg: null,
    boneMassKg: null, hydrationPct: null, visceralFat: null, spO2Pct: null, restingHR: null,
    tempCelsius: null, systolicBP: null, diastolicBP: null, measuredAt,
  };
}

/** Regroupe les mesures par jour. Un champ absent d'un groupe n'efface pas celui d'un autre groupe du meme jour. */
export function groupMeasures(groups: MeasureGroup[]): DayMeasure[] {
  const byDate: Record<string, DayMeasure> = {};
  for (const grp of groups) {
    const date = new Date(grp.date * 1000).toISOString().slice(0, 10);
    const day = (byDate[date] ??= emptyDay(date, grp.date * 1000));

    const v: Record<number, number> = {};
    for (const m of grp.measures) v[m.type] = scaleMeas(m.value, m.unit);

    if (v[1]   != null) day.weightKg     = r2(v[1]);
    if (v[6]   != null) day.bodyFatPct   = r1(v[6]);
    if (v[8]   != null) day.fatMassKg    = r2(v[8]);
    if (v[9]   != null) day.diastolicBP  = Math.round(v[9]);
    if (v[10]  != null) day.systolicBP   = Math.round(v[10]);
    if (v[11]  != null) day.restingHR    = Math.round(v[11]);
    if (v[54]  != null) day.spO2Pct      = r1(v[54]);
    if (v[71]  != null) day.tempCelsius  = r1(v[71]);
    if (v[76]  != null) day.muscleMassKg = r2(v[76]);
    if (v[88]  != null) day.boneMassKg   = r2(v[88]);
    if (v[170] != null) day.visceralFat  = r1(v[170]);
    // Withings donne l'hydratation en kg d'eau : on la ramene en % du poids de la meme pesee.
    const weightForWater = v[1] ?? day.weightKg;
    if (v[77] != null && weightForWater) day.hydrationPct = r1((v[77] / weightForWater) * 100);
  }
  return Object.values(byDate);
}
