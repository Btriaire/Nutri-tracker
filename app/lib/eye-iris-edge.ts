
import { rayEdge, fitCircleRobust, type PixelReader, type Pt, type StructureFit } from "./eye-structures";

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

export function fitIrisEdge(read: PixelReader, c0: Pt, irisR: number, lids: { upperPx: number | null; lowerPx: number | null }, rollRad: number, w: number, h: number): StructureFit | null {
  const points: Pt[] = [];
  let visible = 0;

  for (let k = 0; k < 90; k++) {
    const a = k * 4 * Math.PI / 180;
    const upComp = Math.cos(a) * Math.sin(rollRad) + Math.sin(a) * (-Math.cos(rollRad));

    if (lids.upperPx !== null && irisR * upComp > lids.upperPx - 0.15 * irisR) {
      continue;
    }
    if (lids.lowerPx !== null && -irisR * upComp > lids.lowerPx - 0.15 * irisR) {
      continue;
    }

    visible++;
    const e = rayEdge(read, c0, a, 0.75 * irisR, 1.3 * irisR, irisR / 60, w, h);
    if (e !== null && e.strength >= 4) {
      points.push({ x: c0.x + e.r * Math.cos(a), y: c0.y + e.r * Math.sin(a) });
    }
  }

  if (points.length < 12 || visible < 20) {
    return null;
  }

  const fit = fitCircleRobust(points);
  if (fit === null) {
    return null;
  }

  if (Math.abs(fit.r - irisR) / irisR > 0.25) {
    return null;
  }

  const circularity = clamp01(1 - fit.rms / fit.r * 4);
  const coverage = fit.inliers / 90;
  const confidence = clamp01(circularity * Math.min(1, fit.inliers / 30));

  return { cx: fit.cx, cy: fit.cy, r: fit.r, circularity, coverage, confidence };
}

