// Apprentissage des corrections du centre de l'oeil.
// Une correction = (vrai centre choisi a la main) - (centre detecte), dans le repere de l'oeil (axe des coins horizontal),
// en diametres d'iris : independante de la distance a la camera et de l'inclinaison de la tete.
// Le decalage appris est la mediane robuste des corrections, tire vers 0 tant qu'on en a peu.
// Pur : aucune dependance a eye-metrics au runtime (types structurels), pour eviter un cycle.

export interface Shift { dx: number; dy: number }
interface Pt { x: number; y: number }

export const LEARN = { maxShift: 0.3, minCount: 3, keep: 20, shrink: 3, cap: 0.15, noise: 0.03 } as const;

const round = (v: number, d = 3) => Math.round(v * 10 ** d) / 10 ** d;
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Repere de l'oeil -> repere de l'image : vecteur (en diametres d'iris) tourne de +roll, applique au centre detecte. */
export function fromEyeFrame(s: Shift, rollRad: number, diameterPx: number, detected: Pt): Pt {
  const cos = Math.cos(rollRad), sin = Math.sin(rollRad);
  return { x: detected.x + (s.dx * cos - s.dy * sin) * diameterPx, y: detected.y + (s.dx * sin + s.dy * cos) * diameterPx };
}

/** Image -> repere de l'oeil : (utilise - detecte) tourne de -roll, en diametres d'iris. */
export function toEyeFrame(used: Pt, detected: Pt, rollRad: number, diameterPx: number): Shift {
  const vx = used.x - detected.x, vy = used.y - detected.y, cos = Math.cos(rollRad), sin = Math.sin(rollRad);
  return { dx: round((vx * cos + vy * sin) / diameterPx), dy: round((-vx * sin + vy * cos) / diameterPx) };
}

export interface LearnedOffset extends Shift { n: number; spread: number; raw: Shift }

/** Decalage a appliquer, ou null si on n'a pas assez de corrections coherentes. */
export function learnedOffset(shifts: Shift[]): LearnedOffset | null {
  const ok = shifts.filter((s) => Number.isFinite(s.dx) && Number.isFinite(s.dy) && Math.hypot(s.dx, s.dy) <= LEARN.maxShift).slice(0, LEARN.keep);
  const n = ok.length;
  if (n < LEARN.minCount) return null;
  const raw = { dx: median(ok.map((s) => s.dx)), dy: median(ok.map((s) => s.dy)) };
  const mag = Math.hypot(raw.dx, raw.dy);
  const spread = median(ok.map((s) => Math.hypot(s.dx - raw.dx, s.dy - raw.dy)));
  if (mag < LEARN.noise || spread > Math.max(LEARN.noise, 0.6 * mag)) return null; // rien a corriger, ou corrections incoherentes
  const k = Math.min(n / (n + LEARN.shrink), LEARN.cap / mag);
  return { dx: round(raw.dx * k), dy: round(raw.dy * k), n, spread: round(spread), raw: { dx: round(raw.dx), dy: round(raw.dy) } };
}

interface SideLike { manualCenter?: boolean; centerShift?: Shift; irisCenter?: Pt }
interface ScanLike { date: string; time: string; metrics?: { A?: SideLike; B?: SideLike } | null }

/** Decalages appris pour chaque oeil, a partir des scans enregistres (corrections manuelles uniquement, plus recentes d'abord). */
export function learnedOffsets(scans: ScanLike[]): Partial<Record<"A" | "B", LearnedOffset>> {
  const sorted = [...scans].sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  const out: Partial<Record<"A" | "B", LearnedOffset>> = {};
  for (const eye of ["A", "B"] as const) {
    const seen = new Set<string>(), list: Shift[] = [];
    for (const sc of sorted) {
      const s = sc.metrics?.[eye];
      if (!s?.manualCenter || !s.centerShift) continue;
      // Une reprise d'un seul oeil recopie l'autre oeil tel quel : meme centre absolu = meme correction, comptee une fois
      const key = `${s.irisCenter?.x},${s.irisCenter?.y},${s.centerShift.dx},${s.centerShift.dy}`;
      if (seen.has(key)) continue;
      seen.add(key);
      list.push(s.centerShift);
    }
    const l = learnedOffset(list);
    if (l) out[eye] = l;
  }
  return out;
}
