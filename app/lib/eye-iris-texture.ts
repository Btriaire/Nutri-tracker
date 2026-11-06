// Texture de l'iris a partir des pixels : relief, orientation des fibres, cryptes, collerette. Module pur (tests/eye-iris-texture.test.ts).
//
// Methode : l'anneau de l'iris (entre la pupille et le bord) est deroule en coordonnees polaires sur la moitie
// basse elargie (-25..205 degres, la paupiere haute et les cils sont evites), a pas egal en pixels dans les deux
// directions. L'eclairage est retire (moyenne locale soustraite), puis :
//   - relief      : ecart-type robuste du detail restant (L*), plus il est fort plus l'iris est structure ;
//   - fibres      : part des variations le long du cercle (stries radiaires) face a celles le long du rayon (anneaux) ;
//   - cryptes     : taches nettement plus sombres que leur voisinage (zones ou le stroma est mince) ;
//   - collerette  : rayon du plus fort changement de luminosite moyenne entre zone pupillaire et zone ciliaire.
//
// C'est une description de l'aspect de l'iris, un trait individuel tres stable chez l'adulte (Larsson et al.).
// Elle ne renseigne pas sur l'etat de sante des organes (l'iridologie n'a pas de validite) : d'un scan a l'autre,
// les ecarts viennent surtout de la nettete, de la lumiere et de la taille de la pupille.

import { rgbToLab, type PixelReader, type Pt } from "./face-metrics";

export interface IrisTexture {
  relief: number;              // ecart-type robuste du detail de l'iris (L*)
  radialRatio: number;         // 0-1 : part des variations le long du cercle (> 0,5 = stries radiaires dominantes)
  cryptCount: number;          // nombre de taches sombres (cryptes) dans la partie analysee
  cryptPct: number;            // % de la surface analysee couverte par ces taches
  collaretteRatio: number | null; // position de la collerette : rayon / rayon de l'iris (null si non vue)
  grade: "dense" | "intermediaire" | "lache";
  confidence: number;          // 0-1 : resolution de l'iris et part de l'anneau lisible
}

const A0 = -25, A1 = 205;               // degres, moitie basse elargie
const CRYPT_DL = 6;                     // L* sous la moyenne locale pour compter comme crypte
const MIN_R_PX = 14;                    // en dessous, l'image est trop petite pour lire une texture

