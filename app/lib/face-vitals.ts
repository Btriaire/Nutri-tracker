// Constantes mesurees par la camera sur 10 a 25 s de video du visage. Module pur (teste dans tests/face-vitals.test.ts).
//
// - Pouls : photoplethysmographie a distance (rPPG), algorithme POS (Wang, den Brinker, Stuijk & de Haan,
//   "Algorithmic Principles of Remote PPG", IEEE TBME 2017) sur la couleur moyenne du front et des joues,
//   puis pic du spectre entre 42 et 210 bpm ; qualite = rapport signal/bruit (de Haan & Jeanne 2013).
// - Respiration (indicative) : composante 6-30 cycles/min de l'intensite de la peau (RIIV) et du mouvement
//   vertical de la tete ; on garde le signal dont le pic ressort le plus.
// - Clignements par minute et PERCLOS (part du temps les yeux fermes a plus de 80 %, indicateur de
//   somnolence de reference : Wierwille 1994 / Dinges 1998) a partir des expressions MediaPipe.

export const FACE_VITALS_VERSION = 1;

export interface VitalsFrame {
  t: number;                    // ms
  rgb: [number, number, number]; // couleur moyenne de la peau (front + joues)
  blink: number;                // 0-1, fermeture moyenne des yeux (blendshape eyeBlink)
  noseY: number;                // position verticale du nez, en fraction de l'ecart entre les yeux
  noseX: number;
}

export interface FaceVitals {
  version: number;
  durationS: number;
  fps: number;
  heartRate: number | null;     // bpm
  heartSnrDb: number | null;
  heartConfidence: "faible" | "modérée" | "bonne";
  respRate: number | null;      // cycles/min
  respConfidence: "faible" | "modérée";
  blinksPerMin: number;
  perclos: number;              // %
  motion: number;               // ecart-type de la position du nez (x100 / ecart des yeux)
  warnings: string[];
}

const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / Math.max(1, xs.length);
const std = (xs: number[]) => { const m = mean(xs); return Math.sqrt(mean(xs.map((x) => (x - m) ** 2))); };

/** Reechantillonne une serie irreguliere a frequence fixe (interpolation lineaire). */
export function resample(t: number[], v: number[], hz: number): number[] {
  if (t.length < 2) return [];
  const out: number[] = [];
  const dt = 1000 / hz;
  let j = 0;
  for (let x = t[0]; x <= t[t.length - 1]; x += dt) {
    while (j < t.length - 2 && t[j + 1] < x) j++;
    const span = t[j + 1] - t[j] || 1;
    const a = Math.min(1, Math.max(0, (x - t[j]) / span));
    out.push(v[j] * (1 - a) + v[j + 1] * a);
  }
  return out;
}

/** Retire la tendance lente (moyenne glissante de `win` echantillons). */
export function detrend(x: number[], win: number): number[] {
  const half = Math.max(1, Math.floor(win / 2));
  const pre = [0];
  for (const v of x) pre.push(pre[pre.length - 1] + v);
  return x.map((v, i) => {
    const a = Math.max(0, i - half), b = Math.min(x.length, i + half + 1);
    return v - (pre[b] - pre[a]) / (b - a);
  });
}

/** Signal rPPG par l'algorithme POS (fenetres glissantes de ~1,6 s, recouvrement-addition). */
export function posSignal(rgb: [number, number, number][], hz: number): number[] {
  const n = rgb.length;
  const l = Math.max(2, Math.round(1.6 * hz));
  const h = new Array(n).fill(0);
  for (let s = 0; s + l <= n; s++) {
    const win = rgb.slice(s, s + l);
    const m = [0, 1, 2].map((c) => mean(win.map((p) => p[c])) || 1);
    const s1: number[] = [], s2: number[] = [];
    for (const p of win) {
      const r = p[0] / m[0], g = p[1] / m[1], b = p[2] / m[2];
      s1.push(g - b);
      s2.push(g + b - 2 * r);
    }
    const alpha = std(s1) / (std(s2) || 1);
    const seg = s1.map((v, i) => v + alpha * s2[i]);
    const ms = mean(seg);
    for (let i = 0; i < l; i++) h[s + i] += seg[i] - ms;
  }
  return h;
}

