// Mesures de l'oeil a partir des points MediaPipe (iris inclus) et des pixels. Module pur (tests/eye-metrics.test.ts).
//
// Regle physique : le diametre visible de l'iris (HVID) vaut ~11,7 mm chez l'adulte, avec peu de variation
// (Rufer et al. 2005) -> sert d'echelle pour donner pupille, ouverture des paupieres, etc. en millimetres.
// "A" = oeil droit de la personne (a gauche sur l'image non miroir), "B" = oeil gauche.

import { rgbToLab, type PixelReader, type Pt } from "./face-metrics";

export const EYE_METRICS_VERSION = 1;
export const HVID_MM = 11.7;

export interface EyeSide {
  irisPx: number;
  pupilMm: number | null;        // null si la pupille ne se distingue pas de l'iris (iris tres fonce, flou)
  pupilContrast: number;         // ecart de luminosite pupille -> iris (L*)
  mrd1Mm: number;                // centre de la pupille -> bord de la paupiere superieure
  mrd2Mm: number;                // centre -> paupiere inferieure
  rednessA: number | null;       // a* moyen du blanc de l'oeil (rougeur)
  scleraB: number | null;        // b* median du blanc de l'oeil (jaunissement)
  arcus: number | null;          // L* bord de l'iris - L* milieu de l'iris (anneau clair = arc corneen)
}

export interface EyeMetrics {
  version: number;
  A: EyeSide;
  B: EyeSide;
  anisocoriaMm: number | null;
  quality: { score: number; warnings: string[] };
}

