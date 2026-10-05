// Mesures objectives du visage, calculees sur la photo a partir des 478 points MediaPipe Face Landmarker
// et de la couleur de la peau. Module pur (aucune dependance navigateur) : teste dans tests/face-metrics.test.ts.
//
// Principes :
// - Tout est normalise par la distance entre les yeux (IOD) : la distance a l'objectif ne change rien.
// - Les mesures de couleur sont RELATIVES dans la meme photo (sous l'oeil vs joue, levres vs joue) pour
//   resister a l'eclairage ; les rares mesures absolues sont signalees comme telles.
// - Aucune norme "medicale" : chaque mesure est comparee a TA propre reference (mediane de tes scans).

export const FACE_METRICS_VERSION = 1;

export interface Pt { x: number; y: number }
/** Lit un pixel (coordonnees image en px) -> [r, g, b] 0-255. */
export type PixelReader = (x: number, y: number) => [number, number, number];

export interface FaceMetrics {
  version: number;
  quality: {
    score: number;               // 0-100
    yawDeg: number;              // rotation gauche/droite estimee
    pitchDeg: number | null;     // inclinaison haut/bas (si matrice dispo)
    luminance: number;           // L* moyen des joues
    iodPx: number;               // distance inter-yeux en pixels
    warnings: string[];
  };
  // Geometrie (sans unite, normalisee par IOD ou par la largeur des pommettes)
  volumeBasVisage: number;       // aire du bas du visage / IOD^2
  largeurJoues: number;          // largeur au niveau des joues basses / IOD
  ratioJoues: number;            // joues basses / pommettes
  ratioMachoire: number;         // machoire / pommettes
  fwhr: number;                  // largeur pommettes / hauteur haut du visage
  ouvertureYeux: number;         // eye aspect ratio moyen
  asymYeux: number;              // ecart d'ouverture entre les deux yeux (%)
  coinsBouche: number;           // coins plus bas que le centre des levres (x100 / IOD) : >0 = tombants
  symetrie: number;              // erreur miroir moyenne (x100 / IOD) : plus bas = plus symetrique
  // Couleur (CIELAB)
  cernes: number;                // L* joue - L* sous l'oeil : plus haut = cernes plus marques
  rougeur: number;               // a* moyen des joues (absolu, sensible a la lumiere)
  uniformite: number;            // ecart-type de L* entre front, joues, menton : plus bas = teint plus uniforme
  levres: number;                // a* levres - a* joues : plus bas = levres plus pales
  luminosite: number;            // L* des joues (absolu, depend surtout de l'eclairage)
  // Expressions MediaPipe (0-1), si disponibles
  plisserYeux?: number;          // eyeSquint moyen
  moue?: number;                 // mouthFrown moyen
  // Reperes pour l'avant/apres aligne (coordonnees normalisees 0-1)
  anchors: { le: [number, number]; re: [number, number]; chin: [number, number] };
}

// ─── Indices MediaPipe (maillage 478 points) ───────────────────────────────────────────────────
const L = {
  eyeA: { outer: 33, inner: 133, top: [159, 158], bottom: [145, 153] },
  eyeB: { outer: 263, inner: 362, top: [386, 385], bottom: [374, 380] },
  cheekbone: [234, 454],
  lowCheek: [132, 361],
  jaw: [172, 397],
  browMid: 168,
  upperLip: 0,
  lipTop: 13,
  lipBottom: 14,
  mouth: [61, 291],
  chin: 152,
  // Contour du bas du visage, de la pommette gauche a la droite en passant par le menton
  lowerContour: [234, 93, 132, 58, 172, 136, 150, 149, 176, 148, 152, 377, 400, 378, 379, 365, 397, 288, 361, 323, 454],
  midline: [10, 151, 9, 8, 168, 6, 197, 195, 5, 4, 1, 19, 94, 2, 164, 0, 11, 12, 13, 14, 15, 16, 17, 18, 200, 199, 175, 152],
  // Paires symetriques (gauche, droite)
  pairs: [[33, 263], [133, 362], [159, 386], [145, 374], [61, 291], [234, 454], [93, 323], [132, 361], [58, 288],
    [172, 397], [70, 300], [105, 334], [107, 336], [50, 280], [205, 425], [129, 358], [48, 278], [136, 365], [150, 379]],
  // Zones de peau pour la couleur
  underEyeA: [111, 117, 118, 119, 120, 121],
  underEyeB: [340, 346, 347, 348, 349, 350],
  cheekA: 205, cheekB: 425, forehead: 151, chinSkin: 199,
  lowerLip: [14, 17],
} as const;

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
const mid = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / Math.max(1, xs.length);
const r = (x: number, d = 3) => Math.round(x * 10 ** d) / 10 ** d;

