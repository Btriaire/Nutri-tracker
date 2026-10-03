import { describe, it, expect } from "vitest";
import { groupMeasures, MEAS_TYPES, type MeasureGroup } from "../app/lib/withings-measures";

// 3 octobre 2026, 07:00 UTC
const T = Date.UTC(2026, 9, 3, 7, 0, 0) / 1000;
// Withings : valeur entiere + unite (puissance de 10)
const m = (type: number, value: number, unit: number) => ({ type, value, unit });

describe("groupMeasures", () => {
  it("lit masse grasse (8), graisse viscerale (170), masse osseuse (88) avec les bonnes unites", () => {
    const groups: MeasureGroup[] = [{
      date: T,
      measures: [m(1, 9312, -2), m(6, 294, -1), m(8, 2730, -2), m(76, 6251, -2), m(88, 330, -2), m(170, 11, 0)],
    }];
    const [d] = groupMeasures(groups);
    expect(d.date).toBe("2026-10-03");
    expect(d.weightKg).toBe(93.12);
    expect(d.bodyFatPct).toBe(29.4);
    expect(d.fatMassKg).toBe(27.3);     // et non plus le poids moins la masse grasse
    expect(d.muscleMassKg).toBe(62.51);
    expect(d.boneMassKg).toBe(3.3);
    expect(d.visceralFat).toBe(11);
  });

  it("convertit l'hydratation (kg d'eau) en pourcentage du poids de la meme pesee", () => {
    const [d] = groupMeasures([{ date: T, measures: [m(1, 8000, -2), m(77, 4400, -2)] }]); // 44 kg sur 80 kg
    expect(d.hydrationPct).toBe(55);
  });

  it("n'efface pas un champ deja connu quand un autre groupe du meme jour ne l'a pas", () => {
    const groups: MeasureGroup[] = [
      { date: T, measures: [m(1, 9312, -2), m(170, 11, 0)] },
      { date: T + 600, measures: [m(10, 128, 0), m(9, 82, 0)] },   // tensiometre, pas de poids
    ];
    const [d] = groupMeasures(groups);
    expect(d.visceralFat).toBe(11);
    expect(d.weightKg).toBe(93.12);
    expect(d.systolicBP).toBe(128);
    expect(d.diastolicBP).toBe(82);
  });

  it("laisse a null ce qui n'est pas mesure (balance sans graisse viscerale)", () => {
    const [d] = groupMeasures([{ date: T, measures: [m(1, 9312, -2)] }]);
    expect(d.visceralFat).toBeNull();
    expect(d.hydrationPct).toBeNull();
    expect(d.boneMassKg).toBeNull();
  });

  it("demande bien les codes corriges et plus les anciens", () => {
    const codes = MEAS_TYPES.split(",").map(Number);
    expect(codes).toContain(170);
    expect(codes).toContain(77);
    expect(codes).toContain(88);
    expect(codes).not.toContain(173);
    expect(codes).not.toContain(41);
    expect(codes).not.toContain(42);
  });
});
