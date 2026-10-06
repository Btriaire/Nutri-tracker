import { describe, it, expect } from "vitest";
import { computeVitals, sanitizeVitals, resample, type VitalsFrame } from "../app/lib/face-vitals";

// Generateur pseudo-aleatoire deterministe
function rng(seed: number) { return () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296 - 0.5; }; }

function frames(opts: { bpm: number; brpm: number; seconds?: number; fps?: number; noise?: number; blinkAt?: number[]; pulseAmp?: number; move?: number }): VitalsFrame[] {
  const r = rng(42);
  const out: VitalsFrame[] = [];
  const fps = opts.fps ?? 25, seconds = opts.seconds ?? 30;
  let t = 0;
  while (t <= seconds * 1000) {
    const s = t / 1000;
    const pulse = Math.sin(2 * Math.PI * (opts.bpm / 60) * s) * (opts.pulseAmp ?? 0.6);
    const resp = Math.sin(2 * Math.PI * (opts.brpm / 60) * s);
    const n = () => r() * (opts.noise ?? 0.8);
    // Le pouls module surtout le vert (absorption de l'hemoglobine), un peu le bleu, peu le rouge
    const light = 1.5 * Math.sin(2 * Math.PI * 0.05 * s); // derive lente de l'eclairage
    out.push({
      t,
      rgb: [180 + light + 0.2 * pulse + n(), 120 + light + pulse + 0.4 * resp + n(), 100 + light + 0.5 * pulse + n()],
      blink: (opts.blinkAt ?? []).some((b) => Math.abs(s - b) < 0.12) ? 0.95 : 0.05,
      noseY: 0.002 * resp + r() * 0.001 + (opts.move ?? 0) * Math.sin(s * 3),
      noseX: r() * 0.001 + (opts.move ?? 0) * Math.cos(s * 2),
    });
    t += 1000 / fps + r() * 8; // cadence irreguliere, comme une vraie camera
  }
  return out;
}

describe("computeVitals", () => {
  it("retrouve le pouls (72 bpm) dans un signal bruite a cadence irreguliere", () => {
    const v = computeVitals(frames({ bpm: 72, brpm: 15 }))!;
    expect(v.heartRate).not.toBeNull();
    expect(Math.abs(v.heartRate! - 72)).toBeLessThanOrEqual(2);
    expect(v.heartConfidence).not.toBe("faible");
  });

  it("suit un autre rythme (95 bpm)", () => {
    const v = computeVitals(frames({ bpm: 95, brpm: 12 }))!;
    expect(Math.abs(v.heartRate! - 95)).toBeLessThanOrEqual(2);
  });

  it("respiration indicative autour de 15 / min", () => {
    const v = computeVitals(frames({ bpm: 70, brpm: 15 }))!;
    expect(v.respRate).not.toBeNull();
    expect(Math.abs(v.respRate! - 15)).toBeLessThanOrEqual(2);
  });

  it("compte les clignements et calcule le PERCLOS", () => {
    const v = computeVitals(frames({ bpm: 70, brpm: 15, blinkAt: [2, 5, 9, 13, 17, 21, 25, 28] }))!;
    expect(v.blinksPerMin).toBe(16); // 8 clignements en 30 s
    expect(v.perclos).toBeGreaterThan(0);
    expect(v.perclos).toBeCloseTo(6.4, 0); // 8 x 0,24 s yeux fermes sur 30 s
  });

  it("signal noye dans le bruit : pas de pouls invente", () => {
    const v = computeVitals(frames({ bpm: 70, brpm: 15, pulseAmp: 0, noise: 3 }))!;
    expect(v.heartConfidence).toBe("faible");
    expect(v.heartRate).toBeNull();
  });

  it("signale les mouvements et refuse une mesure trop courte", () => {
    expect(computeVitals(frames({ bpm: 70, brpm: 15, move: 0.2 }))!.warnings.join()).toMatch(/bougé/);
    expect(computeVitals(frames({ bpm: 70, brpm: 15, seconds: 5 }))).toBeNull();
  });
});

describe("outils", () => {
  it("resample interpole lineairement", () => {
    expect(resample([0, 100], [0, 10], 20)).toEqual([0, 5, 10]);
  });
  it("sanitizeVitals", () => {
    const v = computeVitals(frames({ bpm: 72, brpm: 15 }))!;
    expect(sanitizeVitals(JSON.parse(JSON.stringify(v)))).toEqual(JSON.parse(JSON.stringify(v)));
    expect(sanitizeVitals({ ...v, heartRate: 400 })).toBeNull();
    expect(sanitizeVitals({ ...v, version: 9 })).toBeNull();
  });
});
