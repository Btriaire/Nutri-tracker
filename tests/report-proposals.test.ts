import { describe, it, expect } from "vitest";
import { buildProposals, type ProposalInput } from "../app/lib/report-proposals";

const base: ProposalInput = {
  daysLogged: 6, avgCalories: 2000, avgProteinG: 100, avgFiberG: 25, avgWaterMl: 2000,
  goals: { dailyCalories: 2000, proteinGrams: 150, fiberGrams: 30, waterMl: 2000 },
  foods: [
    { name: "Yaourt grec", usualGrams: 125, count: 8, per100: { calories: 97, proteinG: 9, fiberG: 0 } },
    { name: "Pâtes cuites", usualGrams: 200, count: 6, per100: { calories: 150, proteinG: 5, fiberG: 2 } },
  ],
};

describe("propositions de la semaine", () => {
  it("protéines manquantes : augmente l'aliment le plus protéiné que l'utilisateur mange", () => {
    const out = buildProposals(base);
    const prot = out.find((p) => p.text.startsWith("Protéines"))!;
    expect(prot.kind).toBe("augmenter");
    expect(prot.text).toMatch(/Yaourt grec de ~\d+ g/);
  });

  it("calories au-dessus : propose de réduire la plus grosse portion de 20 %", () => {
    const out = buildProposals({ ...base, avgCalories: 2400, avgProteinG: 160 });
    const cal = out.find((p) => p.text.startsWith("Calories"))!;
    expect(cal.kind).toBe("réduire");
    expect(cal.text).toMatch(/Pâtes cuites de 200 g à 160 g/);
  });

  it("pas assez de jours saisis : pas de chiffres", () => {
    expect(buildProposals({ ...base, daysLogged: 2 })[0].text).toMatch(/Pas assez de jours/);
  });

  it("rien à corriger quand tout est proche de l'objectif", () => {
    const out = buildProposals({ ...base, avgProteinG: 150, avgFiberG: 30 });
    expect(out[0].text).toMatch(/rien à corriger/);
  });
});
