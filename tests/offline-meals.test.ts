import { describe, it, expect, beforeEach, vi } from "vitest";

// Environnement navigateur minimal : localStorage + window (evenements).
const store = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, v); },
  removeItem: (k: string) => { store.delete(k); },
});
vi.stubGlobal("window", { dispatchEvent: () => true });

const { enqueueMeal, flushQueue, readQueue, queueWater, readWater, rankFoods, entryFromFood } = await import("../app/lib/offline-meals");
import type { RecentFood } from "../app/api/food/recent/route";

const voice = (names: string[]) => ({
  results: names.map((n) => ({ result: { id: n, source: "ai", name: n }, per100g: { calories: 200, proteinG: 10, carbsG: 20, fatG: 5, fiberG: 2 }, grams: 150 })),
});
const ok = (body: unknown = {}) => new Response(JSON.stringify(body), { status: 200 });

describe("file de repas hors ligne", () => {
  beforeEach(() => { store.clear(); });

  it("analyse le texte, ajoute chaque aliment au repas choisi, fixe l'heure du repas puis vide la file", async () => {
    enqueueMeal({ date: "2026-10-05", meal: "dinner", time: "20:15", text: "saumon et riz" });
    const calls: { url: string; method: string; body: Record<string, unknown> }[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, method: init.method!, body: JSON.parse(init.body as string) });
      return url === "/api/food/voice" ? ok(voice(["Saumon", "Riz"])) : ok();
    }));
    expect((await flushQueue()).sent).toBe(1);
    const logs = calls.filter((c) => c.url === "/api/log" && c.method === "POST");
    expect(logs.map((c) => (c.body.entry as { name: string; meal: string }).name)).toEqual(["Saumon", "Riz"]);
    expect(logs.every((c) => (c.body.entry as { meal: string }).meal === "dinner" && c.body.date === "2026-10-05")).toBe(true);
    expect((logs[0].body.entry as { nutrition: { calories: number } }).nutrition.calories).toBe(300); // 150 g a 200 kcal/100 g
    const patch = calls.find((c) => c.method === "PATCH")!;
    expect(patch.body.mealTime).toEqual({ meal: "dinner", timeMs: new Date("2026-10-05T20:15:00").getTime() });
    expect(readQueue()).toEqual([]);
  });

  it("coupure au milieu de l'envoi : reprise sans doublon", async () => {
    enqueueMeal({ date: "2026-10-05", meal: "lunch", time: "12:30", text: "poulet, riz" });
    let logPosts = 0;
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      if (url === "/api/food/voice") return ok(voice(["Poulet", "Riz"]));
      if (init.method === "POST") { logPosts++; if (logPosts === 2) throw new TypeError("Failed to fetch"); }
      return ok();
    }));
    expect((await flushQueue()).sent).toBe(0);
    expect(readQueue()[0].status).toBe("parsed");
    expect(readQueue()[0].items!.map((i) => i.done)).toEqual([true, false]);

    const posted: string[] = [];
    const voiceCalls = vi.fn();
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      if (url === "/api/food/voice") voiceCalls();
      if (url === "/api/log" && init.method === "POST") posted.push((JSON.parse(init.body as string).entry as { name: string }).name);
      return ok();
    }));
    expect((await flushQueue()).sent).toBe(1);
    expect(posted).toEqual(["Riz"]);          // le poulet deja envoye ne repart pas
    expect(voiceCalls).not.toHaveBeenCalled(); // pas de nouvelle analyse
    expect(readQueue()).toEqual([]);
  });

  it("hors ligne des le depart : rien n'est perdu", async () => {
    enqueueMeal({ date: "2026-10-05", meal: "breakfast", time: "08:00", text: "2 oeufs" });
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
    expect((await flushQueue()).sent).toBe(0);
    expect(readQueue()[0]).toMatchObject({ status: "pending", text: "2 oeufs" });
  });

  it("texte non reconnu : marque en echec, garde le repas, ne boucle pas", async () => {
    enqueueMeal({ date: "2026-10-05", meal: "snacks", time: "16:00", text: "truc" });
    const f = vi.fn(async () => ok({ results: [] }));
    vi.stubGlobal("fetch", f);
    await flushQueue();
    expect(readQueue()[0]).toMatchObject({ status: "failed", error: "Aucun aliment reconnu dans le texte : reformule" });
    await flushQueue();
    expect(f).toHaveBeenCalledTimes(1);
  });

  const yaourt: RecentFood = { name: "Yaourt grec", source: "ciqual", nutritionPer100g: { calories: 97, proteinG: 9, carbsG: 4, fatG: 5, fiberG: 0 }, lastLoggedAt: "2026-10-04", timesLogged: 12, usualGrams: 125, mealCounts: { breakfast: 10, snacks: 2 } };
  const pates: RecentFood = { name: "Pâtes cuites", source: "ciqual", nutritionPer100g: { calories: 150, proteinG: 5, carbsG: 30, fatG: 1, fiberG: 2 }, lastLoggedAt: "2026-10-03", timesLogged: 20, usualGrams: 200, mealCounts: { lunch: 15, dinner: 5 } };

  it("aliments habituels seuls : envoyes tels quels, sans analyse IA", async () => {
    enqueueMeal({ date: "2026-10-05", meal: "breakfast", time: "07:45", text: "", picks: [entryFromFood(yaourt, 150, "breakfast")] });
    expect(readQueue()[0].status).toBe("parsed");
    const urls: string[] = [];
    const bodies: Record<string, unknown>[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => { urls.push(url); bodies.push(JSON.parse(init.body as string)); return ok(); }));
    expect((await flushQueue()).sent).toBe(1);
    expect(urls).not.toContain("/api/food/voice");
    const entry = bodies[0].entry as { name: string; servingGrams: number; nutrition: { calories: number; proteinG: number } };
    expect(entry).toMatchObject({ name: "Yaourt grec", servingGrams: 150 });
    expect(entry.nutrition.calories).toBe(146);   // 97 kcal/100 g x 1,5
    expect(entry.nutrition.proteinG).toBe(13.5);
  });

  it("aliments habituels + texte : les deux sont ajoutes, une seule analyse", async () => {
    enqueueMeal({ date: "2026-10-05", meal: "lunch", time: "12:30", text: "une pomme", picks: [entryFromFood(pates, 200, "lunch")] });
    const names: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      if (url === "/api/food/voice") return ok(voice(["Pomme"]));
      if (init.method === "POST") names.push((JSON.parse(init.body as string).entry as { name: string }).name);
      return ok();
    }));
    await flushQueue();
    expect(names).toEqual(["Pâtes cuites", "Pomme"]);
  });

  it("eau hors ligne : la derniere quantite du jour est envoyee puis oubliee", async () => {
    queueWater("2026-10-05", 750);
    queueWater("2026-10-05", 1000);
    const bodies: unknown[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => { bodies.push([url, init.method, JSON.parse(init.body as string)]); return ok(); }));
    await flushQueue();
    expect(bodies).toEqual([["/api/log/water", "PATCH", { date: "2026-10-05", waterMl: 1000 }]]);
    expect(readWater()).toEqual({});
  });

  it("propose d'abord ce qu'on mange a ce repas, recherche sans accents", () => {
    expect(rankFoods([pates, yaourt], "breakfast", "").map((f) => f.name)).toEqual(["Yaourt grec", "Pâtes cuites"]);
    expect(rankFoods([pates, yaourt], "lunch", "").map((f) => f.name)).toEqual(["Pâtes cuites", "Yaourt grec"]);
    expect(rankFoods([pates, yaourt], "lunch", "pate").map((f) => f.name)).toEqual(["Pâtes cuites"]);
  });
});
