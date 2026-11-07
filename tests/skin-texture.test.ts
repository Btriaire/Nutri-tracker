import { describe, it, expect } from "vitest";
import { patchParams, analyzeSkin, SKIN_MIN_IOD_PX, type LabPatch } from "@/app/lib/skin-texture";

const N = 128;
function patch(f: (x: number, y: number) => [number, number, number]): LabPatch {
  const L = new Float32Array(N * N), a = new Float32Array(N * N), b = new Float32Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const [l, A, B] = f(x, y); const i = y * N + x; L[i] = l; a[i] = A; b[i] = B; }
  return { L, a, b, N };
}
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const flat = patchParams(patch(() => [60, 15, 15]));

describe("patchParams", () => {
  it("peau parfaitement unie : tout est au minimum", () => {
    expect(flat.grain).toBeCloseTo(0, 2);
    expect(flat.lissage).toBeCloseTo(1, 2);
    expect(flat.ridules).toBe(0);
    expect(flat.taches).toBeCloseTo(0, 2);
    expect(flat.rougeurs).toBeCloseTo(0, 2);
    expect(flat.brillance).toBe(0);
  });
  it("un eclairage en degrade n'est pas pris pour de la texture", () => {
    const g = patchParams(patch((x) => [50 + (x / N) * 20, 15, 15]));
    expect(g.grain).toBeLessThan(0.1);
    expect(g.ridules).toBe(0);
    expect(g.lissage).toBeGreaterThan(0.95);
  });
  it("grain fin : grain monte et lissage baisse", () => {
    const g = patchParams(patch(() => [60 + (rnd() - 0.5) * 8, 15, 15]));
    expect(g.grain).toBeGreaterThan(0.3);
    expect(g.lissage).toBeLessThan(0.9);
  });
  it("une ligne sombre fine compte comme ridule, une ligne claire non", () => {
    const line = (s: number) => patchParams(patch((x, y) => [60 + s * 6 * Math.exp(-((y - 64) ** 2) / 8), 15, 15]));
    expect(line(-1).ridules).toBeGreaterThan(1);
    expect(line(1).ridules).toBe(0);
  });
  it("tache etendue : taches monte, grain peu", () => {
    const t = patchParams(patch((x, y) => [60 - 8 * Math.exp(-((x - 64) ** 2 + (y - 64) ** 2) / 200), 15, 15]));
    expect(t.taches).toBeGreaterThan(0.5);
    expect(t.grain).toBeLessThan(t.taches);
  });
  it("rougeur localisee detectee, une teinte rouge uniforme non", () => {
    const r = patchParams(patch((x, y) => [60, 15 + (Math.hypot(x - 64, y - 64) < 30 ? 12 : 0), 15]));
    expect(r.rougeurs).toBeGreaterThan(5);
    expect(patchParams(patch(() => [60, 30, 15])).rougeurs).toBeCloseTo(0, 2);
  });
  it("reflet brillant detecte", () => {
    const r = patchParams(patch((x, y) => [Math.hypot(x - 64, y - 64) < 20 ? 90 : 60, 15, 15]));
    expect(r.brillance).toBeGreaterThan(3);
  });
});

describe("analyzeSkin", () => {
  // Visage de face, distance entre yeux = 0,4 de la largeur.
  const lm = () => {
    const p = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5 }));
    p[33] = { x: 0.2, y: 0.35 }; p[133] = { x: 0.4, y: 0.35 }; p[362] = { x: 0.6, y: 0.35 }; p[263] = { x: 0.8, y: 0.35 };
    p[50] = { x: 0.25, y: 0.6 }; p[280] = { x: 0.75, y: 0.6 }; p[151] = { x: 0.5, y: 0.15 };
    return p;
  };
  // Motif defini en coordonnees du visage ; bord net au coin de l'oeil pour la nettete.
  const scene = (S: number, edge = true) => (px: number, py: number): [number, number, number] => {
    const x = px / S, y = py / S;
    if (Math.hypot(x - 0.3, y - 0.35) < 0.12) return edge ? (x < 0.3 ? [20, 20, 20] : [235, 235, 235]) : [128 + (x - 0.3) * 200, 128 + (x - 0.3) * 200, 128 + (x - 0.3) * 200];
    const v = 170 + 8 * Math.sin(x * 500) * Math.sin(y * 500);
    return [v, v * 0.85, v * 0.75];
  };
  it("refuse une photo trop petite pour lire la peau", () => {
    const w = Math.floor((SKIN_MIN_IOD_PX - 1) / 0.4);
    expect(analyzeSkin(lm(), w, w, scene(w))).toEqual({ ok: false, reason: "resolution" });
  });
  it("refuse une photo floue", () => {
    expect(analyzeSkin(lm(), 1000, 1000, scene(1000, false))).toEqual({ ok: false, reason: "flou" });
  });
  it("refuse sans visage complet", () => {
    expect(analyzeSkin(lm().slice(0, 100), 1000, 1000, scene(1000))).toEqual({ ok: false, reason: "visage" });
  });
  it("renvoie les parametres et la meme valeur quelle que soit la resolution", () => {
    const a = analyzeSkin(lm(), 1000, 1000, scene(1000));
    const b = analyzeSkin(lm(), 2000, 2000, scene(2000));
    if (!a.ok || !b.ok) throw new Error("analyse refusee");
    expect(a.iodPx).toBeCloseTo(400, 0);
    expect(a.grain).toBeGreaterThan(0);
    expect(Math.abs(a.grain - b.grain) / a.grain).toBeLessThan(0.15);
  });
});
