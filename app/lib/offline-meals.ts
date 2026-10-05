"use client";

// Saisie de repas hors ligne : le repas est decrit en texte libre et garde sur le telephone (localStorage),
// puis envoye au retour du reseau : analyse IA (/api/food/voice, comme la dictee) -> ajout des aliments
// (/api/log) -> heure du repas (/api/log PATCH mealTime, pour la glycemie).
// Les aliments habituels (/api/food/recent) sont aussi gardes sur le telephone : hors ligne, on les choisit
// directement avec leurs vraies valeurs, sans passer par l'IA. L'eau ajoutee hors ligne suit le meme chemin.
// Chaque etape est memorisee : une coupure au milieu de l'envoi ne cree jamais de doublon.

import { aiScaleToGrams, type AiPer100g } from "./ai-food";
import { mealTimeFromInput } from "./glucose";
import { scaleNutrition } from "./nutrition";
import type { FoodEntry, FoodSearchResult, MealType } from "./types";
import type { RecentFood } from "@/app/api/food/recent/route";

export type NewEntry = Omit<FoodEntry, "id" | "loggedAt">;

export interface QueuedMeal {
  id: string;
  date: string;          // "yyyy-MM-dd"
  meal: MealType;
  time: string;          // "HH:mm", heure reelle du repas
  text: string;          // description libre (peut etre vide si seulement des aliments habituels)
  createdAt: number;
  status: "pending" | "parsed" | "failed";
  error?: string;
  items?: { entry: NewEntry; done: boolean }[];
}

const KEY = "nt-offline-meals";
export const QUEUE_EVENT = "nt-offline-queue";
export const SYNCED_EVENT = "nt-offline-synced";

export function readQueue(): QueuedMeal[] {
  try {
    const raw = localStorage.getItem(KEY);
    const q = raw ? JSON.parse(raw) : [];
    return Array.isArray(q) ? q : [];
  } catch {
    return [];
  }
}

function writeQueue(q: QueuedMeal[]) {
  try { localStorage.setItem(KEY, JSON.stringify(q)); } catch { /* stockage plein ou bloque */ }
  window.dispatchEvent(new Event(QUEUE_EVENT));
}

function update(id: string, patch: Partial<QueuedMeal>) {
  writeQueue(readQueue().map((m) => (m.id === id ? { ...m, ...patch } : m)));
}

export function enqueueMeal(m: Pick<QueuedMeal, "date" | "meal" | "time" | "text"> & { picks?: NewEntry[] }): boolean {
  const q = readQueue();
  const { picks = [], ...rest } = m;
  const items = picks.map((entry) => ({ entry: { ...entry, meal: m.meal }, done: false }));
  const item: QueuedMeal = {
    ...rest, text: rest.text.trim(), id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, createdAt: Date.now(),
    // Sans texte, rien a analyser : les aliments choisis sont deja prets a envoyer.
    status: rest.text.trim() ? "pending" : "parsed", items,
  };
  writeQueue([...q, item]);
  return readQueue().some((x) => x.id === item.id); // false si le telephone refuse le stockage
}

export function removeQueued(id: string) {
  writeQueue(readQueue().filter((m) => m.id !== id));
}

/** Remet un repas "echoue" en attente (apres correction du texte par exemple). */
export function retryQueued(id: string, text?: string) {
  update(id, { status: "pending", error: undefined, items: undefined, ...(text ? { text } : {}) });
}

type VoiceResult = { result: FoodSearchResult; per100g: AiPer100g; grams: number };

class Offline extends Error {}

const AUTH_ERROR = "Session expirée : reconnecte-toi pour envoyer";

async function post(url: string, body: unknown, method = "POST"): Promise<Response> {
  try {
    return await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  } catch {
    throw new Offline();
  }
}

let flushing = false;

