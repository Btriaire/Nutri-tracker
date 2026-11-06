const HVID_MM = 11.7;

export function circleStripArea(R: number, yLow: number, yHigh: number): number {
  const clampedYLow = Math.max(-R, Math.min(R, yLow));
  const clampedYHigh = Math.max(-R, Math.min(R, yHigh));

  if (clampedYHigh <= clampedYLow) {
    return 0;
  }

  const F = (y: number): number => {
    const ySquared = y * y;
    const term1 = y * Math.sqrt(Math.max(0, R * R - ySquared));
    const term2 = R * R * Math.asin(Math.max(-1, Math.min(1, y / R)));
    return term1 + term2;
  };

  return F(clampedYHigh) - F(clampedYLow);
}

export interface EyeAreas {
  pupilMm2: number | null;
  irisMm2: number;
  irisExposedMm2: number;
  irisCoveredPct: number;
  pupilIrisAreaPct: number | null;
  apertureMm2: number | null;
  scleraExposedMm2: number | null;
}

export function eyeAreas(s: { irisPx: number; pupilMm: number | null; mrd1Mm: number; mrd2Mm: number; fissureWidthMm?: number }): EyeAreas {
  const R = HVID_MM / 2;
  const irisMm2 = Math.PI * R * R;
  const pupilMm2 = s.pupilMm !== null ? Math.PI * (s.pupilMm / 2) ** 2 : null;
  const h1 = Math.max(0, s.mrd1Mm);
  const h2 = Math.max(0, s.mrd2Mm);
  const irisExposedMm2 = circleStripArea(R, -h2, h1);
  const irisCoveredPct = 100 * (1 - irisExposedMm2 / irisMm2);
  const pupilIrisAreaPct = pupilMm2 !== null ? 100 * pupilMm2 / irisMm2 : null;
  const fissureWidthMm = s.fissureWidthMm !== undefined && Number.isFinite(s.fissureWidthMm) && s.fissureWidthMm > 0 ? s.fissureWidthMm : null;
  const apertureMm2 = fissureWidthMm !== null ? (2 / 3) * fissureWidthMm * (h1 + h2) : null;
  const scleraExposedMm2 = apertureMm2 !== null ? Math.max(0, apertureMm2 - irisExposedMm2) : null;

  return {
    pupilMm2,
    irisMm2,
    irisExposedMm2,
    irisCoveredPct,
    pupilIrisAreaPct,
    apertureMm2,
    scleraExposedMm2,
  };
}
