// Detection precise des structures de l'oeil (pupille, limbe) par rayons et ajustement robuste de cercle.
// Module pur : il ne lit que des pixels via un PixelReader.
import { rgbToLab, type PixelReader, type Pt } from "./face-metrics";

export type { PixelReader, Pt };

export interface CircleFit { cx: number; cy: number; r: number; rms: number; inliers: number; total: number }
export interface StructureFit { cx: number; cy: number; r: number; circularity: number; coverage: number; confidence: number }

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Ajustement algebrique de Kasa (moindres carres), points centres sur leur barycentre pour le conditionnement. */
function kasa(points: Pt[]): { cx: number; cy: number; r: number } | null {
  const n = points.length;
  if (n < 3) return null;
  const mx = points.reduce((s, p) => s + p.x, 0) / n, my = points.reduce((s, p) => s + p.y, 0) / n;
  let Suu = 0, Svv = 0, Suv = 0, Suuu = 0, Svvv = 0, Suvv = 0, Svuu = 0;
  for (const p of points) {
    const u = p.x - mx, v = p.y - my;
    Suu += u * u; Svv += v * v; Suv += u * v; Suuu += u * u * u; Svvv += v * v * v; Suvv += u * v * v; Svuu += v * u * u;
  }
  const det = Suu * Svv - Suv * Suv;
  if (Math.abs(det) < 1e-9) return null;
  const a = (Suuu + Suvv) / 2, b = (Svvv + Svuu) / 2;
  const uc = (a * Svv - b * Suv) / det, vc = (Suu * b - Suv * a) / det;
  const r2 = uc * uc + vc * vc + (Suu + Svv) / n;
  return r2 > 0 ? { cx: uc + mx, cy: vc + my, r: Math.sqrt(r2) } : null;
}

function circumcircle(a: Pt, b: Pt, c: Pt): { cx: number; cy: number; r: number } | null {
  const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  if (Math.abs(d) < 1e-9) return null;
  const a2 = a.x * a.x + a.y * a.y, b2 = b.x * b.x + b.y * b.y, c2 = c.x * c.x + c.y * c.y;
  const cx = (a2 * (b.y - c.y) + b2 * (c.y - a.y) + c2 * (a.y - b.y)) / d;
  const cy = (a2 * (c.x - b.x) + b2 * (a.x - c.x) + c2 * (b.x - a.x)) / d;
  return { cx, cy, r: Math.hypot(a.x - cx, a.y - cy) };
}

// Tolerance plafonnee : sans plafond, un cercle immense (points alignes) accepterait tous les points
const tolFor = (r: number) => Math.min(2.5, Math.max(1, 0.05 * r));
const residual = (p: Pt, c: { cx: number; cy: number; r: number }) => Math.abs(Math.hypot(p.x - c.cx, p.y - c.cy) - c.r);

/** Cercle robuste : RANSAC deterministe (graine fixe), puis Kasa sur les points concordants. */
export function fitCircleRobust(points: Pt[]): CircleFit | null {
  const n = points.length;
  if (n < 6) return null;
  let seed = 12345;
  const draw = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return Math.floor((seed / 4294967296) * n); };
  let best: Pt[] = [];
  for (let t = 0; t < 300; t++) {
    const i = draw(), j = draw(), k = draw();
    if (i === j || j === k || i === k) continue;
    const c = circumcircle(points[i], points[j], points[k]);
    if (!c || c.r < 1 || c.r > 10000) continue;
    const tol = tolFor(c.r);
    const inl = points.filter((p) => residual(p, c) < tol);
    if (inl.length > best.length) best = inl;
  }
  if (best.length < 6) return null;
  const fit = kasa(best);
  if (!fit) return null;
  const tol = tolFor(fit.r);
  const inl = points.filter((p) => residual(p, fit) < tol);
  if (inl.length < 6) return null;
  const rms = Math.sqrt(inl.reduce((s, p) => s + residual(p, fit) ** 2, 0) / inl.length);
  return { ...fit, rms, inliers: inl.length, total: n };
}

interface Edge { r: number; strength: number }

/** Bord le long d'un rayon : plus fort gradient positif (sombre vers clair) du profil de luminance lisse. */
function rayEdge(read: PixelReader, c0: Pt, angle: number, rMin: number, rMax: number, step: number, w: number, h: number): Edge | null {
  const radii: number[] = [], lum: number[] = [];
  for (let r = rMin; r <= rMax; r += step) {
    const x = Math.round(c0.x + r * Math.cos(angle)), y = Math.round(c0.y + r * Math.sin(angle));
    if (x < 0 || y < 0 || x >= w || y >= h) continue;
    radii.push(r); lum.push(Math.min(85, rgbToLab(read(x, y))[0]));
  }
  if (lum.length < 7) return null;
  const sm = lum.map((_, i) => { const a = Math.max(0, i - 1), b = Math.min(lum.length - 1, i + 1); let s = 0; for (let k = a; k <= b; k++) s += lum[k]; return s / (b - a + 1); });
  let bestG = -Infinity, bestI = -1;
  for (let i = 1; i < sm.length - 1; i++) { const g = sm[i + 1] - sm[i - 1]; if (g > bestG) { bestG = g; bestI = i; } }
  return bestI < 0 ? null : { r: radii[bestI], strength: bestG };
}

