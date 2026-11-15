import { describe, expect, it } from 'vitest';
import { datesBetween, planPeriod, dayPlanEntries, MAX_PERIOD_DAYS, ECART_KCAL, KCAL_PER_DRINK } from '@/app/lib/period-plan';
import { PERIOD_FOOD_PREFIX } from '@/app/lib/day-status';
import { DEFAULT_MEAL_SHARES } from '@/app/lib/meal-shares';

const baseParams = {
  from: '2026-11-02',
  to: '2026-11-15',
  kcal: 2000,
  quality: 'balanced' as const,
  ecartsPerWeek: 2,
  ecartType: 'repas' as const,
  ecartSize: 'gros' as const,
  drinksPerWeek: 6,
  activity: 'normale' as const,
  feeling: { energy: 3, mood: 3, sleep: 3 },
  note: 'vacances'
};

describe('period-plan', () => {
  describe('datesBetween', () => {
    it('returns 14 dates from 2026-11-02 to 2026-11-15', () => {
      const dates = datesBetween('2026-11-02', '2026-11-15');
      expect(dates).toHaveLength(14);
      expect(dates[0]).toBe('2026-11-02');
      expect(dates[13]).toBe('2026-11-15');
    });

    it('throws on 2026-11-15 to 2026-11-02', () => {
      expect(() => datesBetween('2026-11-15', '2026-11-02')).toThrow();
    });

    it('throws on a 100-day span', () => {
      expect(() => datesBetween('2026-01-01', '2026-04-15')).toThrow();
    });

    it('throws on bad format', () => {
      expect(() => datesBetween('2026/11/02', '2026-11-15')).toThrow();
    });
  });

  describe('planPeriod', () => {
    it('over the 14 days: 2 ecarts per week placed on the two Saturdays and two Fridays (2026-11-06, 07, 13, 14), all confirmed false, note copied', () => {
      const dates = datesBetween('2026-11-02', '2026-11-15');
      const plans = planPeriod(baseParams, dates);
      expect(plans).toHaveLength(14);
      expect(plans.filter(p => p.ecart !== null)).toHaveLength(4);
      expect(plans.find(p => p.date === '2026-11-06')?.ecart).toEqual({ type: 'repas', size: 'gros' });
      expect(plans.find(p => p.date === '2026-11-07')?.ecart).toEqual({ type: 'repas', size: 'gros' });
      expect(plans.find(p => p.date === '2026-11-13')?.ecart).toEqual({ type: 'repas', size: 'gros' });
      expect(plans.find(p => p.date === '2026-11-14')?.ecart).toEqual({ type: 'repas', size: 'gros' });
      expect(plans.every(p => p.confirmed === false)).toBe(true);
      expect(plans.every(p => p.note === 'vacances')).toBe(true);
    });

    it('drinks total 12 with max-min <= 1 between the days of each week and Fridays getting at least as many as Mondays', () => {
      const dates = datesBetween('2026-11-02', '2026-11-15');
      const plans = planPeriod(baseParams, dates);
      expect(plans.reduce((sum, p) => sum + p.drinks, 0)).toBe(12);
      const week1 = plans.slice(0, 7);
      const week2 = plans.slice(7, 14);
      expect(Math.max(...week1.map(p => p.drinks)) - Math.min(...week1.map(p => p.drinks))).toBeLessThanOrEqual(1);
      expect(Math.max(...week2.map(p => p.drinks)) - Math.min(...week2.map(p => p.drinks))).toBeLessThanOrEqual(1);
      expect(week1.find(p => p.date === '2026-11-07')?.drinks).toBeGreaterThanOrEqual(week1.find(p => p.date === '2026-11-02')?.drinks || 0);
      expect(week2.find(p => p.date === '2026-11-14')?.drinks).toBeGreaterThanOrEqual(week2.find(p => p.date === '2026-11-07')?.drinks || 0);
    });

    it('mixed quality alternates balanced/unbalanced', () => {
      const dates = datesBetween('2026-11-02', '2026-11-15');
      const plans = planPeriod({ ...baseParams, quality: 'mixed' as const }, dates);
      expect(plans[0].quality).toBe('balanced');
      expect(plans[1].quality).toBe('unbalanced');
      expect(plans[2].quality).toBe('balanced');
      expect(plans[3].quality).toBe('unbalanced');
    });

    it('a subset of 3 dates in one week with ecartsPerWeek 7 gives 3 ecarts', () => {
      const dates = ['2026-11-02', '2026-11-03', '2026-11-04'];
      const plans = planPeriod({ ...baseParams, ecartsPerWeek: 7 }, dates);
      expect(plans.filter(p => p.ecart !== null)).toHaveLength(3);
    });

    it('throws on kcal 900', () => {
      expect(() => planPeriod({ ...baseParams, kcal: 900 }, datesBetween('2026-11-02', '2026-11-15'))).toThrow();
    });

    it('throws on drinksPerWeek 50', () => {
      expect(() => planPeriod({ ...baseParams, drinksPerWeek: 50 }, datesBetween('2026-11-02', '2026-11-15'))).toThrow();
    });
  });

  describe('dayPlanEntries', () => {
    it('for a day with ecart gros repas and 2 drinks: every entry foodId equals PERIOD_FOOD_PREFIX + \'p1\', one entry named \'Écart estimé : repas copieux\' with 1000 calories on dinner, one \'Alcool estimé : 2 verres\' with alcoholG 20 and calories 140, and the template calories sum to 2000', () => {
      const plan = {
        date: '2026-11-06',
        kcal: 2000,
        quality: 'balanced' as const,
        ecart: { type: 'repas' as const, size: 'gros' as const },
        drinks: 2,
        feeling: { energy: 3, mood: 3, sleep: 3 },
        note: 'vacances',
        confirmed: false
      };
      const entries = dayPlanEntries(plan, 'p1');
      expect(entries.every(e => e.foodId === PERIOD_FOOD_PREFIX + 'p1')).toBe(true);
      const ecartEntry = entries.find(e => e.name === 'Écart estimé : repas copieux');
      expect(ecartEntry).toBeDefined();
      expect(ecartEntry?.meal).toBe('dinner');
      expect(ecartEntry?.nutrition.calories).toBe(1000);
      const drinkEntry = entries.find(e => e.name === 'Alcool estimé : 2 verres');
      expect(drinkEntry).toBeDefined();
      expect(drinkEntry?.nutrition.alcoholG).toBe(20);
      expect(drinkEntry?.nutrition.calories).toBe(140);
      const templateEntries = entries.filter(e => e.name !== 'Écart estimé : repas copieux' && e.name !== 'Alcool estimé : 2 verres');
      expect(templateEntries.reduce((sum, e) => sum + e.nutrition.calories, 0)).toBe(2000);
    });

    it('total calories = 3140', () => {
      const plan = {
        date: '2026-11-06',
        kcal: 2000,
        quality: 'balanced' as const,
        ecart: { type: 'repas' as const, size: 'gros' as const },
        drinks: 2,
        feeling: { energy: 3, mood: 3, sleep: 3 },
        note: 'vacances',
        confirmed: false
      };
      const entries = dayPlanEntries(plan, 'p1');
      expect(entries.reduce((sum, e) => sum + e.nutrition.calories, 0)).toBe(3140);
    });
  });
});

