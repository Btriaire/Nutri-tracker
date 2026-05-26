import type { FoodNutrition, FoodSearchResult, Lang, ServingOption } from "./types";
import { getAdminFirestore } from "./firebase-admin";

// ─── Ciqual document shape (Firestore) ────────────────────────────────────────

interface CiqualDoc {
  id: string;
  name: string;
  nameLower: string;
  category: string;
  per100g: {
    calories:        number;
    proteinG:        number;
    carbsG:          number;
    fatG:            number;
    fiberG:          number;
    sugarG:          number | null;
    starchG:         number | null;
    saturatedFatG:   number | null;
    monounsatFatG:   number | null;
    polyunsatFatG:   number | null;
    sodiumMg:        number | null;
    saltG:           number | null;
    potassiumMg:     number | null;
    calciumMg:       number | null;
    magneziumMg:     number | null;
    phosphorusMg:    number | null;
    ironMg:          number | null;
    zincMg:          number | null;
    vitaminAUg:      number | null;
    vitaminCMg:      number | null;
    vitaminDUg:      number | null;
    vitaminB12Ug:    number | null;
    vitaminB9Ug:     number | null;
    waterG:          number | null;
    alcoholG:        number | null;
    cholesterolMg:   number | null;
  };
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

function ciqualToResult(doc: CiqualDoc): FoodSearchResult {
  const p = doc.per100g;
  const nutrition: FoodNutrition = {
    calories:       Math.round(p.calories),
    proteinG:       Math.round(p.proteinG * 10) / 10,
    carbsG:         Math.round(p.carbsG * 10) / 10,
    fatG:           Math.round(p.fatG * 10) / 10,
    fiberG:         Math.round(p.fiberG * 10) / 10,
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
  };

  return {
    id:           `ciqual:${doc.id}`,
    source:       "ciqual",
    name:         doc.name,
    category:     doc.category,
    servingSizeG: 100,
    servingLabel: "100g",
    nutrition,
  };
}

function offToResult(product: Record<string, unknown>): FoodSearchResult | null {
  const nm = product.nutriments as Record<string, number> | undefined;
  if (!nm) return null;

  const cal100 = nm["energy-kcal_100g"] ?? nm["energy_100g"] ?? null;
  if (cal100 === null) return null;

  const servingSize = product.serving_size as string | undefined;
  const servingG    = parseServingGrams(servingSize) ?? 100;
  const ratio       = servingG / 100;

  const nutrition: FoodNutrition = {
    calories:       Math.round(cal100 * ratio),
    proteinG:       Math.round((nm.proteins_100g ?? 0) * ratio * 10) / 10,
    carbsG:         Math.round((nm.carbohydrates_100g ?? 0) * ratio * 10) / 10,
    fatG:           Math.round((nm.fat_100g ?? 0) * ratio * 10) / 10,
    fiberG:         Math.round((nm["fiber_100g"] ?? nm["fibers_100g"] ?? 0) * ratio * 10) / 10,
    sugarG:         nm.sugars_100g         ? scaleN(nm.sugars_100g, ratio)            : undefined,
    saturatedFatG:  nm["saturated-fat_100g"] ? scaleN(nm["saturated-fat_100g"], ratio) : undefined,
    sodiumMg:       nm.sodium_100g          ? scaleMg(nm.sodium_100g * 1000, ratio)   : undefined,
    saltG:          nm.salt_100g            ? scaleN(nm.salt_100g, ratio)             : undefined,
    potassiumMg:    nm.potassium_100g       ? scaleMg(nm.potassium_100g * 1000, ratio): undefined,
    calciumMg:      nm.calcium_100g         ? scaleMg(nm.calcium_100g * 1000, ratio)  : undefined,
    ironMg:         nm.iron_100g            ? scaleN(nm.iron_100g * 1000, ratio)      : undefined,
    vitaminCMg:     nm["vitamin-c_100g"]    ? scaleN(nm["vitamin-c_100g"] * 1000, ratio) : undefined,
    cholesterolMg:  nm.cholesterol_100g     ? scaleMg(nm.cholesterol_100g * 1000, ratio) : undefined,
    waterG:         nm.water_100g           ? scaleN(nm.water_100g, ratio)            : undefined,
    alcoholG:       nm.alcohol_100g         ? scaleN(nm.alcohol_100g, ratio)          : undefined,
  };

  const servingOptions: ServingOption[] = [];
  if (servingG !== 100) {
    servingOptions.push({ label: servingSize ?? `${servingG}g`, grams: servingG, isDefault: true });
  }
  servingOptions.push({ label: "100g", grams: 100, isDefault: servingG === 100 });

  return {
    id:             `off:${product.code ?? product._id}`,
    source:         "off",
    name:           (product.product_name_fr ?? product.product_name ?? product._id) as string,
    brand:          product.brands as string | undefined,
    category:       product.categories_tags
                      ? ((product.categories_tags as string[])[0] ?? undefined)
                      : undefined,
    servingSizeG:   servingG,
    servingLabel:   servingSize ?? "100g",
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
    ? item.servingSize as number
    : 100;
  const unit     = (item.servingSizeUnit as string) ?? "g";
  const isG      = unit.toLowerCase() === "g";
  const ratio    = servingG / 100;
  const servingLabel = isG ? `${servingG}g` : `${servingG} ${unit}`;

  const nutrition: FoodNutrition = {
    calories:       Math.round(getN(1008) * ratio),
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
  };

  const servingOptions: ServingOption[] = [];
  if (isG && servingG !== 100) {
    servingOptions.push({ label: servingLabel, grams: servingG, isDefault: true });
    servingOptions.push({ label: "100g", grams: 100 });
  }

  return {
    id:             `usda:${item.fdcId}`,
    source:         "usda",
    name:           item.description as string,
    brand:          (item.brandOwner ?? item.brandName) as string | undefined,
    category:       item.foodCategory as string | undefined,
    servingSizeG:   servingG,
    servingLabel,
    servingOptions: servingOptions.length > 0 ? servingOptions : undefined,
    nutrition,
  };
}

function parseServingGrams(s: string | undefined): number | null {
  if (!s) return null;
  const m = s.match(/(\d+(?:[.,]\d+)?)\s*g/i);
  return m ? parseFloat(m[1].replace(",", ".")) : null;
}

// ─── Source fetchers ──────────────────────────────────────────────────────────

async function searchCiqual(query: string, limit = 15): Promise<FoodSearchResult[]> {
  try {
    const db = getAdminFirestore();
    const q  = query.toLowerCase().trim();
    const snap = await db
      .collection("ciqual_foods")
      .where("nameLower", ">=", q)
      .where("nameLower", "<=", q + "\uf8ff")
      .limit(limit)
      .get();

    return snap.docs.map((d) => ciqualToResult(d.data() as CiqualDoc));
  } catch {
    return [];
  }
}

async function searchOpenFoodFacts(query: string, lang: "fr" | "en", limit = 15): Promise<FoodSearchResult[]> {
  try {
    const base = lang === "fr"
      ? "https://fr.openfoodfacts.org"
      : "https://world.openfoodfacts.org";

    const fields = "code,product_name,product_name_fr,brands,categories_tags,nutriments,serving_size";
    const url = `${base}/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&fields=${fields}&page_size=${limit}`;

    const res = await fetch(url, {
      headers: { "User-Agent": "NutriTracker/1.0 (personal use)" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];

    const json = await res.json() as { products?: unknown[] };
    return (json.products ?? [])
      .map((p) => offToResult(p as Record<string, unknown>))
      .filter((r): r is FoodSearchResult => r !== null)
      .slice(0, limit);
  } catch {
    return [];
  }
}

async function searchUSDA(query: string, limit = 15): Promise<FoodSearchResult[]> {
  try {
    const key = process.env.USDA_API_KEY;
    if (!key) return [];

    const url = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(query)}&pageSize=${limit}&dataType=Branded,Foundation,SR%20Legacy&api_key=${key}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return [];

    const json = await res.json() as { foods?: unknown[] };
    return (json.foods ?? [])
      .map((item) => usdaToResult(item as Record<string, unknown>))
      .slice(0, limit);
  } catch {
    return [];
  }
}

// ─── Edamam Food Database ─────────────────────────────────────────────────────

interface EdamamFood {
  foodId:        string;
  label:         string;
  brand?:        string;
  category?:     string;
  categoryLabel?: string;
  nutrients: {
    ENERC_KCAL?: number;
    PROCNT?:     number;
    FAT?:        number;
    CHOCDF?:     number;
    FIBTG?:      number;
    SUGAR?:      number;
    FASAT?:      number;
    NA?:         number;
  };
}

function edamamToResult(food: EdamamFood, measureWeight = 100): FoodSearchResult {
  const n   = food.nutrients;
  const ratio = measureWeight / 100;
  const nutrition: FoodNutrition = {
    calories:      Math.round((n.ENERC_KCAL ?? 0) * ratio),
    proteinG:      Math.round((n.PROCNT ?? 0)     * ratio * 10) / 10,
    carbsG:        Math.round((n.CHOCDF ?? 0)     * ratio * 10) / 10,
    fatG:          Math.round((n.FAT ?? 0)        * ratio * 10) / 10,
    fiberG:        Math.round((n.FIBTG ?? 0)      * ratio * 10) / 10,
    sugarG:        n.SUGAR ? scaleN(n.SUGAR, ratio) : undefined,
    saturatedFatG: n.FASAT ? scaleN(n.FASAT, ratio) : undefined,
    sodiumMg:      n.NA    ? scaleMg(n.NA, ratio)   : undefined,
  };

  const servingOptions: ServingOption[] = [{ label: "100g", grams: 100, isDefault: measureWeight === 100 }];
  if (measureWeight !== 100) {
    servingOptions.unshift({ label: `${measureWeight}g`, grams: measureWeight, isDefault: true });
  }

  return {
    id:           `edamam:${food.foodId}`,
    source:       "edamam",
    name:         food.label,
    brand:        food.brand,
    category:     food.categoryLabel ?? food.category,
    servingSizeG: measureWeight,
    servingLabel: `${measureWeight}g`,
    servingOptions,
    nutrition,
  };
}

async function searchEdamam(query: string, limit = 20): Promise<FoodSearchResult[]> {
  try {
    const appId  = process.env.EDAMAM_APP_ID?.trim();
    const appKey = process.env.EDAMAM_APP_KEY?.trim();
    if (!appId || !appKey) return [];

    const url = `https://api.edamam.com/api/food-database/v2/parser?app_id=${appId}&app_key=${appKey}&ingr=${encodeURIComponent(query)}&nutrition-type=logging`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return [];

    const json = await res.json() as { hints?: { food: EdamamFood; measures?: { label: string; weight: number }[] }[] };
    return (json.hints ?? [])
      .slice(0, limit)
      .map(({ food, measures }) => {
        const serving = measures?.find((m) => m.label !== "Gram" && m.weight > 0);
        return edamamToResult(food, serving?.weight ?? 100);
      });
  } catch {
    return [];
  }
}

// ─── Barcode lookup ───────────────────────────────────────────────────────────

export async function lookupBarcode(barcode: string): Promise<FoodSearchResult | null> {
  try {
    const url = `https://world.openfoodfacts.org/api/v0/product/${barcode}.json?fields=code,product_name,product_name_fr,brands,categories_tags,nutriments,serving_size`;
    const res = await fetch(url, {
      headers: { "User-Agent": "NutriTracker/1.0 (personal use)" },
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

// ─── Main cascade search ──────────────────────────────────────────────────────

export async function searchFoods(
  query: string,
  lang: Lang = "fr",
): Promise<FoodSearchResult[]> {
  const q = query.trim();
  if (!q) return [];

  if (lang === "fr") {
    const [ciqual, off, edamam] = await Promise.all([
      searchCiqual(q),
      searchOpenFoodFacts(q, "fr"),
      searchEdamam(q),
    ]);
    const combined = dedup([...ciqual, ...off, ...edamam]);

    if (combined.length < 5) {
      const usda = await searchUSDA(q);
      return dedup([...combined, ...usda]).slice(0, 30);
    }

    return combined.slice(0, 30);
  }

  const [usda, off, edamam] = await Promise.all([
    searchUSDA(q),
    searchOpenFoodFacts(q, "en"),
    searchEdamam(q),
  ]);

  return dedup([...usda, ...off, ...edamam]).slice(0, 30);
}

function dedup(results: FoodSearchResult[]): FoodSearchResult[] {
  const seen = new Set<string>();
  return results.filter((r) => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });
}