function polygonArea(pts: Pt[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    a += p.x * q.y - q.x * p.y;
  }
  return Math.abs(a) / 2;
}

function centroid(pts: Pt[]): Pt {
  return { x: mean(pts.map((p) => p.x)), y: mean(pts.map((p) => p.y)) };
}

/** Eye aspect ratio : hauteur moyenne de l'oeil / largeur. */
function ear(p: Pt[], e: { outer: number; inner: number; top: readonly number[]; bottom: readonly number[] }): number {
  const h = (dist(p[e.top[0]], p[e.bottom[0]]) + dist(p[e.top[1]], p[e.bottom[1]])) / 2;
  return h / Math.max(1e-6, dist(p[e.outer], p[e.inner]));
}

/** Reflete un point par rapport a la droite (a, direction unitaire u). */
function reflect(p: Pt, a: Pt, u: Pt): Pt {
  const vx = p.x - a.x, vy = p.y - a.y;
  const t = vx * u.x + vy * u.y;
  const px = a.x + t * u.x, py = a.y + t * u.y;
  return { x: 2 * px - p.x, y: 2 * py - p.y };
}

/** Droite des moindres carres (axe principal) passant par les points de la ligne mediane. */
function fitLine(pts: Pt[]): { a: Pt; u: Pt } {
  const c = centroid(pts);
  let sxx = 0, syy = 0, sxy = 0;
  for (const p of pts) { const dx = p.x - c.x, dy = p.y - c.y; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; }
  const theta = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  return { a: c, u: { x: Math.cos(theta), y: Math.sin(theta) } };
}

