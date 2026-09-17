/**
 * Universal level-progress color system
 * Scale: Info (bleu) → Ok (vert) → Warn (jaune) → Calories (orange) → Danger (rouge)
 *
 * Used for ALL progress bars and level indicators across the site.
 * fraction = value / goal  (0 = empty, 1 = at goal, >1 = exceeded)
 *
 * Toutes les couleurs passent par les jetons de theme (--info/--ok/--warn/
 * --calories/--danger) plutot que par des hexadecimaux fixes : ce fichier
 * pilote les barres de progression sur 6 pages, et les valeurs en dur
 * correspondaient exactement au theme sombre — les theme clairs (Lumiere,
 * MFP) recevaient donc des couleurs jamais verifiees pour leur fond, avec un
 * contraste mesure aussi bas que 1,71 sur blanc.
 */

// The gradient that fills progress bars (always spans the fill width)
export const LEVEL_GRADIENT =
  "linear-gradient(90deg, var(--info) 0%, var(--ok) 32%, var(--warn) 62%, var(--calories) 82%, var(--danger) 100%)";

/**
 * Returns a single representative color for a given fraction.
 * Use for text, icons, or rings where a solid color is needed.
 */
export function levelColor(fraction: number): string {
  if (fraction > 1.05) return "var(--danger)";   // rouge   — depasse
  if (fraction > 0.85) return "var(--calories)"; // orange  — proche de la limite
  if (fraction > 0.62) return "var(--warn)";     // jaune   — on y arrive
  if (fraction > 0.28) return "var(--ok)";       // vert    — en bonne voie
  return "var(--info)";                           // bleu    — demarrage
}

/**
 * Same scale but accepts a 0–100 percentage instead of 0–1 fraction.
 */
export function levelColorPct(pct: number | null): string {
  if (pct === null) return "var(--text-muted)";
  return levelColor(pct / 100);
}

/**
 * Background color for a progress bar fill div.
 * Use with levelBarClip() for Framer Motion bars,
 * or levelBarStyle() for plain CSS-transition bars.
 */
export function levelBarBg(fraction: number): string {
  return fraction > 1 ? "var(--danger)" : LEVEL_GRADIENT;
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