const round = (v: number, d = 2) => Math.round(v * 10 ** d) / 10 ** d;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const median = (xs: number[]) => { if (!xs.length) return NaN; const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

/** Grille polaire de L* : lignes = rayons (du bord de la pupille vers l'exterieur), colonnes = angles. NaN = reflet ou cil. */
export function unwrapIris(read: PixelReader, c: Pt, R: number, pupilR: number, w: number, h: number): { grid: number[][]; r0: number; r1: number; step: number } | null {
  const r0 = Math.max(pupilR * 1.15, R * 0.3), r1 = R * 0.88;
  if (!(r1 > r0) || R < MIN_R_PX) return null;
  const step = Math.max(0.75, R / 60);                     // pixels, identique dans les deux directions
  const nR = Math.max(4, Math.floor((r1 - r0) / step));
  const rMid = (r0 + r1) / 2;
  const nA = Math.max(16, Math.min(720, Math.floor(((A1 - A0) * Math.PI / 180) * rMid / step)));
  const grid: number[][] = [];
  for (let i = 0; i < nR; i++) {
    const r = r0 + (i + 0.5) * ((r1 - r0) / nR);
    const row: number[] = [];
    for (let j = 0; j < nA; j++) {
      const t = ((A0 + (j + 0.5) * ((A1 - A0) / nA)) * Math.PI) / 180;
      const x = Math.round(c.x + r * Math.cos(t)), y = Math.round(c.y + r * Math.sin(t));
      if (x < 0 || y < 0 || x >= w || y >= h) { row.push(NaN); continue; }
      const L = rgbToLab(read(x, y))[0];
      row.push(L > 88 || L < 4 ? NaN : L);
    }
    grid.push(row);
  }
  return { grid, r0, r1, step };
}

/** Moyenne locale (fenetre (2k+1) x (2k+1), NaN ignores). */
function localMean(g: number[][], k: number): number[][] {
  const nR = g.length, nA = g[0].length;
  return g.map((row, i) => row.map((_, j) => {
    let s = 0, n = 0;
    for (let di = -k; di <= k; di++) {
      const ii = i + di; if (ii < 0 || ii >= nR) continue;
      for (let dj = -k; dj <= k; dj++) {
        const jj = j + dj; if (jj < 0 || jj >= nA) continue;
        const v = g[ii][jj]; if (Number.isFinite(v)) { s += v; n++; }
      }
    }
    return n ? s / n : NaN;
  }));
}

/** Taches connexes (4-voisins) d'au moins `minSize` cases. */
function blobs(mask: boolean[][], minSize: number): { count: number; cells: number } {
  const nR = mask.length, nA = mask[0].length;
  const seen = mask.map((r) => r.map(() => false));
  let count = 0, cells = 0;
  for (let i = 0; i < nR; i++) for (let j = 0; j < nA; j++) {
    if (!mask[i][j] || seen[i][j]) continue;
    let size = 0;
    const stack: [number, number][] = [[i, j]];
    seen[i][j] = true;
    while (stack.length) {
      const [a, b] = stack.pop()!;
      size++;
      for (const [da, db] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const x = a + da, y = b + db;
        if (x >= 0 && y >= 0 && x < nR && y < nA && mask[x][y] && !seen[x][y]) { seen[x][y] = true; stack.push([x, y]); }
      }
    }
    if (size >= minSize) { count++; cells += size; }
  }
  return { count, cells };
}

export function irisTexture(read: PixelReader, c: Pt, R: number, pupilR: number, w: number, h: number): IrisTexture | null {
  const u = unwrapIris(read, c, R, pupilR, w, h);
  if (!u) return null;
  const { grid, r0, r1 } = u;
  const nR = grid.length, nA = grid[0].length;
  const total = nR * nA;
  const valid = grid.flat().filter(Number.isFinite).length;
  if (valid < Math.max(60, total * 0.4)) return null;

  // Eclairage retire : detail = L* - moyenne locale sur ~1/6 de la largeur de l'anneau
  const k = Math.max(2, Math.round(nR / 6));
  const lm = localMean(grid, k);
  const detail = grid.map((row, i) => row.map((v, j) => (Number.isFinite(v) && Number.isFinite(lm[i][j]) ? v - lm[i][j] : NaN)));
  const flat = detail.flat().filter(Number.isFinite);
  const med = median(flat);
  const relief = 1.4826 * median(flat.map((v) => Math.abs(v - med)));

  // Orientation : differences voisines du detail (eclairage retire) le long du cercle (colonnes) et du rayon (lignes)
  let ga = 0, na = 0, gr = 0, nr = 0;
  for (let i = 0; i < nR; i++) for (let j = 0; j < nA; j++) {
    const v = detail[i][j]; if (!Number.isFinite(v)) continue;
    if (j + 1 < nA && Number.isFinite(detail[i][j + 1])) { ga += Math.abs(detail[i][j + 1] - v); na++; }
    if (i + 1 < nR && Number.isFinite(detail[i + 1][j])) { gr += Math.abs(detail[i + 1][j] - v); nr++; }
  }
  const mA = na ? ga / na : 0, mR = nr ? gr / nr : 0;
  const radialRatio = mA + mR > 0 ? mA / (mA + mR) : 0.5;

  // Cryptes : taches sombres d'au moins ~0,1 % de l'anneau (3 cases minimum)
  const mask = detail.map((row) => row.map((v) => Number.isFinite(v) && v < -CRYPT_DL));
  const { count: cryptCount, cells } = blobs(mask, Math.max(3, Math.round(total * 0.001)));
  const cryptPct = (100 * cells) / Math.max(1, valid);

  // Collerette : plus fort saut de la luminosite moyenne par anneau, entre 15 % et 70 % de la largeur
  const ringMean = grid.map((row) => median(row.filter(Number.isFinite)));
  let best = 0, bestI = -1;
  for (let i = Math.max(1, Math.floor(nR * 0.15)); i < Math.min(nR - 1, Math.ceil(nR * 0.7)); i++) {
    const s = Math.abs(ringMean[i + 1] - ringMean[i - 1]) / 2;
    if (Number.isFinite(s) && s > best) { best = s; bestI = i; }
  }
  const collaretteRatio = bestI >= 0 && best >= 1.5 ? round((r0 + (bestI + 0.5) * ((r1 - r0) / nR)) / R, 2) : null;

  // Classe descriptive (inspiree de la grille cryptes / sillons de Larsson & Pedersen) : lisse et serre -> lache et creuse
  const loose = (relief >= 7 ? 1 : relief >= 4 ? 0.5 : 0) + (cryptPct >= 6 ? 1 : cryptPct >= 2 ? 0.5 : 0);
  const grade: IrisTexture["grade"] = loose >= 1.5 ? "lache" : loose >= 0.5 ? "intermediaire" : "dense";

  const confidence = clamp01(Math.min(1, (R - MIN_R_PX) / 36) * (valid / total) * 1.15);
  return {
    relief: round(relief, 1),
    radialRatio: round(radialRatio, 2),
    cryptCount,
    cryptPct: round(cryptPct, 1),
    collaretteRatio,
    grade,
    confidence: round(confidence, 2),
  };
}

export const TEXTURE_LABEL: Record<IrisTexture["grade"], string> = {
  dense: "dense, fibres serrées",
  intermediaire: "intermédiaire",
  lache: "lâche, à cryptes marquées",
};

/** Lecture courte de l'orientation des fibres. */
export function fiberLabel(radialRatio: number): string {
  if (radialRatio >= 0.58) return "stries radiaires dominantes";
  if (radialRatio <= 0.42) return "anneaux / sillons dominants";
  return "mixte";
}
