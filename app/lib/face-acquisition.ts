type Point = { x: number; y: number };

export function ovalGeometry(viewW: number, viewH: number): { cx: number, cy: number, rx: number, ry: number } {
  const ry = Math.min(viewH * 0.62, viewW * 0.86 * 1.35, viewH * 0.8) / 2;
  const rx = ry / 1.35;
  const cx = viewW / 2;
  const cy = Math.min(Math.max(ry, viewH * 0.44), viewH - ry);
  return { cx, cy, rx, ry };
}

export function faceFraming(p: Point[], video: { w: number, h: number }, view: { w: number, h: number }): { fill: number; dx: number; dy: number; inFrame: boolean } {
  const k = Math.max(view.w / video.w, view.h / video.h);
  const ox = (video.w * k - view.w) / 2;
  const oy = (video.h * k - view.h) / 2;

  const sx = (x: number) => x * video.w * k - ox;
  const sy = (y: number) => y * video.h * k - oy;

  const top = { x: sx(p[10].x), y: sy(p[10].y) };
  const chin = { x: sx(p[152].x), y: sy(p[152].y) };
  const L = { x: sx(p[234].x), y: sy(p[234].y) };
  const R = { x: sx(p[454].x), y: sy(p[454].y) };

  const faceH = chin.y - top.y;
  const headTop = top.y - 0.2 * faceH;
  const headH = chin.y - headTop;

  const oval = ovalGeometry(view.w, view.h);
  const fill = headH / (2 * oval.ry);

  const hx = (L.x + R.x) / 2;
  const hy = (headTop + chin.y) / 2;
  const dx = (hx - oval.cx) / oval.rx;
  const dy = (hy - oval.cy) / oval.ry;

  const inFrame = Math.min(L.x, R.x) >= 0 && Math.max(L.x, R.x) <= view.w && headTop >= 0 && chin.y <= view.h;

  return { fill, dx, dy, inFrame };
}

export function facePose(p: Point[]): { yawDeg: number, rollDeg: number, cx: number, cy: number } {
  const nose = p[1];
  const L = p[234];
  const R = p[454];
  const dA = Math.hypot(nose.x - L.x, nose.y - L.y);
  const dB = Math.hypot(nose.x - R.x, nose.y - R.y);
  const yawDeg = Math.asin(Math.max(-1, Math.min(1, 2 * (dA - dB) / (dA + dB)))) * 180 / Math.PI;

  const p33 = p[33];
  const p263 = p[263];
  const rollDeg = Math.atan2(p263.y - p33.y, p263.x - p33.x) * 180 / Math.PI;

  const cx = (L.x + R.x) / 2;
  const cy = (p[10].y + p[152].y) / 2;

  return { yawDeg, rollDeg, cx, cy };
}

export interface FaceAcqInput {
  fill: number;
  dx: number;
  dy: number;
  inFrame: boolean;
  yawDeg: number;
  rollDeg: number;
  motion: number;
  sharp: number;
  light: number;
}

export function faceAcquisition(i: FaceAcqInput): { score: number, issue: string | null } {
  const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

  const size = clamp01(i.fill < 0.72 ? 1 - (0.72 - i.fill) / 0.3 : i.fill > 1.0 ? 1 - (i.fill - 1.0) / 0.2 : 1);
  const center = clamp01(1 - Math.max(0, Math.hypot(i.dx, i.dy) - 0.15) / 0.4);
  const yaw = clamp01(1 - Math.max(0, Math.abs(i.yawDeg) - 6) / 12);
  const roll = clamp01(1 - Math.max(0, Math.abs(i.rollDeg) - 5) / 10);
  const stab = clamp01(1 - i.motion / 0.03);
  const sharp = clamp01((i.sharp - 3) / 10);
  const light = clamp01(i.light < 60 ? (i.light - 30) / 30 : i.light > 220 ? (250 - i.light) / 30 : 1);

  let score = Math.round(100 * (0.15 * size + 0.15 * center + 0.15 * yaw + 0.1 * roll + 0.15 * stab + 0.2 * sharp + 0.1 * light));
  if (!i.inFrame) score = Math.min(score, 50);

  let issue: string | null = null;
  if (!i.inFrame) issue = "Visage coupé : éloigne-toi";
  else if (size < 0.5) issue = i.fill < 0.72 ? "Trop loin : rapproche-toi" : "Trop près : éloigne-toi";
  else if (center < 0.5) issue = "Centre ton visage dans l'ovale";
  else if (yaw < 0.5) issue = "Regarde bien en face";
  else if (roll < 0.5) issue = "Redresse la tête";
  else if (stab < 0.5) issue = "Bouge moins : tiens le téléphone stable";
  else if (sharp < 0.5) issue = "Image floue : attends la mise au point";
  else if (light < 0.5) issue = i.light < 100 ? "Trop sombre : éclaire le visage" : "Trop de lumière";

  return { score, issue };
}

export class BestShot<T> {
  private _best: T | null = null;
  private _bestScore: number = -Infinity;
  private _count = 0;
  private readonly threshold: number;

  constructor(threshold: number) {
    this.threshold = threshold;
  }

  offer(score: number, value: T): boolean {
    if (score < this.threshold) return false;
    this._count++;
    if (score > this._bestScore) {
      this._best = value;
      this._bestScore = score;
      return true;
    }
    return false;
  }

  reset(): void {
    this._best = null;
    this._bestScore = -Infinity;
    this._count = 0;
  }

  get best(): T | null {
    return this._best;
  }

  get count(): number {
    return this._count;
  }
}
