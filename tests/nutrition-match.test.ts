import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { buildCiqualIndex, estimateMissing, matchFood, tokenize, satRatioFor, type CiqualLite } from "../app/lib/nutrition-match";
import type { FoodNutrition } from "../app/lib/types";

// Vraie table CIQUAL embarquee : les tests verifient le comportement sur de vrais aliments courants.
const index = buildCiqualIndex(JSON.parse(readFileSync("app/lib/data/ciqual-foods.json", "utf8")) as CiqualLite[]);
const base = (over: Partial<FoodNutrition>): FoodNutrition => ({ calories: 100, proteinG: 5, carbsG: 10, fatG: 4, fiberG: 1, ...over });

describe("tokenize", () => {
  it("retire accents, mots vides, nombres et pluriels, unifie cuit/cuite", () => {
    expect(tokenize("Haricots verts cuits, 150 g")).toEqual(["haricot", "vert", "cuit"]);
    expect(tokenize("Courgettes cuites sautées")).toEqual(["courgette", "cuit", "saute"]);
    expect(tokenize("Œufs au plat")).toEqual(["oeuf", "plat"]);
  });
});

describe("matchFood", () => {
  const name = (q: string) => matchFood(index, q)?.doc.name ?? null;

  it("ne choisit pas une forme transformee pour un nom generique", () => {
    expect(name("saumon")).toMatch(/^Saumon, cuit/);        // et non saumon fume (1410 mg de sodium)
    expect(name("jambon")).toMatch(/^Jambon cuit/);          // et non jambon de Bayonne
    expect(name("pain")).toBe("Pain (aliment moyen)");       // et non pain d'epices
    expect(name("poulet")).toMatch(/^Poulet, viande/);       // et non poulet basquaise prepare
  });

  it("garde la tete de l'aliment : tomate n'est pas du jus de tomate", () => {
    expect(name("tomate")).toMatch(/^Tomate/);
    expect(name("tomates")).toMatch(/^Tomate/);
  });

  it("choisit la boisson prete a boire plutot que le cafe moulu", () => {
    expect(name("café")).toMatch(/prêt à boire/);
    expect(name("café noir")).toMatch(/prêt à boire/);
  });

  it("reconnait un nom d'usage courant", () => {
    expect(name("baguette")).toMatch(/^Pain, baguette/);
  });

  it("renvoie null quand rien de fiable n'existe", () => {
    expect(name("vinaigrette maison du chef")).toBeNull();
    expect(name("")).toBeNull();
  });
});

describe("estimateMissing", () => {
  it("convertit sel en sodium (identite : sodium = sel x 400)", () => {
    const e = estimateMissing({ name: "produit inconnu xyz", grams: 100, nutrition: base({ saltG: 1.5, saturatedFatG: 1 }) }, index);
    expect(e.sodiumMg).toBe(600);
    expect(e.sodiumSource).toBe("salt");
  });

  it("ne remplace jamais une valeur deja connue", () => {
    const e = estimateMissing({ name: "saumon", grams: 100, nutrition: base({ sodiumMg: 999, saturatedFatG: 9 }) }, index);
    expect(e).toEqual({});
  });

  it("met sodium CIQUAL a l'echelle du poids, et graisses saturees au prorata des lipides de l'aliment", () => {
    const e = estimateMissing({ name: "saumon", grams: 200, nutrition: base({ fatG: 20 }) }, index);
    expect(e.sodiumSource).toBe("ciqual");
    expect(e.sodiumMg).toBeGreaterThan(80);
    expect(e.sodiumMg).toBeLessThan(160);                    // ~64 mg/100 g x 2
    expect(e.saturatedFatG).toBeLessThanOrEqual(20);         // jamais plus que les lipides
    expect(e.saturatedFatG).toBeGreaterThan(2);
  });

  it("sans correspondance : graisses saturees par ratio de famille, sodium laisse inconnu", () => {
    const e = estimateMissing({ name: "vinaigrette maison du chef", grams: 20, nutrition: base({ fatG: 10 }) }, index);
    expect(e.sodiumMg).toBeUndefined();
    expect(e.satFatSource).toBe("ratio");
    expect(e.saturatedFatG).toBe(3.3);                       // 10 g x 0,33
  });

  it("aliment sans lipides : 0 g de graisses saturees", () => {
    const e = estimateMissing({ name: "coca zero", grams: 330, nutrition: base({ fatG: 0 }) }, index);
    expect(e.saturatedFatG).toBe(0);
  });
});

describe("satRatioFor", () => {
  it("distingue les familles", () => {
    expect(satRatioFor("beurre doux")).toBeGreaterThan(0.5);
    expect(satRatioFor("huile d'olive")).toBeLessThan(0.2);
    expect(satRatioFor("truc mysterieux")).toBe(0.33);
  });
});
