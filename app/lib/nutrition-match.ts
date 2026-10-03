// Comble le sodium et les graisses saturees manquants d'un aliment (estimation par IA, aliment perso,
// recette, produit Open Food Facts incomplet) a partir de la table de reference CIQUAL (ANSES).
// Module pur : l'index CIQUAL est fourni par l'appelant (voir nutrition-enrich.ts), donc testable.
//
// Principe : on ne fabrique jamais une valeur sans source.
//   1. sel renseigne mais pas de sodium  -> sodium = sel x 400 (identite, pas une estimation)
//   2. aliment reconnu dans CIQUAL        -> sodium au poids, graisses saturees au prorata des lipides
//   3. aliment non reconnu                -> graisses saturees = lipides x ratio moyen par famille
//                                            (le sodium reste inconnu : aucune regle honnete sans table)
import type { FoodNutrition } from "./types";

export interface CiqualLite {
  name: string;
  category?: string;
  per100g: { fatG: number; saturatedFatG: number | null; sodiumMg: number | null };
}

export type EstimateSource = "salt" | "ciqual" | "ratio";

export interface Estimate {
  sodiumMg?:      number;
  saturatedFatG?: number;
  sodiumSource?:  EstimateSource;
  satFatSource?:  EstimateSource;
  matchedName?:   string;
}

const STOPWORDS = new Set([
  "de", "du", "des", "d", "la", "le", "les", "l", "au", "aux", "a", "avec", "et", "en", "un", "une", "sur", "sans",
  "environ", "type", "maison", "portion", "tranche", "tranches", "cuillere", "cuilleres", "verre",
  "bol", "assiette", "petit", "petite", "grand", "grande", "g", "kg", "ml", "cl", "l",
]);

export function normalizeToken(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/œ/g, "oe");
}

// Formes feminines/plurielles des mots de cuisson ramenees a la forme masculine singuliere de CIQUAL.
const CANON: Record<string, string> = {
  cuite: "cuit", cuites: "cuit", cuits: "cuit", crue: "cru", crues: "cru", crus: "cru",
  rotie: "roti", roties: "roti", rotis: "roti", grillee: "grille", grillees: "grille", grilles: "grille",
  sautee: "saute", sautees: "saute", sautes: "saute", poelee: "poele", poelees: "poele", poeles: "poele",
  bouillie: "bouilli", bouillies: "bouilli", bouillis: "bouilli", rapee: "rape", rapees: "rape", rapes: "rape",
  hachee: "hache", hachees: "hache", fumee: "fume", fumees: "fume", fumes: "fume",
  frite: "frit", frites: "frit", frits: "frit", toaste: "grille", toastee: "grille",
  grec: "grecque", grecs: "grecque", grecques: "grecque",
  farcie: "farci", farcies: "farci", farcis: "farci",
};

// Pluriels a NE PAS depluraliser : "pates" (pasta) deviendrait "pate" et se confondrait avec le pate (charcuterie)
// et la pate (a tarte).
const KEEP_PLURAL = new Set(["pates"]);

// Expressions a traiter comme UN mot : "pomme" ne doit pas retrouver "pomme de terre", ni "noix" la noix de muscade.
const PHRASES: [RegExp, string][] = [
  [/\bpommes? de terre\b/g, "pommedeterre"],
  [/\bnoix de (muscade|coco|cajou|pecan|macadamia|bresil|ginkgo)\b/g, "noix$1"],
];

/** Racine commune au singulier/pluriel/feminin ("complètes" -> "complet", "tomates" -> "tomat"), appliquee des deux cotes. */
function stem(w: string): string {
  const c = CANON[w] ?? w;
  if (KEEP_PLURAL.has(c)) return c;
  if (c.length > 4 && c.endsWith("es")) return c.slice(0, -2);
  if (c.length > 3 && /[sxe]$/.test(c)) return c.slice(0, -1);
  return c;
}

/** Mots significatifs d'un nom d'aliment : sans accents, sans mots vides, sans nombres, ramenes a leur racine. */
export function tokenize(name: string): string[] {
  let n = normalizeToken(name).replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
  for (const [re, rep] of PHRASES) n = n.replace(re, rep);
  return n
    .split(" ")
    .filter((w) => w.length >= 2 && !/^\d+$/.test(w) && !STOPWORDS.has(w))
    .map(stem);
}

interface IndexedDoc { doc: CiqualLite; tokens: string[]; set: Set<string>; head: string }
export type CiqualIndex = IndexedDoc[];

export function buildCiqualIndex(docs: CiqualLite[]): CiqualIndex {
  return docs.map((doc) => {
    const tokens = tokenize(doc.name);
    return { doc, tokens, set: new Set(tokens), head: tokens[0] ?? "" };
  });
}

export interface Match { doc: CiqualLite; score: number }

