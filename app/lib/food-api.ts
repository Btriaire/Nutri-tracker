import type { FoodNutrition, FoodSearchResult, Lang, ServingOption } from "./types";
import ciqualFoods from "./data/ciqual-foods.json";

// ─── Ciqual document shape (static reference table) ───────────────────────────

interface CiqualDoc {
  id: string;
  name: string;
  nameLower: string;
  category: string;
  per100g: {
    calories: number; proteinG: number; carbsG: number; fatG: number; fiberG: number;
    sugarG: number | null; starchG: number | null; saturatedFatG: number | null;
    monounsatFatG: number | null; polyunsatFatG: number | null;
    sodiumMg: number | null; saltG: number | null; potassiumMg: number | null;
    calciumMg: number | null; magneziumMg: number | null; phosphorusMg: number | null;
    ironMg: number | null; zincMg: number | null; vitaminAUg: number | null;
    vitaminCMg: number | null; vitaminDUg: number | null; vitaminB12Ug: number | null;
    vitaminB9Ug: number | null; waterG: number | null; alcoholG: number | null;
    cholesterolMg: number | null;
  };
}

// ─── Ciqual data ────────────────────────────────────────────────────────────
// Bundled as a static asset instead of a Firestore collection: it's a fixed
// reference table (ANSES CIQUAL) that never changes at runtime, so querying it
// from Firestore only cost ~3200 reads on every cold serverless start for no
// benefit. Regenerate via `npx tsx scripts/export-ciqual-static.ts` if the
// source table is ever re-imported.

async function getCiqualCache(): Promise<CiqualDoc[]> {
  return ciqualFoods as CiqualDoc[];
}

// ─── Text helpers ─────────────────────────────────────────────────────────────

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")   // é→e  à→a  ç→c
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function scoreText(haystack: string, needles: string[]): number {
  const norm  = normalize(haystack);
  const words = norm.split(/\s+/);
  let score   = 0;
  for (const n of needles) {
    if (!norm.includes(n)) return 0;   // all words must match
    if (words[0] === n)         score += 12;
    else if (norm.startsWith(n)) score += 9;
    else if (words.includes(n)) score += 6;
    else                        score += 2;
  }
  score += Math.max(0, 8 - words.length); // shorter name = more specific
  return score;
}

// ─── Normalise helpers ────────────────────────────────────────────────────────

function scaleN(val: number | null | undefined, ratio: number): number | undefined {
  if (val == null) return undefined;
  return Math.round(val * ratio * 10) / 10;
}
function scaleMg(val: number | null | undefined, ratio: number): number | undefined {
  if (val == null) return undefined;
  return Math.round(val * ratio);
}

// ─── Source converters ────────────────────────────────────────────────────────

function ciqualToResult(doc: CiqualDoc): FoodSearchResult {
  const p = doc.per100g;
  return {
    id:           `ciqual:${doc.id}`,
    source:       "ciqual",
    name:         doc.name,
    category:     doc.category,
    servingSizeG: 100,
    servingLabel: "100g",
    nutrition: {
      calories: Math.round(p.calories),
      proteinG: Math.round(p.proteinG * 10) / 10,
      carbsG:   Math.round(p.carbsG   * 10) / 10,
      fatG:     Math.round(p.fatG     * 10) / 10,
      fiberG:   Math.round(p.fiberG   * 10) / 10,
      sugarG:         scaleN(p.sugarG, 1),
      starchG:        scaleN(p.starchG, 1),
      saturatedFatG:  scaleN(p.saturatedFatG, 1),
      monounsatFatG:  scaleN(p.monounsatFatG, 1),
      polyunsatFatG:  scaleN(p.polyunsatFatG, 1),
      cholesterolMg:  scaleMg(p.cholesterolMg, 1),
      sodiumMg:       scaleMg(p.sodiumMg, 1),
      saltG:          scaleN(p.saltG, 1),
      potassiumMg:    scaleMg(p.potassiumMg, 1),
      calciumMg:      scaleMg(p.calciumMg, 1),
      magneziumMg:    scaleMg(p.magneziumMg, 1),
      phosphorusMg:   scaleMg(p.phosphorusMg, 1),
      ironMg:         scaleN(p.ironMg, 1),
      zincMg:         scaleN(p.zincMg, 1),
      vitaminAUg:     scaleMg(p.vitaminAUg, 1),
      vitaminCMg:     scaleN(p.vitaminCMg, 1),
      vitaminDUg:     scaleN(p.vitaminDUg, 1),
      vitaminB12Ug:   scaleN(p.vitaminB12Ug, 1),
      vitaminB9Ug:    scaleMg(p.vitaminB9Ug, 1),
      waterG:         scaleN(p.waterG, 1),
      alcoholG:       scaleN(p.alcoholG, 1),
    },
  };
}

