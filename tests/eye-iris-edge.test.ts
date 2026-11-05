import { describe, it, expect } from "vitest";
import { fitIrisEdge } from "../app/lib/eye-iris-edge";
import type { PixelReader } from "../app/lib/eye-structures";

const R = 40, PUPIL = 14, W = 200, H = 200;
type RGB = [number, number, number];

/** Oeil 200x200 centre en (cx, cy) : blanc, iris brun, pupille, paupieres de peau a up px au-dessus et low px sous le centre. */
function eye(o: { cx?: number; cy?: number; up?: number; low?: number; noise?: boolean; noIris?: boolean } = {}): PixelReader {
  const cx = o.cx ?? 100, cy = o.cy ?? 100, up = o.up ?? Infinity, low = o.low ?? Infinity;
  let seed = 11;
  const j = () => { if (!o.noise) return 0; seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return (seed / 4294967296) * 10 - 5; };
  const px = (c: RGB): RGB => [c[0] + j(), c[1] + j(), c[2] + j()];
  return (x, y) => {
    if (y < cy - up || y > cy + low) return px([200, 150, 130]);
    const d = Math.hypot(x - cx, y - cy);
    if (o.noIris) return px([232, 232, 232]);
    if (d > R) return px([232, 232, 232]);
    if (d > PUPIL) return px([110, 80, 50]);
    return px([12, 12, 12]);
  };
}
const c0 = { x: 100, y: 100 };
const lids = (u: number | null, l: number | null) => ({ upperPx: u, lowerPx: l });

describe("fitIrisEdge", () => {
  it("iris entierement visible : centre et rayon a moins de 1 px", () => {
    const f = fitIrisEdge(eye({ noise: true }), c0, R, lids(null, null), 0, W, H)!;
    expect(f).not.toBeNull();
    expect(Math.abs(f.r - R)).toBeLessThan(1);
    expect(Math.hypot(f.cx - 100, f.cy - 100)).toBeLessThan(1);
    expect(f.coverage).toBeGreaterThan(0.8);
    expect(f.confidence).toBeGreaterThan(0.5);
  });
  it("paupieres qui cachent le haut et le bas de l'iris : meme precision, couverture plus faible", () => {
    const full = fitIrisEdge(eye({ noise: true }), c0, R, lids(null, null), 0, W, H)!;
    const f = fitIrisEdge(eye({ noise: true, up: 24, low: 22 }), c0, R, lids(24, 22), 0, W, H)!;
    expect(f).not.toBeNull();
    expect(Math.abs(f.r - R)).toBeLessThan(1.5);
    expect(Math.hypot(f.cx - 100, f.cy - 100)).toBeLessThan(1.5);
    expect(f.coverage).toBeLessThan(full.coverage);
  });
  it("sans la liste des paupieres (null) mais avec paupiere reelle, le resultat reste raisonnable", () => {
    const f = fitIrisEdge(eye({ noise: true, up: 24 }), c0, R, lids(null, null), 0, W, H);
    expect(f === null || Math.abs(f.r - R) < 4).toBe(true);
  });
  it("corrige un centre de depart decale de 4 px", () => {
    const f = fitIrisEdge(eye({ noise: true }), { x: 104, y: 97 }, R, lids(null, null), 0, W, H)!;
    expect(Math.hypot(f.cx - 100, f.cy - 100)).toBeLessThan(1.2);
    expect(Math.abs(f.r - R)).toBeLessThan(1.5);
  });
  it("oeil decale dans l'image", () => {
    const f = fitIrisEdge(eye({ cx: 130, cy: 90, noise: true }), { x: 128, y: 92 }, R, lids(null, null), 0, W, H)!;
    expect(Math.hypot(f.cx - 130, f.cy - 90)).toBeLessThan(1.2);
  });
  it("pas d'iris : null ou confiance faible", () => {
    const f = fitIrisEdge(eye({ noIris: true, noise: true }), c0, R, lids(null, null), 0, W, H);
    expect(f === null || f.confidence < 0.3).toBe(true);
  });
  it("tient pres du bord de l'image sans planter", () => {
    const f = fitIrisEdge(eye({ cx: 30, cy: 100 }), { x: 30, y: 100 }, R, lids(null, null), 0, W, H);
    expect(f === null || Number.isFinite(f.r)).toBe(true);
  });
});
