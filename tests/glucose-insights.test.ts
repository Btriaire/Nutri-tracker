import { describe, it, expect } from "vitest";
import {
  percentile, overview, rangeBreakdown, ambulatoryProfile, typicalHour, mealRows, mealStats, meanCurve,
  linearFit, macroFit, isolatedEffects, splitByMacro, CURVE_OFFSETS, type MealRow,
} from "../app/lib/glucose-insights";
import type { FoodEntry, GlucoseReading } from "../app/lib/types";

const r = (ms: number, mmol: number): GlucoseReading => ({ timeMs: ms, mmol, mealRelation: null, mealType: null, source: "google_fit" });
const MIN = 60_000;

describe("overview", () => {
  it("moyenne, ecart-type, coefficient de variation et GMI", () => {
    const o = overview([r(0, 5), r(1, 7), r(2, 9)]);
    expect(o.avgMmol).toBe(7);
    expect(o.sdMmol).toBe(1.6);
    expect(o.cvPct).toBe(23);
    expect(o.gmiPct).toBe(6.3);          // 3,31 + 0,02392 x (7 x 18,016 = 126,1 mg/dL)
  });
  it("vide : tout est null", () => {
    expect(overview([]).avgMmol).toBeNull();
  });
});

describe("rangeBreakdown", () => {
  it("repartit les lectures par tranche (tres bas, bas, cible, haut, tres haut)", () => {
    const readings = [2.5, 3.5, 5, 6, 8, 11, 15, 5].map((v, i) => r(i, v));
    expect(rangeBreakdown(readings, { min: 3.9, max: 10 })).toEqual({ veryLow: 12.5, low: 12.5, inRange: 50, high: 12.5, veryHigh: 12.5 });
  });
  it("sans lecture : null", () => expect(rangeBreakdown([], { min: 3.9, max: 10 })).toBeNull());
});

describe("ambulatoryProfile", () => {
  it("regroupe par creneau de 30 min en heure locale et calcule la mediane", () => {
    // 12:00 locale (UTC+2) = 10:00 UTC ; 6 lectures dans le creneau 12:00-12:30
    const day = Date.UTC(2026, 9, 3, 10, 0, 0);
    const readings = [5, 6, 7, 8, 9, 10].map((v, i) => r(day + i * 4 * MIN, v));
    const agp = ambulatoryProfile(readings, 120);
    expect(agp).toHaveLength(1);
    expect(agp[0].hour).toBe(12);
    expect(agp[0].p50).toBe(7.5);
    expect(agp[0].n).toBe(6);
  });
  it("ignore un creneau a moins de 5 lectures", () => {
    expect(ambulatoryProfile([r(0, 5), r(1, 6)], 0)).toEqual([]);
  });
});

describe("typicalHour", () => {
  it("heure moyenne locale ; un diner apres minuit ne ramene pas la moyenne a midi", () => {
    const at = (h: number, m = 0) => Date.UTC(2026, 9, 3, h, m) - 2 * 3_600_000; // heure locale UTC+2 -> UTC
    expect(typicalHour([at(12), at(14)], 120)).toBe(13);
    expect(typicalHour([at(23, 30), at(24, 30)], 120)).toBe(24);   // 23:30 et 00:30 -> 24:00
    expect(typicalHour([], 120)).toBeNull();
  });
});

describe("mealRows / mealStats / meanCurve", () => {
  const day = Date.UTC(2026, 9, 3, 0, 0, 0);
  const at = (min: number) => day + min * MIN;
  // dejeuner 12:00 (720 min) : 5,0 avant, monte a 9,0 a +45, 7,0 a +2 h
  const readings: GlucoseReading[] = [];
  for (let m = 660; m <= 960; m += 5) {
    const dt = m - 720;
    readings.push(r(at(m), dt < 0 ? 5.0 : Math.round((5 + 4 * (dt / 45) * Math.exp(1 - dt / 45)) * 10) / 10));
  }
  const entry = (meal: FoodEntry["meal"], min: number, n: { carbsG: number; fiberG: number; fatG: number }) =>
    ({ meal, loggedAt: { seconds: at(min) / 1000 }, nutrition: { ...n, proteinG: 20, calories: 500 } }) as unknown as FoodEntry;

  it("une ligne par repas avec avant, pic, hausse, delai et courbe", () => {
    const rows = mealRows(readings, [{ date: "2026-10-03", entries: [entry("lunch", 720, { carbsG: 60, fiberG: 6, fatG: 15 })] }]);
    expect(rows).toHaveLength(1);
    const x = rows[0];
    expect(x.status).toBe("ok");
    expect(x.pre).toBe(5);
    expect(x.peak).toBeGreaterThan(8.5);
    expect(x.minutesToPeak).toBeGreaterThanOrEqual(35);   // plateau du pic entre 40 et 50 min
    expect(x.minutesToPeak).toBeLessThanOrEqual(50);
    expect(x.curve).toHaveLength(CURVE_OFFSETS.length);
    expect(x.curve[0]).toBe(0);
    expect(x.curve[3]).toBeGreaterThan(3);        // +45 min : pres du pic
    expect(x.curve[12]).toBeLessThan(x.curve[3] as number);
    expect(x.carbsG).toBe(60);
  });

  it("l'heure corrigee remplace l'heure de saisie", () => {
    const rows = mealRows(readings, [{ date: "2026-10-03", entries: [entry("lunch", 900, { carbsG: 60, fiberG: 6, fatG: 15 })], mealTimes: { lunch: at(720) } }]);
    expect(rows[0].timeMs).toBe(at(720));
    expect(rows[0].pre).toBe(5);
  });

  it("stats par repas : moyennes et part de repas dont le pic reste dans la cible", () => {
    const rows = mealRows(readings, [{ date: "2026-10-03", entries: [entry("lunch", 720, { carbsG: 60, fiberG: 6, fatG: 15 })] }]);
    const s = mealStats(rows, "lunch", { min: 3.9, max: 10 });
    expect(s.n).toBe(1);
    expect(s.avgPre).toBe(5);
    expect(s.pctPeakInRange).toBe(100);
    expect(mealStats(rows, "dinner", { min: 3.9, max: 10 }).n).toBe(0);
  });

  it("courbe moyenne : masquee sous 3 repas", () => {
    const rows = mealRows(readings, [{ date: "2026-10-03", entries: [entry("lunch", 720, { carbsG: 60, fiberG: 6, fatG: 15 })] }]);
    expect(meanCurve(rows).every((p) => p.mean === null)).toBe(true);
    const three = [rows[0], rows[0], rows[0]];
    expect(meanCurve(three)[0]).toMatchObject({ offset: 0, mean: 0, n: 3 });
  });
});