const EYES = {
  A: { iris: 468, ring: [469, 470, 471, 472], inner: 133, outer: 33, upper: 159, lower: 145 },
  B: { iris: 473, ring: [474, 475, 476, 477], inner: 362, outer: 263, upper: 386, lower: 374 },
} as const;

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
const median = (xs: number[]) => { if (!xs.length) return NaN; const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / Math.max(1, xs.length);
const round = (x: number, d = 2) => Math.round(x * 10 ** d) / 10 ** d;

function lumAt(read: PixelReader, x: number, y: number, w: number, h: number): number | null {
  const xi = Math.round(x), yi = Math.round(y);
  if (xi < 0 || yi < 0 || xi >= w || yi >= h) return null;
  return rgbToLab(read(xi, yi))[0];
}

/** Luminosite mediane sur un cercle, angles de la moitie basse elargie (evite paupiere superieure et cils). */
function ringL(read: PixelReader, c: Pt, r: number, w: number, h: number): number {
  const vals: number[] = [];
  for (let a = -25; a <= 205; a += 7.5) {
    const t = (a * Math.PI) / 180;
    const v = lumAt(read, c.x + r * Math.cos(t), c.y + r * Math.sin(t), w, h);
    if (v !== null) vals.push(v);
  }
  return median(vals);
}

/**
 * Pupille : profil radial de luminosite depuis le centre de l'iris ; le bord est le saut le plus fort
 * (sombre -> plus clair) entre 15 % et 75 % du rayon de l'iris. La mediane par cercle ignore le reflet de l'ecran.
 */
export function detectPupil(read: PixelReader, c: Pt, irisR: number, w: number, h: number): { r: number; contrast: number } | null {
  const step = Math.max(0.5, irisR / 60);
  const radii: number[] = [], prof: number[] = [];
  for (let r = irisR * 0.08; r <= irisR * 0.85; r += step) { radii.push(r); prof.push(ringL(read, c, r, w, h)); }
  const k = Math.max(1, Math.round(irisR * 0.06 / step));
  const grad: { r: number; g: number }[] = [];
  for (let i = k; i < prof.length - k; i++) {
    const r = radii[i];
    if (r < irisR * 0.15 || r > irisR * 0.75) continue;
    grad.push({ r, g: prof[i + k] - prof[i - k] });
  }
  if (!grad.length) return null;
  const best = grad.reduce((a, b) => (b.g > a.g ? b : a));
  if (!Number.isFinite(best.g)) return null;
  // Le saut forme un plateau de largeur ~2k : le bord est au milieu du plateau, pas a son debut
  const i0 = grad.indexOf(best);
  let lo = i0, hi = i0;
  while (lo > 0 && grad[lo - 1].g >= best.g * 0.9) lo--;
  while (hi < grad.length - 1 && grad[hi + 1].g >= best.g * 0.9) hi++;
  return { r: (grad[lo].r + grad[hi].r) / 2, contrast: best.g };
}

function measureSide(P: Pt[], e: (typeof EYES)["A"] | (typeof EYES)["B"], read: PixelReader, w: number, h: number): EyeSide {
  const c = P[e.iris];
  // Diametre de l'iris : MediaPipe estime le contour complet ; on garde la plus grande des deux paires opposees
  const irisPx = Math.max(dist(P[e.ring[0]], P[e.ring[2]]), dist(P[e.ring[1]], P[e.ring[3]]));
  const R = irisPx / 2;
  const mmPerPx = HVID_MM / Math.max(1, irisPx);

  // Axe de l'oeil -> direction "haut" perpendiculaire (insensible a l'inclinaison de la tete)
  const ax = P[e.outer].x - P[e.inner].x, ay = P[e.outer].y - P[e.inner].y;
  const n = Math.hypot(ax, ay) || 1;
  let ux = -ay / n, uy = ax / n;
  if (uy > 0) { ux = -ux; uy = -uy; }                         // "haut" = y image decroissant
  const up = (p: Pt) => (p.x - c.x) * ux + (p.y - c.y) * uy;
  const mrd1Mm = Math.max(0, up(P[e.upper])) * mmPerPx;
  const mrd2Mm = Math.max(0, -up(P[e.lower])) * mmPerPx;

  const pupil = detectPupil(read, c, R, w, h);
  const pupilMmRaw = pupil ? 2 * pupil.r * mmPerPx : null;
  const pupilOk = pupil && pupil.contrast >= 6 && pupilMmRaw! >= 1.5 && pupilMmRaw! <= 9;

  // Blanc de l'oeil : petites zones entre le bord de l'iris et chaque coin
  const scl: [number, number, number][] = [];
  for (const corner of [P[e.inner], P[e.outer]]) {
    const d = dist(c, corner);
    if (d < R * 1.4) continue;
    for (const f of [0.35, 0.55, 0.75]) {
      const rr = R * 1.15 + (d - R * 1.35) * f;
      const px = { x: c.x + ((corner.x - c.x) / d) * rr, y: c.y + ((corner.y - c.y) / d) * rr };
      const rad = Math.max(1, Math.round(R * 0.12));
      for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) {
        const xi = Math.round(px.x + dx), yi = Math.round(px.y + dy);
        if (xi >= 0 && yi >= 0 && xi < w && yi < h) scl.push(rgbToLab(read(xi, yi)));
      }
    }
  }
  const white = scl.filter((v) => v[0] >= 55);
  const vessel = scl.filter((v) => v[0] >= 35);
  const scleraB = white.length >= 8 ? median(white.map((v) => v[2])) : null;
  const rednessA = vessel.length >= 8 ? mean(vessel.map((v) => v[1])) : null;

  // Arc corneen : anneau exterieur de l'iris nettement plus clair que son milieu
  const outer = ringL(read, c, R * 0.92, w, h), midI = ringL(read, c, R * 0.6, w, h);
  const arcus = Number.isFinite(outer) && Number.isFinite(midI) ? outer - midI : null;

  return {
    irisPx: round(irisPx, 1),
    pupilMm: pupilOk ? round(pupilMmRaw!) : null,
    pupilContrast: round(pupil?.contrast ?? 0, 1),
    mrd1Mm: round(mrd1Mm), mrd2Mm: round(mrd2Mm),
    rednessA: rednessA === null ? null : round(rednessA),
    scleraB: scleraB === null ? null : round(scleraB),
    arcus: arcus === null ? null : round(arcus, 1),
  };
}

