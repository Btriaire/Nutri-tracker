import type { DayTotals, NutritionGoals } from "./types";
import { inferFoodCategory } from "./food-substitution";

export interface QualityBreakdown {
  macro:      number; // 0-4   — répartition P/G/L vs l'objectif de l'utilisateur
  fiber:      number; // 0-1.5 — fibres vs objectif proportionnel
  sugar:      number; // 0-1.5 — pénalité si excès de sucre
  sodium:     number; // 0-1   — pénalité si excès de sodium
  satFat:     number; // 0-1   — pénalité si excès de graisses saturées
  diversity:  number; // 0-1   — présence de légumes/fruits/légumineuses
}

export interface QualityScore {
  score:     number; // 0-10, arrondi à 0.5 près
  label:     string;
  color:     string;
  breakdown: QualityBreakdown;
  tips:      string[]; // 0-2 conseils courts sur les points les plus faibles
}

const BANDS: { min: number; label: string; color: string }[] = [
  { min: 8.5, label: "Excellent",     color: "#22c55e" },
  { min: 7,   label: "Bon",           color: "#34d399" },
  { min: 5,   label: "Correct",       color: "#fbbf24" },
  { min: 3,   label: "À améliorer",   color: "#fb923c" },
  { min: 0,   label: "Déséquilibré",  color: "#f87171" },
];

export function qualityBand(score: number): { label: string; color: string } {
  const band = BANDS.find(b => score >= b.min) ?? BANDS[BANDS.length - 1];
  return { label: band.label, color: band.color };
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * Score de qualité nutritionnelle 0-10, calculable pour un repas (shareOfDay =
 * part réelle des calories du repas dans l'objectif quotidien) ou pour la
 * journée entière (shareOfDay = 1). Les repères sucre/sodium/graisses sat. et
 * fibres sont mis à l'échelle par shareOfDay : un repas qui représente 40% des
 * calories du jour a droit à 40% de la limite/objectif quotidien — pas un
 * repère fixe par type de repas, qui pénaliserait injustement le jeûne
 * intermittent ou des habitudes de repas atypiques.
 *
 * La répartition macro est comparée à l'objectif PERSONNEL de l'utilisateur
 * (déduit de ses grammages cibles protéines/glucides/lipides), pas à une
 * norme générique — c'est ce qui rend le score "en fonction de l'objectif".
 */
export function computeQualityScore(
  totals: DayTotals,
  goals:  NutritionGoals,
  shareOfDay: number,
  entryNames: string[] = [],
): QualityScore | null {
  const actualKcal = totals.proteinG * 4 + totals.carbsG * 4 + totals.fatG * 9;
  if (actualKcal < 20) return null; // repas vide / quasi rien loggé — pas de score pertinent

  const share = clamp(shareOfDay, 0.03, 1);

  // ── Macro balance (4 pts) — vs la répartition cible de l'utilisateur ──────
  const targetKcal = (goals.proteinGrams * 4) + (goals.carbsGrams * 4) + (goals.fatGrams * 9);
  let macro = 4;
  if (targetKcal > 0) {
    const targetP = (goals.proteinGrams * 4) / targetKcal;
    const targetC = (goals.carbsGrams   * 4) / targetKcal;
    const targetF = (goals.fatGrams     * 9) / targetKcal;
    const actualP = (totals.proteinG * 4) / actualKcal;
    const actualC = (totals.carbsG   * 4) / actualKcal;
    const actualF = (totals.fatG     * 9) / actualKcal;
    const distance = Math.abs(targetP - actualP) + Math.abs(targetC - actualC) + Math.abs(targetF - actualF);
    macro = clamp(4 * (1 - distance / 0.9), 0, 4);
  }

  // ── Fibres (1.5 pts) ───────────────────────────────────────────────────────
  const fiberTarget = (goals.fiberGrams || 30) * share;
  const fiber = fiberTarget > 0 ? clamp(1.5 * (totals.fiberG / fiberTarget), 0, 1.5) : 1.5;

  // ── Sucre / sodium / graisses saturées (pénalité au-delà du repère) ───────
  const penaltyScore = (actual: number | undefined, limitFull: number, max: number) => {
    const limit = limitFull * share;
    if (limit <= 0 || !actual) return max;
    const excessRatio = actual > limit ? (actual - limit) / limit : 0;
    return clamp(max * (1 - excessRatio), 0, max);
  };
  const sugar  = penaltyScore(totals.sugarG,        goals.sugarGrams        ?? 50,   1.5);
  const sodium = penaltyScore(totals.sodiumMg,      goals.sodiumMg          ?? 2300, 1);
  const satFat = penaltyScore(totals.saturatedFatG, goals.saturatedFatGrams ?? 20,   1);

  // ── Diversité alimentaire (1 pt) — légumes/fruits/légumineuses présents ──
  const goodCategories = new Set(["legume", "fruit", "legumineuses"]);
  const goodCount = new Set(entryNames.map(inferFoodCategory).filter(c => goodCategories.has(c))).size;
  const diversity = goodCount >= 2 ? 1 : goodCount === 1 ? 0.7 : 0.4;

  const breakdown: QualityBreakdown = { macro, fiber, sugar, sodium, satFat, diversity };
  const score = Math.round((macro + fiber + sugar + sodium + satFat + diversity) * 2) / 2;
  const band = qualityBand(score);

  const tips: string[] = [];
  const weak = Object.entries(breakdown)
    .map(([key, val]) => ({ key, ratio: val / { macro: 4, fiber: 1.5, sugar: 1.5, sodium: 1, satFat: 1, diversity: 1 }[key as keyof QualityBreakdown] }))
    .sort((a, b) => a.ratio - b.ratio);
  const TIP_TEXT: Record<keyof QualityBreakdown, string> = {
    macro:     "Répartition protéines/glucides/lipides éloignée de ton objectif",
    fiber:     "Manque de fibres — ajoute légumes, légumineuses ou céréales complètes",
    sugar:     "Apport en sucre élevé pour ce que ça représente",
    sodium:    "Apport en sodium élevé pour ce que ça représente",
    satFat:    "Trop de graisses saturées pour ce que ça représente",
    diversity: "Peu de légumes/fruits/légumineuses dans ce repas",
  };
  for (const { key, ratio } of weak) {
    if (ratio < 0.6 && tips.length < 2) tips.push(TIP_TEXT[key as keyof QualityBreakdown]);
  }

  return { score, label: band.label, color: band.color, breakdown, tips };
}
