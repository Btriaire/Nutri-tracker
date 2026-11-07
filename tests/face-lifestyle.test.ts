import { describe, it, expect } from "vitest";
import { faceLifestyle, type DayFactors } from "@/app/lib/face-lifestyle";
import type { FaceMetrics } from "@/app/lib/face-metrics";

let s = 11; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
const date = (i: number) => new Date(Date.UTC(2026, 6, 1 + i)).toISOString().slice(0, 10);
const M = (o: Partial<FaceMetrics>): FaceMetrics => ({ volumeBasVisage: 1, ouvertureYeux: 0.3, cernes: 5, paupiere: 0.5, rougeur: 10, levres: 3, quality: { score: 80 } , ...o } as unknown as FaceMetrics);

function world(effect: (f: DayFactors, prev: DayFactors) => Partial<FaceMetrics>, n = 45) {
  const days: Record<string, DayFactors> = {};
  for (let i = -1; i < n; i++) days[date(i)] = { sleepH: 6 + rnd() * 2, alcoholG: rnd() < 0.4 ? 20 + rnd() * 30 : 0, saltG: 4 + rnd() * 6, weightKg: 90 + rnd() };
  const scans = [];
  for (let i = 0; i < n; i++) {
    const base = { cernes: 5 + (rnd() - 0.5), rougeur: 10 + (rnd() - 0.5), ouvertureYeux: 0.3 + (rnd() - 0.5) * 0.01 };
    scans.push({ date: date(i), metrics: M({ ...base, ...effect(days[date(i)], days[date(i - 1)]) }) });
  }
  return { scans, days };
}

describe("faceLifestyle", () => {
  it("retrouve l'effet de l'alcool de la veille sur les cernes", () => {
    const { scans, days } = world((f, p) => ({ cernes: 5 + (p.alcoholG ?? 0) / 10 + (rnd() - 0.5) }));
    const r = faceLifestyle(scans, days);
    const l = r.links.find((x) => x.metric === "cernes" && x.factor === "alcoholG")!;
    expect(l.status).toBe("confirmé");
    expect(l.rho).toBeGreaterThan(0.5);
    expect(l.text).toContain("alcool");
    expect(l.text).toMatch(/cernes/i);
  });
  it("l'alcool du jour meme (apres la photo) ne compte pas", () => {
    const { scans, days } = world((f) => ({ cernes: 5 + (f.alcoholG ?? 0) / 10 }));
    expect(faceLifestyle(scans, days).links.some((x) => x.metric === "cernes" && x.factor === "alcoholG" && x.status === "confirmé")).toBe(false);
  });
  it("donnees sans lien : rien de confirme, mais les tests sont comptes", () => {
    const { scans, days } = world(() => ({}));
    const r = faceLifestyle(scans, days);
    expect(r.links.filter((x) => x.status === "confirmé")).toHaveLength(0);
    expect(r.tested).toBeGreaterThan(10);
  });
  it("moins de 12 paires : pas de test", () => {
    const { scans, days } = world((f, p) => ({ cernes: 5 + (p.alcoholG ?? 0) / 10 }), 10);
    expect(faceLifestyle(scans, days).tested).toBe(0);
  });
  it("ignore les photos de mauvaise qualite", () => {
    const { scans, days } = world((f, p) => ({ cernes: 5 + (p.alcoholG ?? 0) / 10 }));
    const bad = scans.map((x) => ({ ...x, metrics: { ...x.metrics, quality: { ...x.metrics.quality, score: 30 } } }));
    expect(faceLifestyle(bad, days).tested).toBe(0);
  });
});
