import { describe, it, expect } from "vitest";
import { computeFaceMetrics, computeBaselines, zScore, describeZ, faceIndexes, alignTransform, rgbToLab, pearson, METRICS, type FaceMetrics } from "../app/lib/face-metrics";

// Visage synthetique symetrique autour de x = 0.5 (coordonnees normalisees).
function face(opts: { mouthDrop?: number; shiftOne?: number; cheekScale?: number } = {}) {
  const pts = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5 }));
  const pair = (a: number, b: number, dx: number, y: number) => { pts[a] = { x: 0.5 - dx, y }; pts[b] = { x: 0.5 + dx, y }; };
  pair(33, 263, 0.16, 0.40); pair(133, 362, 0.06, 0.40);
  pair(159, 386, 0.115, 0.385); pair(158, 385, 0.095, 0.385); pair(145, 374, 0.115, 0.415); pair(153, 380, 0.095, 0.415);
  pair(61, 291, 0.08, 0.70 + (opts.mouthDrop ?? 0));
  const cs = opts.cheekScale ?? 1;
  pair(234, 454, 0.30, 0.45); pair(93, 323, 0.29, 0.52); pair(132, 361, 0.27 * cs, 0.60); pair(58, 288, 0.25 * cs, 0.66);
  pair(172, 397, 0.23 * cs, 0.70); pair(136, 365, 0.20, 0.76); pair(150, 379, 0.16, 0.81); pair(149, 378, 0.12, 0.84);
  pair(176, 400, 0.08, 0.86); pair(148, 377, 0.04, 0.875);
  pair(70, 300, 0.15, 0.33); pair(105, 334, 0.11, 0.32); pair(107, 336, 0.05, 0.33); pair(50, 280, 0.2, 0.55);
  pair(205, 425, 0.18, 0.56); pair(129, 358, 0.05, 0.55); pair(48, 278, 0.04, 0.56);
  [[111, 340, 0.15], [117, 346, 0.135], [118, 347, 0.12], [119, 348, 0.105], [120, 349, 0.09], [121, 350, 0.075]].forEach(([a, b, dx]) => pair(a, b, dx, 0.47));
  const mid: [number, number][] = [[10, 0.12], [151, 0.22], [9, 0.33], [8, 0.36], [168, 0.38], [6, 0.42], [197, 0.45], [195, 0.48], [5, 0.5], [4, 0.52], [1, 0.55],
    [19, 0.58], [94, 0.6], [2, 0.61], [164, 0.63], [0, 0.66], [11, 0.67], [12, 0.68], [13, 0.69], [14, 0.71], [15, 0.72], [16, 0.73], [17, 0.75], [18, 0.77], [200, 0.79], [199, 0.8], [175, 0.86], [152, 0.89]];
  mid.forEach(([i, y]) => { pts[i] = { x: 0.5, y }; });
  if (opts.shiftOne) pts[61] = { x: pts[61].x, y: pts[61].y + opts.shiftOne };
  // Iris : centre et bord (le blanc de l'oeil est echantillonne entre l'iris et les coins)
  pts[468] = { x: 0.39, y: 0.40 }; pts[469] = { x: 0.405, y: 0.40 };
  pts[473] = { x: 0.61, y: 0.40 }; pts[474] = { x: 0.625, y: 0.40 };
  return pts;
}
const skin: [number, number, number] = [200, 160, 140];
const uniform = () => skin;

