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
 * Background color for a progress bar fill div.
 * Use with levelBarClip() for Framer Motion bars,
 * or levelBarStyle() for plain CSS-transition bars.
 */
export function levelBarBg(fraction: number): string {
  return fraction > 1 ? "#ef4444" : LEVEL_GRADIENT;
}

/**
 * clipPath value that reveals only the left `fraction` portion of the bar.
 * The gradient spans the full element width; clipping the right side exposes
 * only the correct colour slice — 30% shows blue, 70% shows blue→green→yellow.
 */
export function levelBarClip(fraction: number): string {
  const rightPct = (Math.max(0, 1 - Math.min(fraction, 1)) * 100).toFixed(1);
  return `inset(0 ${rightPct}% 0 0)`;
}

/**
 * Inline style for a plain <div> progress bar (CSS transition, no Framer Motion).
 * The clip-path approach correctly reveals only the left colour portion.
 */
export function levelBarStyle(fraction: number): React.CSSProperties {
  return {
    background:  levelBarBg(fraction),
    clipPath:    levelBarClip(fraction),
    transition:  "clip-path 0.7s cubic-bezier(0.16, 1, 0.3, 1)",
  };
}