// Mots du nom saisi qui n'empechent pas l'appariement s'ils sont absents de la fiche CIQUAL
// ("cafe noir" -> "Cafe, ... non sucre, pret a boire").
const SOFT_QUERY_TOKENS = new Set(["noir", "noire", "chaud", "chaude", "froid", "froide", "frais", "fraiche", "bio", "entier", "nature"].map(stem));

// Formes transformees : penalisees quand le nom saisi ne les demande pas ("saumon" ne doit pas donner
// du saumon fume a 1400 mg de sodium, ni "pain" du pain d'epices).
const PROCESSED_TOKENS = new Set([
  "fume", "seche", "appertise", "conserve", "preemballe", "pane", "sauce", "frit", "farci",
  "basquaise", "curry", "oseille", "perdu", "epice", "aromatise", "sucre", "allege", "mayonnaise", "assaisonne",
  "sandwich", "quiche", "gratin", "nugget", "chips", "cacao", "chocolat", "bayonne", "parme", "serrano",
  "fourre", "croquette", "friture", "coco", "lardon", "poudre", "soluble", "enrichi", "moulu", "feuille", "puree",
  "vinaigre", "confit", "marine", "saumure", "lyophilise", "deshydrate", "concentre", "nectar", "confiture", "compote",
].map(stem));

// Boissons : la fiche utile est "pret a boire" / "infuse", pas la poudre ni le grain.
const DRINK_HEADS = new Set(["cafe", "the", "tisane", "infusion", "expresso"].map(stem));

// Aliments dont la forme "cuite" est la forme consommee par defaut quand le nom ne precise rien.
const COOKED_BY_DEFAULT = new Set([
  "riz", "pates", "lentille", "quinoa", "boulgour", "semoule", "ble", "jambon", "poulet", "dinde", "boeuf", "porc",
  "veau", "agneau", "steak", "legume", "haricot", "brocoli", "chou", "epinard", "courgette", "carotte",
].map(stem));

// Mots reperes, ramenes a la meme racine que les tokens.
const T = {
  cuit: stem("cuit"), cru: stem("cru"), moyen: stem("moyen"), precision: stem("precision"), boire: stem("boire"),
  infuse: stem("infuse"), standard: stem("standard"), non: stem("non"), sale: stem("sale"),
};
const COOKED_WORDS = new Set(["cuit", "roti", "grille", "saute", "vapeur"].map(stem));
const T_FRAIS = new Set(["frais", "fraiche"].map(stem));
const T_FROMAGE = stem("fromage");

/** Meilleur aliment CIQUAL pour un nom libre, ou null si aucun n'est assez sur. */
export function matchFood(index: CiqualIndex, name: string): Match | null {
  const all = tokenize(name);
  if (all.length === 0) return null;
  const wantsCooked = all.some((t) => COOKED_WORDS.has(t));
  const wantsRaw = all.includes(T.cru);
  const wantsProcessed = new Set(all.filter((t) => PROCESSED_TOKENS.has(t)));

  let best: Match | null = null;
  for (const { doc, tokens, set } of index) {
    // Mots "souples" absents de la fiche : ignores (couleur, temperature, mode de cuisson, cru). Les autres doivent TOUS
    // se retrouver. "frais" est decisif pour un fromage ("fromage frais" n'est pas un fromage affine a 500 mg de sodium).
    const isSoft = (t: string) =>
      (SOFT_QUERY_TOKENS.has(t) || COOKED_WORDS.has(t) || t === T.cru) && !(T_FRAIS.has(t) && all.includes(T_FROMAGE));
    const q = all.filter((t) => set.has(t) || !isSoft(t));
    if (q.length === 0) continue;
    if (!q.every((t) => set.has(t))) continue;

    const pos = tokens.indexOf(q[0]);
    // Un mot isole doit etre en tete ou en 2e position de la fiche ("Pain, baguette" pour "baguette",
    // mais pas "Tarte aux pommes" pour "pomme" quand "Pomme, crue" existe : la tete rapporte un bonus).
    if (q.length === 1 && pos > 1) continue;

    let score = 10 - tokens.length * 0.35;
    if (tokens[0] === q[0] || q.includes(tokens[0])) score += 3;
    else if (pos === 1) score += 1;
    if (tokens[0] === all[0]) score += 2;                                    // meme mot de tete que le nom saisi ("huile d'olive")
    const generic = set.has(T.moyen) || set.has(T.precision);
    // Plats prepares : penalises pour un nom d'ingredient ("riz" ne doit pas donner "riz cantonais"),
    // sauf les fiches generiques du plat lui-meme ("Pizza (aliment moyen)").
    if (doc.category?.startsWith("entrées et plats") && !generic) score -= 3;
    // Fiches "aliment moyen" / "sans precision" : seulement si la fiche COMMENCE par l'aliment demande
    // (sinon "tomate" donnerait "Jus de tomate (aliment moyen)").
    if (generic && q.includes(tokens[0])) score += 4;
    if (q.some((t) => DRINK_HEADS.has(t)) && (set.has(T.boire) || set.has(T.infuse))) score += 3;
    if (wantsCooked && set.has(T.cuit)) score += 1.5;
    if (wantsRaw && set.has(T.cru)) score += 1.5;
    if (!wantsCooked && !wantsRaw) {
      if (set.has(T.cru) && q.some((t) => COOKED_BY_DEFAULT.has(t))) score -= 2;
      if (set.has(T.cuit) && q.some((t) => COOKED_BY_DEFAULT.has(t))) score += 1.5;
    }
    if (!wantsCooked && !wantsRaw && (set.has(T.cru) || set.has(T.cuit))) score += 0.6;   // forme de base de l'ingredient : depart egal -> la plus simple
    if (set.has(T.standard)) score += 1.5;                                   // "Pates seches standard" = la reference courante
    for (const t of tokens) {
      if (PROCESSED_TOKENS.has(t) && !wantsProcessed.has(t)) score -= 3;
      if (t === T.sale && !set.has(T.non) && !wantsProcessed.has(T.sale)) score -= 3;   // "non sale" = forme nature
    }
    if (doc.per100g.sodiumMg === null) score -= 2;                           // fiche sans donnee de sodium
    if (!best || score > best.score) best = { doc, score };
  }
  return best && best.score >= 5 ? best : null;
}

