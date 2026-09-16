// Estimation de la graisse viscerale (VAI) — extrait de BodyCompChart.tsx pour
// etre testable : c'est du calcul medical (formule d'Amato et al. 2010) qui
// etait enferme dans un composant de 900 lignes, donc impossible a verifier.
//
// Deux regimes : si le tour de taille / TG / HDL reels sont connus (mensurations
// + Blood Doctor) on les utilise, sinon on les estime a partir du % de graisse.
// Les drapeaux *Measured disent lequel, pour que l'UI puisse afficher "mesure"
// plutot que "estime".

import type { Gender } from "./types";
import type { LipidReading } from "./blood-doctor-source";

export interface VisceralsEstimate {
  vai: number | null;
  wc: number | null;
  tg: number | null;
  hdl: number | null;
  imc: number | null;
  wcMeasured: boolean;
  tgMeasured: boolean;
  hdlMeasured: boolean;
}

export interface RealVisceralInputs {
  wc?:  number | null; // tour de taille reel (mensurations), en cm
  tg?:  number | null; // triglycerides reels (Blood Doctor), en mg/dL
  hdl?: number | null; // HDL reel (Blood Doctor), en mg/dL
}

/** Dernier tour de taille connu (mensurations) a une date donnee ou avant — les mensurations
 *  sont saisies au mois, donc on prend la plus recente entree <= au mois du point. */
export function waistCmForDate(date: string, history: { month: string; waistCm: number | null }[]): number | null {
  const month = date.slice(0, 7);
  let best: number | null = null;
  for (const h of history) {
    if (h.waistCm != null && h.month <= month) best = h.waistCm;
  }
  return best;
}

/** Derniers TG/HDL connus (Blood Doctor) a une date donnee ou avant — `history` doit etre trie par date croissante. */
export function lipidsForDate(date: string, history: LipidReading[]): { tg: number | null; hdl: number | null } {
  let tg: number | null = null, hdl: number | null = null;
  for (const r of history) {
    if (r.date > date) break;
    if (r.tgMgDl != null)  tg  = r.tgMgDl;
    if (r.hdlMgDl != null) hdl = r.hdlMgDl;
  }
  return { tg, hdl };
}

export function estimateWaistCircumference(
  imb: number,
  bodyFatPct: number,
  age: number,
  gender: Gender | undefined
): number {
  // Simple regression-based estimation WC from IMC + %fat + age + sex
  if (gender === "male") {
    return Math.round((70 + 1.5 * imb + 0.2 * bodyFatPct + 0.05 * age) * 10) / 10;
  } else {
    return Math.round((65 + 1.2 * imb + 0.15 * bodyFatPct + 0.03 * age) * 10) / 10;
  }
}

export function estimateTriglycerides(
  bodyFatPct: number,
  age: number,
  gender: Gender | undefined
): number {
  // Estimate TG (mg/dL) from body fat % + age + sex
  if (gender === "male") {
    return Math.round(50 + 2 * bodyFatPct + 0.05 * age);
  } else {
    return Math.round(40 + 1.5 * bodyFatPct + 0.03 * age);
  }
}

export function estimateHDL(bodyFatPct: number, gender: Gender | undefined): number {
  // Estimate HDL (mg/dL) from body fat % — inverse correlation
  if (gender === "male") {
    return Math.round(60 - 0.3 * bodyFatPct);
  } else {
    return Math.round(70 - 0.2 * bodyFatPct);
  }
}

export function calculateVAI(
  wc: number,
  imc: number,
  tg: number,
  hdl: number,
  gender: Gender | undefined
): number {
  // VAI formula (Amato et al., 2010) — adapted for mg/dL units
  const genderCoef = gender === "male" ? { wc: 39.68, bmiFactor: 1.88, tgDiv: 1.03, hdlMult: 1.31 } :
                                          { wc: 36.58, bmiFactor: 1.89, tgDiv: 0.81, hdlMult: 1.52 };

  const numerator = (wc / (genderCoef.wc + genderCoef.bmiFactor * imc)) * (tg / genderCoef.tgDiv) * (genderCoef.hdlMult / hdl);
  return Math.round(numerator * 100) / 100;
}

export function calculateVisceralsForPoint(
  point: { bodyFatPct?: number | null },
  userAge: number | undefined,
  userGender: Gender | undefined,
  userHeightCm: number | undefined,
  userCurrentWeightKg: number | undefined,
  real?: RealVisceralInputs
): VisceralsEstimate {
  if (!point.bodyFatPct || !userHeightCm || !userCurrentWeightKg || !userGender) {
    return { vai: null, wc: null, tg: null, hdl: null, imc: null, wcMeasured: false, tgMeasured: false, hdlMeasured: false };
  }

  const heightM = userHeightCm / 100;
  const imc = Math.round((userCurrentWeightKg / (heightM * heightM)) * 10) / 10;

  const wcMeasured  = real?.wc  != null;
  const tgMeasured  = real?.tg  != null;
  const hdlMeasured = real?.hdl != null;

  const wc  = real?.wc  ?? estimateWaistCircumference(imc, point.bodyFatPct, userAge ?? 40, userGender);
  const tg  = real?.tg  ?? estimateTriglycerides(point.bodyFatPct, userAge ?? 40, userGender);
  const hdl = real?.hdl ?? estimateHDL(point.bodyFatPct, userGender);
  const vai = calculateVAI(wc, imc, tg, hdl, userGender);

  return { vai, wc, tg, hdl, imc, wcMeasured, tgMeasured, hdlMeasured };
}