/** Spectre de puissance (TFD directe, fenetre de Hann) entre fMin et fMax Hz, pas `step` Hz. */
export function spectrum(x: number[], hz: number, fMin: number, fMax: number, step = 0.01): { f: number; p: number }[] {
  const n = x.length;
  const w = x.map((v, i) => v * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / Math.max(1, n - 1))));
  const out: { f: number; p: number }[] = [];
  for (let f = fMin; f <= fMax + 1e-9; f += step) {
    let re = 0, im = 0;
    const k = (2 * Math.PI * f) / hz;
    for (let i = 0; i < n; i++) { re += w[i] * Math.cos(k * i); im -= w[i] * Math.sin(k * i); }
    out.push({ f, p: re * re + im * im });
  }
  return out;
}

function peak(spec: { f: number; p: number }[]): { f: number; p: number } {
  return spec.reduce((a, b) => (b.p > a.p ? b : a), spec[0]);
}

/** Rapport signal/bruit (dB) : energie autour du pic et de sa 1re harmonique vs le reste de la bande. */
function snrDb(spec: { f: number; p: number }[], f0: number): number {
  let sig = 0, noise = 0;
  for (const s of spec) {
    const near = Math.abs(s.f - f0) <= 0.1 || Math.abs(s.f - 2 * f0) <= 0.2;
    if (near) sig += s.p; else noise += s.p;
  }
  return 10 * Math.log10((sig || 1e-12) / (noise || 1e-12));
}

/** Prominence d'un pic : puissance au pic / puissance mediane de la bande. */
function prominence(spec: { f: number; p: number }[], pk: { p: number }): number {
  const ps = spec.map((s) => s.p).sort((a, b) => a - b);
  return pk.p / (ps[ps.length >> 1] || 1e-12);
}

/** `minDurationS` : 10 s pour un resultat ; plus court seulement pour les estimations provisoires. */
export function computeVitals(frames: VitalsFrame[], minDurationS = 10): FaceVitals | null {
  if (frames.length < Math.min(60, minDurationS * 8)) return null;
  const t = frames.map((f) => f.t);
  const durationS = (t[t.length - 1] - t[0]) / 1000;
  if (durationS < minDurationS) return null;
  const fps = (frames.length - 1) / durationS;
  const HZ = 30;
  const warnings: string[] = [];

  // Pouls
  const ch = [0, 1, 2].map((c) => resample(t, frames.map((f) => f.rgb[c]), HZ));
  const rgb = ch[0].map((_, i) => [ch[0][i], ch[1][i], ch[2][i]] as [number, number, number]);
  const pos = detrend(posSignal(rgb, HZ), HZ * 2);
  const hrSpec = spectrum(pos, HZ, 0.7, 3.5, 0.01);
  const hrPeak = peak(hrSpec);
  const snr = snrDb(hrSpec, hrPeak.f);
  const heartConfidence: FaceVitals["heartConfidence"] = snr >= 3 ? "bonne" : snr >= -1 ? "modérée" : "faible";

  // Mouvement de la tete
  const iodMotion = Math.sqrt(std(frames.map((f) => f.noseX)) ** 2 + std(frames.map((f) => f.noseY)) ** 2) * 100;
  if (iodMotion > 6) warnings.push("Tu as bougé pendant la mesure : reste immobile, appuyé si possible");
  if (fps < 12) warnings.push("Caméra lente : mesure moins précise");
  const lum = mean(frames.map((f) => 0.299 * f.rgb[0] + 0.587 * f.rgb[1] + 0.114 * f.rgb[2]));
  if (lum < 60) warnings.push("Lumière faible : mets-toi face à une fenêtre ou une lampe");
  if (heartConfidence === "faible") warnings.push("Signal du pouls trop faible : lumière stable et visage immobile");

  // Respiration (indicative) : intensite de la peau et mouvement vertical, sur 18 s minimum (mesure longue)
  let respRate: number | null = null;
  let respConfidence: FaceVitals["respConfidence"] = "faible";
  if (durationS >= 18) {
    const lumS = detrend(resample(t, frames.map((f) => f.rgb[1]), 10), 10 * 12);
    const motS = detrend(resample(t, frames.map((f) => f.noseY), 10), 10 * 12);
    const cands = [lumS, motS].map((x) => { const sp = spectrum(x, 10, 0.1, 0.5, 0.005); const pk = peak(sp); return { f: pk.f, prom: prominence(sp, pk) }; });
    const best = cands.reduce((a, b) => (b.prom > a.prom ? b : a));
    if (best.prom >= 3) {
      respRate = Math.round(best.f * 60);
      respConfidence = best.prom >= 8 ? "modérée" : "faible";
    }
  }

  // Clignements et PERCLOS
  let blinks = 0, closed = false, closedFrames = 0;
  for (const f of frames) {
    if (!closed && f.blink > 0.5) { closed = true; blinks++; }
    else if (closed && f.blink < 0.3) closed = false;
    if (f.blink > 0.8) closedFrames++;
  }

  return {
    version: FACE_VITALS_VERSION,
    durationS: Math.round(durationS),
    fps: Math.round(fps),
    heartRate: heartConfidence === "faible" ? null : Math.round(hrPeak.f * 60),
    heartSnrDb: Math.round(snr * 10) / 10,
    heartConfidence,
    respRate,
    respConfidence,
    blinksPerMin: Math.round((blinks / durationS) * 60),
    perclos: Math.round((closedFrames / frames.length) * 1000) / 10,
    motion: Math.round(iodMotion * 10) / 10,
    warnings,
  };
}