export interface EyeInput { landmarks: { x: number; y: number }[]; width: number; height: number; read: PixelReader }

export function computeEyeMetrics(inp: EyeInput): EyeMetrics | null {
  if (inp.landmarks.length < 478) return null;
  const P: Pt[] = inp.landmarks.map((p) => ({ x: p.x * inp.width, y: p.y * inp.height }));
  const A = measureSide(P, EYES.A, inp.read, inp.width, inp.height);
  const B = measureSide(P, EYES.B, inp.read, inp.width, inp.height);
  const warnings: string[] = [];
  let score = 100;
  const irisMin = Math.min(A.irisPx, B.irisPx);
  if (irisMin < 28) { warnings.push("Yeux trop petits sur l'image : rapproche le téléphone (25-30 cm)"); score -= 35; }
  if (Math.abs(A.irisPx - B.irisPx) / Math.max(A.irisPx, B.irisPx) > 0.12) { warnings.push("Tête tournée : regarde l'écran bien en face"); score -= 25; }
  if (A.pupilMm === null || B.pupilMm === null) { warnings.push("Pupille peu visible (iris foncé ou flou) : mesures de pupille indisponibles"); score -= 10; }
  if (A.mrd1Mm < 0.5 && B.mrd1Mm < 0.5) { warnings.push("Yeux trop fermés : ouvre grand les yeux"); score -= 30; }
  return {
    version: EYE_METRICS_VERSION, A, B,
    anisocoriaMm: A.pupilMm !== null && B.pupilMm !== null ? round(Math.abs(A.pupilMm - B.pupilMm)) : null,
    quality: { score: Math.max(0, score), warnings },
  };
}

// ─── Conjonctive (paupiere inferieure tiree) ───────────────────────────────────────────────────

export interface Conjunctiva { eye: "A" | "B"; pallorIndex: number; bandMm: number }

/**
 * Rougeur de la conjonctive palpebrale relative au blanc de l'oeil (a* conjonctive - a* sclere) :
 * plus bas = plus pale (Sheth et al. 1997 ; Collings et al. 2016, photos de conjonctive et anemie).
 * On prend l'oeil dont la paupiere est la plus tiree. null si aucune bande assez visible.
 */
export function computeConjunctiva(inp: EyeInput): Conjunctiva | null {
  if (inp.landmarks.length < 478) return null;
  const P: Pt[] = inp.landmarks.map((p) => ({ x: p.x * inp.width, y: p.y * inp.height }));
  let best: Conjunctiva | null = null;
  for (const key of ["A", "B"] as const) {
    const e = EYES[key];
    const c = P[e.iris];
    const R = Math.max(dist(P[e.ring[0]], P[e.ring[2]]), dist(P[e.ring[1]], P[e.ring[3]])) / 2;
    const top = c.y + R * 1.25, bottom = P[e.lower].y - R * 0.1;
    const bandPx = bottom - top;
    if (bandPx < R * 0.3) continue;
    const conj: [number, number, number][] = [];
    for (let y = Math.round(top); y <= Math.round(bottom); y++) {
      for (let x = Math.round(c.x - R * 0.7); x <= Math.round(c.x + R * 0.7); x++) {
        if (x >= 0 && y >= 0 && x < inp.width && y < inp.height) conj.push(rgbToLab(inp.read(x, y)));
      }
    }
    const side = measureSide(P, e, inp.read, inp.width, inp.height);
    if (conj.length < 20 || side.rednessA === null) continue;
    const pallorIndex = round(mean(conj.map((v) => v[1])) - side.rednessA);
    const bandMm = round(bandPx * (HVID_MM / (2 * R)));
    if (!best || bandMm > best.bandMm) best = { eye: key, pallorIndex, bandMm };
  }
  return best;
}

