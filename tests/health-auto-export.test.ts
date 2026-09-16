import { describe, it, expect } from "vitest";
import { parseHaePayload } from "@/app/lib/health-auto-export";

// Ce parser a perdu des données en silence : sans l'option "Aggregate Sleep
// Data" côté app iOS, les points de sleep_analysis n'ont pas les champs
// asleep/deep/rem/core, et tout le sommeil était ignoré sans le moindre
// signal. Ces tests figent le comportement attendu dans les deux modes.

describe("parseHaePayload — sommeil agrégé", () => {
  const aggregated = {
    data: {
      metrics: [{
        name: "sleep_analysis",
        data: [{
          sleepStart: "2026-09-14 23:10:00 +0200",
          sleepEnd:   "2026-09-15 07:40:00 +0200",
          asleep: 7.5, core: 4.0, deep: 1.5, rem: 2.0, awake: 0.4,
        }],
      }],
    },
  };

  it("rattache la nuit au jour du RÉVEIL, pas à celui de l'endormissement", () => {
    const byDate = parseHaePayload(aggregated);
    expect([...byDate.keys()]).toEqual(["2026-09-15"]);
  });

  it("convertit les heures en minutes pour chaque phase", () => {
    const d = parseHaePayload(aggregated).get("2026-09-15")!;
    expect(d.sleepMinutes).toBe(450);       // 7.5 h
    expect(d.sleepLightMinutes).toBe(240);  // core 4.0 h
    expect(d.sleepDeepMinutes).toBe(90);    // 1.5 h
    expect(d.sleepRemMinutes).toBe(120);    // 2.0 h
  });
});

describe("parseHaePayload — mode NON agrégé (la panne silencieuse)", () => {
  it("n'invente aucune donnée de sommeil quand les champs de phase sont absents", () => {
    // Ce que HAE envoie quand "Aggregate Sleep Data" est désactivé.
    const raw = {
      data: { metrics: [{ name: "sleep_analysis", data: [{ date: "2026-09-15 07:40:00 +0200", qty: 7.5 }] }] },
    };
    const d = parseHaePayload(raw).get("2026-09-15");
    // Rien n'est extrait : c'est précisément le cas où la synchro semblait
    // fonctionner alors qu'aucun sommeil n'arrivait.
    expect(d?.sleepMinutes).toBeUndefined();
  });
});

describe("parseHaePayload — autres métriques", () => {
  it("additionne les pas de la journée et moyenne la fréquence cardiaque", () => {
    const byDate = parseHaePayload({
      data: {
        metrics: [
          { name: "step_count", units: "count", data: [
            { date: "2026-09-15 09:00:00 +0200", qty: 1200 },
            { date: "2026-09-15 18:00:00 +0200", qty: 3300 },
          ]},
          { name: "heart_rate", units: "count/min", data: [
            { date: "2026-09-15 09:00:00 +0200", Avg: 60 },
            { date: "2026-09-15 18:00:00 +0200", Avg: 80 },
          ]},
        ],
      },
    });
    const d = byDate.get("2026-09-15")!;
    expect(d.steps).toBe(4500);
    expect(d.heartRateAvg).toBe(70);
  });

  it("sépare correctement plusieurs journées dans un même export", () => {
    const byDate = parseHaePayload({
      data: { metrics: [{ name: "step_count", data: [
        { date: "2026-09-14 10:00:00 +0200", qty: 1000 },
        { date: "2026-09-15 10:00:00 +0200", qty: 2000 },
      ]}]},
    });
    expect(byDate.get("2026-09-14")!.steps).toBe(1000);
    expect(byDate.get("2026-09-15")!.steps).toBe(2000);
  });

  it("ignore une métrique inconnue sans planter", () => {
    const byDate = parseHaePayload({ data: { metrics: [{ name: "metrique_inexistante", data: [{ date: "2026-09-15 10:00:00 +0200", qty: 1 }] }] } });
    expect(byDate.size).toBe(0);
  });

  it("tolère un payload vide ou malformé", () => {
    expect(parseHaePayload({}).size).toBe(0);
    expect(parseHaePayload({ data: {} }).size).toBe(0);
    expect(parseHaePayload({ data: { metrics: [] } }).size).toBe(0);
  });
});
