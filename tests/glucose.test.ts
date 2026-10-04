import { describe, it, expect } from "vitest";
import { matchMealGlucose, computeDayStats, mergeReadings, analyzeMealGlucose, mealGlucoseResponses, mealAnchors, mealTimeFromInput, entryTimeMs, DEFAULT_GLUCOSE_TARGET } from "../app/lib/glucose";
import type { FoodEntry, GlucoseReading } from "../app/lib/types";

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

describe("analyzeMealGlucose", () => {
  // repas a 12:00 (720 min)
  const day = [r(700, 5.2), r(715, 5.4), r(745, 8.8), r(765, 9.6), r(800, 8.1), r(840, 7.0), r(890, 6.2)];

  it("trouve avant, pic, 2 h, hausse et delai du pic", () => {
    const a = analyzeMealGlucose(day, 720 * 60_000, 60)!;
    expect(a.pre?.mmol).toBe(5.4);
    expect(a.peak?.mmol).toBe(9.6);
    expect(a.minutesToPeak).toBe(45);
    expect(a.riseMmol).toBe(4.2);
    expect(a.post?.mmol).toBe(7.0);          // 14:00 exactement
    expect(a.deltaMmol).toBe(1.6);
    expect(a.risePer10gCarbs).toBe(0.7);     // 4,2 mmol pour 60 g
  });

  it("ne calcule pas de ratio pour un repas de moins de 10 g de glucides", () => {
    expect(analyzeMealGlucose(day, 720 * 60_000, 6)!.risePer10gCarbs).toBeNull();
  });

  it("borne l'analyse au repas suivant : un pic apres un autre repas ne lui est pas attribue", () => {
    const next = 780 * 60_000;                // collation a 13:00
    const a = analyzeMealGlucose(day, 720 * 60_000, 60, next)!;
    expect(a.peak?.mmol).toBe(9.6);           // 12:45, avant la collation
    expect(a.post).toBeNull();                // la lecture a +2 h suit deja la collation
  });

  it("la hausse n'est jamais negative", () => {
    const a = analyzeMealGlucose([r(715, 9.0), r(730, 8.0), r(840, 7.5)], 720 * 60_000, 40)!;
    expect(a.riseMmol).toBe(0);
  });

  it("dit explicitement quand aucune lecture n'entoure le repas (status no-data)", () => {
    const a = analyzeMealGlucose([r(0, 5)], 720 * 60_000, 40);
    expect(a.status).toBe("no-data");
    expect(a.peak).toBeNull();
    expect(a.lastReadingMs).toBe(0);
  });

  it("repas recent : lectures arretees avant la fin des 2 h = reponse en cours (status pending)", () => {
    // repas 12:00, derniere lecture 13:10 -> la lecture a +2 h n'existe pas encore
    const a = analyzeMealGlucose([r(700, 5.2), r(715, 5.4), r(745, 8.8), r(790, 7.9)], 720 * 60_000, 60);
    expect(a.status).toBe("pending");
    expect(a.peak?.mmol).toBe(8.8);
    expect(a.post).toBeNull();
    expect(a.lastReadingMs).toBe(790 * 60_000);
  });

  it("un repas suivi d'un autre repas n'est jamais 'pending' : sa fenetre est bornee, pas incomplete", () => {
    const a = analyzeMealGlucose([r(715, 5.4), r(745, 8.8), r(770, 7.9)], 720 * 60_000, 60, 780 * 60_000);
    expect(a.status).toBe("ok");
  });
});

describe("mealGlucoseResponses", () => {
  const entry = (meal: FoodEntry["meal"], minute: number, carbs: number) =>
    ({ meal, loggedAt: { seconds: minute * 60 }, nutrition: { carbsG: carbs } }) as unknown as FoodEntry;

  it("associe chaque repas a sa reponse, borne par le suivant", () => {
    const readings = [r(470, 5.0), r(480, 5.1), r(520, 8.0), r(600, 6.0), r(715, 5.3), r(745, 9.0), r(840, 6.5)];
    const out = mealGlucoseResponses([entry("lunch", 720, 70), entry("breakfast", 480, 40), entry("breakfast", 485, 10)], readings);
    expect(out.breakfast?.carbsG).toBe(50);
    expect(out.breakfast?.peak?.mmol).toBe(8.0);
    expect(out.lunch?.pre?.mmol).toBe(5.3);
    expect(out.lunch?.peak?.mmol).toBe(9.0);
    expect(out.dinner).toBeUndefined();
  });

  it("une heure de repas saisie remplace l'heure de saisie des aliments", () => {
    const readings = [r(1190, 5.0), r(1200, 5.1), r(1250, 8.5), r(1320, 6.6)];   // dîner réel 20:00 (1200 min)
    // les aliments ont été saisis à 22:30 (1350 min) : sans correction, ni "avant" ni "pic" ne sont trouvés
    const loggedLate = [entry("dinner", 1350, 60)];
    expect(mealGlucoseResponses(loggedLate, readings).dinner?.peak).toBeNull();
    const fixed = mealGlucoseResponses(loggedLate, readings, { dinner: 1200 * 60_000 });
    expect(fixed.dinner?.pre?.mmol).toBe(5.1);
    expect(fixed.dinner?.peak?.mmol).toBe(8.5);
    expect(fixed.dinner?.status).toBe("ok");
  });

  it("mealAnchors : heure retenue, macros cumulees, repas tries par heure", () => {
    const e = (meal: FoodEntry["meal"], minute: number, n: { carbsG: number; fiberG: number; fatG: number }) =>
      ({ meal, loggedAt: { seconds: minute * 60 }, nutrition: { ...n, proteinG: 10, calories: 200 } }) as unknown as FoodEntry;
    const a = mealAnchors(
      [e("dinner", 1200, { carbsG: 50, fiberG: 6, fatG: 20 }), e("breakfast", 480, { carbsG: 30, fiberG: 3, fatG: 5 }), e("breakfast", 490, { carbsG: 10, fiberG: 1, fatG: 2 })],
      { dinner: 1230 * 60_000 },
    );
    expect(a.map((x) => x.meal)).toEqual(["breakfast", "dinner"]);
    expect(a[0]).toMatchObject({ carbsG: 40, fiberG: 4, fatG: 7, proteinG: 20, kcal: 400, overridden: false });
    expect(a[1]).toMatchObject({ timeMs: 1230 * 60_000, overridden: true });
  });

  it("mealTimeFromInput : heure locale ; dîner/collation entre 00:00 et 03:59 = le lendemain", () => {
    const base = new Date("2026-10-03T12:30:00").getTime();
    expect(mealTimeFromInput("2026-10-03", "12:30", "lunch")).toBe(base);
    const late = mealTimeFromInput("2026-10-03", "00:30", "dinner")!;
    expect(new Date(late).getDate()).toBe(4);
    expect(new Date(mealTimeFromInput("2026-10-03", "00:30", "breakfast")!).getDate()).toBe(3);
    expect(mealTimeFromInput("2026-10-03", "25:00", "lunch")).toBeNull();
    expect(mealTimeFromInput("2026-10-03", "midi", "lunch")).toBeNull();
  });

  it("entryTimeMs accepte seconds et _seconds", () => {
    expect(entryTimeMs({ loggedAt: { seconds: 10 } } as unknown as FoodEntry)).toBe(10000);
    expect(entryTimeMs({ loggedAt: { _seconds: 10 } } as unknown as FoodEntry)).toBe(10000);
    expect(entryTimeMs({} as unknown as FoodEntry)).toBeNull();
  });
});