/** Valide des constantes recues du navigateur (null si invalides). */
export function sanitizeVitals(x: unknown): FaceVitals | null {
  if (!x || typeof x !== "object") return null;
  const v = x as Record<string, unknown>;
  const num = (n: unknown) => typeof n === "number" && Number.isFinite(n);
  const numOrNull = (n: unknown) => n === null || num(n);
  if (v.version !== FACE_VITALS_VERSION) return null;
  if (!["durationS", "fps", "blinksPerMin", "perclos", "motion"].every((k) => num(v[k]))) return null;
  if (!numOrNull(v.heartRate) || !numOrNull(v.heartSnrDb) || !numOrNull(v.respRate)) return null;
  if (v.heartRate !== null && ((v.heartRate as number) < 35 || (v.heartRate as number) > 220)) return null;
  if (!["faible", "modérée", "bonne"].includes(v.heartConfidence as string) || !["faible", "modérée"].includes(v.respConfidence as string)) return null;
  return {
    version: FACE_VITALS_VERSION,
    durationS: v.durationS as number, fps: v.fps as number,
    heartRate: v.heartRate as number | null, heartSnrDb: v.heartSnrDb as number | null,
    heartConfidence: v.heartConfidence as FaceVitals["heartConfidence"],
    respRate: v.respRate as number | null, respConfidence: v.respConfidence as FaceVitals["respConfidence"],
    blinksPerMin: v.blinksPerMin as number, perclos: v.perclos as number, motion: v.motion as number,
    warnings: Array.isArray(v.warnings) ? (v.warnings as unknown[]).filter((w): w is string => typeof w === "string").slice(0, 6).map((w) => w.slice(0, 120)) : [],
  };
}

/** Estimation provisoire pendant la mesure. */
export interface LiveEstimate { tMs: number; bpm: number | null; confidence: FaceVitals["heartConfidence"] }

export const MIN_MEASURE_MS = 10_000;
export const MAX_QUICK_MS = 20_000;

/**
 * Arret automatique : au moins 10 s, puis des que les 3 dernieres estimations (une par seconde)
 * sont fiables et a moins de 3 bpm d'ecart. Plafond 20 s : on garde alors ce qu'on a.
 */
export function shouldStop(estimates: LiveEstimate[], elapsedMs: number): boolean {
  if (elapsedMs >= MAX_QUICK_MS) return true;
  if (elapsedMs < MIN_MEASURE_MS) return false;
  const last = estimates.slice(-3);
  if (last.length < 3 || last.some((e) => e.bpm === null || e.confidence === "faible")) return false;
  const bpms = last.map((e) => e.bpm!);
  return Math.max(...bpms) - Math.min(...bpms) <= 3;
}
