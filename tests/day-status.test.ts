import { describe, expect, it } from "vitest";
import { isEstimatedEntry, dayStatus, monthGrid, PERIOD_FOOD_PREFIX } from "@/app/lib/day-status";
import { TEMPLATE_FOOD_ID } from "@/app/lib/day-template";
import type { MealType } from "@/app/lib/types";

const e = (meal: MealType, kcal: number, foodId = "x") => ({
  meal,
  foodId,
  nutrition: {
    calories: kcal,
    proteinG: 0,
    carbsG: 0,
    fatG: 0,
    fiberG: 0,
  },
});

describe("isEstimatedEntry", () => {
  it("returns true for template id", () => {
    expect(isEstimatedEntry({ foodId: TEMPLATE_FOOD_ID })).toBe(true);
  });

  it("returns true for period id", () => {
    expect(isEstimatedEntry({ foodId: `${PERIOD_FOOD_PREFIX}abc` })).toBe(true);
  });

  it("returns false for ordinary id", () => {
    expect(isEstimatedEntry({ foodId: "x" })).toBe(false);
  });
});

describe("dayStatus", () => {
  it("returns vide for no entries", () => {
    expect(dayStatus([], 2000)).toBe("vide");
  });

  it("returns estime with template entry", () => {
    expect(dayStatus([e("breakfast", 500, TEMPLATE_FOOD_ID)], 2000)).toBe("estime");
  });

  it("returns estime when mixed real + periode entry", () => {
    expect(dayStatus([e("breakfast", 500), e("lunch", 500, `${PERIOD_FOOD_PREFIX}abc`)], 2000)).toBe("estime");
  });

  it("returns partiel with one meal of 1500 kcal and goal 2000", () => {
    expect(dayStatus([e("breakfast", 1500)], 2000)).toBe("partiel");
  });

  it("returns partiel with two meals totalling 800 and goal 2000", () => {
    expect(dayStatus([e("breakfast", 400), e("lunch", 400)], 2000)).toBe("partiel");
  });

  it("returns complet with breakfast 500 + lunch 900 + dinner 700 goal 2000", () => {
    expect(dayStatus([e("breakfast", 500), e("lunch", 900), e("dinner", 700)], 2000)).toBe("complet");
  });

  it("returns complet with goal 0 with two meals of 100 kcal", () => {
    expect(dayStatus([e("breakfast", 100), e("lunch", 100)], 0)).toBe("complet");
  });
});

describe("monthGrid", () => {
  it("returns correct grid for November 2026", () => {
    const grid = monthGrid(2026, 11);
    expect(grid.length % 7).toBe(0);
    expect(grid.slice(0, 6)).toEqual([null, null, null, null, null, null]);
    expect(grid[6]).toBe("2026-11-01");
    expect(grid).toContain("2026-11-30");
    expect(grid.length).toBe(42);
  });

  it("returns correct grid for February 2026", () => {
    const grid = monthGrid(2026, 2);
    expect(grid.filter((date) => date !== null).length).toBe(28);
  });
});