// Part moyenne de graisses saturees dans les lipides totaux, par famille (reperes CIQUAL/ANSES, ordre de grandeur).
const SAT_RATIO_RULES: [RegExp, number][] = [
  [/beurre|creme|fromage|camembert|brie|emmental|comte|mozzarella|parmesan|chevre|roquefort|raclette|lait entier|yaourt/, 0.62],
  [/huile d olive|olive/, 0.15],
  [/huile|margarine|tournesol|colza/, 0.12],
  [/noix|amande|noisette|cacahuete|pistache|cajou|graine|avocat/, 0.12],
  [/saumon|thon|sardine|maquereau|poisson|crevette|cabillaud|truite/, 0.22],
  [/poulet|dinde|volaille|canard/, 0.30],
  [/boeuf|veau|agneau|porc|jambon|saucisse|lardon|bacon|steak|burger|charcuterie|chorizo/, 0.40],
  [/chocolat|biscuit|gateau|viennoiserie|croissant|patisserie|glace|brioche/, 0.50],
  [/oeuf/, 0.32],
];
const DEFAULT_SAT_RATIO = 0.33;

export function satRatioFor(name: string): number {
  const n = normalizeToken(name).replace(/[^a-z0-9]+/g, " ");
  for (const [re, ratio] of SAT_RATIO_RULES) if (re.test(n)) return ratio;
  return DEFAULT_SAT_RATIO;
}

const r0 = (v: number) => Math.round(v);
const r1 = (v: number) => Math.round(v * 10) / 10;

/**
 * Valeurs a ajouter pour un aliment : ne renvoie QUE ce qui manque (un champ deja renseigne n'est jamais
 * ecrase). `grams` = poids consomme ; `nutrition` = valeurs deja mises a l'echelle de ce poids.
 */
export function estimateMissing(
  input: { name: string; grams: number; nutrition: FoodNutrition },
  index: CiqualIndex,
): Estimate {
  const { name, grams, nutrition: n } = input;
  const out: Estimate = {};
  const needSodium = n.sodiumMg == null;
  const needSat = n.saturatedFatG == null;
  if (!needSodium && !needSat) return out;

  if (needSodium && n.saltG != null && n.saltG > 0) {
    out.sodiumMg = r0(n.saltG * 400);
    out.sodiumSource = "salt";
  }

  const match = matchFood(index, name);
  if (match) {
    const p = match.doc.per100g;
    out.matchedName = match.doc.name;
    if (needSodium && out.sodiumMg === undefined && p.sodiumMg !== null) {
      out.sodiumMg = r0((p.sodiumMg * grams) / 100);
      out.sodiumSource = "ciqual";
    }
    if (needSat) {
      if (p.saturatedFatG !== null && p.fatG > 0.5) {
        // Au prorata des lipides propres a l'aliment : coherent avec ce que l'IA/l'utilisateur a saisi.
        out.saturatedFatG = r1(Math.min(n.fatG, (p.saturatedFatG / p.fatG) * n.fatG));
        out.satFatSource = "ciqual";
      } else if (p.saturatedFatG !== null && p.fatG <= 0.5) {
        out.saturatedFatG = r1(Math.min(n.fatG, (p.saturatedFatG * grams) / 100));
        out.satFatSource = "ciqual";
      }
    }
  }

  if (needSat && out.saturatedFatG === undefined) {
    out.saturatedFatG = r1(n.fatG * satRatioFor(name));
    out.satFatSource = "ratio";
  }
  return out;
}
