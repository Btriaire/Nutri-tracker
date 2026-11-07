// Matrice de co-occurrence des niveaux de gris (Haralick et al., 1973) sur la bande deroulee de l iris, eclairage retire :
// descripteurs de l aspect, pas un diagnostic.
import { A0, A1 } from "./eye-iris-texture";

export interface GlcmFeatures {
  contrast: number;
  homogeneity: number;
  energy: number;
  correlation: number;
  entropy: number;
  contrastAngular: number;
  contrastRadial: number;
  anisotropy: number;
  pairs: number;
}

export function glcmFeatures(detail: number[][], levels = 16, range = 12): GlcmFeatures | null {
  const nR = detail.length;
  if (nR === 0) return null;
  const nA = detail[0].length;
  if (nA === 0) return null;

  const q = (v: number) => Math.max(0, Math.min(Math.floor((v + range) / (2 * range) * levels), levels - 1));

  const M1: number[][] = Array.from({ length: levels }, () => Array(levels).fill(0));
  const M2: number[][] = Array.from({ length: levels }, () => Array(levels).fill(0));
  let angularPairs = 0;
  let radialPairs = 0;

  for (let i = 0; i < nR; i++) {
    for (let j = 0; j < nA; j++) {
      const v = detail[i][j];
      if (isNaN(v)) continue;

      const a = q(v);
      if (j + 1 < nA) {
        const v2 = detail[i][j + 1];
        if (!isNaN(v2)) {
          const b = q(v2);
          M1[a][b]++;
          M1[b][a]++;
          angularPairs++;
        }
      }
      if (i + 1 < nR) {
        const v2 = detail[i + 1][j];
        if (!isNaN(v2)) {
          const b = q(v2);
          M2[a][b]++;
          M2[b][a]++;
          radialPairs++;
        }
      }
    }
  }

  if (angularPairs < 100 || radialPairs < 100) return null;

  const normalize = (M: number[][]) => {
    const sum = M.flat().reduce((a, b) => a + b, 0);
    return M.map(row => row.map(v => v / sum));
  };

  const M1n = normalize(M1);
  const M2n = normalize(M2);

  const computeFeatures = (M: number[][]) => {
    let contrast = 0;
    let homogeneity = 0;
    let energy = 0;
    let entropy = 0;
    let mu = 0;
    let mu2 = 0;

    // First pass to compute mu
    for (let a = 0; a < levels; a++) {
      const rowSum = M[a].reduce((sum, v) => sum + v, 0);
      mu += a * rowSum;
    }

    // Second pass to compute sd and mu2
    const colSum = Array(levels).fill(0);
    for (let a = 0; a < levels; a++) {
      for (let b = 0; b < levels; b++) {
        const v = M[a][b];
        if (v === 0) continue;
        const diff = a - b;
        contrast += v * diff * diff;
        homogeneity += v / (1 + Math.abs(diff));
        energy += v * v;
        entropy -= v * Math.log2(v);
        mu2 += (a - mu) * (b - mu) * v;
        colSum[b] += v;
      }
    }

    let sd = 0;
    for (let b = 0; b < levels; b++) {
      sd += (b - mu) * (b - mu) * colSum[b];
    }
    sd = Math.sqrt(sd);

    const correlation = sd < 1e-9 ? 1 : Math.max(-1, Math.min(1, mu2 / (sd * sd)));

    return { contrast, homogeneity, energy, correlation, entropy };
  };

  const f1 = computeFeatures(M1n);
  const f2 = computeFeatures(M2n);

  const contrast = (f1.contrast + f2.contrast) / 2;
  const homogeneity = (f1.homogeneity + f2.homogeneity) / 2;
  const energy = (f1.energy + f2.energy) / 2;
  const correlation = (f1.correlation + f2.correlation) / 2;
  const entropy = (f1.entropy + f2.entropy) / 2;
  const contrastAngular = f1.contrast;
  const contrastRadial = f2.contrast;
  const anisotropy = contrastAngular + contrastRadial === 0 ? 0 : (contrastAngular - contrastRadial) / (contrastAngular + contrastRadial);

  return {
    contrast: Math.round(contrast * 1000) / 1000 + 0,
    homogeneity: Math.round(homogeneity * 1000) / 1000 + 0,
    energy: Math.round(energy * 1000) / 1000 + 0,
    correlation: Math.round(correlation * 1000) / 1000 + 0,
    entropy: Math.round(entropy * 1000) / 1000 + 0,
    contrastAngular: Math.round(contrastAngular * 1000) / 1000 + 0,
    contrastRadial: Math.round(contrastRadial * 1000) / 1000 + 0,
    anisotropy: Math.round(anisotropy * 1000) / 1000 + 0,
    pairs: angularPairs + radialPairs
  };
}

export function cellAt(m: { r0: number; r1: number; nR: number; nA: number }, p: {x:number;y:number}, c: {x:number;y:number}): [number, number] | null {
  const dx = p.x - c.x;
  const dy = p.y - c.y;
  const r = Math.hypot(dx, dy);
  if (r < m.r0 || r >= m.r1) return null;

  let t = Math.atan2(dy, dx) * 180 / Math.PI;
  if (t < A0 - 1e-9) t += 360;
  if (t < A0 || t >= A1) return null;

  const i = Math.floor((r - m.r0) / (m.r1 - m.r0) * m.nR);
  const j = Math.floor((t - A0) / (A1 - A0) * m.nA);

  return [i, j];
}
