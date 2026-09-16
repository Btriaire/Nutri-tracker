import { describe, it, expect } from "vitest";
import { computeQualityScore, qualityBand } from "@/app/lib/meal-quality";
import type { DayTotals, NutritionGoals } from "@/app/lib/types";
import { defaultGoals } from "@/app/lib/nutrition";

// Le score de qualité est affiché sur chaque repas et sur la journée : une
// régression ici est invisible (le badge affiche toujours un chiffre) mais
// fausse tout le retour donné à l'utilisateur.

const goals: NutritionGoals = { ...defaultGoals(), proteinGrams: 150, carbsGrams: 220, fatGrams: 65, fiberGrams: 30, dailyCalories: 2000 };

/** Repas calé sur la répartition macro cible, riche en fibres, sans excès. */
const repasIdeal: DayTotals = {
  calories: 2000, proteinG: 150, carbsG: 220, fatG: 65, fiberG: 30,
  sugarG: 30, sodiumMg: 1500, saturatedFatG: 12,
};

describe("computeQualityScore", () => {
  it("renvoie null quand il n'y a rien de significatif à noter", () => {
    expect(computeQualityScore({ calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 }, goals, 1)).toBeNull();
  });

  it("note haut un repas aligné sur l'objectif macro et riche en fibres", () => {
    const r = computeQualityScore(repasIdeal, goals, 1, ["salade", "lentilles", "pomme"])!;
    expect(r.score).toBeGreaterThanOrEqual(9);
    expect(r.breakdown.macro).toBeCloseTo(4, 1);
    expect(r.tips).toHaveLength(0);
  });

  it("pénalise une répartition macro éloignée de l'objectif", () => {
    // Tout en glucides : la cible est ~30% protéines / 44% glucides / 26% lipides.
    const toutGlucides: DayTotals = { ...repasIdeal, proteinG: 5, carbsG: 480, fatG: 5 };
    const r = computeQualityScore(toutGlucides, goals, 1)!;
    expect(r.breakdown.macro).toBeLessThan(2);
    expect(r.tips.join(" ")).toContain("Répartition");
  });

  it("pénalise un excès de sucre au-delà du repère", () => {
    const sucre = computeQualityScore({ ...repasIdeal, sugarG: 200 }, goals, 1)!;
    const normal = computeQualityScore(repasIdeal, goals, 1)!;
    expect(sucre.breakdown.sugar).toBeLessThan(normal.breakdown.sugar);
    expect(sucre.score).toBeLessThan(normal.score);
  });

  it("met les repères à l'échelle de la part réelle du repas dans la journée", () => {
    // Une collation = 20% des calories du jour. 10g de sucre y sont corrects,
    // alors que les mêmes 10g jugés sur le repère d'une journée entière le
    // seraient d'autant plus : le repère doit suivre la taille du repas.
    const collation: DayTotals = { calories: 400, proteinG: 30, carbsG: 44, fatG: 13, fiberG: 6, sugarG: 30, sodiumMg: 300, saturatedFatG: 2 };
    const commeJournee = computeQualityScore(collation, goals, 1)!;
    const commeCollation = computeQualityScore(collation, goals, 0.2)!;
    // À part réduite, le repère de sucre se resserre → note de sucre plus basse.
    expect(commeCollation.breakdown.sugar).toBeLessThan(commeJournee.breakdown.sugar);
  });

  it("récompense la présence de légumes / fruits / légumineuses", () => {
    const avec = computeQualityScore(repasIdeal, goals, 1, ["brocoli", "lentilles"])!;
    const sans = computeQualityScore(repasIdeal, goals, 1, ["pain blanc"])!;
    expect(avec.breakdown.diversity).toBeGreaterThan(sans.breakdown.diversity);
  });

  it("borne le score entre 0 et 10 même sur des valeurs absurdes", () => {
    const catastrophe = computeQualityScore(
      { calories: 5000, proteinG: 0, carbsG: 1200, fatG: 1, fiberG: 0, sugarG: 900, sodiumMg: 30000, saturatedFatG: 200 },
      goals, 1)!;
    expect(catastrophe.score).toBeGreaterThanOrEqual(0);
    expect(catastrophe.score).toBeLessThanOrEqual(10);
  });

  it("ne donne jamais plus de 2 conseils", () => {
    const mauvais = computeQualityScore(
      { calories: 2000, proteinG: 2, carbsG: 480, fatG: 5, fiberG: 0, sugarG: 400, sodiumMg: 9000, saturatedFatG: 90 },
      goals, 1)!;
    expect(mauvais.tips.length).toBeLessThanOrEqual(2);
  });
});

describe("qualityBand", () => {
  it("associe chaque score à sa tranche", () => {
    expect(qualityBand(9).label).toBe("Excellent");
    expect(qualityBand(7.5).label).toBe("Bon");
    expect(qualityBand(5).label).toBe("Correct");
    expect(qualityBand(3).label).toBe("À améliorer");
    expect(qualityBand(1).label).toBe("Déséquilibré");
  });
});
