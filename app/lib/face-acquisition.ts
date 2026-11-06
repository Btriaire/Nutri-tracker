type Point = { x: number; y: number };

export interface FaceAcqInput {
  widthRatio: number;
  cx: number;
  cy: number;
  yawDeg: number;
  rollDeg: number;
  motion: number;
  sharp: number;
  light: number;
}

export function faceAcquisition(i: FaceAcqInput): { score: number; issue: string | null } {
  const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
  const hypot = (x: number, y: number) => Math.sqrt(x * x + y * y);

  const size = clamp01(i.widthRatio < 0.45 ? 1 - (0.45 - i.widthRatio) / 0.15 :
    i.widthRatio > 0.75 ? 1 - (i.widthRatio - 0.75) / 0.15 : 1);
  const center = clamp01(1 - Math.max(0, hypot(i.cx - 0.5, i.cy - 0.42) - 0.08) / 0.15);
  const yaw = clamp01(1 - Math.max(0, Math.abs(i.yawDeg) - 6) / 12);
  const roll = clamp01(1 - Math.max(0, Math.abs(i.rollDeg) - 5) / 10);
  const stab = clamp01(1 - i.motion / 0.03);
  const sharp = clamp01((i.sharp - 3) / 10);
  const light = clamp01(i.light < 60 ? (i.light - 30) / 30 :
    i.light > 220 ? (250 - i.light) / 30 : 1);

  const score = Math.round(100 * (0.15 * size + 0.15 * center + 0.15 * yaw + 0.1 * roll + 0.15 * stab + 0.2 * sharp + 0.1 * light));

  let issue: string | null = null;
  if (size < 0.5) issue = i.widthRatio < 0.45 ? "Trop loin : rapproche-toi" : "Trop près : éloigne-toi";
  else if (center < 0.5) issue = "Centre ton visage dans l'ovale";
  else if (yaw < 0.5) issue = "Regarde bien en face";
  else if (roll < 0.5) issue = "Redresse la tête";
  else if (stab < 0.5) issue = "Bouge moins : tiens le téléphone stable";
  else if (sharp < 0.5) issue = "Image floue : attends la mise au point";
  else if (light < 0.5) issue = i.light < 100 ? "Trop sombre : éclaire le visage" : "Trop de lumière";

  return { score, issue };
}

export function facePose(p: Point[]): { widthRatio: number; cx: number; cy: number; yawDeg: number; rollDeg: number } {
  const left = p[234], right = p[454], nose = p[1], eyeA = p[33], eyeB = p[263], top = p[10], chin = p[152];

  const widthRatio = Math.hypot(right.x - left.x, right.y - left.y);
  const cx = (left.x + right.x) / 2;
  const cy = (top.y + chin.y) / 2;

  const dA = Math.hypot(nose.x - left.x, nose.y - left.y);
  const dB = Math.hypot(nose.x - right.x, nose.y - right.y);
  const yawDeg = (Math.asin(Math.max(-1, Math.min(1, 2 * (dA - dB) / (dA + dB)))) * 180) / Math.PI;

  const rollDeg = (Math.atan2(eyeB.y - eyeA.y, eyeB.x - eyeA.x) * 180) / Math.PI;

  return { widthRatio, cx, cy, yawDeg, rollDeg };
}

export class BestShot<T> {
  public count: number = 0;
  public best: T | null = null;
  private bestScore: number = -Infinity;

  constructor(private threshold: number) {}

  offer(score: number, shot: T): boolean {
    if (score < this.threshold) return false;
    this.count++;
    if (score > this.bestScore) {
      this.bestScore = score;
      this.best = shot;
      return true;
    }
    return false;
  }

  reset(): void {
    this.count = 0;
    this.best = null;
    this.bestScore = -Infinity;
  }
}