// ─── Couleur : sRGB -> CIELAB (D65) ────────────────────────────────────────────────────────────
export function rgbToLab([R, G, B]: [number, number, number]): [number, number, number] {
  const lin = (c: number) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const rl = lin(R), gl = lin(G), bl = lin(B);
  const x = (rl * 0.4124 + gl * 0.3576 + bl * 0.1805) / 0.95047;
  const y = (rl * 0.2126 + gl * 0.7152 + bl * 0.0722) / 1.0;
  const z = (rl * 0.0193 + gl * 0.1192 + bl * 0.9505) / 1.08883;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const fx = f(x), fy = f(y), fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** Moyenne Lab d'un disque de rayon `radius` px autour de `c`. */
function patchLab(read: PixelReader, c: Pt, radius: number, w: number, h: number): [number, number, number] {
  const acc = [0, 0, 0];
  let n = 0;
  const rr = Math.max(1, Math.round(radius));
  const step = rr > 8 ? 2 : 1;
  for (let dy = -rr; dy <= rr; dy += step) {
    for (let dx = -rr; dx <= rr; dx += step) {
      if (dx * dx + dy * dy > rr * rr) continue;
      const x = Math.round(c.x + dx), y = Math.round(c.y + dy);
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const lab = rgbToLab(read(x, y));
      acc[0] += lab[0]; acc[1] += lab[1]; acc[2] += lab[2]; n++;
    }
  }
  return n ? [acc[0] / n, acc[1] / n, acc[2] / n] : [NaN, NaN, NaN];
}

const std = (xs: number[]) => { const m = mean(xs); return Math.sqrt(mean(xs.map((x) => (x - m) ** 2))); };

export interface MetricsInput {
  /** Points en coordonnees normalisees 0-1 (sortie MediaPipe). */
  landmarks: { x: number; y: number }[];
  width: number;
  height: number;
  read: PixelReader;
  /** Matrice 4x4 de transformation faciale (colonne majeure), si disponible. */
  matrix?: number[];
  blendshapes?: Record<string, number>;
}

/** Calcule toutes les mesures d'une photo. Renvoie null si le maillage est incomplet. */
export function computeFaceMetrics(inp: MetricsInput): FaceMetrics | null {
  if (inp.landmarks.length < 468) return null;
  const P: Pt[] = inp.landmarks.map((p) => ({ x: p.x * inp.width, y: p.y * inp.height }));
  const eyeA = mid(P[L.eyeA.outer], P[L.eyeA.inner]);
  const eyeB = mid(P[L.eyeB.outer], P[L.eyeB.inner]);
  const iod = dist(eyeA, eyeB);
  if (!(iod > 1)) return null;

  const width = (pair: readonly number[]) => dist(P[pair[0]], P[pair[1]]);
  const wCheekbone = width(L.cheekbone);

  // Geometrie
  const volumeBasVisage = polygonArea(L.lowerContour.map((i) => P[i])) / (iod * iod);
  const largeurJoues = width(L.lowCheek) / iod;
  const ratioJoues = width(L.lowCheek) / wCheekbone;
  const ratioMachoire = width(L.jaw) / wCheekbone;
  const fwhr = wCheekbone / Math.max(1e-6, dist(P[L.browMid], P[L.upperLip]));
  const earA = ear(P, L.eyeA), earB = ear(P, L.eyeB);
  const ouvertureYeux = (earA + earB) / 2;
  const asymYeux = (Math.abs(earA - earB) / Math.max(1e-6, ouvertureYeux)) * 100;

  // Coins de la bouche, mesures perpendiculairement a l'axe des yeux (insensible a l'inclinaison de la tete)
  const ex = (eyeB.x - eyeA.x) / iod, ey = (eyeB.y - eyeA.y) / iod;      // axe des yeux
  const down = (p: Pt, ref: Pt) => (p.x - ref.x) * -ey + (p.y - ref.y) * ex; // composante "vers le bas"
  const lipCenter = mid(P[L.lipTop], P[L.lipBottom]);
  const coinsBouche = ((down(P[L.mouth[0]], lipCenter) + down(P[L.mouth[1]], lipCenter)) / 2 / iod) * 100;

  // Symetrie : erreur moyenne entre chaque point et le reflet de son symetrique
  const axis = fitLine(L.midline.map((i) => P[i]));
  const symetrie = (mean(L.pairs.map(([a, b]) => dist(P[a], reflect(P[b], axis.a, axis.u)))) / iod) * 100;

  // Rotation : matrice MediaPipe si dispo, sinon estimation par la position du nez entre les pommettes
  let yawDeg: number, pitchDeg: number | null = null;
  if (inp.matrix && inp.matrix.length === 16) {
    const m = inp.matrix;
    yawDeg = (Math.asin(Math.max(-1, Math.min(1, -m[2]))) * 180) / Math.PI;
    pitchDeg = (Math.atan2(m[6], m[10]) * 180) / Math.PI;
  } else {
    const dA = dist(P[1], P[L.cheekbone[0]]), dB = dist(P[1], P[L.cheekbone[1]]);
    yawDeg = (Math.asin(Math.max(-1, Math.min(1, (dA - dB) / (dA + dB)))) * 180) / Math.PI;
  }

  // Couleur
  const rad = iod * 0.1;
  const lab = (c: Pt, k = 1) => patchLab(inp.read, c, rad * k, inp.width, inp.height);
  const underA = lab(centroid(L.underEyeA.map((i) => P[i])), 0.8);
  const underB = lab(centroid(L.underEyeB.map((i) => P[i])), 0.8);
  const cheekA = lab(P[L.cheekA], 1.4), cheekB = lab(P[L.cheekB], 1.4);
  const forehead = lab(P[L.forehead], 1.4), chin = lab(P[L.chinSkin], 1.1);
  const lip = lab(mid(P[L.lowerLip[0]], P[L.lowerLip[1]]), 0.6);
  const cheekL = (cheekA[0] + cheekB[0]) / 2, cheekAstar = (cheekA[1] + cheekB[1]) / 2;
  const cernes = cheekL - (underA[0] + underB[0]) / 2;
  const uniformite = std([forehead[0], cheekA[0], cheekB[0], chin[0]]);
  const levres = lip[1] - cheekAstar;

  // Qualite de la photo
  const warnings: string[] = [];
  let score = 100;
  if (Math.abs(yawDeg) > 12) { warnings.push("Visage tourné : regarde l'objectif bien en face"); score -= Math.min(40, (Math.abs(yawDeg) - 12) * 3); }
  if (pitchDeg !== null && Math.abs(pitchDeg) > 15) { warnings.push("Tête inclinée vers le haut ou le bas"); score -= Math.min(25, (Math.abs(pitchDeg) - 15) * 2); }
  if (cheekL < 35) { warnings.push("Photo sombre : mets-toi face à une fenêtre"); score -= 20; }
  if (cheekL > 85) { warnings.push("Photo surexposée"); score -= 15; }
  if (iod < 50) { warnings.push("Visage trop petit : rapproche-toi"); score -= 20; }

  const bs = inp.blendshapes;
  const anchors = {
    le: [r(eyeA.x / inp.width, 4), r(eyeA.y / inp.height, 4)] as [number, number],
    re: [r(eyeB.x / inp.width, 4), r(eyeB.y / inp.height, 4)] as [number, number],
    chin: [r(P[L.chin].x / inp.width, 4), r(P[L.chin].y / inp.height, 4)] as [number, number],
  };

  return {
    version: FACE_METRICS_VERSION,
    quality: { score: Math.max(0, Math.round(score)), yawDeg: r(yawDeg, 1), pitchDeg: pitchDeg === null ? null : r(pitchDeg, 1), luminance: r(cheekL, 1), iodPx: Math.round(iod), warnings },
    volumeBasVisage: r(volumeBasVisage),
    largeurJoues: r(largeurJoues),
    ratioJoues: r(ratioJoues),
    ratioMachoire: r(ratioMachoire),
    fwhr: r(fwhr),
    ouvertureYeux: r(ouvertureYeux),
    asymYeux: r(asymYeux, 1),
    coinsBouche: r(coinsBouche, 2),
    symetrie: r(symetrie, 2),
    cernes: r(cernes, 2),
    rougeur: r(cheekAstar, 2),
    uniformite: r(uniformite, 2),
    levres: r(levres, 2),
    luminosite: r(cheekL, 1),
    ...(bs ? {
      plisserYeux: r(((bs.eyeSquintLeft ?? 0) + (bs.eyeSquintRight ?? 0)) / 2),
      moue: r(((bs.mouthFrownLeft ?? 0) + (bs.mouthFrownRight ?? 0)) / 2),
    } : {}),
    anchors,
  };
}

// ─── Reference personnelle et index ────────────────────────────────────────────────────────────

export type MetricKey =
  | "volumeBasVisage" | "largeurJoues" | "ratioJoues" | "ratioMachoire" | "ouvertureYeux" | "coinsBouche"
  | "symetrie" | "cernes" | "rougeur" | "uniformite" | "levres";

export interface MetricInfo {
  key: MetricKey;
  label: string;
  /** Sens "plus marque" : +1 si une valeur haute = trait plus marque. */
  higher: string;
  lower: string;
  /** Ecart minimal considere comme significatif (evite qu'un historique tres stable grossisse le bruit). */
  minSpread: number;
  group: "volume" | "fatigue" | "teint" | "symetrie";
}

export const METRICS: MetricInfo[] = [
  { key: "volumeBasVisage", label: "Volume du bas du visage", higher: "plus plein", lower: "plus affiné", minSpread: 0.04, group: "volume" },
  { key: "ratioJoues", label: "Joues / pommettes", higher: "plus pleines", lower: "plus creusées", minSpread: 0.008, group: "volume" },
  { key: "ratioMachoire", label: "Mâchoire / pommettes", higher: "plus large", lower: "plus dessinée", minSpread: 0.008, group: "volume" },
  { key: "cernes", label: "Cernes", higher: "plus marqués", lower: "moins marqués", minSpread: 0.8, group: "fatigue" },
  { key: "ouvertureYeux", label: "Ouverture des yeux", higher: "plus ouverts", lower: "moins ouverts", minSpread: 0.012, group: "fatigue" },
  { key: "coinsBouche", label: "Coins de la bouche", higher: "plus tombants", lower: "plus relevés", minSpread: 0.6, group: "fatigue" },
  { key: "uniformite", label: "Uniformité du teint", higher: "moins uniforme", lower: "plus uniforme", minSpread: 0.5, group: "teint" },
  { key: "rougeur", label: "Rougeur des joues", higher: "plus rouges", lower: "moins rouges", minSpread: 0.8, group: "teint" },
  { key: "levres", label: "Couleur des lèvres", higher: "plus colorées", lower: "plus pâles", minSpread: 0.8, group: "teint" },
  { key: "symetrie", label: "Asymétrie", higher: "moins symétrique", lower: "plus symétrique", minSpread: 0.25, group: "symetrie" },
];

export interface Baseline { median: number; spread: number; n: number }

const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

/** Reference personnelle : mediane et dispersion robuste (MAD) des scans de bonne qualite. */
export function computeBaselines(all: FaceMetrics[], minQuality = 60): Partial<Record<MetricKey, Baseline>> {
  const good = all.filter((m) => m.quality.score >= minQuality);
  const out: Partial<Record<MetricKey, Baseline>> = {};
  for (const info of METRICS) {
    const xs = good.map((m) => m[info.key]).filter((x): x is number => typeof x === "number" && Number.isFinite(x));
    if (xs.length < 3) continue;
    const md = median(xs);
    const mad = median(xs.map((x) => Math.abs(x - md))) * 1.4826;
    out[info.key] = { median: md, spread: Math.max(mad, info.minSpread), n: xs.length };
  }
  return out;
}

/** Ecart a la reference en "ecarts habituels" (z robuste). */
export function zScore(value: number, b: Baseline | undefined): number | null {
  if (!b) return null;
  return (value - b.median) / b.spread;
}

export function describeZ(z: number | null, info: MetricInfo): string {
  if (z === null) return "référence en construction";
  const a = Math.abs(z);
  if (a < 0.6) return "comme d'habitude";
  const word = z > 0 ? info.higher : info.lower;
  return a < 1.5 ? `un peu ${word}` : `nettement ${word}`;
}

export interface FaceIndexes { volume: number | null; fatigue: number | null; teint: number | null }

const toIndex = (z: number) => Math.round(Math.max(0, Math.min(100, 50 + 15 * z)));

/**
 * Index 0-100 centres sur TON habitude (50 = comme d'habitude).
 * Volume : plus haut = visage plus plein. Fatigue : plus haut = plus de signes de fatigue. Teint : plus haut = teint plus irregulier/terne.
 */
export function faceIndexes(m: FaceMetrics, b: Partial<Record<MetricKey, Baseline>>): FaceIndexes {
  const z = (k: MetricKey) => zScore(m[k] as number, b[k]);
  const combine = (parts: [number | null, number][]) => {
    const ok = parts.filter((p): p is [number, number] => p[0] !== null);
    if (ok.length === 0) return null;
    const wsum = ok.reduce((s, [, w]) => s + Math.abs(w), 0);
    return toIndex(ok.reduce((s, [v, w]) => s + v * w, 0) / wsum);
  };
  const zl = z("levres");
  return {
    volume: combine([[z("volumeBasVisage"), 0.5], [z("ratioJoues"), 0.3], [z("ratioMachoire"), 0.2]]),
    fatigue: combine([[z("cernes"), 0.5], [z("ouvertureYeux") === null ? null : -z("ouvertureYeux")!, 0.3], [z("coinsBouche"), 0.2]]),
    teint: combine([[z("uniformite"), 0.6], [zl === null ? null : -zl, 0.4]]),
  };
}

/** Correlation de Pearson (null si moins de 4 paires). */
export function pearson(pairs: [number, number][]): number | null {
  if (pairs.length < 4) return null;
  const mx = mean(pairs.map((p) => p[0])), my = mean(pairs.map((p) => p[1]));
  let sxy = 0, sxx = 0, syy = 0;
  for (const [x, y] of pairs) { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; syy += (y - my) ** 2; }
  if (sxx === 0 || syy === 0) return null;
  return sxy / Math.sqrt(sxx * syy);
}

/**
 * Transformation (similitude) qui place les deux yeux a des positions fixes : sert a l'avant/apres aligne.
 * Renvoie [a, b, c, d, e, f] pour ctx.setTransform, image source en px -> canvas.
 */
export function alignTransform(
  anchors: FaceMetrics["anchors"], imgW: number, imgH: number,
  target: { le: Pt; re: Pt },
): [number, number, number, number, number, number] {
  const sx = { x: anchors.le[0] * imgW, y: anchors.le[1] * imgH };
  const sy = { x: anchors.re[0] * imgW, y: anchors.re[1] * imgH };
  const vs = { x: sy.x - sx.x, y: sy.y - sx.y }, vt = { x: target.re.x - target.le.x, y: target.re.y - target.le.y };
  const s = Math.hypot(vt.x, vt.y) / Math.max(1e-6, Math.hypot(vs.x, vs.y));
  const ang = Math.atan2(vt.y, vt.x) - Math.atan2(vs.y, vs.x);
  const a = s * Math.cos(ang), b = s * Math.sin(ang);
  // x' = a*x - b*y + e ; y' = b*x + a*y + f  (forme canvas : [a, b, -b, a, e, f])
  const e = target.le.x - (a * sx.x - b * sx.y);
  const f = target.le.y - (b * sx.x + a * sx.y);
  return [a, b, -b, a, e, f];
}

/** Valide des mesures recues du navigateur avant de les enregistrer (null si invalides). */
export function sanitizeMetrics(x: unknown): FaceMetrics | null {
  if (!x || typeof x !== "object") return null;
  const m = x as Record<string, unknown>;
  const num = (v: unknown) => typeof v === "number" && Number.isFinite(v);
  if (m.version !== FACE_METRICS_VERSION) return null;
  const numeric = ["volumeBasVisage", "largeurJoues", "ratioJoues", "ratioMachoire", "fwhr", "ouvertureYeux", "asymYeux",
    "coinsBouche", "symetrie", "cernes", "rougeur", "uniformite", "levres", "luminosite"];
  if (!numeric.every((k) => num(m[k]))) return null;
  const q = m.quality as Record<string, unknown> | undefined;
  if (!q || !num(q.score) || !num(q.yawDeg) || !num(q.luminance) || !num(q.iodPx) || !Array.isArray(q.warnings)) return null;
  const a = m.anchors as Record<string, unknown> | undefined;
  const pair = (p: unknown) => Array.isArray(p) && p.length === 2 && p.every(num);
  if (!a || !pair(a.le) || !pair(a.re) || !pair(a.chin)) return null;
  const out: FaceMetrics = {
    version: FACE_METRICS_VERSION,
    quality: {
      score: q.score as number, yawDeg: q.yawDeg as number, pitchDeg: num(q.pitchDeg) ? (q.pitchDeg as number) : null,
      luminance: q.luminance as number, iodPx: q.iodPx as number,
      warnings: (q.warnings as unknown[]).filter((w): w is string => typeof w === "string").slice(0, 6).map((w) => w.slice(0, 120)),
    },
    anchors: { le: a.le as [number, number], re: a.re as [number, number], chin: a.chin as [number, number] },
  } as FaceMetrics;
  for (const k of numeric) (out as unknown as Record<string, number>)[k] = m[k] as number;
  if (num(m.plisserYeux)) out.plisserYeux = m.plisserYeux as number;
  if (num(m.moue)) out.moue = m.moue as number;
  return out;
}

/** Texte compact pour l'IA : mesures de la photo, reference personnelle et tendance sur tout l'historique. */
export function metricsContext(current: FaceMetrics | null, history: { date: string; metrics: FaceMetrics }[]): string {
  const lines: string[] = [];
  const b = computeBaselines(history.map((h) => h.metrics));
  const fmt = (v: number) => (Math.round(v * 100) / 100).toString().replace(".", ",");
  if (current) {
    lines.push(`Qualité de la photo : ${current.quality.score}/100${current.quality.warnings.length ? ` (${current.quality.warnings.join(" ; ")})` : ""}.`);
    lines.push(`Mesures objectives de CETTE photo, comparées à la référence personnelle (médiane de ses scans) :`);
    for (const info of METRICS) {
      const v = current[info.key] as number;
      const base = b[info.key];
      lines.push(`- ${info.label} : ${fmt(v)}${base ? ` (référence ${fmt(base.median)}, ${describeZ(zScore(v, base), info)})` : " (référence en construction)"}`);
    }
    const idx = faceIndexes(current, b);
    lines.push(`Index (50 = son habitude) : volume ${idx.volume ?? "?"}, fatigue ${idx.fatigue ?? "?"}, teint ${idx.teint ?? "?"}.`);
  }
  const sorted = [...history].sort((x, y) => x.date.localeCompare(y.date)).filter((h) => h.metrics.quality.score >= 60);
  if (sorted.length >= 6) {
    const k = Math.min(5, Math.floor(sorted.length / 3));
    const first = sorted.slice(0, k), last = sorted.slice(-k);
    lines.push(`Tendance sur tout l'historique (${sorted.length} photos exploitables, du ${sorted[0].date} au ${sorted[sorted.length - 1].date}), moyenne des ${k} premières vs des ${k} dernières :`);
    for (const info of METRICS) {
      const a = mean(first.map((h) => h.metrics[info.key] as number)), z = mean(last.map((h) => h.metrics[info.key] as number));
      const base = b[info.key];
      const shift = base ? (z - a) / base.spread : 0;
      lines.push(`- ${info.label} : ${fmt(a)} → ${fmt(z)}${Math.abs(shift) >= 0.6 ? ` (${shift > 0 ? info.higher : info.lower})` : " (stable)"}`);
    }
  }
  return lines.join("\n");
}

export interface FaceReportSummary {
  count: number;            // scans mesures sur tout l'historique
  latestDate: string;
  quality: number;
  indexes: FaceIndexes;
  notable: string[];        // ecarts du dernier scan vs la reference ("Cernes : un peu plus marqués")
  trend: string[];          // evolution de fond, premieres vs dernieres photos
}

/** Resume des mesures objectives pour le rapport (et donc le podcast / les infographies). */
export function summarizeForReport(history: { date: string; metrics: FaceMetrics }[]): FaceReportSummary | null {
  const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length === 0) return null;
  const latest = sorted[sorted.length - 1];
  const b = computeBaselines(sorted.map((h) => h.metrics));
  const notable = METRICS.flatMap((info) => {
    const z = zScore(latest.metrics[info.key] as number, b[info.key]);
    return z !== null && Math.abs(z) >= 0.6 ? [`${info.label} : ${describeZ(z, info)}`] : [];
  });
  const good = sorted.filter((h) => h.metrics.quality.score >= 60);
  const trend: string[] = [];
  if (good.length >= 6) {
    const k = Math.min(5, Math.floor(good.length / 3));
    for (const info of METRICS) {
      const base = b[info.key];
      if (!base) continue;
      const a = mean(good.slice(0, k).map((h) => h.metrics[info.key] as number));
      const z = mean(good.slice(-k).map((h) => h.metrics[info.key] as number));
      const shift = (z - a) / base.spread;
      if (Math.abs(shift) >= 0.6) trend.push(`${info.label} : ${shift > 0 ? info.higher : info.lower} depuis le début`);
    }
  }
  return { count: sorted.length, latestDate: latest.date, quality: latest.metrics.quality.score, indexes: faceIndexes(latest.metrics, b), notable, trend };
}