function parseServingGrams(s: string | undefined): number | null {
  if (!s) return null;
  const m = s.match(/(\d+(?:[.,]\d+)?)\s*g/i);
  return m ? parseFloat(m[1].replace(",", ".")) : null;
}

function offToResult(product: Record<string, unknown>): FoodSearchResult | null {
  const nm = product.nutriments as Record<string, number> | undefined;
  if (!nm) return null;
  // Prefer kcal field; fall back to kJ converted to kcal (never use energy_100g which may be kJ)
  const cal100 = nm["energy-kcal_100g"]
    ?? (nm["energy-kj_100g"] != null ? Math.round(nm["energy-kj_100g"] / 4.184) : null)
    ?? null;
  if (cal100 === null || cal100 <= 0) return null;

  const servingSize = product.serving_size as string | undefined;
  const servingG    = parseServingGrams(servingSize) ?? 100;
  const ratio       = servingG / 100;

  const nutrition: FoodNutrition = {
    calories:       Math.round(cal100 * ratio),
    proteinG:       Math.round((nm.proteins_100g          ?? 0) * ratio * 10) / 10,
    carbsG:         Math.round((nm.carbohydrates_100g     ?? 0) * ratio * 10) / 10,
    fatG:           Math.round((nm.fat_100g               ?? 0) * ratio * 10) / 10,
    fiberG:         Math.round((nm["fiber_100g"] ?? nm["fibers_100g"] ?? 0) * ratio * 10) / 10,
    sugarG:         nm.sugars_100g            ? scaleN(nm.sugars_100g, ratio)                       : undefined,
    saturatedFatG:  nm["saturated-fat_100g"]  ? scaleN(nm["saturated-fat_100g"], ratio)             : undefined,
    sodiumMg:       nm.sodium_100g            ? scaleMg(nm.sodium_100g * 1000, ratio)               : undefined,
    saltG:          nm.salt_100g              ? scaleN(nm.salt_100g, ratio)                         : undefined,
    potassiumMg:    nm.potassium_100g         ? scaleMg(nm.potassium_100g * 1000, ratio)            : undefined,
    calciumMg:      nm.calcium_100g           ? scaleMg(nm.calcium_100g * 1000, ratio)              : undefined,
    ironMg:         nm.iron_100g              ? scaleN(nm.iron_100g * 1000, ratio)                  : undefined,
    vitaminCMg:     nm["vitamin-c_100g"]      ? scaleN(nm["vitamin-c_100g"] * 1000, ratio)          : undefined,
    cholesterolMg:  nm.cholesterol_100g       ? scaleMg(nm.cholesterol_100g * 1000, ratio)          : undefined,
    waterG:         nm.water_100g             ? scaleN(nm.water_100g, ratio)                        : undefined,
    alcoholG:       nm.alcohol_100g           ? scaleN(nm.alcohol_100g, ratio)                      : undefined,
  };

  const servingOptions: ServingOption[] = [];
  if (servingG !== 100) servingOptions.push({ label: servingSize ?? `${servingG}g`, grams: servingG, isDefault: true });
  servingOptions.push({ label: "100g", grams: 100, isDefault: servingG === 100 });

  const rawImage = product.image_front_thumb_url as string | undefined;
  return {
    id:           `off:${product.code ?? product._id}`,
    source:       "off",
    name:         (product.product_name_fr ?? product.product_name ?? product._id) as string,
    brand:        product.brands as string | undefined,
    category:     product.categories_tags
                    ? ((product.categories_tags as string[])[0] ?? undefined) : undefined,
    imageUrl:     rawImage?.startsWith("http") ? rawImage : undefined,
    servingSizeG: servingG,
    servingLabel: servingSize ?? "100g",
    servingOptions: servingOptions.length > 1 ? servingOptions : undefined,
    nutrition,
  };
}

