import { describe, it, expect } from "vitest";
import { calcTotals, pct, scaleNutrition, nutritionPer100gFromServing, calcBMR, calcTDEE } from "@/app/lib/nutrition";
import type { FoodNutrition } from "@/app/lib/types";
import { foodEntry } from "./fixtures";

const entry = (over: Partial<FoodNutrition>) =>
  foodEntry({ nutrition: { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0, ...over } });

describe("calcTotals", () => {
  it("additionne les macros de toutes les entrées", () => {
    const t = calcTotals([
      entry({ calories: 300, proteinG: 20, carbsG: 30, fatG: 10, fiberG: 4 }),
      entry({ calories: 200, proteinG: 10, carbsG: 25, fatG: 5,  fiberG: 3 }),
    ]);
    expect(t.calories).toBe(500);
    expect(t.proteinG).toBe(30);
    expect(t.fiberG).toBe(7);
  });

  it("traite les nutriments optionnels absents comme zéro, sans NaN", () => {
    const t = calcTotals([entry({ calories: 100 }), entry({ calories: 100, sugarG: 5, sodiumMg: 200 })]);
    expect(t.sugarG).toBe(5);
    expect(t.sodiumMg).toBe(200);
    expect(Number.isNaN(t.saturatedFatG!)).toBe(false);
  });

  it("renvoie des zéros sur une liste vide", () => {
    expect(calcTotals([]).calories).toBe(0);
  });
});

describe("pct", () => {
  it("calcule un pourcentage d'objectif", () => {
    expect(pct(50, 100)).toBe(50);
    expect(pct(150, 100)).toBe(150);
  });
  it("évite la division par zéro", () => {
    expect(pct(50, 0)).toBe(0);
  });
  it("plafonne les valeurs aberrantes à 999", () => {
    expect(pct(100_000, 10)).toBe(999);
  });
});

describe("scaleNutrition", () => {
  const per100g: FoodNutrition = { calories: 200, proteinG: 10, carbsG: 20, fatG: 8, fiberG: 4, sugarG: 6, sodiumMg: 300 };

  it("met à l'échelle selon le poids de la portion", () => {
    const s = scaleNutrition(per100g, 50);
    expect(s.calories).toBe(100);
    expect(s.proteinG).toBe(5);
    expect(s.sodiumMg).toBe(150);
  });

  it("laisse indéfinis les champs optionnels absents", () => {
    const s = scaleNutrition({ calories: 100, proteinG: 1, carbsG: 1, fatG: 1, fiberG: 1 }, 200);
    expect(s.sugarG).toBeUndefined();
  });

  it("fait l'aller-retour portion → 100g sans dériver", () => {
    const portion = scaleNutrition(per100g, 250);
    const retour  = nutritionPer100gFromServing(portion, 250);
    expect(retour.calories).toBeCloseTo(per100g.calories, 0);
    expect(retour.proteinG).toBeCloseTo(per100g.proteinG, 0);
  });
});

describe("calcBMR / calcTDEE", () => {
  // Référence Mifflin-St Jeor, homme 80 kg / 180 cm / 40 ans :
  // 10*80 + 6.25*180 - 5*40 + 5 = 1730
  it("applique la formule Mifflin-St Jeor", () => {
    expect(calcBMR(80, 180, 40, "male", "mifflin")).toBeCloseTo(1730, 0);
  });

  it("donne un métabolisme plus bas chez la femme à gabarit égal", () => {
    expect(calcBMR(80, 180, 40, "female")).toBeLessThan(calcBMR(80, 180, 40, "male"));
  });

  it("Katch-McArdle dépend de la masse maigre, donc du % de graisse", () => {
    const maigre = calcBMR(80, 180, 40, "male", "katch", 10);
    const gras   = calcBMR(80, 180, 40, "male", "katch", 30);
    expect(maigre).toBeGreaterThan(gras);
  });

  it("le TDEE croît avec le niveau d'activité", () => {
    const sedentaire = calcTDEE(80, 180, 40, "male", "sedentary");
    const actif      = calcTDEE(80, 180, 40, "male", "very_active");
    expect(actif).toBeGreaterThan(sedentaire);
    expect(sedentaire).toBeCloseTo(1730 * 1.2, 0);
  });
});
