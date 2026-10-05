"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { format } from "date-fns";
import { IconWifiOff, IconCloudUpload, IconTrash, IconAlertTriangle, IconRefresh, IconCheck, IconSearch, IconMinus, IconPlus, IconX } from "@tabler/icons-react";
import {
  enqueueMeal, readQueue, removeQueued, retryQueued, flushQueue, QUEUE_EVENT, type QueuedMeal,
  readOfflineFoods, refreshOfflineFoods, rankFoods, entryFromFood, readWater,
} from "@/app/lib/offline-meals";
import type { RecentFood } from "@/app/api/food/recent/route";
import { MEAL_META } from "./meal-meta";
import type { MealType } from "@/app/lib/types";

const MEALS: MealType[] = ["breakfast", "lunch", "snacks", "dinner"];

function guessMeal(h: number): MealType {
  if (h < 10) return "breakfast";
  if (h < 15) return "lunch";
  if (h < 18) return "snacks";
  return "dinner";
}

// Etat reseau et file d'attente, lus sans setState dans un effet.
const subscribeOnline = (cb: () => void) => {
  window.addEventListener("online", cb); window.addEventListener("offline", cb);
  return () => { window.removeEventListener("online", cb); window.removeEventListener("offline", cb); };
};
export function useOnline() {
  return useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
}
let cache: { raw: string; q: QueuedMeal[] } = { raw: "", q: [] };
const subscribeQueue = (cb: () => void) => {
  window.addEventListener(QUEUE_EVENT, cb); window.addEventListener("storage", cb);
  return () => { window.removeEventListener(QUEUE_EVENT, cb); window.removeEventListener("storage", cb); };
};
const EMPTY: QueuedMeal[] = [];
export function useOfflineQueue(): QueuedMeal[] {
  return useSyncExternalStore(subscribeQueue, () => {
    const q = readQueue();
    const raw = JSON.stringify(q);
    if (raw !== cache.raw) cache = { raw, q };
    return cache.q;
  }, () => EMPTY);
}
let foodsCache: { n: number; first: string; foods: RecentFood[] } = { n: 0, first: "", foods: [] };
const NO_FOODS: RecentFood[] = [];
function useOfflineFoods(): RecentFood[] {
  return useSyncExternalStore(subscribeQueue, () => {
    const f = readOfflineFoods();
    if (f.length !== foodsCache.n || (f[0]?.name ?? "") !== foodsCache.first) foodsCache = { n: f.length, first: f[0]?.name ?? "", foods: f };
    return foodsCache.foods;
  }, () => NO_FOODS);
}
const kcalOf = (f: RecentFood, grams: number) => Math.round((f.nutritionPer100g.calories * grams) / 100);

interface Props {
  /** Afficher le formulaire meme en ligne (page /offline). */
  alwaysShowForm?: boolean;
}

