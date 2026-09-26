import { describe, it, expect } from "vitest";
import { computeCurrentStreak } from "../app/lib/streak";

const days = (s: string) => s.split("").map((c) => c === "x"); // index 0 = aujourd'hui

describe("computeCurrentStreak", () => {
  it("compte les jours consecutifs", () => {
    expect(computeCurrentStreak(days("xxxx.."))).toEqual({ currentStreak: 4, restDaysUsed: 0 });
  });
  it("ignore aujourd'hui s'il est vide", () => {
    expect(computeCurrentStreak(days(".xxx.."))).toEqual({ currentStreak: 3, restDaysUsed: 0 });
  });
  it("un jour de repos isole ne casse pas la serie", () => {
    expect(computeCurrentStreak(days("xx.xxx."))).toEqual({ currentStreak: 5, restDaysUsed: 1 });
  });
  it("deux jours vides d'affilee cassent la serie", () => {
    expect(computeCurrentStreak(days("xx..xxx"))).toEqual({ currentStreak: 2, restDaysUsed: 0 });
  });
  it("un seul repos par fenetre de 7 jours", () => {
    expect(computeCurrentStreak(days("xx.xx.xxx"))).toEqual({ currentStreak: 4, restDaysUsed: 1 });
    expect(computeCurrentStreak(days("xx.xx.xxxxxx.xx"))).toEqual({ currentStreak: 4, restDaysUsed: 1 });
  });
  it("aujourd'hui vide puis hier vide casse la serie", () => {
    expect(computeCurrentStreak(days("..xxx"))).toEqual({ currentStreak: 0, restDaysUsed: 0 });
  });
  it("un repos en bout de serie n'est pas compte", () => {
    expect(computeCurrentStreak(days("xxx."))).toEqual({ currentStreak: 3, restDaysUsed: 0 });
  });
});
