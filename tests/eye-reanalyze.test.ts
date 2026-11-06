import { describe, it, expect } from "vitest";
import { recenterEye, requantifyCrop, CROP, CROP_IRIS_D, REQUANT_VERSION } from "../app/lib/eye-reanalyze";
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

describe("requantifyCrop", () => {
  const eye = (cx: number, cy: number, r: number, pupil: number) => (x: number, y: number): [number, number, number] => {
    const d = Math.hypot(x - cx, y - cy);
    return d > r ? [232, 232, 232] : d > pupil ? [110, 80, 50] : [12, 12, 12];
  };
  it("corrige l'echelle quand l'iris reel est plus petit que suppose, et le centre", () => {
    const r = 48;                                                 // 10 % de moins que 53,3
    const q = requantifyCrop(eye(163, 158, r, 16), side({ pupilMm: 2, fissureWidthMm: 30 }));
    expect(Math.abs(q.irisR - r)).toBeLessThan(1.5);
    expect(Math.hypot(q.center.x - 163, q.center.y - 158)).toBeLessThan(1.5);
    expect(q.side.pupilMm!).toBeCloseTo((16 / r) * 11.7, 0);
    expect(q.side.irisPx).toBeLessThan(80);
    expect(q.side.fissureWidthMm!).toBeGreaterThan(30);
    expect(q.side.requantV).toBe(REQUANT_VERSION);
  });
  it("ne deplace jamais un centre choisi a la main", () => {
    const q = requantifyCrop(eye(165, 160, CROP_IRIS_D / 2, 16), side({ manualCenter: true }));
    expect(q.center).toEqual({ x: 160, y: 160 });
  });
  it("sans bord d'iris lisible, garde l'echelle et les valeurs", () => {
    const q = requantifyCrop(() => [120, 120, 120], side());
    expect(q.irisR).toBeCloseTo(CROP_IRIS_D / 2, 5);
    expect(q.side.pupilMm).toBe(4.1);
    expect(q.side.mrd1Mm).toBeCloseTo(5, 1);
  });
});