function usdaToResult(item: Record<string, unknown>): FoodSearchResult {
  const nutrients = (item.foodNutrients as Record<string, unknown>[]) ?? [];
  const getN = (id: number): number => {
    const n = nutrients.find((n) => (n.nutrientId ?? n.nutrientNumber) === id);
    return typeof n?.value === "number" ? n.value : 0;
  };
  const servingG = typeof item.servingSize === "number" && item.servingSize > 0
    ? item.servingSize as number : 100;
  const unit     = (item.servingSizeUnit as string) ?? "g";
  const isG      = unit.toLowerCase() === "g";
  const ratio    = servingG / 100;
  const servingLabel = isG ? `${servingG}g` : `${servingG} ${unit}`;
  const servingOptions: ServingOption[] = [];
  if (isG && servingG !== 100) {
    servingOptions.push({ label: servingLabel, grams: servingG, isDefault: true });
    servingOptions.push({ label: "100g", grams: 100 });
  }
  return {
    id:           `usda:${item.fdcId}`,
    source:       "usda",
    name:         item.description as string,
    brand:        (item.brandOwner ?? item.brandName) as string | undefined,
    category:     item.foodCategory as string | undefined,
    servingSizeG: servingG, servingLabel,
    servingOptions: servingOptions.length > 0 ? servingOptions : undefined,
    nutrition: {
      calories:       Math.round((getN(1008) || getN(2047)) * ratio),
      proteinG:       Math.round(getN(1003) * ratio * 10) / 10,
      carbsG:         Math.round(getN(1005) * ratio * 10) / 10,
      fatG:           Math.round(getN(1004) * ratio * 10) / 10,
      fiberG:         Math.round(getN(1079) * ratio * 10) / 10,
      sugarG:         getN(2000) ? scaleN(getN(2000), ratio) : undefined,
      starchG:        getN(1009) ? scaleN(getN(1009), ratio) : undefined,
      saturatedFatG:  getN(1258) ? scaleN(getN(1258), ratio) : undefined,
      monounsatFatG:  getN(1292) ? scaleN(getN(1292), ratio) : undefined,
      polyunsatFatG:  getN(1293) ? scaleN(getN(1293), ratio) : undefined,
      transFatG:      getN(1257) ? scaleN(getN(1257), ratio) : undefined,
      cholesterolMg:  getN(1253) ? scaleMg(getN(1253), ratio) : undefined,
      sodiumMg:       getN(1093) ? scaleMg(getN(1093), ratio) : undefined,
      potassiumMg:    getN(1092) ? scaleMg(getN(1092), ratio) : undefined,
      calciumMg:      getN(1087) ? scaleMg(getN(1087), ratio) : undefined,
      magneziumMg:    getN(1090) ? scaleMg(getN(1090), ratio) : undefined,
      phosphorusMg:   getN(1091) ? scaleMg(getN(1091), ratio) : undefined,
      ironMg:         getN(1089) ? scaleN(getN(1089), ratio)  : undefined,
      zincMg:         getN(1095) ? scaleN(getN(1095), ratio)  : undefined,
      vitaminAUg:     getN(1106) ? scaleMg(getN(1106), ratio) : undefined,
      vitaminCMg:     getN(1162) ? scaleN(getN(1162), ratio)  : undefined,
      vitaminDUg:     getN(1114) ? scaleN(getN(1114), ratio)  : undefined,
      vitaminB12Ug:   getN(1178) ? scaleN(getN(1178), ratio)  : undefined,
      vitaminB9Ug:    getN(1190) ? scaleMg(getN(1190), ratio) : undefined,
      waterG:         getN(1051) ? scaleN(getN(1051), ratio)  : undefined,
      alcoholG:       getN(1018) ? scaleN(getN(1018), ratio)  : undefined,
    },
  };
}

