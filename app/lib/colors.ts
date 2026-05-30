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
 *
 * IMPORTANT — scaleX approach:
 * The fill div must be 100% wide (className="w-full") and the parent must
 * have overflow:hidden. Animate `scaleX` (0 → fraction) instead of `width`.
 * This way the gradient always spans the full parent width; scaleX reveals
 * only the correct colour slice — 30% shows only blue, 70% shows
 * blue→green→yellow, 100% shows the full spectrum.
 */
export function levelBarStyle(fraction: number): React.CSSProperties {
  if (fraction > 1.0) {
    // Over limit: solid red
    return { background: "#ef4444", transformOrigin: "left center", willChange: "transform" };
  }
  return { background: LEVEL_GRADIENT, transformOrigin: "left center", willChange: "transform" };
}