// ─── Reflexe pupillaire au flash de l'ecran ────────────────────────────────────────────────────

export interface PlrSample { t: number; pupilMm: number | null }
export interface PlrResult { baselineMm: number; minMm: number; constrictionPct: number; latencyMs: number | null; maxVelocityMmS: number }

/** `samples` : diametre moyen des deux pupilles par image ; `flashT` : instant ou l'ecran passe au blanc. */
export function analyzePlr(samples: PlrSample[], flashT: number): PlrResult | null {
  const ok = samples.filter((s): s is { t: number; pupilMm: number } => s.pupilMm !== null);
  const pre = ok.filter((s) => s.t >= flashT - 900 && s.t < flashT).map((s) => s.pupilMm);
  const post = ok.filter((s) => s.t >= flashT && s.t <= flashT + 2200);
  if (pre.length < 5 || post.length < 8) return null;
  // Lissage (moyenne glissante de 3) contre le bruit de detection
  const sm = post.map((s, i) => ({ t: s.t, v: mean(post.slice(Math.max(0, i - 1), i + 2).map((x) => x.pupilMm)) }));
  const baselineMm = median(pre);
  const minMm = Math.min(...sm.map((s) => s.v));
  const drop = baselineMm - minMm;
  const constrictionPct = Math.max(0, (drop / baselineMm) * 100);
  const onset = sm.find((s) => baselineMm - s.v >= Math.max(0.1, drop * 0.1));
  let maxVelocityMmS = 0;
  for (let i = 1; i < sm.length; i++) {
    const dt = (sm[i].t - sm[i - 1].t) / 1000;
    if (dt > 0) maxVelocityMmS = Math.max(maxVelocityMmS, (sm[i - 1].v - sm[i].v) / dt);
  }
  return {
    baselineMm: round(baselineMm), minMm: round(minMm), constrictionPct: round(constrictionPct, 1),
    latencyMs: drop >= 0.2 && onset ? Math.round(onset.t - flashT) : null,
    maxVelocityMmS: round(maxVelocityMmS),
  };
}

// ─── Synthese : index personnels et signaux a surveiller ───────────────────────────────────────

export interface EyeScanData {
  date: string;
  metrics: EyeMetrics;
  plr?: PlrResult | null;
  conjunctiva?: Conjunctiva | null;
  mbiS?: number | null;          // temps yeux ouverts sans cligner (s)
}

export interface EyeSignal { level: "ok" | "watch" | "alert"; text: string }

const avg2 = (a: number | null, b: number | null) => (a !== null && b !== null ? (a + b) / 2 : a ?? b);
export const scanValue = {
  pupille: (s: EyeScanData) => avg2(s.metrics.A.pupilMm, s.metrics.B.pupilMm),
  mrd1: (s: EyeScanData) => avg2(s.metrics.A.mrd1Mm, s.metrics.B.mrd1Mm),
  rougeur: (s: EyeScanData) => avg2(s.metrics.A.rednessA, s.metrics.B.rednessA),
  jaune: (s: EyeScanData) => avg2(s.metrics.A.scleraB, s.metrics.B.scleraB),
  arcus: (s: EyeScanData) => avg2(s.metrics.A.arcus, s.metrics.B.arcus),
  constriction: (s: EyeScanData) => s.plr?.constrictionPct ?? null,
  pallor: (s: EyeScanData) => s.conjunctiva?.pallorIndex ?? null,
  mbi: (s: EyeScanData) => s.mbiS ?? null,
};
export type EyeValueKey = keyof typeof scanValue;

/** Grade de rougeur estime 0-4 (inspire de l'echelle d'Efron), a partir de a* du blanc de l'oeil. */
export function rednessGrade(a: number | null): number | null {
  if (a === null) return null;
  return a < 2 ? 0 : a < 4 ? 1 : a < 7 ? 2 : a < 10 ? 3 : 4;
}

