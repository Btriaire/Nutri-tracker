// Re-analyse d'un oeil apres coup, a partir de sa photo enregistree et d'un nouveau centre touche a la main.
// La photo est un carre de 320 px, redresse, centre sur l'ancien centre, large de 3 diametres d'iris :
// le diametre de l'iris y vaut donc toujours 320 / 3 px, quel que soit le scan.
// Ce qui depend des points de repere du visage (blanc de l'oeil, cernes, largeur de la fente) n'est pas refait :
// il est repris du scan, sauf les hauteurs de paupieres qui sont recalculees depuis le nouveau centre.
import { fitLimbusRays, fitPupilRays, type PixelReader, type Pt } from "./eye-structures";
import { HVID_MM, RADIUS_MM, irisColour, ringL, type EyeSide } from "./eye-metrics";
import type { Shift } from "./eye-learning";

export const CROP = 320;
export const CROP_IRIS_D = CROP / 3;
const MAX_TAP_SHIFT = 0.35; // au-dela (en diametres d'iris), le toucher n'est pas un recentrage mais une erreur

const round = (v: number, d = 2) => Math.round(v * 10 ** d) / 10 ** d;

/** Nouvel etat de l'oeil pour un centre `tap` (pixels de la photo) ; null si le toucher est trop loin du centre. */
export function recenterEye(read: PixelReader, side: EyeSide, tap: Pt): EyeSide | null {
  const off = { x: tap.x - CROP / 2, y: tap.y - CROP / 2 };
  if (!Number.isFinite(off.x) || !Number.isFinite(off.y) || Math.hypot(off.x, off.y) > MAX_TAP_SHIFT * CROP_IRIS_D) return null;
  const R = CROP_IRIS_D / 2, mm = HVID_MM / CROP_IRIS_D;
  const prev: Shift = side.centerShift ?? { dx: 0, dy: 0 };
  const centerShift = { dx: round(prev.dx + off.x / CROP_IRIS_D, 3), dy: round(prev.dy + off.y / CROP_IRIS_D, 3) };

  const pf = fitPupilRays(read, tap, R, CROP, CROP);
  const pupilOk = !!pf && pf.confidence >= 0.35 && 2 * pf.r * mm >= 1.5 && 2 * pf.r * mm <= 9;
  const lim = fitLimbusRays(read, tap, R, CROP, CROP);
  const pupilR = pupilOk ? pf!.r : side.pupilMm != null ? side.pupilMm / 2 / mm : R * 0.3;
  const colour = irisColour(read, tap, R, pupilR, CROP, CROP);

  const outer = ringL(read, tap, R * 0.92, CROP, CROP), mid = ringL(read, tap, R * 0.6, CROP, CROP);
  const edge = ringL(read, tap, R * 0.97, CROP, CROP), inside = ringL(read, tap, R * 0.72, CROP, CROP);

  // Le centre monte de `up` mm : la paupiere haute se rapproche, la basse s'eloigne
  const up = -off.y * mm;
  const mrd1Mm = round(Math.max(0, side.mrd1Mm - up)), mrd2Mm = round(Math.max(0, side.mrd2Mm + up));
  const base = side.irisCenter ?? { x: 0, y: 0 };
  const scale = side.irisPx / CROP_IRIS_D;

  const { learnedCenter: _lc, ...rest } = side;
  void _lc;
  return {
    ...rest,
    ...(pupilOk ? {
      pupilMm: round(2 * pf!.r * mm),
      pupilCircularity: round(pf!.circularity), pupilConfidence: round(pf!.confidence),
      pupilDecentrationMm: round(Math.hypot(pf!.cx - tap.x, pf!.cy - tap.y) * mm),
      pupilCenter: { x: round(base.x + (pf!.cx - tap.x) * scale, 1), y: round(base.y + (pf!.cy - tap.y) * scale, 1) },
    } : {}),
    ...(lim ? { limbusConfidence: round(lim.confidence) } : {}),
    ...(colour.irisLab ? colour : {}),
    arcus: Number.isFinite(outer) && Number.isFinite(mid) ? round(outer - mid, 1) : side.arcus,
    limbalRing: Number.isFinite(edge) && Number.isFinite(inside) ? round(inside - edge, 1) : side.limbalRing,
    catchlight: side.catchlight ? { dxMm: round(side.catchlight.dxMm - off.x * mm), dyMm: round(side.catchlight.dyMm - off.y * mm) } : side.catchlight,
    mrd1Mm, mrd2Mm,
    fenteRatio: round((mrd1Mm + mrd2Mm) / HVID_MM, 3),
    scleralShowUpperMm: round(Math.max(0, mrd1Mm - RADIUS_MM)), scleralShowLowerMm: round(Math.max(0, mrd2Mm - RADIUS_MM)),
    manualCenter: true, centerShift,
  };
}