function edamamToResult(food: Record<string, unknown>): FoodSearchResult | null {
  const n = food.nutrients as Record<string, number> | undefined;
  if (!n || !n.ENERC_KCAL) return null;
  return {
    id:           `edamam:${food.foodId}`,
    source:       "edamam",
    name:         food.label as string,
    category:     food.category as string | undefined,
    imageUrl:     food.image as string | undefined,
    servingSizeG: 100,
    servingLabel: "100g",
    nutrition: {
      calories:       Math.round(n.ENERC_KCAL ?? 0),
      proteinG:       Math.round((n.PROCNT  ?? 0) * 10) / 10,
      carbsG:         Math.round((n.CHOCDF  ?? 0) * 10) / 10,
      fatG:           Math.round((n.FAT     ?? 0) * 10) / 10,
      fiberG:         Math.round((n.FIBTG   ?? 0) * 10) / 10,
      sugarG:         n.SUGAR ? scaleN(n.SUGAR, 1) : undefined,
      sodiumMg:       n.NA    ? scaleMg(n.NA,    1) : undefined,
      calciumMg:      n.CA    ? scaleMg(n.CA,    1) : undefined,
      potassiumMg:    n.K     ? scaleMg(n.K,     1) : undefined,
      ironMg:         n.FE    ? scaleN(n.FE,     1) : undefined,
      vitaminCMg:     n.VITC  ? scaleN(n.VITC,   1) : undefined,
      cholesterolMg:  n.CHOLE ? scaleMg(n.CHOLE, 1) : undefined,
    },
  };
}

// Nutritionix food shape
interface NxFood {
  food_name: string; brand_name?: string; photo?: { thumb?: string };
  serving_qty: number; serving_unit: string; serving_weight_grams: number;
  nf_calories: number; nf_total_fat: number; nf_saturated_fat: number;
  nf_total_carbohydrate: number; nf_dietary_fiber: number; nf_sugars: number;
  nf_protein: number; nf_sodium: number; nf_cholesterol: number; nf_potassium: number;
  nix_item_id?: string;
}

function nutritionixToResult(f: NxFood, branded: boolean): FoodSearchResult {
  const g = f.serving_weight_grams || 100;
  return {
    id:           `nutritionix:${branded ? (f.nix_item_id ?? f.food_name) : f.food_name}`,
    source:       "nutritionix",
    name:         f.food_name,
    brand:        f.brand_name,
    imageUrl:     f.photo?.thumb,
    servingSizeG: g,
    servingLabel: `${f.serving_qty} ${f.serving_unit} (${g}g)`,
    servingOptions: g !== 100 ? [
      { label: `${f.serving_qty} ${f.serving_unit}`, grams: g, isDefault: true },
      { label: "100g", grams: 100 },
    ] : undefined,
    nutrition: {
      calories:       Math.round(f.nf_calories             ?? 0),
      proteinG:       Math.round((f.nf_protein             ?? 0) * 10) / 10,
      carbsG:         Math.round((f.nf_total_carbohydrate  ?? 0) * 10) / 10,
      fatG:           Math.round((f.nf_total_fat           ?? 0) * 10) / 10,
      fiberG:         Math.round((f.nf_dietary_fiber       ?? 0) * 10) / 10,
      sugarG:         f.nf_sugars       ? scaleN(f.nf_sugars, 1)       : undefined,
      saturatedFatG:  f.nf_saturated_fat ? scaleN(f.nf_saturated_fat, 1) : undefined,
      sodiumMg:       f.nf_sodium       ? scaleMg(f.nf_sodium, 1)      : undefined,
      potassiumMg:    f.nf_potassium    ? scaleMg(f.nf_potassium, 1)   : undefined,
      cholesterolMg:  f.nf_cholesterol  ? scaleMg(f.nf_cholesterol, 1) : undefined,
    },
  };
}

