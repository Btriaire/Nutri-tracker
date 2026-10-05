"use client";

// Saisie de repas hors ligne : le repas est decrit en texte libre et garde sur le telephone (localStorage),
// puis envoye au retour du reseau : analyse IA (/api/food/voice, comme la dictee) -> ajout des aliments
// (/api/log) -> heure du repas (/api/log PATCH mealTime, pour la glycemie).
// Chaque etape est memorisee : une coupure au milieu de l'envoi ne cree jamais de doublon.

import { aiScaleToGrams, type AiPer100g } from "./ai-food";
import { mealTimeFromInput } from "./glucose";
import type { FoodEntry, FoodSearchResult, MealType } from "./types";

type NewEntry = Omit<FoodEntry, "id" | "loggedAt">;

export interface QueuedMeal {
  id: string;
  date: string;          // "yyyy-MM-dd"
  meal: MealType;
  time: string;          // "HH:mm", heure reelle du repas
  text: string;
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

export function enqueueMeal(m: Pick<QueuedMeal, "date" | "meal" | "time" | "text">): boolean {
  const q = readQueue();
  const item: QueuedMeal = { ...m, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, createdAt: Date.now(), status: "pending" };
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
    for (const start of readQueue()) {
      if (start.status === "failed") continue;
      let m = start;

      if (m.status === "pending") {
        const res = await post("/api/food/voice", { text: m.text, defaultMeal: m.meal });
        if (res.status === 401) break;                                  // session expiree : il faut se reconnecter
        if (!res.ok) { update(m.id, { status: "failed", error: "Analyse impossible pour l'instant" }); continue; }
        const data = await res.json() as { results?: VoiceResult[] };
        const results = data.results ?? [];
        if (results.length === 0) { update(m.id, { status: "failed", error: "Aucun aliment reconnu : reformule" }); continue; }
        const items = results.map((d) => ({
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
        m = { ...m, status: "parsed", items };
        update(m.id, { status: "parsed", items });
      }

      const items = m.items ?? [];
      let blocked = false;
      for (let i = 0; i < items.length; i++) {
        if (items[i].done) continue;
        const res = await post("/api/log", { date: m.date, entry: items[i].entry });
        if (!res.ok) { blocked = true; break; }
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