/** Saisie minimale d'un repas sans reseau + suivi des repas en attente d'envoi. */
// Le repas est toujours date du jour reel : hors ligne, la page du journal affichee peut venir du cache d'un autre jour.
export default function OfflineMealCapture({ alwaysShowForm = false }: Props) {
  const online = useOnline();
  const queue = useOfflineQueue();
  const [meal, setMeal] = useState<MealType>(() => guessMeal(new Date().getHours()));
  const [time, setTime] = useState(() => format(new Date(), "HH:mm"));
  const [text, setText] = useState("");
  const foods = useOfflineFoods();
  const [query, setQuery] = useState("");
  const [basket, setBasket] = useState<{ food: RecentFood; grams: number }[]>([]);
  const [saved, setSaved] = useState<"ok" | "error" | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(null), 4000);
    return () => clearTimeout(t);
  }, [saved]);

  const showForm = !online || alwaysShowForm;
  if (!showForm && queue.length === 0) return null;

  const save = () => {
    const t = text.trim();
    if (!t && basket.length === 0) return;
    const picks = basket.map((b) => entryFromFood(b.food, b.grams, meal));
    const ok = enqueueMeal({ date: format(new Date(), "yyyy-MM-dd"), meal, time, text: t, picks });
    setSaved(ok ? "ok" : "error");
    if (ok) { setText(""); setBasket([]); setQuery(""); }
    if (ok && navigator.onLine) void flushQueue();
  };

  const inBasket = new Set(basket.map((b) => b.food.name));
  const suggestions = rankFoods(foods, meal, query).filter((f) => !inBasket.has(f.name)).slice(0, query ? 8 : 6);
  const setGrams = (name: string, g: number) =>
    setBasket((bs) => bs.map((b) => (b.food.name === name ? { ...b, grams: Math.max(5, Math.min(2000, Math.round(g))) } : b)));
  const basketKcal = basket.reduce((s, b) => s + kcalOf(b.food, b.grams), 0);

  const sendNow = async () => { setSending(true); try { await flushQueue(); } finally { setSending(false); } };

  return (
    <section aria-label="Saisie hors ligne" className="rounded-2xl p-4 mb-5"
      style={{ background: "color-mix(in srgb, var(--warn) 7%, var(--surface))", border: "1px solid color-mix(in srgb, var(--warn) 30%, transparent)" }}>
      {showForm && (
        <>
          <p className="flex items-center gap-2 text-[14px] font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
            {online ? <IconCloudUpload size={17} style={{ color: "var(--warn)" }} /> : <IconWifiOff size={17} style={{ color: "var(--warn)" }} />}
            {online ? "Noter un repas" : "Pas de réseau : note ton repas"}
          </p>
          <p className="text-[12px] mb-3" style={{ color: "var(--text-secondary)" }}>
            Repas d&apos;aujourd&apos;hui : choisis tes aliments habituels ou décris ce que tu as mangé. Tout est ajouté
            au journal automatiquement dès que le réseau revient.
          </p>

          <div className="flex flex-wrap gap-1.5 mb-2" role="radiogroup" aria-label="Repas">
            {MEALS.map((m) => {
              const active = m === meal;
              return (
                <button key={m} type="button" role="radio" aria-checked={active} onClick={() => setMeal(m)}
                  className="min-h-[40px] px-3 rounded-full text-[13px] font-medium"
                  style={{
                    background: active ? `color-mix(in srgb, ${MEAL_META[m].color} 18%, transparent)` : "var(--layer-1)",
                    border: `1px solid ${active ? MEAL_META[m].color : "var(--border)"}`,
                    color: active ? MEAL_META[m].color : "var(--text-secondary)",
                  }}>
                  {MEAL_META[m].fr}
                </button>
              );
            })}
          </div>

          <label className="flex items-center gap-2 mb-2 text-[13px]" style={{ color: "var(--text-secondary)" }}>
            Heure du repas
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)}
              className="min-h-[40px] px-2 rounded-lg text-[15px] tabular-nums"
              style={{ background: "var(--layer-1)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          </label>

          {/* Aliments habituels : valeurs exactes, sans IA, disponibles hors ligne */}
          {foods.length > 0 ? (
            <div className="mb-3">
              <p className="text-[13px] font-semibold mb-1.5" style={{ color: "var(--text-primary)" }}>Tes aliments habituels</p>
              <label className="flex items-center gap-2 px-3 min-h-[44px] rounded-xl mb-2"
                style={{ background: "var(--layer-1)", border: "1px solid var(--border)" }}>
                <IconSearch size={16} style={{ color: "var(--text-muted)" }} />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Chercher (ex. yaourt)"
                  aria-label="Chercher dans tes aliments habituels"
                  className="flex-1 bg-transparent outline-none text-[15px]" style={{ color: "var(--text-primary)" }} />
              </label>
              <div className="flex flex-wrap gap-1.5">
                {suggestions.map((f) => (
                  <button key={f.name} type="button" onClick={() => setBasket((bs) => [...bs, { food: f, grams: f.usualGrams || 100 }])}
                    className="flex items-center gap-1 min-h-[40px] px-3 rounded-full text-[13px] text-left"
                    style={{ background: "var(--layer-1)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
                    <IconPlus size={13} style={{ color: "var(--warn)" }} />
                    {f.name}
                    <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>{f.usualGrams || 100} g</span>
                  </button>
                ))}
                {suggestions.length === 0 && (
                  <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>Rien de trouvé : décris-le plus bas.</p>
                )}
              </div>

              {basket.length > 0 && (
                <ul className="mt-2.5 rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                  {basket.map((b, i) => (
                    <li key={b.food.name} className="flex items-center gap-2 px-3 py-2" style={{ borderTop: i ? "1px solid var(--border)" : "none", background: "var(--layer-1)" }}>
                      <span className="flex-1 min-w-0">
                        <span className="block text-[14px] leading-snug" style={{ color: "var(--text-primary)" }}>{b.food.name}</span>
                        <span className="block text-[12px] tabular-nums" style={{ color: "var(--calories)" }}>{kcalOf(b.food, b.grams)} kcal</span>
                      </span>
                      <button type="button" onClick={() => setGrams(b.food.name, b.grams - 10)} aria-label={`10 g de moins de ${b.food.name}`}
                        className="flex items-center justify-center w-9 h-9 rounded-full" style={{ background: "var(--layer-2)", color: "var(--text-primary)" }}>
                        <IconMinus size={14} />
                      </button>
                      <input type="number" inputMode="numeric" value={b.grams} onChange={(e) => setGrams(b.food.name, Number(e.target.value) || 5)}
                        aria-label={`Grammes de ${b.food.name}`}
                        className="w-14 min-h-[36px] text-center rounded-lg text-[14px] tabular-nums"
                        style={{ background: "var(--layer-2)", color: "var(--text-primary)", border: "1px solid var(--border)" }} />
                      <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>g</span>
                      <button type="button" onClick={() => setGrams(b.food.name, b.grams + 10)} aria-label={`10 g de plus de ${b.food.name}`}
                        className="flex items-center justify-center w-9 h-9 rounded-full" style={{ background: "var(--layer-2)", color: "var(--text-primary)" }}>
                        <IconPlus size={14} />
                      </button>
                      <button type="button" onClick={() => setBasket((bs) => bs.filter((x) => x.food.name !== b.food.name))} aria-label={`Retirer ${b.food.name}`}
                        className="flex items-center justify-center w-9 h-9 rounded-full" style={{ color: "var(--text-muted)" }}>
                        <IconX size={15} />
                      </button>
                    </li>
                  ))}
                  <li className="flex justify-between px-3 py-2 text-[13px] font-semibold" style={{ borderTop: "1px solid var(--border)", color: "var(--text-primary)" }}>
                    <span>Total</span><span className="tabular-nums" style={{ color: "var(--calories)" }}>{basketKcal} kcal</span>
                  </li>
                </ul>
              )}
            </div>
          ) : !online && (
            <p className="text-[12px] mb-2" style={{ color: "var(--text-muted)" }}>
              Tes aliments habituels seront proposés ici hors ligne après la prochaine ouverture de l&apos;appli avec du réseau.
            </p>
          )}

          <p className="text-[13px] font-semibold mb-1.5" style={{ color: "var(--text-primary)" }}>
            {foods.length > 0 ? "Autre chose ? Décris-le" : "Décris ton repas"}
          </p>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={foods.length > 0 ? 2 : 3}
            placeholder="Ex. : 2 œufs brouillés, 1 tranche de pain complet beurrée, 1 café"
            aria-label="Description du repas"
            className="w-full p-3 rounded-xl text-[15px] mb-2 resize-y"
            style={{ background: "var(--layer-1)", border: "1px solid var(--border-strong)", color: "var(--text-primary)" }} />

          <button type="button" onClick={save} disabled={!text.trim() && basket.length === 0}
            className="w-full min-h-[48px] rounded-xl text-[14px] font-semibold disabled:opacity-50"
            style={{ background: "var(--warn)", color: "var(--bg)" }}>
            Enregistrer le repas
          </button>
          {saved === "ok" && (
            <p role="status" className="flex items-center gap-1.5 text-[12px] mt-2" style={{ color: "var(--ok)" }}>
              <IconCheck size={14} /> Gardé sur le téléphone{online ? ", envoi en cours…" : " : il partira au retour du réseau."}
            </p>
          )}
          {saved === "error" && (
            <p role="alert" className="text-[12px] mt-2" style={{ color: "var(--danger)" }}>
              Le téléphone refuse le stockage (navigation privée ?). Note ton repas ailleurs pour l&apos;instant.
            </p>
          )}
        </>
      )}

      {queue.length > 0 && (
        <div className={showForm ? "mt-4" : ""}>
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <p className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
              {queue.length} repas en attente d&apos;envoi
            </p>
            {online && (
              <button type="button" onClick={sendNow} disabled={sending}
                className="flex items-center gap-1.5 min-h-[40px] px-3 rounded-lg text-[12px] font-medium"
                style={{ background: "var(--layer-2)", color: "var(--text-primary)" }}>
                <IconRefresh size={14} className={sending ? "animate-spin" : ""} /> Envoyer
              </button>
            )}
          </div>
          <ul className="space-y-2">
            {queue.map((q) => (
              <li key={q.id} className="rounded-xl p-2.5" style={{ background: "var(--layer-1)", border: "1px solid var(--border)" }}>
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium" style={{ color: MEAL_META[q.meal].color }}>
                      {MEAL_META[q.meal].fr} · {q.time} · {format(new Date(`${q.date}T12:00:00`), "dd/MM")}
                    </p>
                    <p className="text-[13px] break-words" style={{ color: "var(--text-primary)" }}>
                      {[...(q.items ?? []).map((it) => `${it.entry.name} (${it.entry.servingGrams} g)`), q.text].filter(Boolean).join(" · ")}
                    </p>
                    {q.status === "failed" ? (
                      <p className="flex items-center gap-1 text-[12px] mt-0.5" style={{ color: "var(--danger)" }}>
                        <IconAlertTriangle size={13} /> {q.error}
                      </p>
                    ) : (
                      <p className="text-[12px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                        {!online ? "En attente du réseau" : q.error ? q.error : q.status === "parsed" ? "Envoi au journal en cours" : "En attente d'analyse"}
                      </p>
                    )}
                  </div>
                  {q.status === "failed" && (
                    <button type="button" onClick={() => { retryQueued(q.id); void flushQueue(); }} aria-label="Réessayer ce repas"
                      className="shrink-0 flex items-center justify-center w-10 h-10 rounded-full" style={{ color: "var(--text-secondary)" }}>
                      <IconRefresh size={16} />
                    </button>
                  )}
                  {!(q.items ?? []).some((it) => it.done) && (
                    <button type="button" onClick={() => { if (confirm("Supprimer ce repas en attente ?")) removeQueued(q.id); }}
                      aria-label="Supprimer ce repas en attente"
                      className="shrink-0 flex items-center justify-center w-10 h-10 rounded-full" style={{ color: "var(--text-muted)" }}>
                      <IconTrash size={16} />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/** Monte une fois dans le layout : envoie la file au chargement, au retour du reseau et toutes les minutes. */
export function OfflineSync() {
  useEffect(() => {
    const run = () => {
      if (!navigator.onLine) return;
      void refreshOfflineFoods();   // garde les aliments habituels a jour pour le prochain passage hors ligne
      if (readQueue().length || Object.keys(readWater()).length) void flushQueue();
    };
    run();
    window.addEventListener("online", run);
    const t = setInterval(run, 60_000);
    return () => { window.removeEventListener("online", run); clearInterval(t); };
  }, []);
  return null;
}
