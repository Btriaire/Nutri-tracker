import { describe, it, expect } from "vitest";
import { sampleSclera } from "../app/lib/eye-sclera";
import { rgbToLab } from "../app/lib/face-metrics";

type RGB = [number, number, number];
const C = { x: 100, y: 100 }, R = 20, W = 260, H = 200;
const SCL: RGB = [232, 232, 232], SKIN: RGB = [200, 150, 130], IRIS: RGB = [110, 80, 50], LASH: RGB = [20, 20, 20], VESSEL: RGB = [230, 175, 175];
const corner = { x: 190, y: 100 };           // coin externe, 90 px a droite (4.5 R)

/** Oeil synthetique : iris au centre, blanc jusqu'a x=skinX, peau au-dela, avec options. */
function img(o: { skinX?: number; lashBand?: [number, number]; vessel?: boolean; specular?: boolean } = {}) {
  const skinX = o.skinX ?? 400;
  return (x: number, y: number): RGB => {
    if (Math.hypot(x - C.x, y - C.y) < R) return IRIS;
    if (x >= skinX) return SKIN;
    if (o.lashBand && x >= o.lashBand[0] && x <= o.lashBand[1]) return LASH;
    if (o.specular && Math.hypot(x - 135, y - 100) < 3) return [255, 255, 255];
    if (o.vessel && x > 130 && x < 150 && Math.abs(y - 100) < 3) return VESSEL;
    return SCL;
  };
}
const Ls = (l: [number, number, number][]) => l.map((v) => v[0]);

describe("sampleSclera", () => {
  it("blanc pur : beaucoup d'echantillons, couverture haute, clairs", () => {
    const r = sampleSclera(img(), C, R, corner, W, H);
    expect(r.lab.length).toBeGreaterThan(100);
    expect(r.coverage).toBeGreaterThan(0.95);
    expect([...Ls(r.lab)].sort((a, b) => a - b)[r.lab.length >> 1]).toBeGreaterThan(85);
  });
  it("exclut les cils (bande sombre)", () => {
    const r = sampleSclera(img({ lashBand: [140, 146] }), C, R, corner, W, H);
    expect(Math.min(...Ls(r.lab))).toBeGreaterThanOrEqual(45);
    expect(r.coverage).toBeLessThan(0.95);
    expect(r.lab.length).toBeGreaterThan(50);
  });
  it("s'arrete a la peau et n'en renvoie aucun pixel", () => {
    const withSkin = sampleSclera(img({ skinX: 140 }), C, R, corner, W, H);
    const all = sampleSclera(img(), C, R, corner, W, H);
    expect(withSkin.lab.length).toBeLessThan(all.lab.length);
    expect(withSkin.lab.length).toBeGreaterThan(20);
    expect(withSkin.lab.every(([, a, b]) => !(b >= 16 && a >= 8))).toBe(true);
  });
  it("garde les vaisseaux (a* eleve) mais pas le reflet speculaire", () => {
    const r = sampleSclera(img({ vessel: true, specular: true }), C, R, corner, W, H);
    expect(Math.max(...r.lab.map((v) => v[1]))).toBeGreaterThan(10);
    expect(Math.max(...Ls(r.lab))).toBeLessThanOrEqual(95);
  });
  it("coin trop proche de l'iris (moins de 1.4 R) : rien", () => {
    const r = sampleSclera(img(), C, R, { x: 120, y: 100 }, W, H);
    expect(r.lab).toEqual([]);
    expect(r.coverage).toBe(0);
  });
  it("ne sort pas de l'image et marche vers la gauche aussi", () => {
    const r = sampleSclera(img(), C, R, { x: 10, y: 100 }, W, H);
    expect(r.lab.length).toBeGreaterThan(100);
    const edge = sampleSclera(img(), { x: 100, y: 100 }, R, { x: 255, y: 100 }, 200, H);
    expect(edge.lab.length).toBeGreaterThan(0);
  });
  it("renvoie bien du CIELAB", () => {
    const r = sampleSclera(img(), C, R, corner, W, H);
    const ref = rgbToLab(SCL);
    expect(Math.abs(r.lab[0][0] - ref[0])).toBeLessThan(0.5);
  });
});
