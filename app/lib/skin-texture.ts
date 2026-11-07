import { rgbToLab } from "./face-metrics";

export const SKIN_MIN_IOD_PX = 250;

export interface LabPatch {
  L: Float32Array;
  a: Float32Array;
  b: Float32Array;
  N: number;
}

export interface SkinParams {
  grain: number;
  lissage: number;
  ridules: number;
  taches: number;
  rougeurs: number;
  brillance: number;
}

export type SkinResult = ({ ok: true; iodPx: number; nettete: number } & SkinParams) | { ok: false; reason: "resolution" | "flou" | "visage" };

function gaussian(src: Float32Array, N: number, sigma: number): Float32Array {
  const radius = Math.ceil(3 * sigma);
  const kernelSize = 2 * radius + 1;
  const kernel = new Float32Array(kernelSize);
  let sum = 0;

  for (let i = -radius; i <= radius; i++) {
    kernel[i + radius] = Math.exp(-(i * i) / (2 * sigma * sigma));
    sum += kernel[i + radius];
  }

  for (let i = 0; i < kernelSize; i++) {
    kernel[i] /= sum;
  }

  const dst = new Float32Array(N * N);

  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      let val = 0;
      for (let i = -radius; i <= radius; i++) {
        const xi = Math.min(Math.max(x + i, 0), N - 1);
        val += src[y * N + xi] * kernel[i + radius];
      }
      dst[y * N + x] = val;
    }
  }

  for (let x = 0; x < N; x++) {
    for (let y = 0; y < N; y++) {
      let val = 0;
      for (let i = -radius; i <= radius; i++) {
        const yi = Math.min(Math.max(y + i, 0), N - 1);
        val += dst[yi * N + x] * kernel[i + radius];
      }
      dst[y * N + x] = val;
    }
  }

  return dst;
}

function mean(arr: Float32Array, m: number, N: number): number {
  let sum = 0;
  let count = 0;

  for (let y = m; y < N - m; y++) {
    for (let x = m; x < N - m; x++) {
      sum += arr[y * N + x];
      count++;
    }
  }

  return sum / count;
}

function variance(arr: Float32Array, m: number, N: number): number {
  const mu = mean(arr, m, N);
  let sum = 0;
  let count = 0;

  for (let y = m; y < N - m; y++) {
    for (let x = m; x < N - m; x++) {
      sum += (arr[y * N + x] - mu) ** 2;
      count++;
    }
  }

  return sum / count;
}

function percentile(arr: Float32Array, p: number, m: number, N: number): number {
  const sorted = new Float32Array((N - 2 * m) ** 2);
  let index = 0;

  for (let y = m; y < N - m; y++) {
    for (let x = m; x < N - m; x++) {
      sorted[index++] = arr[y * N + x];
    }
  }

  sorted.sort();
  const pos = Math.floor(p * (sorted.length - 1));
  return sorted[pos];
}

function median(arr: Float32Array, m: number, N: number): number {
  return percentile(arr, 0.5, m, N);
}

function percent(arr: Float32Array, threshold: number, m: number, N: number): number {
  let count = 0;
  let total = 0;

  for (let y = m; y < N - m; y++) {
    for (let x = m; x < N - m; x++) {
      if (arr[y * N + x] > threshold) {
        count++;
      }
      total++;
    }
  }

  return 100 * count / total;
}