describe("linearFit", () => {
  it("retrouve une droite parfaite", () => {
    const f = linearFit([1, 2, 3, 4, 5, 6].map((x) => ({ x, y: 2 * x + 1 })))!;
    expect(f.slope).toBeCloseTo(2);
    expect(f.intercept).toBeCloseTo(1);
    expect(f.r).toBeCloseTo(1);
  });
  it("null sous 5 points ou sans variation", () => {
    expect(linearFit([{ x: 1, y: 1 }, { x: 2, y: 2 }])).toBeNull();
    expect(linearFit([1, 2, 3, 4, 5].map((y) => ({ x: 3, y })))).toBeNull();
  });
});

function row(i: number, carbsG: number, fiberG: number, fatG: number, rise: number): MealRow {
  return { date: `d${i}`, meal: "lunch", timeMs: i, status: "ok", carbsG, fiberG, fatG, proteinG: 20, kcal: 500, pre: 5, peak: 5 + rise, post: 6, rise, minutesToPeak: 40, curve: [] };
}

describe("isolatedEffects", () => {
  it("retrouve l'effet de chaque macro sur des donnees construites (hausse = 0,5 par 10 g glucides, -0,4 par 5 g fibres, +0,1 par 10 g lipides)", () => {
    const rows: MealRow[] = [];
    let i = 0;
    for (const c of [20, 40, 60, 80]) for (const f of [2, 6, 10]) for (const l of [5, 15, 30]) {
      rows.push(row(i++, c, f, l, 1 + 0.5 * (c / 10) - 0.4 * (f / 5) + 0.1 * (l / 10)));
    }
    const e = isolatedEffects(rows)!;
    expect(e.carbsPer10g).toBeCloseTo(0.5, 1);
    expect(e.fiberPer5g).toBeCloseTo(-0.4, 1);
    expect(e.fatPer10g).toBeCloseTo(0.1, 1);
    expect(e.r2).toBeGreaterThan(0.99);
  });
  it("null sous 15 repas ou si les macros ne varient pas independamment", () => {
    expect(isolatedEffects([row(0, 40, 5, 10, 2), row(1, 50, 5, 10, 3)])).toBeNull();
    const collinear = Array.from({ length: 20 }, (_, i) => row(i, 10 + i, 10 + i, 10 + i, 2 + i * 0.1));
    expect(isolatedEffects(collinear)).toBeNull();
  });
});

describe("splitByMacro / macroFit", () => {
  it("a glucides comparables, les repas riches en fibres montent moins", () => {
    const rows = [
      ...[1, 2, 3, 4].map((i) => row(i, 50, 2, 10, 4.0 + i * 0.05)),
      ...[5, 6, 7, 8].map((i) => row(i, 50, 12, 10, 2.0 + i * 0.05)),
    ];
    const s = splitByMacro(rows, "fiber")!;
    expect(s.lowAvg).toBeGreaterThan(s.highAvg + 1.5);
    expect(s.lowN).toBe(4);
    expect(s.highN).toBe(4);
  });
  it("macroFit : pente de la hausse selon les glucides", () => {
    const rows = [1, 2, 3, 4, 5, 6].map((i) => row(i, i * 10, 5, 10, i * 0.5));
    expect(macroFit(rows, "carbs")!.slope).toBeCloseTo(0.05);
  });
  it("percentile interpole", () => expect(percentile([1, 2, 3, 4], 0.5)).toBe(2.5));
});
