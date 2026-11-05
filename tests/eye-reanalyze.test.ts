import { describe, it, expect } from "vitest";
import { recenterEye, CROP, CROP_IRIS_D } from "../app/lib/eye-reanalyze";
import type { EyeSide } from "../app/lib/eye-metrics";

const R = CROP_IRIS_D / 2, PUPIL = 17;
/** Photo 320 px : sclere claire, iris brun de rayon R, pupille noire, centres en (cx, cy). */
const photo = (cx: number, cy: number) => (x: number, y: number): [number, number, number] => {
  const d = Math.hypot(x - cx, y - cy);
  return d > R ? [232, 232, 232] : d > PUPIL ? [110, 80, 50] : [12, 12, 12];
};
const side = (extra: Partial<EyeSide> = {}): EyeSide => ({
  irisPx: 80, pupilMm: 4.1, pupilContrast: 10, mrd1Mm: 5, mrd2Mm: 4.5, rednessA: 3, scleraB: 8, arcus: 1,
  irisCenter: { x: 500, y: 300 }, catchlight: { dxMm: 1, dyMm: -1 }, ...extra,
});

describe("recenterEye", () => {
  it("recentre sur l'iris reel et refait la pupille", () => {
    const tx = 160 + 8, ty = 160 - 5;                             // le vrai centre est decale de (8, -5) px
    const s = recenterEye(photo(tx, ty), side({ pupilMm: 2 }), { x: tx, y: ty })!;
    expect(s.pupilMm!).toBeCloseTo((2 * PUPIL * 11.7) / CROP_IRIS_D, 0);
    expect(s.manualCenter).toBe(true);
    expect(s.centerShift!.dx).toBeCloseTo(8 / CROP_IRIS_D, 2);
    expect(s.centerShift!.dy).toBeCloseTo(-5 / CROP_IRIS_D, 2);
    expect(s.pupilDecentrationMm!).toBeLessThan(0.3);
  });
  it("cumule avec le decalage deja applique (appris ou manuel)", () => {
    const s = recenterEye(photo(168, 160), side({ centerShift: { dx: 0.1, dy: 0.02 }, learnedCenter: true }), { x: 168, y: 160 })!;
    expect(s.centerShift!.dx).toBeCloseTo(0.1 + 8 / CROP_IRIS_D, 2);
    expect(s.learnedCenter).toBeUndefined();
  });
  it("deplace les paupieres : centre plus haut = paupiere haute plus proche, basse plus loin", () => {
    const s = recenterEye(photo(160, 150), side(), { x: 160, y: 150 })!;
    const mm = 11.7 / CROP_IRIS_D;
    expect(s.mrd1Mm).toBeCloseTo(5 - 10 * mm, 1);
    expect(s.mrd2Mm).toBeCloseTo(4.5 + 10 * mm, 1);
    expect(s.catchlight!.dyMm).toBeCloseTo(-1 + 10 * mm, 1);
  });
  it("refuse un toucher trop loin du centre", () => {
    expect(recenterEye(photo(160, 160), side(), { x: 160 + 0.4 * CROP_IRIS_D, y: 160 })).toBeNull();
    expect(recenterEye(photo(160, 160), side(), { x: NaN, y: 160 })).toBeNull();
    expect(CROP).toBe(320);
  });
});