import { sanitizeDayPlan, sanitizePeriodParams } from "@/app/lib/period-plan";
describe("sanitize", () => {
  const plan = { date: "2026-11-07", kcal: 2200, quality: "balanced", ecart: { type: "apero", size: "moyen" }, drinks: 2, feeling: { energy: 3, mood: 4, sleep: 2 }, note: "x", confirmed: true };
  it("accepte un jour valide et retire les champs inconnus", () => {
    expect(sanitizeDayPlan({ ...plan, hack: 1 })).toEqual(plan);
  });
  it("refuse les jours invalides", () => {
    for (const bad of [null, { ...plan, date: "07/11/2026" }, { ...plan, kcal: 9000 }, { ...plan, quality: "mixed" }, { ...plan, ecart: { type: "x", size: "gros" } }, { ...plan, drinks: 2.5 }, { ...plan, feeling: { energy: 6, mood: 3, sleep: 3 } }, { ...plan, confirmed: "oui" }])
      expect(sanitizeDayPlan(bad)).toBeNull();
  });
  it("coupe une note trop longue", () => {
    expect(sanitizeDayPlan({ ...plan, note: "a".repeat(500) })!.note.length).toBe(300);
  });
  it("parametres de periode", () => {
    const p = { from: "2026-11-02", to: "2026-11-15", kcal: 2000, quality: "mixed", ecartsPerWeek: 2, ecartType: "repas", ecartSize: "gros", drinksPerWeek: 6, activity: "normale", feeling: { energy: 3, mood: 3, sleep: 3 }, note: "" };
    expect(sanitizePeriodParams(p)).toEqual(p);
    expect(sanitizePeriodParams({ ...p, to: "2027-06-01" })).toBeNull();
    expect(sanitizePeriodParams({ ...p, ecartsPerWeek: 9 })).toBeNull();
  });
});
