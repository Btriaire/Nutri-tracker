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
    it("should include only breakfast, lunch, and dinner", () => {
      const plan = eggPlanForDay(0, { morningSnack: true });
      expect(plan.some(entry => entry.meal === "breakfast")).toBe(true);
      expect(plan.some(entry => entry.meal === "morning_snack")).toBe(false);
      expect(plan.some(entry => entry.meal === "lunch")).toBe(true);
      expect(plan.some(entry => entry.meal === "snacks")).toBe(false);
      expect(plan.some(entry => entry.meal === "dinner")).toBe(true);
    });

    it("should have the same menu for all day indices", () => {
      const plan1 = eggPlanForDay(0, {});
      const plan2 = eggPlanForDay(1, {});
      const plan3 = eggPlanForDay(2, {});
      const plan4 = eggPlanForDay(5, {});
      expect(plan1).toEqual(plan2);
      expect(plan1).toEqual(plan3);
      expect(plan1).toEqual(plan4);
    });

    it("should have correct food quantities", () => {
      const plan = eggPlanForDay(0, {});
      const breakfast = plan.filter((e) => e.meal === 'breakfast' && e.foodId === 'egg-diet:blanc');
      const lunch = plan.filter((e) => e.meal === 'lunch' && e.foodId === 'egg-diet:blanc');
      const dinner = plan.filter((e) => e.meal === 'dinner' && e.foodId === 'egg-diet:blanc');
      expect(breakfast.every(entry => entry.servingQty === 3)).toBe(true);
      expect(lunch.every(entry => entry.servingQty === 3)).toBe(true);
      expect(dinner.every(entry => entry.servingQty === 3)).toBe(true);
    });

    it("should have total calories and proteins within specified ranges", () => {
      const plan = eggPlanForDay(0, {});
      const total_kcal = plan.reduce((sum, entry) => sum + entry.nutrition.calories, 0);
      const total_proteins = plan.reduce((sum, entry) => sum + entry.nutrition.proteinG, 0);
      expect(total_kcal).toBeGreaterThanOrEqual(440);
      expect(total_kcal).toBeLessThanOrEqual(490);
      expect(total_proteins).toBeGreaterThanOrEqual(60);
      expect(total_proteins).toBeLessThanOrEqual(70);
    });

    it("should have foodId starting with 'egg-diet:'", () => {
      const plan = eggPlanForDay(0, {});
      expect(plan.every(entry => entry.foodId.startsWith("egg-diet:"))).toBe(true);
    });
  });
});