/** Contraste de part et d'autre d'un bord circulaire : interieur (0.85 r) contre exterieur (1.2 r), en L*. */
function ringContrast(read: PixelReader, cx: number, cy: number, r: number, w: number, h: number): number | null {
  const at = (rad: number) => {
    const vals: number[] = [];
    for (let a = 0; a < 24; a++) {
      const t = (a / 24) * 2 * Math.PI;
      const x = Math.round(cx + rad * Math.cos(t)), y = Math.round(cy + rad * Math.sin(t));
      if (x >= 0 && y >= 0 && x < w && y < h) vals.push(Math.min(85, rgbToLab(read(x, y))[0]));
    }
    return vals.length >= 12 ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
  };
  const inside = at(0.85 * r), outside = at(1.2 * r);
  return inside === null || outside === null ? null : outside - inside;
}

/** Pupille : 48 rayons depuis c0, bords sombre->clair, cercle robuste ; null si la pupille ne se distingue pas. */
export function fitPupilRays(read: PixelReader, c0: Pt, irisR: number, w: number, h: number): StructureFit | null {
  const N = 48, step = irisR / 60;
  const pts: Pt[] = [], strengths: number[] = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * 2 * Math.PI;
    const e = rayEdge(read, c0, a, 0.12 * irisR, 0.8 * irisR, step, w, h);
    if (!e || e.strength < 4 || e.r < 0.15 * irisR || e.r > 0.75 * irisR) continue;
    pts.push({ x: c0.x + e.r * Math.cos(a), y: c0.y + e.r * Math.sin(a) });
    strengths.push(e.strength);
  }
  if (pts.length < 12) return null;
  const fit = fitCircleRobust(pts);
  if (!fit) return null;
  const contrast = ringContrast(read, fit.cx, fit.cy, fit.r, w, h);
  if (contrast === null || contrast < 8) return null;
  const circularity = clamp01(1 - fit.rms / fit.r), coverage = fit.inliers / N;
  const meanStrength = strengths.reduce((s, v) => s + v, 0) / strengths.length;
  return { cx: fit.cx, cy: fit.cy, r: fit.r, circularity, coverage, confidence: clamp01(coverage * circularity * Math.min(1, meanStrength / 12)) };
}

/** Limbe : secteurs horizontaux seulement (les paupieres cachent le haut et le bas), centre vertical fixe. */
export function fitLimbusRays(read: PixelReader, c0: Pt, irisR: number, w: number, h: number): StructureFit | null {
  const deg = Math.PI / 180, step = irisR / 60;
  const pts: Pt[] = [];
  let total = 0;
  for (const [from, to] of [[-35, 35], [145, 215]] as const) {
    for (let d = from; d <= to; d += 3) {
      total++;
      const a = d * deg;
      const e = rayEdge(read, c0, a, 0.8 * irisR, 1.3 * irisR, step, w, h);
      if (e && e.strength >= 4) pts.push({ x: c0.x + e.r * Math.cos(a), y: c0.y + e.r * Math.sin(a) });
    }
  }
  const left = pts.filter((p) => p.x < c0.x).length, right = pts.length - left;
  if (left < 5 || right < 5) return null;
  const solve = (set: Pt[]) => {
    // (x - cx)^2 + (y - cy0)^2 = r^2  <=>  z = 2 cx x + k  avec z = x^2 + (y - cy0)^2, k = r^2 - cx^2
    let sx = 0, sxx = 0, sz = 0, sxz = 0;
    for (const p of set) { const z = p.x * p.x + (p.y - c0.y) ** 2; sx += p.x; sxx += p.x * p.x; sz += z; sxz += p.x * z; }
    const n = set.length, det = 4 * sxx * n - 4 * sx * sx;
    if (Math.abs(det) < 1e-9) return null;
    const cx = (2 * sxz * n - 2 * sx * sz) / det, k = (4 * sxx * sz - 2 * sx * 2 * sxz) / det;
    const r2 = k + cx * cx;
    return r2 > 0 ? { cx, r: Math.sqrt(r2) } : null;
  };
  let fit = solve(pts);
  if (!fit) return null;
  const dist = (p: Pt, f: { cx: number; r: number }) => Math.abs(Math.hypot(p.x - f.cx, p.y - c0.y) - f.r);
  const tol = Math.max(1, 2.5 * median(pts.map((p) => dist(p, fit!))));
  const kept = pts.filter((p) => dist(p, fit!) <= tol);
  if (kept.length >= 10) fit = solve(kept) ?? fit;
  const res = kept.map((p) => dist(p, fit!));
  const rms = Math.sqrt(res.reduce((s, v) => s + v * v, 0) / Math.max(1, res.length));
  const circularity = clamp01(1 - rms / fit.r * 4), coverage = kept.length / total;
  return { cx: fit.cx, cy: c0.y, r: fit.r, circularity, coverage, confidence: clamp01(coverage * circularity) };
}

/** Angle de la droite des deux coins de l'oeil par rapport a l'horizontale, dans [-90, 90] degres. */
export function canthalRollDeg(inner: Pt, outer: Pt): number {
  let a = (Math.atan2(outer.y - inner.y, outer.x - inner.x) * 180) / Math.PI;
  if (a > 90) a -= 180;
  if (a < -90) a += 180;
  return a;
}
