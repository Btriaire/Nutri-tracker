import { describe, it, expect } from "vitest";
import { glcmFeatures, cellAt } from "../app/lib/eye-iris-glcm";

const grid = (f: (i: number, j: number) => number, nR = 20, nA = 120) => Array.from({ length: nR }, (_, i) => Array.from({ length: nA }, (_, j) => f(i, j)));
let s = 3; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;

describe("glcmFeatures (Haralick)", () => {
  it("iris uni : contraste 0, homogeneite et energie 1, entropie 0", () => {
    const g = glcmFeatures(grid(() => 0))!;
    expect(g.contrast).toBe(0); expect(g.homogeneity).toBe(1); expect(g.energy).toBe(1); expect(g.entropy).toBe(0);
  });
  it("detail aleatoire : contraste et entropie montent, homogeneite baisse", () => {
    const g = glcmFeatures(grid(() => (rnd() - 0.5) * 20))!;
    expect(g.correlation).toBeGreaterThanOrEqual(-1); expect(g.correlation).toBeLessThanOrEqual(1);
    expect(g.contrast).toBeGreaterThan(5); expect(g.entropy).toBeGreaterThan(3); expect(g.homogeneity).toBeLessThan(0.5);
  });
  it("stries radiaires : contraste le long du cercle >> le long du rayon", () => {
    const g = glcmFeatures(grid((i, j) => (j % 4 < 2 ? 6 : -6)))!;
    expect(g.contrastAngular).toBeGreaterThan(10 * Math.max(0.01, g.contrastRadial));
    expect(g.anisotropy).toBeGreaterThan(0.8);
  });
  it("anneaux : anisotropie negative ; motif regulier : correlation forte", () => {
    const g = glcmFeatures(grid((i) => (i % 4 < 2 ? 6 : -6)))!;
    expect(g.anisotropy).toBeLessThan(-0.8);
    const sm = glcmFeatures(grid((i, j) => 8 * Math.sin(j / 6)))!;
    expect(sm.correlation).toBeGreaterThan(0.8);
    expect(sm.correlation).toBeLessThanOrEqual(1);
  });
  it("ignore les cases illisibles ; null si trop peu de paires", () => {
    expect(glcmFeatures(grid((i, j) => (j % 2 ? NaN : 1)))).toBeNull();
    const g = glcmFeatures(grid((i, j) => (j < 10 ? NaN : 0)))!;
    expect(g.contrast).toBe(0);
  });
});

describe("cellAt", () => {
  const m = { r0: 20, r1: 40, nR: 10, nA: 230 };
  it("retrouve la case d'un pixel de la zone analysee", () => {
    // angle 90 degres (bas de la photo, y vers le bas), rayon 30 -> ligne 5, colonne 115
    expect(cellAt(m, { x: 100, y: 130 }, { x: 100, y: 100 })).toEqual([5, 115]);
    expect(cellAt(m, { x: 130, y: 100 }, { x: 100, y: 100 })).toEqual([5, 25]);
  });
  it("hors anneau ou hors secteur : null", () => {
    expect(cellAt(m, { x: 100, y: 110 }, { x: 100, y: 100 })).toBeNull();
    expect(cellAt(m, { x: 100, y: 70 }, { x: 100, y: 100 })).toBeNull();
    expect(cellAt(m, { x: 100, y: 145 }, { x: 100, y: 100 })).toBeNull();
  });
});
