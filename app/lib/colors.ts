/**
 * Universal level-progress color system
 * Scale: Blue → Green → Yellow → Orange → Red
 *
 * Used for ALL progress bars and level indicators across the site.
 * fraction = value / goal  (0 = empty, 1 = at goal, >1 = exceeded)
 */

// The gradient that fills progress bars (always spans the fill width)
export const LEVEL_GRADIENT =
  "linear-gradient(90deg, #60a5fa 0%, #34d399 32%, #fbbf24 62%, #f97316 82%, #ef4444 100%)";

/**
 * Returns a single representative color for a given fraction.
 * Use for text, icons, or rings where a solid color is needed.
 */
export function levelColor(fraction: number): string {
  if (fraction > 1.05) return "#ef4444";   // red   — exceeded
  if (fraction > 0.85) return "#f97316";   // orange — near limit
  if (fraction > 0.62) return "#fbbf24";   // yellow — getting there
  if (fraction > 0.28) return "#34d399";   // green  — on track
  return "#60a5fa";                         // blue   — just starting
}

/**
 * Same scale but accepts a 0–100 percentage instead of 0–1 fraction.
 */
export function levelColorPct(pct: number | null): string {
  if (pct === null) return "rgba(255,255,255,0.28)";
  return levelColor(pct / 100);
}

/**
 * Returns inline style for a gradient-filled progress bar div.
 * Apply this to the fill element; set `width` separately via animation.
 *
 * The trick: backgroundSize scales the gradient so it appears to span
 * the full parent bar width. Only the relevant colour slice is visible
 * in the fill div — so a 30% bar shows only blue, a 70% bar shows
 * blue→green→yellow, and 100% shows the full spectrum.
 */
export function levelBarStyle(fraction: number): React.CSSProperties {
  if (fraction > 1.0) {
    // Over limit: solid red
    return { background: "#ef4444" };
  }
  const clampedFraction = Math.max(fraction, 0.005);
  // backgroundSize = 100/fraction % → gradient spans the whole parent bar
  const sizeStr = `${Math.min(Math.ceil(100 / clampedFraction), 4000)}% 100%`;
  return { background: LEVEL_GRADIENT, backgroundSize: sizeStr };
}
