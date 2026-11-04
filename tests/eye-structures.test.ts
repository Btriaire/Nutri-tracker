import { describe, it, expect } from "vitest";
import { fitCircleRobust, fitPupilRays, fitLimbusRays, canthalRollDeg, type PixelReader, type Pt } from "../app/lib/eye-structures";

const R = 40, PUPIL = 14;

/** Oeil synthetique 200x200 centre en (100,100) : sclere claire, iris brun, pupille noire, bruit deterministe. */
function makeEye(opts: { catchlight?: boolean; eyelidTop?: number; noise?: boolean; pupil?: number } = {}): PixelReader {
  const { catchlight = false, eyelidTop = Infinity, noise = false, pupil = PUPIL } = opts;
  let seed = 7;
  const jitter = () => { if (!noise) return 0; seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return (seed / 4294967296) * 12 - 6; };
  const px = (rgb: [number, number, number]): [number, number, number] => [rgb[0] + jitter(), rgb[1] + jitter(), rgb[2] + jitter()];
  return (x, y) => {
    if (y < 100 - eyelidTop) return px([200, 150, 130]);                                  // peau (paupiere)
    if (catchlight && Math.hypot(x - 108, y - 92) <= 4) return [255, 255, 255];             // reflet de l'ecran
    const d = Math.hypot(x - 100, y - 100);
    if (d > R) return px([232, 232, 232]);                                                  // sclere
    if (d > pupil) return px([110, 80, 50]);                                                // iris
    return px([12, 12, 12]);                                                                // pupille
  };
}

const circle = (cx: number, cy: number, r: number, n: number): Pt[] =>
  Array.from({ length: n }, (_, i) => ({ x: cx + r * Math.cos((i * 2 * Math.PI) / n), y: cy + r * Math.sin((i * 2 * Math.PI) / n) }));

describe("fitCircleRobust", () => {
  it("retrouve un cercle exact", () => {
    const f = fitCircleRobust(circle(50, 60, 25, 40))!;
    expect(Math.abs(f.cx - 50)).toBeLessThan(0.01);
    expect(Math.abs(f.cy - 60)).toBeLessThan(0.01);
    expect(Math.abs(f.r - 25)).toBeLessThan(0.01);
  });
  it("reste a moins de 1 px avec 20 % d'aberrants", () => {
    const pts = circle(50, 60, 25, 40);
    const out: Pt[] = Array.from({ length: 8 }, (_, i) => ({ x: 50 + 30 + i * 3, y: 60 - 20 + i * 5 }));
    const f = fitCircleRobust([...pts, ...out])!;
    expect(f).not.toBeNull();
    expect(Math.abs(f.cx - 50)).toBeLessThan(1);
    expect(Math.abs(f.cy - 60)).toBeLessThan(1);
    expect(Math.abs(f.r - 25)).toBeLessThan(1);
  });
  it("renvoie null avec trop peu de points", () => {
    expect(fitCircleRobust(circle(50, 60, 25, 4))).toBeNull();
  });
});

describe("fitPupilRays", () => {
  it("mesure la pupille bruitee (rayon et centre)", () => {
    const f = fitPupilRays(makeEye({ noise: true }), { x: 100, y: 100 }, R, 200, 200)!;
    expect(f).not.toBeNull();
    expect(Math.abs(f.r - PUPIL)).toBeLessThan(1.2);
    expect(Math.hypot(f.cx - 100, f.cy - 100)).toBeLessThan(1);
    expect(f.confidence).toBeGreaterThan(0.4);
  });
  it("corrige un centre de depart decale", () => {
    const f = fitPupilRays(makeEye({ noise: true }), { x: 104, y: 97 }, R, 200, 200)!;
    expect(Math.abs(f.r - PUPIL)).toBeLessThan(1.2);
    expect(Math.hypot(f.cx - 100, f.cy - 100)).toBeLessThan(1);
  });
  it("ignore le reflet de l'ecran", () => {
    const f = fitPupilRays(makeEye({ noise: true, catchlight: true }), { x: 100, y: 100 }, R, 200, 200)!;
    expect(Math.abs(f.r - PUPIL)).toBeLessThan(1.5);
  });
  it("tient avec une paupiere qui cache le haut de la pupille", () => {
    const f = fitPupilRays(makeEye({ noise: true, eyelidTop: 8 }), { x: 100, y: 100 }, R, 200, 200)!;
    expect(f).not.toBeNull();
    expect(Math.abs(f.r - PUPIL)).toBeLessThan(2.5);
    expect(f.confidence).toBeGreaterThan(0.3);
  });
  it("ne trouve rien sur un iris uniforme sans pupille", () => {
    const f = fitPupilRays(makeEye({ noise: true, pupil: 0 }), { x: 100, y: 100 }, R, 200, 200);
    expect(f === null || f.confidence < 0.3).toBe(true);
  });
});

describe("fitLimbusRays", () => {
  it("mesure le bord de l'iris", () => {
    const f = fitLimbusRays(makeEye({ noise: true }), { x: 100, y: 100 }, R, 200, 200)!;
    expect(Math.abs(f.r - R)).toBeLessThan(1.5);
    expect(Math.abs(f.cx - 100)).toBeLessThan(1);
  });
  it("tient avec une paupiere haute qui cache le haut de l'iris", () => {
    const f = fitLimbusRays(makeEye({ noise: true, eyelidTop: 25 }), { x: 100, y: 100 }, R, 200, 200)!;
    expect(Math.abs(f.r - R)).toBeLessThan(1.5);
    expect(Math.abs(f.cx - 100)).toBeLessThan(1);
  });
});

describe("canthalRollDeg", () => {
  it("donne l'inclinaison de l'axe des coins, dans les deux sens", () => {
    expect(canthalRollDeg({ x: 0, y: 0 }, { x: 100, y: 0 })).toBeCloseTo(0, 5);
    expect(canthalRollDeg({ x: 0, y: 0 }, { x: 100, y: 10 })).toBeCloseTo(5.71, 1);
    expect(canthalRollDeg({ x: 100, y: 0 }, { x: 0, y: 10 })).toBeCloseTo(-5.71, 1);
  });
});
