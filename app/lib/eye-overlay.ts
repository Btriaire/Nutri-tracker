import type { EyeSide } from "./eye-metrics";

export const EYE_LID_POINTS = { A: [159, 145], B: [386, 374] } as const;

export function drawEyeOverlay(
  ctx: CanvasRenderingContext2D,
  side: EyeSide,
  lid: { top: { x: number; y: number }; bottom: { x: number; y: number } },
  good: boolean
): void {
  // Clear the canvas
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  // If iris center is not present, do not draw anything
  if (!side.irisCenter) return;

  const irisRadius = side.irisPx / 2;
  const targetRadius = 1.6 * irisRadius;

  // Draw target ring
  ctx.beginPath();
  ctx.arc(side.irisCenter.x, side.irisCenter.y, targetRadius, 0, 2 * Math.PI);
  ctx.lineWidth = 4;
  ctx.strokeStyle = good ? "#34d399" : "#f59e0b";
  ctx.stroke();

  // Draw target markers
  const markerLength = 12;
  ctx.beginPath();
  ctx.moveTo(side.irisCenter.x - targetRadius, side.irisCenter.y);
  ctx.lineTo(side.irisCenter.x - targetRadius - markerLength, side.irisCenter.y);
  ctx.moveTo(side.irisCenter.x + targetRadius, side.irisCenter.y);
  ctx.lineTo(side.irisCenter.x + targetRadius + markerLength, side.irisCenter.y);
  ctx.moveTo(side.irisCenter.x, side.irisCenter.y - targetRadius);
  ctx.lineTo(side.irisCenter.x, side.irisCenter.y - targetRadius - markerLength);
  ctx.moveTo(side.irisCenter.x, side.irisCenter.y + targetRadius);
  ctx.lineTo(side.irisCenter.x, side.irisCenter.y + targetRadius + markerLength);
  ctx.stroke();

  // Draw iris
  ctx.beginPath();
  ctx.arc(side.irisCenter.x, side.irisCenter.y, irisRadius, 0, 2 * Math.PI);
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#818cf8";
  ctx.stroke();

  // Draw pupil if present
  if (side.pupilMm != null && side.pupilCenter) {
    const pupilRadius = (side.pupilMm / 11.7) * irisRadius;
    ctx.beginPath();
    ctx.arc(side.pupilCenter.x, side.pupilCenter.y, pupilRadius, 0, 2 * Math.PI);
    ctx.strokeStyle = "#fbbf24";
    ctx.stroke();
  }

  // Draw eyelids
  ctx.beginPath();
  ctx.arc(lid.top.x, lid.top.y, 5, 0, 2 * Math.PI);
  ctx.arc(lid.bottom.x, lid.bottom.y, 5, 0, 2 * Math.PI);
  ctx.fillStyle = "#34d399";
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(lid.top.x, lid.top.y);
  ctx.lineTo(lid.bottom.x, lid.bottom.y);
  ctx.setLineDash([6, 4]);
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.setLineDash([]);

  // Draw catchlight if present
  if (side.catchlight) {
    const mmToPx = side.irisPx / 11.7;
    const catchlightX = side.irisCenter.x + side.catchlight.dxMm * mmToPx;
    const catchlightY = side.irisCenter.y + side.catchlight.dyMm * mmToPx;
    ctx.beginPath();
    ctx.moveTo(catchlightX - 4, catchlightY - 4);
    ctx.lineTo(catchlightX + 4, catchlightY + 4);
    ctx.moveTo(catchlightX + 4, catchlightY - 4);
    ctx.lineTo(catchlightX - 4, catchlightY + 4);
    ctx.strokeStyle = "#f87171";
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}