export function patchParams(p: LabPatch): SkinParams {
  const N = p.N;
  const m = N / 8;
  const L = p.L;
  const a = p.a;
  const b = p.b;

  const g1 = gaussian(L, N, 1);
  const g3 = gaussian(L, N, 3);
  const grain = Math.sqrt(variance(g1.map((v, i) => v - g3[i]), m, N));

  const flat = new Float32Array(N * N);
  const gN8 = gaussian(L, N, N / 8);
  for (let i = 0; i < N * N; i++) {
    flat[i] = Math.max(0, Math.min(15, Math.floor(L[i] - gN8[i] + 8)));
  }

  const glcm = new Array(16).fill(0).map(() => new Array(16).fill(0));
  for (let y = m; y < N - m; y++) {
    for (let x = m; x < N - m; x++) {
      const i = Math.floor(flat[y * N + x]);
      for (const j of [flat[y * N + x + 1], flat[(y + 1) * N + x]]) {
        glcm[i][j]++;
        glcm[j][i]++;
      }
    }
  }

  let lissage = 0;
  let total = 0;
  for (let i = 0; i < 16; i++) {
    for (let j = 0; j < 16; j++) {
      lissage += glcm[i][j] / (1 + Math.abs(i - j));
      total += glcm[i][j];
    }
  }
  lissage /= total;

  const g2 = gaussian(L, N, 2);
  const gxx = new Float32Array(N * N);
  const gyy = new Float32Array(N * N);
  const gxy = new Float32Array(N * N);

  for (let y = 1; y < N - 1; y++) {
    for (let x = 1; x < N - 1; x++) {
      gxx[y * N + x] = g2[y * N + x + 1] + g2[y * N + x - 1] - 2 * g2[y * N + x];
      gyy[y * N + x] = g2[(y + 1) * N + x] + g2[(y - 1) * N + x] - 2 * g2[y * N + x];
      gxy[y * N + x] = (g2[(y + 1) * N + x + 1] + g2[(y - 1) * N + x - 1] - g2[(y + 1) * N + x - 1] - g2[(y - 1) * N + x + 1]) / 4;
    }
  }

  const l = new Float32Array(N * N);
  for (let y = 1; y < N - 1; y++) {
    for (let x = 1; x < N - 1; x++) {
      const gxxVal = gxx[y * N + x];
      const gyyVal = gyy[y * N + x];
      const gxyVal = gxy[y * N + x];
      l[y * N + x] = (gxxVal + gyyVal) / 2 + Math.sqrt(((gxxVal - gyyVal) / 2) ** 2 + gxyVal ** 2);
    }
  }

  const ridules = percent(l, 0.3, m, N);

  const s = N / 32;
  const gL = gaussian(L, N, s);
  const gN4 = gaussian(L, N, N / 4);
  const dL = new Float32Array(N * N);
  for (let i = 0; i < N * N; i++) {
    dL[i] = gL[i] - gN4[i];
  }

  const ga = gaussian(a, N, s);
  const gN4a = gaussian(a, N, N / 4);
  const da = new Float32Array(N * N);
  for (let i = 0; i < N * N; i++) {
    da[i] = ga[i] - gN4a[i];
  }

  const gb = gaussian(b, N, s);
  const gN4b = gaussian(b, N, N / 4);
  const db = new Float32Array(N * N);
  for (let i = 0; i < N * N; i++) {
    db[i] = gb[i] - gN4b[i];
  }

  const taches = Math.sqrt(variance(dL, m, N) + variance(da, m, N) + variance(db, m, N));

  const rougeurs = percentile(a, 0.95, m, N) - median(a, m, N);

  const brillance = percent(L.map((v, i) => v - gN4[i]), 15, m, N);

  return {
    grain: Math.round(grain * 100) / 100,
    lissage: Math.round(lissage * 100) / 100,
    ridules: Math.round(ridules * 100) / 100,
    taches: Math.round(taches * 100) / 100,
    rougeurs: Math.round(rougeurs * 100) / 100,
    brillance: Math.round(brillance * 100) / 100,
  };
}

