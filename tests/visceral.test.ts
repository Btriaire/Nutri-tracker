import { describe, it, expect } from "vitest";
import {
  calculateVAI, calculateVisceralsForPoint, estimateHDL,
  estimateTriglycerides, estimateWaistCircumference, lipidsForDate, waistCmForDate,
} from "@/app/lib/visceral";

// Ce calcul (VAI, Amato et al. 2010) etait enferme dans un composant de 900
// lignes : impossible a tester, donc jamais verifie, alors qu'il produit un
// indicateur de sante affiche a l'utilisateur.

describe("calculateVAI", () => {
  it("applique les coefficients specifiques au sexe", () => {
    const h = calculateVAI(90, 25, 150, 45, "male");
    const f = calculateVAI(90, 25, 150, 45, "female");
    expect(h).toBeGreaterThan(0);
    expect(f).toBeGreaterThan(0);
    expect(h).not.toBe(f); // les formules different reellement
  });

  it("croit avec les triglycerides et decroit avec le HDL", () => {
    const base = calculateVAI(90, 25, 150, 45, "male");
    expect(calculateVAI(90, 25, 300, 45, "male")).toBeGreaterThan(base); // TG x2
    expect(calculateVAI(90, 25, 150, 90, "male")).toBeLessThan(base);    // HDL x2
  });

  it("croit avec le tour de taille", () => {
    expect(calculateVAI(110, 25, 150, 45, "male")).toBeGreaterThan(calculateVAI(80, 25, 150, 45, "male"));
  });

  it("arrondit a deux decimales", () => {
    const v = calculateVAI(90, 25, 150, 45, "male");
    expect(v).toBe(Math.round(v * 100) / 100);
  });
});

describe("calculateVisceralsForPoint", () => {
  const profil = { age: 40, gender: "male" as const, heightCm: 180, weightKg: 81 }; // IMC = 25.0

  it("ne calcule rien sans les donnees de profil indispensables", () => {
    const vide = calculateVisceralsForPoint({ bodyFatPct: 22 }, 40, undefined, 180, 81);
    expect(vide.vai).toBeNull();
    expect(vide.wcMeasured).toBe(false);
  });

  it("ne calcule rien sans pourcentage de graisse", () => {
    expect(calculateVisceralsForPoint({ bodyFatPct: null }, 40, "male", 180, 81).vai).toBeNull();
  });

  it("calcule l'IMC a partir de la taille et du poids", () => {
    const r = calculateVisceralsForPoint({ bodyFatPct: 22 }, profil.age, profil.gender, profil.heightCm, profil.weightKg);
    expect(r.imc).toBe(25); // 81 / 1.80²
  });

  it("marque les valeurs comme ESTIMEES quand rien de reel n'est fourni", () => {
    const r = calculateVisceralsForPoint({ bodyFatPct: 22 }, profil.age, profil.gender, profil.heightCm, profil.weightKg);
    expect(r.wcMeasured).toBe(false);
    expect(r.tgMeasured).toBe(false);
    expect(r.hdlMeasured).toBe(false);
    expect(r.vai).not.toBeNull();
  });

  it("utilise les valeurs REELLES quand elles existent et les signale", () => {
    const r = calculateVisceralsForPoint(
      { bodyFatPct: 22 }, profil.age, profil.gender, profil.heightCm, profil.weightKg,
      { wc: 95, tg: 120, hdl: 55 });
    expect(r.wc).toBe(95);
    expect(r.tg).toBe(120);
    expect(r.hdl).toBe(55);
    expect(r.wcMeasured && r.tgMeasured && r.hdlMeasured).toBe(true);
  });

  it("accepte un melange mesure/estime (c'est le cas courant)", () => {
    // Tour de taille connu (mensurations) mais pas de bilan lipidique.
    const r = calculateVisceralsForPoint(
      { bodyFatPct: 22 }, profil.age, profil.gender, profil.heightCm, profil.weightKg, { wc: 95 });
    expect(r.wcMeasured).toBe(true);
    expect(r.tgMeasured).toBe(false);
    expect(r.tg).not.toBeNull(); // estime, donc present quand meme
  });
});

describe("waistCmForDate", () => {
  const histo = [
    { month: "2026-05", waistCm: 95 },
    { month: "2026-07", waistCm: 92 },
    { month: "2026-09", waistCm: 90 },
  ];

  it("prend le dernier releve connu AVANT ou pendant le mois demande", () => {
    expect(waistCmForDate("2026-08-15", histo)).toBe(92);
    expect(waistCmForDate("2026-09-20", histo)).toBe(90);
  });

  it("ne remonte jamais un releve futur", () => {
    expect(waistCmForDate("2026-04-01", histo)).toBeNull();
  });

  it("ignore les mois sans mesure", () => {
    expect(waistCmForDate("2026-08-15", [{ month: "2026-06", waistCm: null }, { month: "2026-05", waistCm: 95 }])).toBe(95);
  });
});

describe("lipidsForDate", () => {
  const bilans = [
    { date: "2026-03-01", tgMgDl: 180, hdlMgDl: 42 },
    { date: "2026-08-01", tgMgDl: 140, hdlMgDl: 50 },
  ];

  it("prend le bilan le plus recent a la date donnee ou avant", () => {
    expect(lipidsForDate("2026-09-01", bilans)).toEqual({ tg: 140, hdl: 50 });
    expect(lipidsForDate("2026-05-01", bilans)).toEqual({ tg: 180, hdl: 42 });
  });

  it("ne remonte rien avant le premier bilan", () => {
    expect(lipidsForDate("2026-01-01", bilans)).toEqual({ tg: null, hdl: null });
  });
});

describe("estimations de repli", () => {
  it("le tour de taille estime croit avec l'IMC et la graisse", () => {
    expect(estimateWaistCircumference(30, 25, 40, "male")).toBeGreaterThan(estimateWaistCircumference(20, 25, 40, "male"));
    expect(estimateWaistCircumference(25, 35, 40, "male")).toBeGreaterThan(estimateWaistCircumference(25, 15, 40, "male"));
  });

  it("le HDL estime decroit quand la graisse augmente", () => {
    expect(estimateHDL(35, "male")).toBeLessThan(estimateHDL(15, "male"));
  });

  it("les triglycerides estimes croissent avec la graisse", () => {
    expect(estimateTriglycerides(35, 40, "male")).toBeGreaterThan(estimateTriglycerides(15, 40, "male"));
  });
});