// FatSecret food shape (foods.search REST v1, format=json)
interface FsFood {
  food_id: string;
  food_name: string;
  brand_name?: string;
  food_type?: string;
  food_description: string; // e.g. "Per 100g - Calories: 52kcal | Fat: 0.17g | Carbs: 13.81g | Protein: 0.26g"
}

function fatsecretToResult(f: FsFood): FoodSearchResult | null {
  const desc = f.food_description ?? "";
  const cal  = /Calories:\s*([\d.]+)\s*kcal/i.exec(desc);
  if (!cal) return null;
  const fat     = /Fat:\s*([\d.]+)\s*g/i.exec(desc);
  const carbs   = /Carbs:\s*([\d.]+)\s*g/i.exec(desc);
  const protein = /Protein:\s*([\d.]+)\s*g/i.exec(desc);
  const fiber   = /Fiber:\s*([\d.]+)\s*g/i.exec(desc);

  // Try to read an explicit gram serving from the leading "Per X" segment (e.g. "Per 100g", "Per 1 slice (28g)")
  const servingMatch = /^Per\s+([^-]+)-/i.exec(desc);
  const servingText  = servingMatch?.[1]?.trim() ?? "1 portion";
  const gramMatch     = /([\d.]+)\s*g\b/i.exec(servingText);
  const servingSizeG  = gramMatch ? parseFloat(gramMatch[1]) : 100;

  return {
    id:           `fatsecret:${f.food_id}`,
    source:       "fatsecret",
    name:         f.food_name,
    brand:        f.brand_name,
    servingSizeG,
    servingLabel: servingText,
    nutrition: {
      calories: Math.round(parseFloat(cal[1])),
      proteinG: protein ? Math.round(parseFloat(protein[1]) * 10) / 10 : 0,
      carbsG:   carbs   ? Math.round(parseFloat(carbs[1])   * 10) / 10 : 0,
      fatG:     fat     ? Math.round(parseFloat(fat[1])     * 10) / 10 : 0,
      fiberG:   fiber   ? Math.round(parseFloat(fiber[1])   * 10) / 10 : 0,
    },
  };
}

// ─── FatSecret OAuth2 (client_credentials) — module-level token cache ────────

let _fsToken: { value: string; expiresAt: number } | null = null;
let _fsTokenPromise: Promise<string | null> | null = null;