function samplePatch(center: { x: number; y: number }, u: { x: number; y: number }, v: { x: number; y: number }, side: number, N: number, w: number, h: number, read: (x: number, y: number) => [number, number, number]): LabPatch {
  const L = new Float32Array(N * N);
  const a = new Float32Array(N * N);
  const b = new Float32Array(N * N);

  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const du = ((i + 0.5) / N - 0.5) * side, dv = ((j + 0.5) / N - 0.5) * side;
      const x = Math.max(0, Math.min(w - 1, center.x + u.x * du + v.x * dv));
      const y = Math.max(0, Math.min(h - 1, center.y + u.y * du + v.y * dv));
      const x0 = Math.max(0, Math.min(w - 1, Math.floor(x)));
      const y0 = Math.max(0, Math.min(h - 1, Math.floor(y)));
      const x1 = Math.min(w - 1, x0 + 1);
      const y1 = Math.min(h - 1, y0 + 1);
      const dx = x - x0;
      const dy = y - y0;

      const [r00, g00, b00] = read(x0, y0);
      const [r01, g01, b01] = read(x0, y1);
      const [r10, g10, b10] = read(x1, y0);
      const [r11, g11, b11] = read(x1, y1);

      const r = r00 * (1 - dx) * (1 - dy) + r01 * (1 - dx) * dy + r10 * dx * (1 - dy) + r11 * dx * dy;
      const g = g00 * (1 - dx) * (1 - dy) + g01 * (1 - dx) * dy + g10 * dx * (1 - dy) + g11 * dx * dy;
      const bl = b00 * (1 - dx) * (1 - dy) + b01 * (1 - dx) * dy + b10 * dx * (1 - dy) + b11 * dx * dy;

      const [l, A, B] = rgbToLab([r, g, bl]);
      const idx = j * N + i;
      L[idx] = l;
      a[idx] = A;
      b[idx] = B;
    }
  }

  return { L, a, b, N };
}

// Parametres descriptifs relatifs a la reference personnelle : ni diagnostic, ni mesure d'hydratation.
export function analyzeSkin(lm: { x: number; y: number }[], w: number, h: number, read: (x: number, y: number) => [number, number, number]): SkinResult {
  if (lm.length < 468) {
    return { ok: false, reason: "visage" };
  }

  const P = lm.map(p => ({ x: p.x * w, y: p.y * h }));
  const eA = { x: (P[33].x + P[133].x) / 2, y: (P[33].y + P[133].y) / 2 };
  const eB = { x: (P[263].x + P[362].x) / 2, y: (P[263].y + P[362].y) / 2 };
  const iod = Math.hypot(eB.x - eA.x, eB.y - eA.y);

  if (iod < SKIN_MIN_IOD_PX) {
    return { ok: false, reason: "resolution" };
  }

  const u = { x: (eB.x - eA.x) / iod, y: (eB.y - eA.y) / iod };
  const v = { x: -u.y, y: u.x };

  const N = 128;
  const side = 0.45 * iod;
  const sharpnessPatch = samplePatch(eA, u, v, side, N, w, h, read);
  const gx = new Float32Array(N * N);
  const gy = new Float32Array(N * N);

  for (let y = 1; y < N - 1; y++) {
    for (let x = 1; x < N - 1; x++) {
      gx[y * N + x] = (sharpnessPatch.L[y * N + x + 1] - sharpnessPatch.L[y * N + x - 1]) / 2;
      gy[y * N + x] = (sharpnessPatch.L[(y + 1) * N + x] - sharpnessPatch.L[(y - 1) * N + x]) / 2;
    }
  }

  const m = 1;
  const nettete = percentile(new Float32Array(gx.map((val, idx) => Math.hypot(val, gy[idx]))), 0.99, m, N);

  if (nettete < 1.5) {
    return { ok: false, reason: "flou" };
  }

  const zones = [
    samplePatch(P[50], u, v, side, N, w, h, read),
    samplePatch(P[280], u, v, side, N, w, h, read),
    samplePatch(P[151], u, v, side, N, w, h, read),
  ];

  const params = zones.map(patch => patchParams(patch));
  const grain = params.reduce((sum, p) => sum + p.grain, 0) / params.length;
  const lissage = params.reduce((sum, p) => sum + p.lissage, 0) / params.length;
  const ridules = params.reduce((sum, p) => sum + p.ridules, 0) / params.length;
  const taches = params.reduce((sum, p) => sum + p.taches, 0) / params.length;
  const rougeurs = params.reduce((sum, p) => sum + p.rougeurs, 0) / params.length;
  const brillance = params.reduce((sum, p) => sum + p.brillance, 0) / params.length;

  return {
    ok: true,
    iodPx: Math.round(iod * 100) / 100,
    nettete: Math.round(nettete * 100) / 100,
    grain: Math.round(grain * 100) / 100,
    lissage: Math.round(lissage * 100) / 100,
    ridules: Math.round(ridules * 100) / 100,
    taches: Math.round(taches * 100) / 100,
    rougeurs: Math.round(rougeurs * 100) / 100,
    brillance: Math.round(brillance * 100) / 100,
  };
}
