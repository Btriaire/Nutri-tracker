import { describe, it, expect } from "vitest";
import { dayTemplate, TEMPLATE_FOOD_ID } from "@/app/lib/day-template";

const sum = (es: ReturnType<typeof dayTemplate>, k: "calories" | "proteinG" | "carbsG" | "fatG" | "fiberG" | "sugarG" | "saturatedFatG" | "sodiumMg") =>
  es.reduce((s, e) => s + (e.nutrition[k] ?? 0), 0);

describe("dayTemplate", () => {
  it("repartit les calories sur 4 repas et retombe sur le total", () => {
    const es = dayTemplate(2000, "balanced");
    expect(es.map((e) => e.meal)).toEqual(["breakfast", "lunch", "snacks", "dinner"]);
    expect(Math.abs(sum(es, "calories") - 2000)).toBeLessThanOrEqual(2);
    expect(es[1].nutrition.calories).toBeGreaterThan(es[0].nutrition.calories);
  });
  it("macros coherentes avec les calories (4/4/9 kcal par gramme)", () => {
    for (const q of ["balanced", "unbalanced"] as const) {
      const es = dayTemplate(2500, q);
      const kcal = 4 * sum(es, "proteinG") + 4 * sum(es, "carbsG") + 9 * sum(es, "fatG");
      expect(Math.abs(kcal - 2500) / 2500).toBeLessThan(0.03);
    }
  });
  it("journee desequilibree : moins de fibres et de proteines, plus de sucre, de gras sature et de sel", () => {
    const b = dayTemplate(2000, "balanced"), u = dayTemplate(2000, "unbalanced");
    expect(sum(u, "fiberG")).toBeLessThan(sum(b, "fiberG"));
    expect(sum(u, "proteinG")).toBeLessThan(sum(b, "proteinG"));
    expect(sum(u, "sugarG")).toBeGreaterThan(sum(b, "sugarG"));
    expect(sum(u, "saturatedFatG")).toBeGreaterThan(sum(b, "saturatedFatG"));
    expect(sum(u, "sodiumMg")).toBeGreaterThan(sum(b, "sodiumMg"));
    expect(sum(b, "fiberG")).toBeGreaterThanOrEqual(25);
  });
  it("chaque entree est marquee comme estimation, avec un libelle clair", () => {
    for (const e of dayTemplate(1500, "unbalanced")) {
      expect(e.foodId).toBe(TEMPLATE_FOOD_ID);
      expect(e.source).toBe("custom");
      expect(e.name).toMatch(/Journée type/);
      expect(e.name).toMatch(/déséquilibrée/);
      expect(e.notes).toMatch(/estimation/i);
      expect(e.servingQty).toBe(1);
    }
  });
  it("refuse des calories hors limites", () => {
    expect(() => dayTemplate(500, "balanced")).toThrow();
    expect(() => dayTemplate(6000, "balanced")).toThrow();
    expect(() => dayTemplate(NaN, "balanced")).toThrow();
  });
});
