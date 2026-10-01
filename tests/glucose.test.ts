import { describe, it, expect } from "vitest";
import { matchMealGlucose, computeDayStats, mergeReadings, DEFAULT_GLUCOSE_TARGET } from "../app/lib/glucose";
import type { GlucoseReading } from "../app/lib/types";

const r = (minutesFromMidnight: number, mmol: number): GlucoseReading => ({
  timeMs: minutesFromMidnight * 60_000,
  mmol,
  mealRelation: null,
  mealType: null,
  source: "google_fit",
});

describe("matchMealGlucose", () => {
  it("prend la derniere lecture avant le repas et celle la plus proche de +2h apres", () => {
    const readings = [r(420, 5.1), r(475, 5.3), r(540, 8.9), r(600, 7.2), r(660, 6.0)];
    const m = matchMealGlucose(readings, 480 * 60_000); // repas a 8h00
    expect(m.pre?.mmol).toBe(5.3);   // 7h55, la plus recente <= 8h00
    expect(m.post?.mmol).toBe(7.2);  // 10h00, exactement +120min
    expect(m.deltaMmol).toBe(1.9);
  });

  it("ignore une lecture avant trop ancienne (> 60 min)", () => {
    const readings = [r(0, 10)]; // 2h avant un repas a 2h
    const m = matchMealGlucose(readings, 120 * 60_000);
    expect(m.pre).toBeNull();
  });

  it("renvoie pre/post null et pas de delta quand rien n'est dans les fenetres", () => {
    const m = matchMealGlucose([], 480 * 60_000);
    expect(m).toEqual({ pre: null, post: null, deltaMmol: null });
  });
});

describe("computeDayStats", () => {
  it("calcule moyenne/min/max et le temps dans la cible", () => {
    const readings = [r(0, 4.0), r(5, 9.0), r(10, 11.0), r(15, 6.0)];
    const s = computeDayStats(readings, DEFAULT_GLUCOSE_TARGET);
    expect(s.avgMmol).toBe(7.5);
    expect(s.minMmol).toBe(4.0);
    expect(s.maxMmol).toBe(11.0);
    expect(s.timeInRangePct).toBe(75); // 3 sur 4 dans [3.9, 10.0]
  });

  it("renvoie des nulls sur un jour vide", () => {
    expect(computeDayStats([])).toEqual({ avgMmol: null, minMmol: null, maxMmol: null, timeInRangePct: null });
  });
});

describe("mergeReadings", () => {
  it("deduplique par horodatage+source et trie par le temps", () => {
    const existing = [r(10, 5.0), r(5, 4.5)];
    const incoming = [r(10, 5.2), r(15, 6.0)]; // 10 remplace l'existant (meme cle)
    const merged = mergeReadings(existing, incoming);
    expect(merged.map((x) => x.timeMs)).toEqual([300000, 600000, 900000]);
    expect(merged.find((x) => x.timeMs === 600000)?.mmol).toBe(5.2);
  });
});