function robust(values: number[], minSpread: number) {
  if (values.length < 3) return null;
  const md = median(values);
  const mad = median(values.map((v) => Math.abs(v - md))) * 1.4826;
  return { median: md, spread: Math.max(mad, minSpread) };
}

const MIN_SPREAD: Record<EyeValueKey, number> = { pupille: 0.3, mrd1: 0.3, rougeur: 0.8, jaune: 0.8, arcus: 2, constriction: 4, pallor: 1, mbi: 2 };

export type EyeBaselines = Partial<Record<EyeValueKey, { median: number; spread: number; n: number }>>;

/** Reference personnelle par parametre (mediane + MAD des scans de qualite), en excluant `exclude`. */
export function eyeBaselines(history: EyeScanData[], exclude?: EyeScanData): EyeBaselines {
  const out: EyeBaselines = {};
  const good = history.filter((h) => h !== exclude && h.metrics.quality.score >= 60);
  for (const key of Object.keys(scanValue) as EyeValueKey[]) {
    const vals = good.map((h) => scanValue[key](h)).filter((x): x is number => x !== null);
    const b = robust(vals, MIN_SPREAD[key]);
    if (b) out[key] = { ...b, n: vals.length };
  }
  return out;
}

export function zFrom(key: EyeValueKey, current: EyeScanData, b: EyeBaselines): number | null {
  const v = scanValue[key](current), base = b[key];
  return v === null || !base ? null : (v - base.median) / base.spread;
}

export function eyeZ(key: EyeValueKey, current: EyeScanData, history: EyeScanData[]): number | null {
  return zFrom(key, current, eyeBaselines(history, current));
}

const idx = (parts: [number | null, number][]) => {
  const ok = parts.filter((p): p is [number, number] => p[0] !== null);
  if (!ok.length) return null;
  const w = ok.reduce((s, [, x]) => s + Math.abs(x), 0);
  return Math.round(Math.max(0, Math.min(100, 50 + 15 * (ok.reduce((s, [z, x]) => s + z * x, 0) / w))));
};

/** Index 0-100, 50 = ton habitude. Plus haut = plus marque (plus sec, plus fatigue, plus de changement de couleur). */
export function eyeIndexes(current: EyeScanData, history: EyeScanData[]) {
  return eyeIndexesFrom(current, eyeBaselines(history, current));
}

export function eyeIndexesFrom(current: EyeScanData, b: EyeBaselines) {
  const z = (k: EyeValueKey) => zFrom(k, current, b);
  const neg = (v: number | null) => (v === null ? null : -v);
  const zJ = z("jaune");
  return {
    secheresse: idx([[neg(z("mbi")), 0.6], [z("rougeur"), 0.4]]),
    fatigue: idx([[neg(z("mrd1")), 0.4], [neg(z("constriction")), 0.3], [z("rougeur"), 0.3]]),
    coloration: idx([[neg(z("pallor")), 0.6], [zJ === null ? null : Math.max(0, zJ), 0.4]]),
  };
}

/** Signaux a surveiller, avec des regles prudentes et non diagnostiques. */
export function eyeSignals(current: EyeScanData, history: EyeScanData[]): EyeSignal[] {
  return eyeSignalsFrom(current, eyeBaselines(history, current));
}

