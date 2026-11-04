import { describe, it, expect } from "vitest";
import { eggDayIndex, eggProgramStatus, eggPlanForDay } from "../app/lib/egg-diet";

describe("egg-diet", () => {
  describe("eggDayIndex", () => {
    it("should return the correct day index", () => {
      expect(eggDayIndex("2026-11-01", "2026-11-01")).toBe(0);
      expect(eggDayIndex("2026-11-01", "2026-11-04")).toBe(3);
      expect(eggDayIndex("2026-11-01", "2026-10-31")).toBe(-1);
      expect(eggDayIndex("2026-12-30", "2027-01-02")).toBe(3);
      expect(eggDayIndex("2026-03-28", "2026-03-30")).toBe(2);
    });
  });

  describe("eggProgramStatus", () => {
    const prefs = {
      startDate: "2026-11-01",
      days: 3,
      autoFill: true,
      filled: ["2026-11-02"]
    };

    it("should return the correct status for active days", () => {
      expect(eggProgramStatus(prefs, "2026-11-01")).toEqual({
        active: true,
        day: 1,
        total: 3,
        filled: false
      });
      expect(eggProgramStatus(prefs, "2026-11-03")).toEqual({
        active: true,
        day: 3,
        total: 3,
        filled: false
      });
    });

    it("should return the correct status for inactive days", () => {
      expect(eggProgramStatus(prefs, "2026-11-04")).toEqual({
        active: false,
        day: 0,
        total: 3,
        filled: false
      });
      expect(eggProgramStatus(prefs, "2026-10-31")).toEqual({
        active: false,
        day: 0,
        total: 3,
        filled: false
      });
    });

    it("should return the correct status for filled days", () => {
      expect(eggProgramStatus(prefs, "2026-11-02")).toEqual({
        active: true,
        day: 2,
        total: 3,
        filled: true
      });
    });

    it("should return inactive status for null prefs", () => {
      expect(eggProgramStatus(null, "2026-11-01")).toEqual({
        active: false,
        day: 0,
        total: 0,
        filled: false
      });
    });
  });

  describe("eggPlanForDay", () => {
    it("should include all meals with morning snack", () => {
      const plan = eggPlanForDay(0, { morningSnack: true });
      const total_kcal = plan.reduce((sum, entry) => sum + entry.nutrition.calories, 0);
      const total_proteins = plan.reduce((sum, entry) => sum + entry.nutrition.proteinG, 0);
      expect(plan.some(entry => entry.meal === "breakfast")).toBe(true);
      expect(plan.some(entry => entry.meal === "morning_snack")).toBe(true);
      expect(plan.some(entry => entry.meal === "lunch")).toBe(true);
      expect(plan.some(entry => entry.meal === "snacks")).toBe(true);
      expect(plan.some(entry => entry.meal === "dinner")).toBe(true);
      expect(total_kcal).toBeGreaterThanOrEqual(1100);
      expect(total_kcal).toBeLessThanOrEqual(1600);
      expect(total_proteins).toBeGreaterThanOrEqual(65);
    });

    it("should not include morning snack if not specified", () => {
      const plan = eggPlanForDay(1, {});
      expect(plan.some(entry => entry.meal === "morning_snack")).toBe(false);
    });

    it("should have the same meal names and quantities for different day indices", () => {
      const plan1 = eggPlanForDay(0, { morningSnack: true });
      const plan2 = eggPlanForDay(3, { morningSnack: true });
      expect(plan1.some(entry => entry.meal === "breakfast" && entry.name === plan2.find(e => e.meal === "breakfast")?.name)).toBe(true);
      expect(plan1.some(entry => entry.meal === "morning_snack" && entry.name === plan2.find(e => e.meal === "morning_snack")?.name)).toBe(true);
      expect(plan1.some(entry => entry.meal === "lunch" && entry.name === plan2.find(e => e.meal === "lunch")?.name)).toBe(true);
      expect(plan1.some(entry => entry.meal === "snacks" && entry.name === plan2.find(e => e.meal === "snacks")?.name)).toBe(true);
      expect(plan1.some(entry => entry.meal === "dinner" && entry.name === plan2.find(e => e.meal === "dinner")?.name)).toBe(true);
    });

    it("should have foodId starting with 'egg-diet:'", () => {
      const plan = eggPlanForDay(2, { morningSnack: true });
      expect(plan.every(entry => entry.foodId.startsWith("egg-diet:"))).toBe(true);
    });
  });
});
