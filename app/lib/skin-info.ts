// Explication et publications de chaque parametre de peau. References verifiees sur PubMed ou DOI editeur.
import type { SkinParams } from "./skin-texture";

export interface SkinRef { label: string; url: string }
export interface SkinInfo { key: keyof SkinParams; label: string; unit: string; meaning: string; method: string; higher: string; lower: string; minSpread: number; refs: SkinRef[] }

const HARALICK: SkinRef = { label: "Haralick et al., IEEE Trans SMC, 1973 (méthode)", url: "https://doi.org/10.1109/TSMC.1973.4309314" };
const FRANGI: SkinRef = { label: "Frangi et al., MICCAI, 1998 (méthode)", url: "https://doi.org/10.1007/BFb0056195" };
const SAMSON: SkinRef = { label: "Samson et al., J Cosmet Dermatol, 2010", url: "https://doi.org/10.1111/j.1473-2165.2010.00489.x" };
const SUNDELIN: SkinRef = { label: "Sundelin et al., Sleep, 2013", url: "https://doi.org/10.5665/sleep.2964" };
const MATTS: SkinRef = { label: "Matts et al., J Am Acad Dermatol, 2007", url: "https://doi.org/10.1016/j.jaad.2007.07.040" };
const FINK: SkinRef = { label: "Fink et al., Int J Cosmet Sci, 2025", url: "https://doi.org/10.1111/ics.13045" };
const KIKUCHI: SkinRef = { label: "Kikuchi et al., J Opt Soc Am A, 2025", url: "https://doi.org/10.1364/JOSAA.550054" };

export const SKIN_INFO: SkinInfo[] = [
  { key: "grain", label: "Grain de peau", unit: "L*", meaning: "Les très petits reliefs de la peau, comme les pores et le micro-relief.", method: "Écart de luminosité entre deux niveaux de flou très fins.", higher: "grain plus visible", lower: "grain moins visible", minSpread: 0.1, refs: [SAMSON] },
  { key: "lissage", label: "Régularité", unit: "0 à 1", meaning: "À quel point deux points voisins de peau se ressemblent. Plus c'est proche de 1, plus la surface paraît régulière.", method: "Homogénéité de la matrice de co-occurrence (GLCM).", higher: "surface plus régulière", lower: "surface moins régulière", minSpread: 0.02, refs: [HARALICK, SAMSON] },
  { key: "ridules", label: "Ridules", unit: "% de la zone", meaning: "La part de peau occupée par de fines lignes sombres.", method: "Filtre de Hessian, qui repère les structures en forme de ligne.", higher: "plus de lignes fines", lower: "moins de lignes fines", minSpread: 0.5, refs: [FRANGI, SUNDELIN, FINK] },
  { key: "taches", label: "Unité du teint", unit: "ΔE", meaning: "Les variations de couleur par plaques. Plus la valeur est haute, plus le teint est irrégulier.", method: "Variation de couleur CIELAB à échelle moyenne.", higher: "teint moins uni", lower: "teint plus uni", minSpread: 0.15, refs: [MATTS, FINK] },
  { key: "rougeurs", label: "Rougeurs localisées", unit: "a*", meaning: "À quel point les zones les plus rouges ressortent du reste de la peau.", method: "Écart entre les 5 % de pixels les plus rouges et la médiane (a*).", higher: "rougeurs plus marquées", lower: "rougeurs moins marquées", minSpread: 0.4, refs: [MATTS] },
  { key: "brillance", label: "Brillance", unit: "% de la zone", meaning: "La part de peau qui renvoie un reflet net. Cela dépend beaucoup de la lumière.", method: "Pixels nettement plus clairs que la peau autour.", higher: "plus de reflets", lower: "moins de reflets", minSpread: 0.5, refs: [KIKUCHI, FINK] },
];

const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

export function sanitizeSkin(x: unknown): SkinParams | null {
  if (!x || typeof x !== "object") return null;
  const m = x as Record<string, unknown>, out = {} as SkinParams;
  for (const { key } of SKIN_INFO) {
    const v = m[key];
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0) return null;
    out[key] = v;
  }
  return out;
}

export function skinBaseline(all: SkinParams[], key: keyof SkinParams): { median: number; spread: number } | null {
  if (all.length < 3) return null;
  const xs = all.map((p) => p[key]), md = median(xs);
  const info = SKIN_INFO.find((i) => i.key === key)!;
  return { median: md, spread: Math.max(median(xs.map((x) => Math.abs(x - md))) * 1.4826, info.minSpread) };
}

export function skinReading(v: number, b: { median: number; spread: number } | null, info: SkinInfo): string {
  if (!b) return "Référence après 3 mesures";
  const z = (v - b.median) / b.spread;
  if (z > 2) return `Au-dessus de ton habitude : ${info.higher}`;
  if (z < -2) return `Sous ton habitude : ${info.lower}`;
  return "Comme d'habitude";
}