describe("computeFaceMetrics", () => {
  it("ne depend pas de la taille de la photo (normalisation par l'ecart entre les yeux)", () => {
    const a = computeFaceMetrics({ landmarks: face(), width: 400, height: 400, read: uniform })!;
    const b = computeFaceMetrics({ landmarks: face(), width: 800, height: 800, read: uniform })!;
    for (const k of ["volumeBasVisage", "ratioJoues", "ratioMachoire", "ouvertureYeux", "symetrie", "fwhr"] as const) expect(b[k]).toBeCloseTo(a[k], 2);
    expect(a.quality.iodPx * 2).toBeCloseTo(b.quality.iodPx, -1);
  });

  it("visage symetrique : asymetrie ~0 ; un point deplace l'augmente", () => {
    const sym = computeFaceMetrics({ landmarks: face(), width: 500, height: 500, read: uniform })!;
    expect(sym.symetrie).toBeLessThan(0.05);
    const off = computeFaceMetrics({ landmarks: face({ shiftOne: 0.03 }), width: 500, height: 500, read: uniform })!;
    expect(off.symetrie).toBeGreaterThan(sym.symetrie + 0.3);
    expect(Math.abs(sym.quality.yawDeg)).toBeLessThan(1);
  });

  it("coins de bouche plus bas = valeur positive", () => {
    const up = computeFaceMetrics({ landmarks: face({ mouthDrop: -0.02 }), width: 500, height: 500, read: uniform })!;
    const down = computeFaceMetrics({ landmarks: face({ mouthDrop: 0.02 }), width: 500, height: 500, read: uniform })!;
    expect(down.coinsBouche).toBeGreaterThan(up.coinsBouche);
    expect(down.coinsBouche).toBeGreaterThan(0);
  });

  it("joues creusees = volume et ratio joues plus bas", () => {
    const full = computeFaceMetrics({ landmarks: face(), width: 500, height: 500, read: uniform })!;
    const thin = computeFaceMetrics({ landmarks: face({ cheekScale: 0.85 }), width: 500, height: 500, read: uniform })!;
    expect(thin.ratioJoues).toBeLessThan(full.ratioJoues);
    expect(thin.volumeBasVisage).toBeLessThan(full.volumeBasVisage);
  });

  it("zone sous l'oeil plus sombre = cernes detectes ; peau uniforme = cernes ~0", () => {
    const W = 500;
    const flat = computeFaceMetrics({ landmarks: face(), width: W, height: W, read: uniform })!;
    expect(Math.abs(flat.cernes)).toBeLessThan(0.01);
    const dark = computeFaceMetrics({ landmarks: face(), width: W, height: W, read: (_x, y) => (Math.abs(y - 0.47 * W) < 8 ? [140, 105, 95] : skin) })!;
    expect(dark.cernes).toBeGreaterThan(5);
  });

  it("signale une photo sombre ou un visage tourne", () => {
    const m = computeFaceMetrics({ landmarks: face(), width: 500, height: 500, read: () => [40, 30, 25] })!;
    expect(m.quality.warnings.join()).toMatch(/sombre/);
    expect(m.quality.score).toBeLessThan(100);
    expect(computeFaceMetrics({ landmarks: face().slice(0, 100), width: 500, height: 500, read: uniform })).toBeNull();
  });
});

describe("reference personnelle et index", () => {
  const base = computeFaceMetrics({ landmarks: face(), width: 500, height: 500, read: uniform })!;
  const variant = (over: Partial<FaceMetrics>): FaceMetrics => ({ ...base, ...over });

  it("mediane robuste, ecart minimal et description en mots", () => {
    const hist = [8, 9, 10, 11, 12].map((c) => variant({ cernes: c }));
    const b = computeBaselines(hist);
    expect(b.cernes!.median).toBe(10);
    expect(b.cernes!.n).toBe(5);
    const info = METRICS.find((m) => m.key === "cernes")!;
    expect(describeZ(zScore(10.2, b.cernes), info)).toBe("comme d'habitude");
    expect(describeZ(zScore(14, b.cernes), info)).toBe("nettement plus marqués");
    expect(describeZ(null, info)).toBe("référence en construction");
  });

  it("ignore les photos de mauvaise qualite et attend 3 scans", () => {
    const bad = variant({ cernes: 50, quality: { ...base.quality, score: 20 } });
    expect(computeBaselines([variant({ cernes: 10 }), variant({ cernes: 10 }), bad]).cernes).toBeUndefined();
  });

  it("index centres sur l'habitude (50) ; plus de cernes = index fatigue plus haut", () => {
    const hist = [9, 10, 11, 10, 10].map((c) => variant({ cernes: c }));
    const b = computeBaselines(hist);
    expect(faceIndexes(variant({ cernes: 10 }), b).fatigue).toBe(50);
    expect(faceIndexes(variant({ cernes: 14 }), b).fatigue!).toBeGreaterThan(60);
  });
});

describe("outils", () => {
  it("blanc = L* 100, gris neutre a*~0", () => {
    const [l, a, b] = rgbToLab([255, 255, 255]);
    expect(l).toBeCloseTo(100, 0); expect(Math.abs(a)).toBeLessThan(0.5); expect(Math.abs(b)).toBeLessThan(0.5);
  });

  it("alignTransform place les yeux sur les cibles", () => {
    const anchors = { le: [0.3, 0.4] as [number, number], re: [0.6, 0.45] as [number, number], chin: [0.45, 0.85] as [number, number] };
    const [a, b, c, d, e, f] = alignTransform(anchors, 400, 600, { le: { x: 100, y: 150 }, re: { x: 200, y: 150 } });
    const apply = (x: number, y: number) => [a * x + c * y + e, b * x + d * y + f];
    const [lx, ly] = apply(120, 240), [rx, ry] = apply(240, 270);
    expect(lx).toBeCloseTo(100, 4); expect(ly).toBeCloseTo(150, 4); expect(rx).toBeCloseTo(200, 4); expect(ry).toBeCloseTo(150, 4);
  });

  it("pearson", () => {
    expect(pearson([[1, 2], [2, 4], [3, 6], [4, 8]])).toBeCloseTo(1, 6);
    expect(pearson([[1, 2]])).toBeNull();
  });
});

