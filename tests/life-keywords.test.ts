import { describe, it, expect } from "vitest";
import { extractKeywords, localLifeAnalysis } from "../app/lib/life-keywords";

describe("extractKeywords", () => {
  it("garde les mots utiles et retire les mots vides", () => {
    expect(extractKeywords("Je me suis mis au vélo tous les jours avec mon frère")).toEqual(expect.arrayContaining(["vélo", "frère"]));
    expect(extractKeywords("Je me suis mis au vélo")).not.toContain("suis");
  });
  it("renvoie au plus 5 mots", () => {
    expect(extractKeywords("travail déménagement stress sommeil sport lecture famille").length).toBeLessThanOrEqual(5);
  });
});

describe("localLifeAnalysis", () => {
  it("detecte un changement durable", () => {
    expect(localLifeAnalysis("Depuis ce mois je marche chaque matin").persistent).toBe(true);
    expect(localLifeAnalysis("Mauvaise nuit, fatigué").persistent).toBe(false);
  });
  it("classe les grands evenements en vie", () => {
    expect(localLifeAnalysis("J'ai changé de travail").kind).toBe("vie");
  });
});