/** Envoie tout ce qui peut l'etre. S'arrete net a la premiere coupure reseau (on reessaiera plus tard). */
export async function flushQueue(): Promise<{ sent: number }> {
  if (flushing || typeof navigator !== "undefined" && navigator.onLine === false) return { sent: 0 };
  flushing = true;
  let sent = 0;
  try {
    for (const [date, waterMl] of Object.entries(readWater())) {
      const res = await post("/api/log/water", { date, waterMl }, "PATCH");
      if (res.ok) clearWater(date);
    }
    for (const start of readQueue()) {
      if (start.status === "failed") continue;
      let m = start;

      if (m.status === "pending") {
        const res = await post("/api/food/voice", { text: m.text, defaultMeal: m.meal });
        if (res.status === 401) { update(m.id, { error: AUTH_ERROR }); break; }   // session expiree : il faut se reconnecter
        if (!res.ok) { update(m.id, { status: "failed", error: "Analyse impossible pour l'instant" }); continue; }
        const data = await res.json() as { results?: VoiceResult[] };
        const results = data.results ?? [];
        if (results.length === 0) { update(m.id, { status: "failed", error: "Aucun aliment reconnu dans le texte : reformule" }); continue; }
        const parsed = results.map((d) => ({
          done: false,
          entry: {
            meal: m.meal,                                               // le repas choisi par l'utilisateur prime
            foodId: d.result.id,
            source: d.result.source,
            name: d.result.name,
            servingGrams: d.grams,
            servingQty: 1,
            servingUnit: "portion",
            servingLabel: `${d.grams} g`,
            nutrition: aiScaleToGrams(d.per100g, d.grams),
          } as NewEntry,
        }));
        const items = [...(m.items ?? []), ...parsed];
        m = { ...m, status: "parsed", items, error: undefined };
        update(m.id, { status: "parsed", items, error: undefined });
      }

      const items = m.items ?? [];
      let blocked = false;
      for (let i = 0; i < items.length; i++) {
        if (items[i].done) continue;
        const res = await post("/api/log", { date: m.date, entry: items[i].entry });
        if (!res.ok) {
          update(m.id, { items: [...items], error: res.status === 401 ? AUTH_ERROR : "Envoi refusé, nouvel essai dans une minute" });
          blocked = true;
          break;
        }
        items[i] = { ...items[i], done: true };
        update(m.id, { items: [...items] });
      }
      if (blocked) break;

      const timeMs = mealTimeFromInput(m.date, m.time, m.meal);
      if (timeMs) await post("/api/log", { date: m.date, mealTime: { meal: m.meal, timeMs } }, "PATCH").catch(() => undefined);
      removeQueued(m.id);
      sent++;
    }
  } catch (e) {
    if (!(e instanceof Offline)) throw e;
  } finally {
    flushing = false;
  }
  if (sent > 0) window.dispatchEvent(new CustomEvent(SYNCED_EVENT, { detail: { sent } }));
  return { sent };
}

// ─── Eau hors ligne : derniere quantite totale du jour, envoyee au retour du reseau ─────────────

const WATER_KEY = "nt-offline-water";

export function readWater(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(WATER_KEY) ?? "{}") ?? {}; } catch { return {}; }
}

export function queueWater(date: string, waterMl: number) {
  try { localStorage.setItem(WATER_KEY, JSON.stringify({ ...readWater(), [date]: waterMl })); } catch { /* stockage indisponible */ }
  window.dispatchEvent(new Event(QUEUE_EVENT));
}

function clearWater(date: string) {
  const w = readWater();
  delete w[date];
  try { localStorage.setItem(WATER_KEY, JSON.stringify(w)); } catch { /* idem */ }
  window.dispatchEvent(new Event(QUEUE_EVENT));
}

// ─── Aliments habituels gardes sur le telephone ─────────────────────────────────────────────────

const FOODS_KEY = "nt-offline-foods";
const FOODS_MAX_AGE_MS = 6 * 3_600_000;

export function readOfflineFoods(): RecentFood[] {
  try {
    const v = JSON.parse(localStorage.getItem(FOODS_KEY) ?? "null") as { foods?: RecentFood[] } | null;
    return Array.isArray(v?.foods) ? v.foods : [];
  } catch {
    return [];
  }
}

/** Met a jour la liste des aliments habituels (au plus toutes les 6 h, seulement en ligne). */
export async function refreshOfflineFoods(force = false): Promise<void> {
  try {
    const saved = JSON.parse(localStorage.getItem(FOODS_KEY) ?? "null") as { savedAt?: number } | null;
    if (!force && saved?.savedAt && Date.now() - saved.savedAt < FOODS_MAX_AGE_MS) return;
    const res = await fetch("/api/food/recent", { cache: "no-store" });
    if (!res.ok) return;
    const { results } = await res.json() as { results: RecentFood[] };
    localStorage.setItem(FOODS_KEY, JSON.stringify({ savedAt: Date.now(), foods: results }));
  } catch { /* hors ligne ou stockage plein : on garde l'ancienne liste */ }
}

const plain = (x: string) => x.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** D'abord ce qu'on mange a ce repas, puis les plus frequents ; filtre par texte (sans accents). */
export function rankFoods(foods: RecentFood[], meal: MealType, query: string): RecentFood[] {
  const q = plain(query.trim());
  return foods
    .filter((f) => !q || plain(f.name).includes(q))
    .sort((a, b) => (b.mealCounts?.[meal] ?? 0) - (a.mealCounts?.[meal] ?? 0) || b.timesLogged - a.timesLogged);
}

/** Entree du journal pour un aliment habituel a une portion donnee. */
export function entryFromFood(f: RecentFood, grams: number, meal: MealType): NewEntry {
  return {
    meal,
    foodId: `recent:${plain(f.name)}`,
    source: f.source,
    name: f.name,
    ...(f.brand ? { brand: f.brand } : {}),
    servingGrams: grams,
    servingQty: 1,
    servingUnit: "portion",
    servingLabel: `${grams} g`,
    nutrition: scaleNutrition(f.nutritionPer100g, grams),
  };
}
