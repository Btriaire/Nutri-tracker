import { describe, it, expect } from "vitest";
import { irisTexture, irisProfile, type IrisTexture } from "../app/lib/eye-iris-texture";
import { IRIS_INFO } from "../app/lib/eye-iris-info";

type RGB = [number, number, number];
const C = { x: 160, y: 160 }, R = 53, P = 16;
const img = (f: (r: number, t: number) => number) => (x: number, y: number): RGB => {
  const dx = x - C.x, dy = y - C.y, r = Math.hypot(dx, dy), t = Math.atan2(dy, dx);
  if (r < P) return [15, 14, 13];
  if (r < R) { const g = Math.max(0, Math.min(255, 110 + f(r, t))); return [g, g * 0.8, g * 0.6]; }
  return [235, 230, 225];
};
const tex = (f: (r: number, t: number) => number) => irisTexture(img(f), C, R, P, 320, 320)!;
const T = (o: Partial<IrisTexture>): IrisTexture => ({ relief: 3, radialRatio: 0.5, cryptCount: 2, cryptPct: 1, collaretteRatio: 0.5, grade: "dense", confidence: 0.8, sharp: 4, furrowCount: 0, furrowExtent: 0, ...o });

describe("sillons et nettete", () => {
  it("un arc sombre le long du cercle est un sillon, pas une crypte", () => {
    const t = tex((r, a) => (Math.abs(r - 40) < 1.5 && a > 0.2 && a < 2.5 ? -35 : 0));
    expect(t.furrowCount).toBe(1);
    expect(t.furrowExtent).toBeGreaterThan(30);
    expect(t.cryptCount).toBe(0);
  });
  it("une tache ronde n'est pas un sillon ; iris uni : rien", () => {
    expect(tex((r, a) => (Math.hypot(r - 35, (a - 1.5) * 35) < 4 ? -35 : 0)).furrowCount).toBe(0);
    expect(tex(() => 0).furrowCount).toBe(0);
    expect(tex(() => 0).furrowExtent).toBe(0);
  });
  it("la nettete monte avec les details fins", () => {
    expect(tex((r, a) => 25 * Math.sin(a * 40)).sharp).toBeGreaterThan(tex(() => 0).sharp!);
  });
});

describe("irisProfile", () => {
  it("ne garde que les photos les plus nettes, puis prend la mediane", () => {
    const h = [T({ sharp: 6, cryptPct: 2 }), T({ sharp: 6, cryptPct: 2 }), T({ sharp: 5, cryptPct: 2 }), T({ sharp: 1, cryptPct: 40 }), T({ sharp: 1, cryptPct: 40 }), T({ sharp: 1, cryptPct: 40 })];
    const p = irisProfile(h)!;
    expect(p.total).toBe(6);
    expect(p.used).toBe(3);
    expect(p.params.cryptPct.median).toBe(2);
    expect(p.params.cryptPct.reliability).toBe("stable");
  });
  it("signale un parametre instable", () => {
    const h = [1, 10, 3, 20, 2, 15].map((c) => T({ cryptPct: c }));
    expect(irisProfile(h)!.params.cryptPct.reliability).toBe("instable");
  });
  it("ignore scans anciens et peu fiables ; moins de 3 : null", () => {
    expect(irisProfile([T({}), T({}), null, undefined, T({ confidence: 0.1 })])).toBeNull();
    expect(irisProfile([{ ...T({}), sharp: undefined }, T({}), T({})])).toBeNull();
  });
});

describe("IRIS_INFO", () => {
  it("chaque parametre du profil a explication et publication", () => {
    expect(IRIS_INFO.map((i) => i.key).sort()).toEqual(["cryptPct", "furrowExtent", "radialRatio", "relief"]);
    for (const i of IRIS_INFO) {
      expect(i.meaning.length).toBeGreaterThan(20);
      expect(i.refs.length).toBeGreaterThan(0);
      for (const r of i.refs) expect(r.url).toMatch(/^https:\/\/doi\.org\//);
    }
  });
});
