import { describe, it, expect } from "vitest";
import { faceAcquisition, facePose, BestShot } from "../app/lib/face-acquisition";

const good = { widthRatio: 0.6, cx: 0.5, cy: 0.42, yawDeg: 0, rollDeg: 0, motion: 0, sharp: 20, light: 130 };

function pts(o: { noseDx?: number; tilt?: number; x?: number; y?: number; w?: number } = {}) {
  const w = o.w ?? 0.6, x = o.x ?? 0.5, y = o.y ?? 0.42, t = o.tilt ?? 0;
  const list = Array.from({ length: 478 }, () => ({ x, y }));
  list[234] = { x: x - w / 2, y }; list[454] = { x: x + w / 2, y };
  list[1] = { x: x + (o.noseDx ?? 0), y };
  list[33] = { x: x - 0.15, y: y - t }; list[263] = { x: x + 0.15, y: y + t };
  list[10] = { x, y: y - 0.3 }; list[152] = { x, y: y + 0.3 };
  return list;
}

describe("faceAcquisition", () => {
  it("prise ideale : 100 et aucun probleme", () => {
    expect(faceAcquisition(good)).toEqual({ score: 100, issue: null });
  });
  it.each([
    [{ widthRatio: 0.3 }, "Trop loin : rapproche-toi"],
    [{ widthRatio: 0.95 }, "Trop près : éloigne-toi"],
    [{ cx: 0.8 }, "Centre ton visage dans l'ovale"],
    [{ cy: 0.75 }, "Centre ton visage dans l'ovale"],
    [{ yawDeg: 20 }, "Regarde bien en face"],
    [{ rollDeg: -15 }, "Redresse la tête"],
    [{ motion: 0.05 }, "Bouge moins : tiens le téléphone stable"],
    [{ sharp: 1 }, "Image floue : attends la mise au point"],
    [{ light: 40 }, "Trop sombre : éclaire le visage"],
    [{ light: 245 }, "Trop de lumière"],
  ])("signale %o", (patch, issue) => {
    const a = faceAcquisition({ ...good, ...patch });
    expect(a.issue).toBe(issue);
    expect(a.score).toBeLessThan(100);
  });
  it("le cadrage passe avant le reste", () => {
    expect(faceAcquisition({ ...good, widthRatio: 0.3, sharp: 1 }).issue).toBe("Trop loin : rapproche-toi");
  });
});

describe("facePose", () => {
  it("visage droit et centre", () => {
    const p = facePose(pts());
    expect(p.widthRatio).toBeCloseTo(0.6, 5);
    expect(p.cx).toBeCloseTo(0.5, 5); expect(p.cy).toBeCloseTo(0.42, 5);
    expect(p.yawDeg).toBeCloseTo(0, 5); expect(p.rollDeg).toBeCloseTo(0, 5);
  });
  it("tete tournee et inclinee", () => {
    expect(Math.abs(facePose(pts({ noseDx: 0.1 })).yawDeg)).toBeGreaterThan(15);
    expect(facePose(pts({ tilt: 0.03 })).rollDeg).toBeCloseTo((Math.atan2(0.06, 0.3) * 180) / Math.PI, 3);
  });
});

describe("BestShot", () => {
  it("garde la meilleure, compte les prises, ignore les scores sous le seuil", () => {
    const b = new BestShot<string>(70);
    expect(b.offer(60, "a")).toBe(false);
    expect(b.count).toBe(0);
    expect(b.offer(75, "b")).toBe(true);
    expect(b.offer(72, "c")).toBe(false);
    expect(b.offer(90, "d")).toBe(true);
    expect(b.count).toBe(3);
    expect(b.best).toBe("d");
    b.reset();
    expect(b.best).toBeNull(); expect(b.count).toBe(0);
  });
});
