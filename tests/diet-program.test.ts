import { describe, it, expect } from "vitest";
import { checkDietCompliance, resolveDietProgramId, normalizeFoodName } from "@/app/lib/diet-program";
import type { MealType } from "@/app/lib/types";
import { foodEntry } from "./fixtures";

const item = (name: string, meal: MealType = "lunch", servingGrams = 100) =>
  foodEntry({ id: name + meal, name, meal, servingGrams });

describe("resolveDietProgramId — compatibilité ascendante", () => {
  it("lit le nouveau champ programId", () => {
    expect(resolveDietProgramId({ programId: "cholesterol" })).toBe("cholesterol");
  });
  it("traduit l'ancien booléen enabled en programme Dr.T-L", () => {
    expect(resolveDietProgramId({ enabled: true })).toBe("tl");
  });
  it("programId a priorité sur enabled resté à true", () => {
    expect(resolveDietProgramId({ enabled: true, programId: "cholesterol" })).toBe("cholesterol");
  });
  it("renvoie null quand aucun programme n'est actif", () => {
    expect(resolveDietProgramId({ enabled: false })).toBeNull();
    expect(resolveDietProgramId(null)).toBeNull();
    expect(resolveDietProgramId({ programId: null })).toBeNull();
  });
});

describe("checkDietCompliance — programme Dr.T-L", () => {
  it("signale un aliment interdit", () => {
    const r = checkDietCompliance([item("Gâteau au chocolat")], [], "tl");
    expect(r.day.status).toBe("ecarts");
    expect(r.perMeal.lunch.violations[0].reason).toContain("sucre");
  });

  it("laisse passer un repas conforme", () => {
    expect(checkDietCompliance([item("Filet de cabillaud vapeur", "dinner", 150)], [], "tl").day.status).toBe("conforme");
  });

  it("respecte les exceptions déclarées par l'utilisateur", () => {
    const entries = [item("Chocolat noir")];
    expect(checkDietCompliance(entries, [], "tl").day.status).toBe("ecarts");
    expect(checkDietCompliance(entries, [normalizeFoodName("Chocolat noir")], "tl").day.status).toBe("conforme");
  });

  it('n\'applique pas "sucre" à une boisson explicitement sans sucre', () => {
    expect(checkDietCompliance([item("Café sans sucre", "breakfast")], [], "tl").day.status).toBe("conforme");
  });

  it("signale un dépassement de quantité de pain au petit-déjeuner", () => {
    const r = checkDietCompliance([item("Pain complet", "breakfast", 200)], [], "tl");
    expect(r.perMeal.breakfast.violations.some(v => v.reason.includes("quantité de pain"))).toBe(true);
  });

  it("renvoie vide quand rien n'est loggé", () => {
    expect(checkDietCompliance([], [], "tl").day.status).toBe("vide");
  });
});

describe("checkDietCompliance — programme Anti-cholestérol", () => {
  it("signale la charcuterie", () => {
    const r = checkDietCompliance([item("Saucisson sec")], [], "cholesterol");
    expect(r.perMeal.lunch.violations[0].reason).toContain("charcuterie");
  });

  it("signale les fritures et le beurre", () => {
    expect(checkDietCompliance([item("Frites")], [], "cholesterol").day.status).toBe("ecarts");
    expect(checkDietCompliance([item("Beurre demi-sel", "breakfast")], [], "cholesterol").day.status).toBe("ecarts");
  });

  it("ne confond pas la pâte à tarte avec le pâté", () => {
    // "pâté" et "pâte" deviennent tous deux "pate" une fois les accents retirés :
    // les mots-clés doivent viser les formes composées ("pate de campagne").
    expect(checkDietCompliance([item("Pâte à tarte")], [], "cholesterol").day.status).toBe("conforme");
    expect(checkDietCompliance([item("Pâté de campagne")], [], "cholesterol").day.status).toBe("ecarts");
  });

  it("ne reprend pas les interdits spécifiques au Dr.T-L", () => {
    // Les lentilles sont proscrites par le régime Dr.T-L mais recommandées
    // contre le cholestérol : les deux programmes doivent rester étanches.
    expect(checkDietCompliance([item("Lentilles")], [], "tl").day.status).toBe("ecarts");
    expect(checkDietCompliance([item("Lentilles")], [], "cholesterol").day.status).toBe("conforme");
  });

  it("n'applique aucune règle de quantité par repas", () => {
    expect(checkDietCompliance([item("Pain complet", "dinner", 500)], [], "cholesterol").day.status).toBe("conforme");
  });
});
