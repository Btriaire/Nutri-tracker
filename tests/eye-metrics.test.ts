import { describe, it, expect } from "vitest";
import { computeEyeMetrics, computeConjunctiva, analyzePlr, eyeIndexes, eyeSignals, rednessGrade, sanitizeEyeScan, type EyeScanData } from "../app/lib/eye-metrics";

const W = 500, H = 400, R = 40;
const CA = { x: 150, y: 200 }, CB = { x: 350, y: 200 };

function landmarks(opts: { lidUp?: number; lowerA?: number; lowerAll?: number } = {}) {
  const pts = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.9 }));
  const set = (i: number, x: number, y: number) => { pts[i] = { x: x / W, y: y / H }; };
  for (const [c, iris, ring, inner, outer, upper, lower] of [
    [CA, 468, [469, 470, 471, 472], 225, 75, 159, 145],
    [CB, 473, [474, 475, 476, 477], 275, 425, 386, 374],
  ] as const) {
    set(iris, c.x, c.y);
    set(ring[0], c.x + R, c.y); set(ring[1], c.x, c.y - R); set(ring[2], c.x - R, c.y); set(ring[3], c.x, c.y + R);
    set(c === CA ? 133 : 362, inner, c.y); set(c === CA ? 33 : 263, outer, c.y);
    set(upper, c.x, c.y - (opts.lidUp ?? 25));
    set(lower, c.x, c.y + (c === CA && opts.lowerA ? opts.lowerA : opts.lowerAll ?? 35));
  }
  // Sous l'oeil et joue (cernes) : sous-oeil a y=330 cote A, joue a y=380
  for (const i of [111, 117, 118, 119, 120, 121]) set(i, 150, 330);
  for (const i of [340, 346, 347, 348, 349, 350]) set(i, 350, 330);
  set(205, 150, 380); set(425, 350, 380);
  return pts;
}

type RGB = [number, number, number];
function eyeImage(o: { pupilA?: number; pupilB?: number; iris?: RGB; sclera?: RGB; arcus?: boolean; conj?: RGB; catchB?: number; nasalRed?: boolean; underDark?: boolean }) {
  return (x: number, y: number): RGB => {
    // Cernes : zone sous l'oeil A plus sombre que la joue
    if (o.underDark && Math.abs(y - 330) < 12 && Math.abs(x - 150) < 20) return [150, 115, 100];
    for (const [c, pr] of [[CA, o.pupilA ?? 15], [CB, o.pupilB ?? 15]] as const) {
      const d = Math.hypot(x - c.x, y - c.y);
      const cdx = c === CB && o.catchB !== undefined ? o.catchB : 4;
      if (Math.hypot(x - (c.x + cdx), y - (c.y - 4)) < 3) return [250, 250, 250];   // reflet de l'ecran
      if (o.nasalRed && d >= R && d < 90 && Math.abs(y - c.y) < 8 && (c === CA ? x > c.x : x < c.x)) return [230, 175, 175];
      if (d < pr) return [18, 16, 15];
      if (d < R) return o.arcus && d > R * 0.85 ? [200, 200, 205] : (o.iris ?? [120, 80, 50]);
      if (o.conj && c === CA && y > c.y + R * 1.3 && Math.abs(x - c.x) < R) return o.conj;
    }
    return o.sclera ?? [235, 232, 228];
  };
}

describe("computeEyeMetrics", () => {
  it("mesure la pupille en mm avec l'iris comme regle (11,7 mm) malgre le reflet de l'ecran", () => {
    const m = computeEyeMetrics({ landmarks: landmarks(), width: W, height: H, read: eyeImage({}) })!;
    expect(m.A.pupilMm!).toBeCloseTo((2 * 15 * 11.7) / 80, 0);
    expect(Math.abs(m.A.pupilMm! - 4.39)).toBeLessThan(0.35);
    expect(m.anisocoriaMm!).toBeLessThan(0.3);
  });

  it("detecte des pupilles inegales et le signale", () => {
    const m = computeEyeMetrics({ landmarks: landmarks(), width: W, height: H, read: eyeImage({ pupilB: 22 }) })!;
    expect(m.anisocoriaMm!).toBeGreaterThan(1.2);
    const s = eyeSignals({ date: "2026-10-06", metrics: m }, []);
    expect(s.some((x) => x.level === "watch" && /inégales/.test(x.text))).toBe(true);
  });

  it("iris tres fonce : pupille non mesurable plutot qu'une valeur fausse", () => {
    const m = computeEyeMetrics({ landmarks: landmarks(), width: W, height: H, read: eyeImage({ iris: [26, 22, 20] }) })!;
    expect(m.A.pupilMm).toBeNull();
    expect(m.quality.warnings.join()).toMatch(/Pupille peu visible/);
  });

  it("ouverture de la paupiere (MRD1) en mm", () => {
    const m = computeEyeMetrics({ landmarks: landmarks({ lidUp: 25 }), width: W, height: H, read: eyeImage({}) })!;
    expect(m.A.mrd1Mm).toBeCloseTo((25 * 11.7) / 80, 1);
  });

  it("rougeur du blanc de l'oeil et arc corneen", () => {
    const white = computeEyeMetrics({ landmarks: landmarks(), width: W, height: H, read: eyeImage({}) })!;
    const red = computeEyeMetrics({ landmarks: landmarks(), width: W, height: H, read: eyeImage({ sclera: [235, 195, 195] }) })!;
    expect(red.A.rednessA!).toBeGreaterThan(white.A.rednessA! + 5);
    expect(rednessGrade(white.A.rednessA)).toBeLessThanOrEqual(1);
    const arc = computeEyeMetrics({ landmarks: landmarks(), width: W, height: H, read: eyeImage({ arcus: true }) })!;
    expect(arc.A.arcus!).toBeGreaterThan(12);
    expect(white.A.arcus!).toBeLessThan(5);
  });
});

