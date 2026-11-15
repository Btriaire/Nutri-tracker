import { describe, it, expect } from "vitest";
import { DEFAULT_MEAL_SHARES, sanitizeMealShares, MEAL_SHARE_ORDER } from "@/app/lib/meal-shares";
import { dayTemplate } from "@/app/lib/day-template";

describe("meal-shares", () => {
  it("defaults sum to 100 and sanitize(DEFAULT) deep-equals DEFAULT", () => {
    const sum = Object.values(DEFAULT_MEAL_SHARES).reduce((a, b) => a + b, 0);
    expect(sum).toBe(100);
    expect(sanitizeMealShares(DEFAULT_MEAL_SHARES)).toEqual(DEFAULT_MEAL_SHARES);
  });

  it("sanitize removes an extra key 'foo' and returns the 5 keys", () => {
    const input = { ...DEFAULT_MEAL_SHARES, foo: 10 };
    const result = sanitizeMealShares(input);
    expect(result).toEqual(DEFAULT_MEAL_SHARES);
  });

  it("sanitize rejects: null, 'x', sum 99, a value 2.5, a value -5, missing dinner, a value '30'", () => {
    expect(sanitizeMealShares(null)).toBeNull();
    expect(sanitizeMealShares("x")).toBeNull();
    const sum99 = { ...DEFAULT_MEAL_SHARES, breakfast: 24 };
    expect(sanitizeMealShares(sum99)).toBeNull();
    const floatValue = { ...DEFAULT_MEAL_SHARES, breakfast: 2.5 };
    expect(sanitizeMealShares(floatValue)).toBeNull();
    const negativeValue = { ...DEFAULT_MEAL_SHARES, breakfast: -5 };
    expect(sanitizeMealShares(negativeValue)).toBeNull();
    const missingDinner = { breakfast: 25, morning_snack: 0, lunch: 35, snacks: 10 };
    expect(sanitizeMealShares(missingDinner)).toBeNull();
    const stringValue = { ...DEFAULT_MEAL_SHARES, breakfast: "30" };
    expect(sanitizeMealShares(stringValue)).toBeNull();
  });

  it("dayTemplate(2000,'balanced') without shares: meals ['breakfast','lunch','snacks','dinner'], calories [500,700,200,600]", () => {
    const result = dayTemplate(2000, "balanced");
    expect(result.map(e => e.meal)).toEqual(["breakfast", "lunch", "snacks", "dinner"]);
    expect(result.map(e => e.nutrition.calories)).toEqual([500, 700, 200, 600]);
  });

  it("custom shares {breakfast:0,morning_snack:10,lunch:50,snacks:0,dinner:40} with 2100 kcal: meals ['morning_snack','lunch','dinner'], calories [210,1050,840]", () => {
    const shares = { breakfast: 0, morning_snack: 10, lunch: 50, snacks: 0, dinner: 40 };
    const result = dayTemplate(2100, "balanced", shares);
    expect(result.map(e => e.meal)).toEqual(["morning_snack", "lunch", "dinner"]);
    expect(result.map(e => e.nutrition.calories)).toEqual([210, 1050, 840]);
  });

  it("shares {breakfast:33,morning_snack:0,lunch:33,snacks:0,dinner:34} with 1999 kcal: calories sum exactly 1999 and last meal is dinner", () => {
    const shares = { breakfast: 33, morning_snack: 0, lunch: 33, snacks: 0, dinner: 34 };
    const result = dayTemplate(1999, "balanced", shares);
    const sum = result.map(e => e.nutrition.calories).reduce((a, b) => a + b, 0);
    expect(sum).toBe(1999);
    expect(result.map(e => e.meal)[result.map(e => e.meal).length - 1]).toBe("dinner");
  });
});
