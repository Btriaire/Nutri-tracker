/** Transparence sur n'importe quelle couleur CSS (hex ou var(--x)) : `color + "55"` produit
 *  une chaine invalide des que la couleur est un var(). */
export const alpha = (color: string, pct: number) => `color-mix(in srgb, ${color} ${pct}%, transparent)`;
