import { describe, it, expect } from "vitest";
import { fromEyeFrame, toEyeFrame, learnedOffset, learnedOffsets } from "../app/lib/eye-learning";

describe("repere de l'oeil", () => {
  it("aller-retour image <-> oeil, avec inclinaison", () => {
    const det = { x: 100, y: 80 }, roll = (12 * Math.PI) / 180;
    const used = fromEyeFrame({ dx: 0.05, dy: -0.03 }, roll, 90, det);
    const back = toEyeFrame(used, det, roll, 90);
    expect(back.dx).toBeCloseTo(0.05, 3);
    expect(back.dy).toBeCloseTo(-0.03, 3);
  });
  it("sans inclinaison, dx est horizontal et dy vertical", () => {
    const p = fromEyeFrame({ dx: 0.1, dy: 0 }, 0, 100, { x: 0, y: 0 });
    expect(p.x).toBeCloseTo(10, 5); expect(p.y).toBeCloseTo(0, 5);
  });
});

describe("learnedOffset", () => {
  const same = (n: number, dx = 0.06, dy = 0.02) => Array.from({ length: n }, (_, i) => ({ dx: dx + (i % 2 ? 0.005 : -0.005), dy }));
  it("rien en dessous de 3 corrections", () => { expect(learnedOffset(same(2))).toBeNull(); });
  it("ignore une erreur de toucher enorme", () => { expect(learnedOffset([...same(2), { dx: 0.9, dy: 0 }])).toBeNull(); });
  it("tire vers zero avec peu de corrections puis converge", () => {
    const a = learnedOffset(same(3))!, b = learnedOffset(same(18))!;
    expect(a.dx).toBeGreaterThan(0); expect(a.dx).toBeLessThan(b.dx); expect(b.dx).toBeLessThan(0.061);
    expect(b.n).toBe(18);
  });
  it("plafonne le decalage applique", () => {
    const l = learnedOffset(same(20, 0.28, 0))!;
    expect(Math.hypot(l.dx, l.dy)).toBeLessThanOrEqual(0.1501);
  });
  it("refuse des corrections incoherentes entre elles", () => {
    expect(learnedOffset([{ dx: 0.1, dy: 0 }, { dx: -0.1, dy: 0 }, { dx: 0, dy: 0.1 }, { dx: 0, dy: -0.1 }])).toBeNull();
  });
  it("ne corrige pas un biais sous le bruit", () => { expect(learnedOffset(same(10, 0.01, 0.005))).toBeNull(); });
});

describe("learnedOffsets (depuis les scans)", () => {
  const side = (dx: number, x: number) => ({ manualCenter: true, centerShift: { dx, dy: 0 }, irisCenter: { x, y: 50 } });
  const scan = (d: number, a?: object, b?: object) => ({ date: `2026-11-0${d}`, time: "08:00", metrics: { A: a, B: b } });
  it("ne compte que les corrections manuelles, par oeil, et une seule fois une copie d'oeil", () => {
    const scans = [scan(1, side(0.06, 100)), scan(2, side(0.07, 101)), scan(3, side(0.06, 102)), scan(4, side(0.06, 102)), scan(5, { irisCenter: { x: 1, y: 1 } }, side(0.1, 9))];
    const o = learnedOffsets(scans);
    expect(o.A?.n).toBe(3);   // le scan 4 recopie le scan 3 (meme centre absolu)
    expect(o.B).toBeUndefined();
  });
});
