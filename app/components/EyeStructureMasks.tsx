import { useId } from "react";

const PX = 320 / (3 * 11.7);

export function aperturePath(mrd1Mm: number, mrd2Mm: number, widthMm: number): string {
  const x0 = (160 - widthMm / 2 * PX).toFixed(1);
  const x1 = (160 + widthMm / 2 * PX).toFixed(1);
  const yTop = (160 - 2 * mrd1Mm * PX).toFixed(1);
  const yBottom = (160 + 2 * mrd2Mm * PX).toFixed(1);
  return `M ${x0} 160 Q 160 ${yTop} ${x1} 160 Q 160 ${yBottom} ${x0} 160 Z`;
}

export default function EyeStructureMasks({ side }: { side: { pupilMm: number | null; mrd1Mm: number; mrd2Mm: number; fissureWidthMm?: number } }) {
  const id = useId().replace(/:/g, '');

  if (side.fissureWidthMm === undefined || side.fissureWidthMm <= 0) {
    return null;
  }

  const irisRadius = (5.85 * PX).toFixed(1);
  const irisPath = `M ${(160 - parseFloat(irisRadius)).toFixed(1)} 160 A ${irisRadius} ${irisRadius} 0 1 0 ${(160 + parseFloat(irisRadius)).toFixed(1)} 160 A ${irisRadius} ${irisRadius} 0 1 0 ${(160 - parseFloat(irisRadius)).toFixed(1)} 160 Z`;
  const pupilPath = side.pupilMm !== null ? `M ${(160 - side.pupilMm / 2 * PX).toFixed(1)} 160 A ${(side.pupilMm / 2 * PX).toFixed(1)} ${(side.pupilMm / 2 * PX).toFixed(1)} 0 1 0 ${(160 + side.pupilMm / 2 * PX).toFixed(1)} 160 A ${(side.pupilMm / 2 * PX).toFixed(1)} ${(side.pupilMm / 2 * PX).toFixed(1)} 0 1 0 ${(160 - side.pupilMm / 2 * PX).toFixed(1)} 160 Z` : '';

  return (
    <>
      <defs>
        <clipPath id={id}>
          <path d={aperturePath(side.mrd1Mm, side.mrd2Mm, side.fissureWidthMm)} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id})`}>
        <path data-structure="sclera" fillRule="evenodd" d={`${aperturePath(side.mrd1Mm, side.mrd2Mm, side.fissureWidthMm)} ${irisPath}`} fill="#34d399" fillOpacity={0.22} />
        <path data-structure="iris" fillRule="evenodd" d={`${irisPath} ${pupilPath}`} fill="#818cf8" fillOpacity={0.3} />
        {side.pupilMm !== null && (
          <circle data-structure="pupil" cx={160} cy={160} r={(side.pupilMm / 2 * PX).toFixed(1)} fill="#fbbf24" fillOpacity={0.35} />
        )}
      </g>
    </>
  );
}
