import { describe, it, expect } from "vitest";
import { irisTexture, unwrapIris, fiberLabel, textureStability, textureMaps } from "../app/lib/eye-iris-texture";

type RGB = [number, number, number];
const W = 320, H = 320, C = { x: 160, y: 160 }, R = 53, PUPIL = 16;

/** Iris synthetique : `pattern(r, angle)` donne un ecart de gris ajoute a un brun moyen. */
function img(pattern: (r: number, t: number) => number, opts: { glint?: boolean } = {}) {
  return (x: number, y: number): RGB => {
    const dx = x - C.x, dy = y - C.y, r = Math.hypot(dx, dy), t = Math.atan2(dy, dx);
    if (opts.glint && Math.hypot(x - (C.x + 20), y - (C.y + 20)) < 4) return [255, 255, 255];
    if (r < PUPIL) return [15, 14, 13];
    if (r < R) { const g = Math.max(0, Math.min(255, 110 + pattern(r, t))); return [g, g * 0.8, g * 0.6]; }
    return [235, 230, 225];
  };
}

describe("unwrapIris", () => {
  it("deroule l'anneau a pas egal et refuse un iris trop petit", () => {
    const u = unwrapIris(img(() => 0), C, R, PUPIL, W, H)!;
    expect(u.grid.length).toBeGreaterThan(10);
    expect(u.grid[0].length).toBeGreaterThan(u.grid.length);
    expect(unwrapIris(img(() => 0), C, 10, 3, W, H)).toBeNull();
  });
  it("ecarte les reflets", () => {
    const u = unwrapIris(img(() => 0, { glint: true }), C, R, PUPIL, W, H)!;
    expect(u.grid.flat().some((v) => Number.isNaN(v))).toBe(true);
  });
});

describe("irisTexture", () => {
  it("iris lisse : relief faible, classe dense, pas de cryptes", () => {
    const t = irisTexture(img(() => 0), C, R, PUPIL, W, H)!;
    expect(t.relief).toBeLessThan(1);
    expect(t.cryptCount).toBe(0);
    expect(t.grade).toBe("dense");
    expect(t.confidence).toBeGreaterThan(0.5);
  });

  it("stries radiaires : variations le long du cercle dominantes", () => {
    const t = irisTexture(img((_, a) => 18 * Math.sin(a * 40)), C, R, PUPIL, W, H)!;
    expect(t.radialRatio).toBeGreaterThan(0.6);
    expect(fiberLabel(t.radialRatio)).toBe("stries radiaires dominantes");
    expect(t.relief).toBeGreaterThan(4);
  });

  it("anneaux concentriques : variations le long du rayon dominantes", () => {
    const t = irisTexture(img((r) => 18 * Math.sin(r * 1.2)), C, R, PUPIL, W, H)!;
    expect(t.radialRatio).toBeLessThan(0.4);
    expect(fiberLabel(t.radialRatio)).toBe("anneaux / sillons dominants");
  });

  it("cryptes : taches sombres comptees, classe plus lache", () => {
    const spots = [0.3, 1.0, 1.7, 2.4].map((a) => ({ x: C.x + 36 * Math.cos(a), y: C.y + 36 * Math.sin(a) }));
    const read = (x: number, y: number): RGB => {
      for (const s of spots) if (Math.hypot(x - s.x, y - s.y) < 4) return [55, 44, 33];
      return img(() => 0)(x, y);
    };
    const t = irisTexture(read, C, R, PUPIL, W, H)!;
    expect(t.cryptCount).toBe(4);
    expect(t.cryptPct).toBeGreaterThan(0.5);
    expect(t.grade).not.toBe("dense");
  });

  it("collerette : saut de luminosite entre zone pupillaire et ciliaire", () => {
    const t = irisTexture(img((r) => (r < 28 ? 25 : 0)), C, R, PUPIL, W, H)!;
    expect(t.collaretteRatio).not.toBeNull();
    expect(t.collaretteRatio!).toBeGreaterThan(0.45);
    expect(t.collaretteRatio!).toBeLessThan(0.62);
  });

  it("null si l'anneau est illisible (tout surexpose)", () => {
    expect(irisTexture(() => [255, 255, 255], C, R, PUPIL, W, H)).toBeNull();
  });
});

describe("textureStability", () => {
  const t = (relief: number, cryptPct: number, grade: "dense" | "intermediaire" | "lache", confidence = 0.8) =>
    ({ relief, radialRatio: 0.5, cryptCount: 3, cryptPct, collaretteRatio: 0.5, grade, confidence });
  it("mediane, ecart et accord de classe ; scans peu fiables ignores", () => {
    const s = textureStability([t(5, 2, "intermediaire"), t(6, 3, "intermediaire"), t(5.5, 2.5, "intermediaire"), t(20, 30, "lache", 0.1), null, undefined])!;
    expect(s.n).toBe(3);
    expect(s.relief.median).toBe(5.5);
    expect(s.relief.spread).toBe(0.5);
    expect(s.agreement).toBe(1);
  });
  it("null avec moins de deux scans exploitables", () => {
    expect(textureStability([t(5, 2, "dense")])).toBeNull();
  });
});

describe("textureMaps", () => {
  it("masque des cryptes aligne sur la grille", () => {
    const m = textureMaps(img(() => 0), C, R, PUPIL, W, H)!;
    expect(m.crypt.length).toBe(m.detail.length);
    expect(m.crypt[0].length).toBe(m.detail[0].length);
    expect(m.crypt.flat().some(Boolean)).toBe(false);
  });
});

describe("cryptes vs sillons", () => {
  it("un saut de luminosite en anneau (collerette) n'est pas compte comme crypte", () => {
    const t = irisTexture(img((r, a) => (r < 28 ? 15 : 0) + 14 * Math.sin(a * 40)), C, R, PUPIL, W, H)!;
    expect(t.cryptCount).toBe(0);
  });
});