export function eyeSignalsFrom(current: EyeScanData, b: EyeBaselines): EyeSignal[] {
  const m = current.metrics;
  const out: EyeSignal[] = [];
  if (m.anisocoriaMm !== null) {
    out.push(m.anisocoriaMm >= 1
      ? { level: "watch", text: `Pupilles inégales (${String(m.anisocoriaMm).replace(".", ",")} mm d'écart) : refais le scan bien face à l'écran. Souvent sans gravité si c'est habituel ; si c'est nouveau avec maux de tête ou trouble de la vue : consulte en urgence.` }
      : { level: "ok", text: "Pupilles égales" });
  }
  const ptosis = Math.min(m.A.mrd1Mm, m.B.mrd1Mm), asym = Math.abs(m.A.mrd1Mm - m.B.mrd1Mm);
  if (m.quality.score >= 60 && (ptosis < 1.5 || asym >= 1.5)) {
    out.push({ level: "watch", text: `Paupière ${asym >= 1.5 ? "plus basse d'un côté" : "basse"} (MRD1 ${String(Math.round(ptosis * 10) / 10).replace(".", ",")} mm). Fatigue le plus souvent ; si c'est soudain, consulte.` });
  }
  const arc = Math.max(m.A.arcus ?? -99, m.B.arcus ?? -99);
  out.push(arc >= 12
    ? { level: "watch", text: "Anneau clair possible autour de l'iris (arc cornéen) : parles-en à ton médecin, un bilan lipidique peut être utile." }
    : { level: "ok", text: "Pas d'arc cornéen visible" });
  const zJ = zFrom("jaune", current, b);
  if (zJ !== null) out.push(zJ >= 3
    ? { level: "watch", text: "Blanc de l'œil plus jaune que d'habitude : refais la photo à la même lumière ; si ça persiste, consulte." }
    : { level: "ok", text: "Pas de jaunissement du blanc de l'œil" });
  const zP = zFrom("pallor", current, b);
  if (zP !== null && zP <= -2) out.push({ level: "watch", text: "Conjonctive plus pâle que d'habitude : surveille tes apports en fer et B12 ; bilan sanguin si fatigue." });
  if (current.mbiS != null && current.mbiS < 10) out.push({ level: "watch", text: `Yeux ouverts ${current.mbiS} s sans cligner (< 10 s) : sécheresse oculaire probable (Inomata 2019).` });
  return out;
}

export function sanitizeEyeScan(x: unknown): Omit<EyeScanData, "date"> | null {
  if (!x || typeof x !== "object") return null;
  const d = x as Record<string, unknown>;
  const num = (v: unknown) => typeof v === "number" && Number.isFinite(v);
  const nn = (v: unknown) => v === null || num(v);
  const m = d.metrics as Record<string, unknown> | undefined;
  if (!m || m.version !== EYE_METRICS_VERSION) return null;
  for (const k of ["A", "B"]) {
    const s = m[k] as Record<string, unknown> | undefined;
    if (!s || !num(s.irisPx) || !num(s.pupilContrast) || !num(s.mrd1Mm) || !num(s.mrd2Mm)) return null;
    if (!nn(s.pupilMm) || !nn(s.rednessA) || !nn(s.scleraB) || !nn(s.arcus)) return null;
  }
  const q = m.quality as Record<string, unknown> | undefined;
  if (!q || !num(q.score) || !Array.isArray(q.warnings) || !nn(m.anisocoriaMm)) return null;
  const plr = d.plr as Record<string, unknown> | null | undefined;
  if (plr && !(num(plr.baselineMm) && num(plr.minMm) && num(plr.constrictionPct) && nn(plr.latencyMs) && num(plr.maxVelocityMmS))) return null;
  const cj = d.conjunctiva as Record<string, unknown> | null | undefined;
  if (cj && !((cj.eye === "A" || cj.eye === "B") && num(cj.pallorIndex) && num(cj.bandMm))) return null;
  if (!(d.mbiS === undefined || nn(d.mbiS))) return null;
  const clean = JSON.parse(JSON.stringify({ metrics: m, plr: plr ?? null, conjunctiva: cj ?? null, mbiS: d.mbiS ?? null }));
  clean.metrics.quality.warnings = (clean.metrics.quality.warnings as unknown[]).filter((w): w is string => typeof w === "string").slice(0, 6);
  return clean;
}