describe("sanitizeMetrics / metricsContext", () => {
  const m = computeFaceMetrics({ landmarks: face(), width: 500, height: 500, read: uniform })!;
  it("accepte des mesures valides, refuse le reste", async () => {
    const { sanitizeMetrics } = await import("../app/lib/face-metrics");
    const sent = JSON.parse(JSON.stringify(m));
    expect(sanitizeMetrics(sent)).toEqual(sent);
    expect(sanitizeMetrics({ ...m, cernes: "x" })).toBeNull();
    expect(sanitizeMetrics({ ...m, version: 99 })).toBeNull();
    expect(sanitizeMetrics(null)).toBeNull();
  });
  it("resume l'historique pour l'IA avec la tendance", async () => {
    const { metricsContext } = await import("../app/lib/face-metrics");
    const hist = Array.from({ length: 9 }, (_, i) => ({ date: `2026-0${1 + Math.floor(i / 3)}-1${i % 3}`, metrics: { ...m, cernes: 8 + i } }));
    const txt = metricsContext({ ...m, cernes: 20 }, hist);
    expect(txt).toMatch(/Cernes : 20 \(référence 12, nettement plus marqués\)/);
    expect(txt).toMatch(/Tendance sur tout l'historique \(9 photos/);
  });
});

describe("summarizeForReport", () => {
  const m = computeFaceMetrics({ landmarks: face(), width: 500, height: 500, read: uniform })!;
  it("ecarts notables du dernier scan et tendance depuis le debut", async () => {
    const { summarizeForReport } = await import("../app/lib/face-metrics");
    const hist = Array.from({ length: 9 }, (_, i) => ({ date: `2026-0${1 + Math.floor(i / 3)}-1${i % 3}`, metrics: { ...m, volumeBasVisage: 3 - i * 0.05, cernes: i === 8 ? 15 : 10 } }));
    const s = summarizeForReport(hist)!;
    expect(s.count).toBe(9);
    expect(s.latestDate).toBe("2026-03-12");
    expect(s.notable.join()).toMatch(/Cernes : nettement plus marqués/);
    expect(s.trend.join()).toMatch(/Volume du bas du visage : plus affiné depuis le début/);
    expect(summarizeForReport([])).toBeNull();
  });
});

describe("teint doré (caroténoïdes)", () => {
  const W = 500;
  const scleraX = [208.75, 181.25, 291.25, 318.75];
  const reader = (skinRgb: [number, number, number], tint = 1) => (x: number, y: number): [number, number, number] => {
    const white = Math.abs(y - 200) < 4 && scleraX.some((sx) => Math.abs(x - sx) < 5);
    const c: [number, number, number] = white ? [235, 232, 228] : skinRgb;
    return [c[0], c[1], Math.min(255, c[2] * tint)];
  };
  it("peau plus jaune que le blanc de l'oeil = valeur positive, plus doree = plus haute", () => {
    const pale = computeFaceMetrics({ landmarks: face(), width: W, height: W, read: reader([200, 165, 150]) })!;
    const golden = computeFaceMetrics({ landmarks: face(), width: W, height: W, read: reader([205, 165, 120]) })!;
    expect(pale.carotenoides).not.toBeNull();
    expect(golden.carotenoides!).toBeGreaterThan(pale.carotenoides! + 5);
  });
  it("une lumiere plus bleue change peu la valeur (blanc de l'oeil comme reference)", () => {
    const a = computeFaceMetrics({ landmarks: face(), width: W, height: W, read: reader([205, 165, 120]) })!;
    const b = computeFaceMetrics({ landmarks: face(), width: W, height: W, read: reader([205, 165, 120], 1.12) })!;
    const skinOnly = (t: number) => rgbToLab([205, 165, Math.min(255, 120 * t)])[2];
    const rawShift = Math.abs(skinOnly(1.12) - skinOnly(1));
    expect(Math.abs(a.carotenoides! - b.carotenoides!)).toBeLessThan(rawShift / 2);
  });
  it("blanc de l'oeil invisible = non mesurable (null)", () => {
    const m = computeFaceMetrics({ landmarks: face(), width: W, height: W, read: () => [90, 60, 50] })!;
    expect(m.carotenoides).toBeNull();
  });
});