describe("conjonctive", () => {
  it("plus pale = indice plus bas ; paupiere pas tiree = non mesurable", () => {
    const lm = landmarks({ lowerA: 95 });
    const pink = computeConjunctiva({ landmarks: lm, width: W, height: H, read: eyeImage({ conj: [215, 110, 115] }) })!;
    const pale = computeConjunctiva({ landmarks: lm, width: W, height: H, read: eyeImage({ conj: [225, 185, 175] }) })!;
    expect(pink.eye).toBe("A");
    expect(pink.pallorIndex).toBeGreaterThan(pale.pallorIndex + 10);
    expect(computeConjunctiva({ landmarks: landmarks(), width: W, height: H, read: eyeImage({}) })).toBeNull();
  });
});

describe("reflexe pupillaire", () => {
  it("constriction, latence et vitesse", () => {
    const samples = [];
    for (let t = 0; t <= 3200; t += 33) {
      const after = t - 1000 - 250;
      const v = after <= 0 ? 5 : 3.5 + 1.5 * Math.exp(-after / 300);
      samples.push({ t, pupilMm: v });
    }
    const r = analyzePlr(samples, 1000)!;
    expect(r.baselineMm).toBeCloseTo(5, 1);
    expect(r.constrictionPct).toBeGreaterThan(27);
    expect(r.latencyMs!).toBeGreaterThanOrEqual(250);
    expect(r.latencyMs!).toBeLessThan(400);
    expect(r.maxVelocityMmS).toBeGreaterThan(2);
    expect(analyzePlr(samples.map((s) => ({ ...s, pupilMm: null })), 1000)).toBeNull();
  });
});

describe("index et validation", () => {
  const base = computeEyeMetrics({ landmarks: landmarks(), width: W, height: H, read: eyeImage({}) })!;
  const scan = (mbiS: number, red?: [number, number, number]): EyeScanData => ({
    date: "2026-10-01",
    metrics: red ? computeEyeMetrics({ landmarks: landmarks(), width: W, height: H, read: eyeImage({ sclera: red }) })! : base,
    mbiS,
  });
  it("index secheresse centre sur l'habitude et signal < 10 s", () => {
    const hist = [scan(20), scan(22), scan(19), scan(21)];
    const now = scan(7, [235, 205, 205]);
    const idx = eyeIndexes(now, [...hist, now]);
    expect(idx.secheresse!).toBeGreaterThan(70);
    expect(eyeIndexes(hist[0], hist).secheresse!).toBeLessThan(60);
    expect(eyeSignals(now, hist).some((s) => /sécheresse oculaire probable/.test(s.text))).toBe(true);
  });
  it("sanitizeEyeScan", () => {
    const d = { metrics: base, plr: null, conjunctiva: null, mbiS: 12 };
    expect(sanitizeEyeScan(JSON.parse(JSON.stringify(d)))).toEqual(JSON.parse(JSON.stringify(d)));
    expect(sanitizeEyeScan({ ...d, metrics: { ...base, version: 9 } })).toBeNull();
    expect(sanitizeEyeScan({ ...d, conjunctiva: { eye: "Z", pallorIndex: 1, bandMm: 2 } })).toBeNull();
  });
});

describe("analyse detaillee par oeil", () => {
  it("reflets alignes = Hirschberg ~0 ; reflet decale sur un oeil = signal", () => {
    const ok = computeEyeMetrics({ landmarks: landmarks(), width: W, height: H, read: eyeImage({}) })!;
    expect(ok.hirschbergMm!).toBeLessThan(0.2);
    expect(ok.A.catchlight!.dxMm).toBeCloseTo((4 * 11.7) / 80, 1);
    const off = computeEyeMetrics({ landmarks: landmarks(), width: W, height: H, read: eyeImage({ catchB: -6 }) })!;
    expect(off.hirschbergMm!).toBeGreaterThan(1.2);
    expect(eyeSignals({ date: "2026-10-07", metrics: off }, []).some((x) => /Hirschberg/.test(x.text) && x.level === "watch")).toBe(true);
  });
  it("rougeur cote nez plus forte que cote tempe", () => {
    const m = computeEyeMetrics({ landmarks: landmarks(), width: W, height: H, read: eyeImage({ nasalRed: true }) })!;
    expect(m.A.rednessNasal!).toBeGreaterThan(m.A.rednessTemporal! + 5);
  });
  it("blanc visible sous l'iris en mm, largeur de la fente, cernes de chaque cote", () => {
    const m = computeEyeMetrics({ landmarks: landmarks({ lowerAll: 52 }), width: W, height: H, read: eyeImage({ underDark: true }) })!;
    expect(m.A.scleralShowLowerMm!).toBeCloseTo((52 * 11.7) / 80 - 5.85, 1);
    expect(m.A.fissureWidthMm!).toBeCloseTo((150 * 11.7) / 80, 0);
    expect(m.A.cernes!).toBeGreaterThan(10);
    expect(Math.abs(m.B.cernes!)).toBeLessThan(1);
  });
  it("symetrie : 100 si les deux yeux sont identiques, plus bas si les pupilles different", () => {
    expect(computeEyeMetrics({ landmarks: landmarks(), width: W, height: H, read: eyeImage({}) })!.symmetryScore).toBeGreaterThanOrEqual(95);
    expect(computeEyeMetrics({ landmarks: landmarks(), width: W, height: H, read: eyeImage({ pupilB: 22 }) })!.symmetryScore!).toBeLessThan(70);
  });
});
