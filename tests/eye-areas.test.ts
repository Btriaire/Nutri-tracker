import { describe, it, expect } from "vitest";
import { circleStripArea, eyeAreas } from "../app/lib/eye-areas";

const R = 5.85; // rayon de l'iris en mm (diametre 11,7 mm)
const DISC = Math.PI * R * R;

describe("circleStripArea", () => {
  it("disque entier, moitie, quart", () => {
    expect(circleStripArea(R, -R, R)).toBeCloseTo(DISC, 6);
    expect(circleStripArea(R, 0, R)).toBeCloseTo(DISC / 2, 6);
    expect(circleStripArea(R, -R, 0)).toBeCloseTo(DISC / 2, 6);
    expect(circleStripArea(R, -100, 100)).toBeCloseTo(DISC, 6);          // bornes hors du disque : plafonnees
  });
  it("bande vide ou inversee : zero", () => {
    expect(circleStripArea(R, 2, 2)).toBe(0);
    expect(circleStripArea(R, 3, 1)).toBe(0);
    expect(circleStripArea(R, R, 50)).toBe(0);
  });
  it("valeur connue : bande [0, R/2] = R^2 * (asin(0.5) + 0.5*sqrt(0.75)) ", () => {
    const expected = R * R * (Math.asin(0.5) + 0.5 * Math.sqrt(0.75));
    expect(circleStripArea(R, 0, R / 2)).toBeCloseTo(expected, 6);
  });
  it("additive : [a,b] + [b,c] = [a,c]", () => {
    expect(circleStripArea(R, -3, 1) + circleStripArea(R, 1, 4)).toBeCloseTo(circleStripArea(R, -3, 4), 9);
  });
});

describe("eyeAreas", () => {
  const base = { irisPx: 80, pupilMm: 4, mrd1Mm: 4.5, mrd2Mm: 5.5, fissureWidthMm: 28 };
  it("surface de la pupille et rapport pupille / iris", () => {
    const a = eyeAreas(base);
    expect(a.pupilMm2!).toBeCloseTo(Math.PI * 4, 6);                      // pi * (4/2)^2
    expect(a.irisMm2).toBeCloseTo(DISC, 6);
    expect(a.pupilIrisAreaPct!).toBeCloseTo((100 * (4 / 11.7) ** 2), 4);
  });
  it("iris expose : disque moins les segments caches par les paupieres", () => {
    const a = eyeAreas(base);
    expect(a.irisExposedMm2).toBeCloseTo(circleStripArea(R, -5.5, 4.5), 6);
    expect(a.irisCoveredPct).toBeCloseTo(100 * (1 - circleStripArea(R, -5.5, 4.5) / DISC), 4);
    expect(a.irisExposedMm2).toBeLessThan(DISC);
  });
  it("paupieres tres ouvertes : iris entier visible, rien de cache", () => {
    const a = eyeAreas({ ...base, mrd1Mm: 9, mrd2Mm: 9 });
    expect(a.irisExposedMm2).toBeCloseTo(DISC, 6);
    expect(a.irisCoveredPct).toBeCloseTo(0, 6);
  });
  it("oeil ferme : tout est nul", () => {
    const a = eyeAreas({ ...base, mrd1Mm: 0, mrd2Mm: 0 });
    expect(a.irisExposedMm2).toBe(0);
    expect(a.apertureMm2).toBe(0);
    expect(a.scleraExposedMm2).toBe(0);
  });
  it("ouverture de la fente = 2/3 * largeur * (mrd1 + mrd2)", () => {
    const a = eyeAreas(base);
    expect(a.apertureMm2!).toBeCloseTo((2 / 3) * 28 * 10, 6);
  });
  it("blanc visible = ouverture - iris expose, jamais negatif", () => {
    const a = eyeAreas(base);
    expect(a.scleraExposedMm2!).toBeCloseTo((2 / 3) * 28 * 10 - a.irisExposedMm2, 6);
    const narrow = eyeAreas({ ...base, fissureWidthMm: 6 });
    expect(narrow.scleraExposedMm2!).toBe(0);
  });
  it("donnees manquantes : null et pas NaN", () => {
    const a = eyeAreas({ ...base, pupilMm: null, fissureWidthMm: undefined });
    expect(a.pupilMm2).toBeNull();
    expect(a.pupilIrisAreaPct).toBeNull();
    expect(a.apertureMm2).toBeNull();
    expect(a.scleraExposedMm2).toBeNull();
    expect(Number.isFinite(a.irisExposedMm2)).toBe(true);
  });
  it("valeurs negatives de paupieres traitees comme zero", () => {
    const a = eyeAreas({ ...base, mrd1Mm: -1, mrd2Mm: 5 });
    expect(a.irisExposedMm2).toBeCloseTo(circleStripArea(R, -5, 0), 6);
  });
});
