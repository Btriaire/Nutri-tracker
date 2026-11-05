import { rgbToLab, type PixelReader, type Pt } from "./face-metrics";

export function sampleSclera(read: PixelReader, c: Pt, R: number, corner: Pt, w: number, h: number): { lab: [number, number, number][]; coverage: number } {
  const d = Math.hypot(corner.x - c.x, corner.y - c.y);
  if (d < 1.4 * R) {
    return { lab: [], coverage: 0 };
  }

  const u = { x: (corner.x - c.x) / d, y: (corner.y - c.y) / d };
  const p = { x: -u.y, y: u.x };

  const lab: [number, number, number][] = [];
  let sampled = 0;
  let kept = 0;

  for (let t = 1.15 * R; t <= d - 0.1 * R; t += 1) {
    let skinCount = 0;
    let rowSamples = 0;

    for (let s = -0.3 * R; s <= 0.3 * R; s += 1) {
      const x = Math.round(c.x + t * u.x + s * p.x);
      const y = Math.round(c.y + t * u.y + s * p.y);

      if (x >= 0 && y >= 0 && x < w && y < h) {
        const rgb = read(x, y);
        const [L, a, b] = rgbToLab(rgb);
        sampled++;

        if (b >= 16 && a >= 8) {
          skinCount++;
        } else if (L < 45 || L > 95) {
          // Skip dark or specular
        } else {
          lab.push([L, a, b]);
          kept++;
        }
        rowSamples++;
      }
    }

    if (rowSamples > 0 && skinCount / rowSamples > 0.5) {
      break;
    }
  }

  const coverage = sampled === 0 ? 0 : kept / sampled;
  return { lab, coverage };
}
