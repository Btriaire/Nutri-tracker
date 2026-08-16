import type { FoodEntry, MealType } from "./types";

// ─── Programme Dr.T-L ────────────────────────────────────────────────────────
// Régime prescrit par le Dr Geneviève Tarpin-Lyonnet (nutritionniste), retranscrit
// depuis la feuille papier annotée. Deux créneaux du document (collation 10h,
// après-dîner/nuit) sont entièrement barrés pour ce patient — ils n'ont donc pas
// d'équivalent ici, seuls les 4 repas du journal (petit-déj/déjeuner/goûter/dîner)
// sont couverts.
//
// La détection de "violation" est un filet de sécurité heuristique, pas une
// lecture médicale : elle repère les cas nets (nom d'aliment interdit, quantité
// nettement au-dessus du repère) via des mots-clés. Elle ne peut pas vérifier
// qu'un aliment "obligatoire" (ex. 2 blancs d'œuf) a bien été pris — l'absence
// de violation détectée ne veut donc dire "rien d'interdit repéré", pas
// "régime suivi à la lettre". D'où le choix de ne jamais faire échouer un repas
// simplement parce qu'il manque un composant obligatoire : trop de faux négatifs
// (l'utilisateur peut avoir mangé l'aliment sans le logger précisément).

export interface DietViolation {
  entryId: string;
  entryName: string;
  reason: string;
}

export interface DietMealReport {
  status: "conforme" | "ecarts" | "vide";
  violations: DietViolation[];
}

export interface DietReport {
  perMeal: Record<MealType, DietMealReport>;
  day: { status: "conforme" | "ecarts" | "vide"; violationCount: number };
  violationsByEntryId: Record<string, DietViolation[]>;
}