async function getFatSecretToken(): Promise<string | null> {
  const clientId     = process.env.FATSECRET_CLIENT_ID;
  const clientSecret = process.env.FATSECRET_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  if (_fsToken && _fsToken.expiresAt > Date.now()) return _fsToken.value;
  if (_fsTokenPromise) return _fsTokenPromise;

  _fsTokenPromise = (async () => {
    try {
      const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
      const res = await fetch("https://oauth.fatsecret.com/connect/token", {
        method: "POST",
        headers: {
          "Authorization": `Basic ${basic}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "grant_type=client_credentials&scope=basic",
        signal: AbortSignal.timeout(7000),
      });
      if (!res.ok) return null;
      const json = await res.json() as { access_token: string; expires_in: number };
      _fsToken = { value: json.access_token, expiresAt: Date.now() + (json.expires_in - 60) * 1000 };
      return _fsToken.value;
    } catch {
      return null;
    } finally {
      _fsTokenPromise = null;
    }
  })();

  return _fsTokenPromise;
}

async function searchFatSecret(query: string, limit = 20): Promise<FoodSearchResult[]> {
  try {
    const token = await getFatSecretToken();
    if (!token) return [];
    const url = `https://platform.fatsecret.com/rest/foods/search/v1?search_expression=${encodeURIComponent(query)}&max_results=${limit}&format=json`;
    const res = await fetch(url, {
      headers: { "Authorization": `Bearer ${token}` },
      signal: AbortSignal.timeout(7000),
    });
    if (!res.ok) return [];
    const json = await res.json() as { foods?: { food?: FsFood | FsFood[] } };
    const raw = json.foods?.food;
    const foods = Array.isArray(raw) ? raw : raw ? [raw] : [];
    return foods.map(fatsecretToResult).filter((r): r is FoodSearchResult => r !== null);
  } catch {
    return [];
  }
}

// ─── Source fetchers ──────────────────────────────────────────────────────────

async function searchCiqual(query: string, limit = 20): Promise<FoodSearchResult[]> {
  try {
    const cache = await getCiqualCache();
    const words = normalize(query).split(/\s+/).filter((w) => w.length >= 2);
    if (!words.length) return [];
    return cache
      .map((doc) => ({ doc, score: scoreText(doc.name, words) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((x) => ciqualToResult(x.doc));
  } catch {
    return [];
  }
}

async function searchOpenFoodFacts(query: string, lang: "fr" | "en", limit = 25): Promise<FoodSearchResult[]> {
  const lc     = lang === "fr" ? "fr" : "en";
  const fields = "code,product_name,product_name_fr,brands,categories_tags,nutriments,serving_size,image_front_thumb_url";

  // Primary: Elasticsearch endpoint (best relevance + popularity sort)
  const p1 = fetch(
    `https://search.openfoodfacts.org/search?q=${encodeURIComponent(query)}&json=1&fields=${fields}&page_size=${limit}&lc=${lc}&sort_by=popularity_key`,
    { headers: { "User-Agent": "NutriTracker/1.0" }, signal: AbortSignal.timeout(7000) },
  ).then(async (r) => {
    if (!r.ok) return [] as FoodSearchResult[];
    const j = await r.json() as { hits?: unknown[] };
    return (j.hits ?? []).map((p) => offToResult(p as Record<string, unknown>)).filter((r): r is FoodSearchResult => r !== null);
  }).catch(() => [] as FoodSearchResult[]);

  // Secondary: classic French endpoint sorted by popularity (complementary products)
  const p2 = lang === "fr"
    ? fetch(
        `https://fr.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&fields=${fields}&page_size=20&sort_by=popularity_key`,
        { headers: { "User-Agent": "NutriTracker/1.0" }, signal: AbortSignal.timeout(7000) },
      ).then(async (r) => {
        if (!r.ok) return [] as FoodSearchResult[];
        const j = await r.json() as { products?: unknown[] };
        return (j.products ?? []).map((p) => offToResult(p as Record<string, unknown>)).filter((r): r is FoodSearchResult => r !== null);
      }).catch(() => [] as FoodSearchResult[])
    : Promise.resolve([] as FoodSearchResult[]);

  const [a, b] = await Promise.all([p1, p2]);
  const seen = new Set<string>();
  return [...a, ...b].filter((r) => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  }).slice(0, limit);
}

async function searchUSDA(query: string, limit = 20): Promise<FoodSearchResult[]> {
  try {
    const key = process.env.USDA_API_KEY;
    if (!key) return [];
    // Foundation + SR Legacy = accurate raw foods / Branded = packaged
    const url = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(query)}&pageSize=${limit}&dataType=Foundation,SR%20Legacy,Branded&api_key=${key}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(7000) });
    if (!res.ok) return [];
    const json = await res.json() as { foods?: unknown[] };
    return (json.foods ?? []).map((i) => usdaToResult(i as Record<string, unknown>)).slice(0, limit);
  } catch {
    return [];
  }
}

async function searchEdamam(query: string): Promise<FoodSearchResult[]> {
  const appId  = process.env.EDAMAM_APP_ID;
  const appKey = process.env.EDAMAM_APP_KEY;
  if (!appId || !appKey) return [];
  try {
    const url = `https://api.edamam.com/api/food-database/v2/parser?app_id=${appId}&app_key=${appKey}&ingr=${encodeURIComponent(query)}&nutrition-type=cooking`;
    const res = await fetch(url, { signal: AbortSignal.timeout(7000) });
    if (!res.ok) return [];
    const json = await res.json() as { hints: { food: Record<string, unknown> }[] };
    return (json.hints ?? []).slice(0, 15).map((h) => edamamToResult(h.food)).filter((r): r is FoodSearchResult => r !== null);
  } catch {
    return [];
  }
}

async function searchNutritionix(query: string): Promise<FoodSearchResult[]> {
  const appId  = process.env.NUTRITIONIX_APP_ID;
  const appKey = process.env.NUTRITIONIX_APP_KEY;
  if (!appId || !appKey) return [];
  try {
    const url = `https://trackapi.nutritionix.com/v2/search/instant?query=${encodeURIComponent(query)}&detailed=true`;
    const res = await fetch(url, {
      headers: { "x-app-id": appId, "x-app-key": appKey, "x-remote-user-id": "0" },
      signal: AbortSignal.timeout(7000),
    });
    if (!res.ok) return [];
    const json = await res.json() as { common?: NxFood[]; branded?: NxFood[] };
    return [
      ...(json.common  ?? []).slice(0, 10).map((f) => nutritionixToResult(f, false)),
      ...(json.branded ?? []).slice(0, 10).map((f) => nutritionixToResult(f, true)),
    ];
  } catch {
    return [];
  }
}

// ─── Barcode lookup ───────────────────────────────────────────────────────────

export async function lookupBarcode(barcode: string): Promise<FoodSearchResult | null> {
  try {
    const url = `https://world.openfoodfacts.org/api/v0/product/${barcode}.json?fields=code,product_name,product_name_fr,brands,categories_tags,nutriments,serving_size`;
    const res = await fetch(url, {
      headers: { "User-Agent": "NutriTracker/1.0" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const json = await res.json() as { status: number; product?: unknown };
    if (json.status !== 1 || !json.product) return null;
    return offToResult(json.product as Record<string, unknown>);
  } catch {
    return null;
  }
}

// ─── Global dedup + relevance merge ──────────────────────────────────────────

function dedup(results: FoodSearchResult[]): FoodSearchResult[] {
  const seenId   = new Set<string>();
  const seenName = new Set<string>();
  return results.filter((r) => {
    if (seenId.has(r.id)) return false;
    const nameKey = normalize(r.name).slice(0, 45);
    if (seenName.has(nameKey)) return false;
    seenId.add(r.id);
    seenName.add(nameKey);
    return true;
  });
}

const SOURCE_PRIORITY: Record<string, number> = {
  ciqual:      5,  // most accurate for raw French foods
  nutritionix: 4,  // large database, strong on common foods
  fatsecret:   4,  // large global database, strong on branded/common foods
  edamam:      3,
  off:         3,  // best for European packaged products
  usda:        2,
};

function rescoreResult(r: FoodSearchResult, words: string[]): number {
  const textScore = scoreText(r.name + " " + (r.brand ?? "") + " " + (r.category ?? ""), words);
  return textScore + (SOURCE_PRIORITY[r.source] ?? 0);
}

// ─── Main search ──────────────────────────────────────────────────────────────

export async function searchFoods(query: string, lang: Lang = "fr"): Promise<FoodSearchResult[]> {
  const q = query.trim();
  if (!q) return [];

  // Warm Ciqual cache on first call (non-blocking for subsequent calls)
  getCiqualCache().catch(() => {});

  const [ciqual, off, usda, edamam, nutritionix, fatsecret] = await Promise.all([
    searchCiqual(q),
    searchOpenFoodFacts(q, lang === "fr" ? "fr" : "en"),
    searchUSDA(q),
    searchEdamam(q),
    searchNutritionix(q),
    searchFatSecret(q),
  ]);

  const words = normalize(q).split(/\s+/).filter((w) => w.length >= 2);

  // Merge all sources, re-score for relevance, deduplicate
  const all = [...ciqual, ...nutritionix, ...fatsecret, ...edamam, ...off, ...usda];
  return dedup(
    all
      .map((r) => ({ r, score: rescoreResult(r, words) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.r),
  ).slice(0, 35);
}
