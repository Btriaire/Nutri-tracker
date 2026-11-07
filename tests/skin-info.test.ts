import { describe, it, expect } from "vitest";
import { SKIN_INFO, sanitizeSkin, skinBaseline, skinReading } from "@/app/lib/skin-info";

const p = { grain: 1, lissage: 0.8, ridules: 2, taches: 1, rougeurs: 3, brillance: 1 };
describe("skin-info", () => {
  it("chaque parametre a une explication et une publication avec lien", () => {
    expect(SKIN_INFO.map((i) => i.key).sort()).toEqual(["brillance", "grain", "lissage", "ridules", "rougeurs", "taches"]);
    for (const i of SKIN_INFO) {
      expect(i.meaning.length).toBeGreaterThan(20);
      expect(i.refs.length).toBeGreaterThan(0);
      for (const r of i.refs) expect(r.url).toMatch(/^https:\/\/doi\.org\//);
    }
  });
  it("sanitizeSkin refuse les valeurs invalides", () => {
    expect(sanitizeSkin(p)).toEqual(p);
    expect(sanitizeSkin({ ...p, grain: "x" })).toBeNull();
    expect(sanitizeSkin({ ...p, ridules: -1 })).toBeNull();
    expect(sanitizeSkin({ ...p, ridules: Infinity })).toBeNull();
    expect(sanitizeSkin(null)).toBeNull();
  });
  it("la reference demande 3 mesures et utilise la mediane", () => {
    expect(skinBaseline([p, p], "grain")).toBeNull();
    expect(skinBaseline([{ ...p, grain: 1 }, { ...p, grain: 2 }, { ...p, grain: 9 }], "grain")!.median).toBe(2);
  });
  it("la lecture compare a la reference sans inventer de jugement", () => {
    const info = SKIN_INFO.find((i) => i.key === "grain")!;
    expect(skinReading(5, null, info)).toBe("Référence après 3 mesures");
    expect(skinReading(1, { median: 1, spread: 0.2 }, info)).toBe("Comme d'habitude");
    expect(skinReading(2, { median: 1, spread: 0.2 }, info)).toBe(`Au-dessus de ton habitude : ${info.higher}`);
    expect(skinReading(0.2, { median: 1, spread: 0.2 }, info)).toBe(`Sous ton habitude : ${info.lower}`);
  });
});
