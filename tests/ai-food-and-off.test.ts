import { describe, it, expect } from "vitest";
import { aiScaleToGrams } from "../app/lib/ai-food";
import { offToResult } from "../app/lib/food-api";
import { enrichNutrition } from "../app/lib/nutrition-enrich";
import { calcTotals } from "../app/lib/nutrition";
import type { FoodEntry } from "../app/lib/types";

const per100 = { calories: 200, proteinG: 15, carbsG: 10, fatG: 8, fiberG: 2 };

describe("aiScaleToGrams", () => {
  it("met a l'echelle sodium et graisses saturees fournis par l'IA", () => {
    const n = aiScaleToGrams({ ...per100, sodiumMg: 400, saturatedFatG: 3 }, 150);
    expect(n.sodiumMg).toBe(600);
    expect(n.saturatedFatG).toBe(4.5);
  });

  it("ecarte les valeurs aberrantes au lieu de les enregistrer", () => {
    expect(aiScaleToGrams({ ...per100, saturatedFatG: 12 }, 100).saturatedFatG).toBeUndefined();   // plus que les lipides (8)
    expect(aiScaleToGrams({ ...per100, sodiumMg: 90_000 }, 100).sodiumMg).toBeUndefined();         // > sodium du sel pur
    expect(aiScaleToGrams({ ...per100, sodiumMg: -5 }, 100).sodiumMg).toBeUndefined();
    expect(aiScaleToGrams({ ...per100, sodiumMg: NaN }, 100).sodiumMg).toBeUndefined();
  });

  it("garde un 0 reel (aliment sans sodium) comme valeur connue", () => {
    expect(aiScaleToGrams({ ...per100, sodiumMg: 0 }, 100).sodiumMg).toBe(0);
  });

  it("sans valeur renvoyee, laisse les champs absents (le serveur les estimera)", () => {
    const n = aiScaleToGrams(per100, 100);
    expect("sodiumMg" in n).toBe(false);
    expect("saturatedFatG" in n).toBe(false);
  });
});

describe("offToResult (Open Food Facts)", () => {
  const off = (nutriments: Record<string, number>) => offToResult({ product_name: "Test", nutriments: { "energy-kcal_100g": 100, ...nutriments } })!;

  it("deduit le sodium du sel quand le produit n'affiche que le sel", () => {
    const r = off({ salt_100g: 1.5 });
    expect(r.nutrition.sodiumMg).toBe(600);          // 1,5 g de sel x 400
  });

  it("garde un zero reel : 0 g de graisses saturees n'est pas 'inconnu'", () => {
    const r = off({ "saturated-fat_100g": 0, sodium_100g: 0, salt_100g: 0 });
    expect(r.nutrition.saturatedFatG).toBe(0);
    expect(r.nutrition.sodiumMg).toBe(0);
  });

  it("convertit le sodium OFF (g) en mg et deduit le sel", () => {
    const r = off({ sodium_100g: 0.4 });
    expect(r.nutrition.sodiumMg).toBe(400);
    expect(r.nutrition.saltG).toBe(1);
  });
});

describe("enrichNutrition + totaux de la journee", () => {
  const entry = (name: string, grams: number, nutrition: FoodEntry["nutrition"]) =>
    ({ name, servingGrams: grams, nutrition } as unknown as FoodEntry);

  it("les totaux du jour comptent enfin les aliments estimes par IA (avant : 0 mg et 0 g)", () => {
    const raw = [
      entry("Pain", 60, { calories: 160, proteinG: 5, carbsG: 30, fatG: 1, fiberG: 2 }),
      entry("Jambon cuit", 50, { calories: 60, proteinG: 10, carbsG: 0, fatG: 2, fiberG: 0 }),
    ];
    const before = calcTotals(raw);
    expect(before.sodiumMg).toBe(0);

    const enriched = raw.map((e) => ({ ...e, nutrition: enrichNutrition(e.name, e.servingGrams, e.nutrition) }));
    const after = calcTotals(enriched);
    expect(after.sodiumMg).toBeGreaterThan(500);       // pain ~300 mg + jambon ~375 mg
    expect(after.saturatedFatG).toBeGreaterThan(0);
    expect(enriched[0].nutrition.estimated).toContain("sodiumMg");
  });

  it("ne marque pas comme estimee une conversion sel -> sodium exacte", () => {
    const n = enrichNutrition("produit x", 100, { calories: 1, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0, saltG: 1, saturatedFatG: 0 });
    expect(n.sodiumMg).toBe(400);
    expect(n.estimated).toBeUndefined();
  });
});