function normalize(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** true si un des mots/phrases (déjà sans accent) apparaît comme mot entier dans le nom normalisé. */
function matchesAny(normalizedName: string, keywords: string[]): string | null {
  for (const kw of keywords) {
    const re = new RegExp(`\\b${escapeRegExp(kw)}\\b`);
    if (re.test(normalizedName)) return kw;
  }
  return null;
}

// ─── Interdits globaux (toutes les valeurs ci-dessous sont déjà sans accent) ──

const SUGAR_KEYWORDS = [
  "sucre", "sucres", "sucree", "sucrees", "bonbon", "bonbons", "chocolat",
  "chocolatee", "chocolatees", "gateau", "gateaux", "biscuit", "biscuits",
  "patisserie", "patisseries", "confiture", "miel", "soda", "coca", "nutella",
  "glace", "sirop", "pate a tartiner", "viennoiserie",
];

const PASTA_PIZZA_KEYWORDS = [
  "pates", "spaghetti", "spaghettis", "macaroni", "tagliatelle", "tagliatelles",
  "nouilles", "lasagne", "lasagnes", "ravioli", "raviolis", "gnocchi", "penne",
  "fusilli", "linguine", "quiche", "pizza",
];

const WINE_KEYWORDS = [
  "vin", "aperitif", "pastis", "kir", "champagne", "porto", "whisky", "biere",
  "muscat", "martini", "cocktail",
];

const FORBIDDEN_VEGETABLES = [
  "petits pois", "macedoine", "lentilles", "pois chiches", "flageolets",
  "mais", "haricots blancs", "feves", "carottes", "carotte", "betteraves",
  "betterave", "avocat", "avocats", "pommes de terre", "pomme de terre",
  "patate", "patates", "potiron", "potirons", "citrouille", "salsifis",
  "artichaut", "artichauts", "legumes secs", "soupe pistou",
];

// Blocklist "meilleur effort" — le régime interdit tout fruit hors liste
// autorisée (pamplemousse, kiwi, fruits rouges, pastèque, grenade, melon,
// poire, pêche, abricot, prune, clémentine), mais vérifier une liste blanche
// fiable depuis un simple nom d'aliment est trop fragile. On se limite donc aux
// fruits courants et clairement hors liste.
const NON_APPROVED_FRUITS = [
  "banane", "bananes", "pomme", "pommes", "orange", "oranges", "raisin",
  "raisins", "ananas", "mangue", "mangues", "cerise", "cerises", "figue",
  "figues", "datte", "dattes", "litchi",
];

const FRUIT_JUICE_KEYWORDS = [
  "jus de fruit", "jus de fruits", "jus d'orange", "jus dorange", "jus de pomme",
  "jus de raisin", "jus multifruit", "jus multivitamine", "nectar",
];

const MEAT_KEYWORDS = [
  "poulet", "dinde", "veau", "lapin", "jambon", "boeuf", "steak", "viande",
  "bavette", "rumsteck", "cheval",
];

const FISH_KEYWORDS = [
  "poisson", "thon", "saumon", "cabillaud", "colin", "sole", "maquereau",
  "hareng", "sardine", "truite", "crevette", "crevettes", "moule", "moules",
  "supion", "supions", "sushi", "sushis", "sashimi", "sashimis",
];

interface MealRule {
  breadMaxG?: number;   // pain complet — au-delà, écart "quantité"
  noBread?: boolean;    // "SANS PAIN NI KRISSPROLLS"
  meatMaxG?: number;
  fishMaxG?: number;
  summary: string;      // résumé affiché en réglages / tooltip
}

const MEAL_RULES: Record<MealType, MealRule> = {
  breakfast: {
    breadMaxG: 60,
    summary: "60g pain complet (ou 4 Krissproll) + yaourt nature/fromage blanc 0% + 2 blancs d'œuf dur (obligatoire) + fruits rouges + boisson sans sucre",
  },
  lunch: {
    breadMaxG: 15,
    meatMaxG: 120,
    fishMaxG: 130,
    summary: "120g viande blanche/maigre ou 130g poisson/thon + 2 blancs d'œuf dur (obligatoire) + légumes à volonté (obligatoire) + 15g pain complet (ou 1 Krissproll) + yaourt nature/fromage blanc + fruits autorisés",
  },
  snacks: {
    noBread: true,
    summary: "Yaourt nature/fromage blanc 0% + fruits rouges ou petit-suisse. Sans pain ni Krissprolls.",
  },
  dinner: {
    noBread: true,
    fishMaxG: 200,
    summary: "200g poisson cuit (ou 145g thon nature, fruits de mer, sushis/sashimis) + 2 blancs d'œuf dur (obligatoire) + légumes à volonté (obligatoire) + yaourt nature/fromage blanc + fruits autorisés. Sans pain.",
  },
};

export const DIET_PROGRAM_NAME = "Programme Dr.T-L";

export const DIET_INTERDITS_SUMMARY =
  "Sucre/sucreries, farine blanche (pain non complet, pâtes, quiche, pizza), " +
  "vin/apéritif, fruits hors liste autorisée et jus de fruits, légumes secs/" +
  "pomme de terre/carotte/betterave/avocat/maïs/potiron/artichaut/salsifis et assimilés.";

export function dietMealSummary(meal: MealType): string {
  return MEAL_RULES[meal].summary;
}

const QUANTITY_TOLERANCE = 1.15; // +15% de marge avant de signaler un écart de quantité

function checkForbiddenKeywords(normalizedName: string): string | null {
  let hit = matchesAny(normalizedName, SUGAR_KEYWORDS);
  if (hit) {
    // "Boisson sans sucre" est explicitement autorisée — ne pas la signaler.
    if (!/\bsans\s*sucre\b/.test(normalizedName)) return `sucre/sucrerie interdit (${hit})`;
    hit = null;
  }
  hit = matchesAny(normalizedName, PASTA_PIZZA_KEYWORDS);
  if (hit) return `farine blanche interdite (${hit})`;

  hit = matchesAny(normalizedName, WINE_KEYWORDS);
  if (hit) return `vin/apéritif interdit (${hit})`;

  hit = matchesAny(normalizedName, FORBIDDEN_VEGETABLES);
  if (hit) return `légume interdit par le régime (${hit})`;

  hit = matchesAny(normalizedName, FRUIT_JUICE_KEYWORDS);
  if (hit) return `jus de fruit interdit (${hit})`;

  hit = matchesAny(normalizedName, NON_APPROVED_FRUITS);
  if (hit) return `fruit hors liste autorisée (${hit})`;

  // Pain "blanc" (sans "complet"/Krissproll/Wasa) : interdit à tout repas, y
  // compris ceux qui autorisent le pain complet en quantité contrôlée.
  if (/\bpain\b/.test(normalizedName) && !/\bcomplet\b|\bkrissproll\b|\bwasa\b/.test(normalizedName)) {
    return "pain non complet — farine blanche interdite";
  }

  return null;
}

function checkQuantity(meal: MealType, normalizedName: string, grams: number): string | null {
  const rule = MEAL_RULES[meal];

  if (rule.noBread && /\bpain\b|\bkrissproll\b/.test(normalizedName)) {
    return "pain non prévu à ce repas";
  }
  if (rule.breadMaxG != null && /\bpain\b.*\bcomplet\b|\bkrissproll\b/.test(normalizedName) && grams > rule.breadMaxG * QUANTITY_TOLERANCE) {
    return `quantité de pain au-delà de la portion prévue (${rule.breadMaxG}g)`;
  }
  if (rule.meatMaxG != null && matchesAny(normalizedName, MEAT_KEYWORDS) && grams > rule.meatMaxG * QUANTITY_TOLERANCE) {
    return `quantité de viande au-delà de la portion prévue (${rule.meatMaxG}g)`;
  }
  if (rule.fishMaxG != null && matchesAny(normalizedName, FISH_KEYWORDS) && grams > rule.fishMaxG * QUANTITY_TOLERANCE) {
    return `quantité de poisson au-delà de la portion prévue (${rule.fishMaxG}g)`;
  }
  return null;
}

export function checkDietCompliance(entries: FoodEntry[]): DietReport {
  const violationsByEntryId: Record<string, DietViolation[]> = {};
  const perMeal = {} as Record<MealType, DietMealReport>;

  (Object.keys(MEAL_RULES) as MealType[]).forEach((meal) => {
    const mealEntries = entries.filter((e) => e.meal === meal);
    const violations: DietViolation[] = [];

    for (const entry of mealEntries) {
      const normalized = normalize(entry.name);
      const reasons: string[] = [];

      const forbidden = checkForbiddenKeywords(normalized);
      if (forbidden) reasons.push(forbidden);

      const overQuantity = checkQuantity(meal, normalized, entry.servingGrams ?? 0);
      if (overQuantity) reasons.push(overQuantity);

      for (const reason of reasons) {
        const v = { entryId: entry.id, entryName: entry.name, reason };
        violations.push(v);
        (violationsByEntryId[entry.id] ??= []).push(v);
      }
    }

    perMeal[meal] = {
      status: violations.length > 0 ? "ecarts" : mealEntries.length > 0 ? "conforme" : "vide",
      violations,
    };
  });

  const violationCount = Object.values(perMeal).reduce((s, m) => s + m.violations.length, 0);
  const anyLogged = entries.length > 0;

  return {
    perMeal,
    day: {
      status: violationCount > 0 ? "ecarts" : anyLogged ? "conforme" : "vide",
      violationCount,
    },
    violationsByEntryId,
  };
}
