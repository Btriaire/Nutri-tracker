"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { format } from "date-fns";
import { IconWifiOff, IconCloudUpload, IconTrash, IconAlertTriangle, IconRefresh, IconCheck } from "@tabler/icons-react";
import { enqueueMeal, readQueue, removeQueued, retryQueued, flushQueue, QUEUE_EVENT, type QueuedMeal } from "@/app/lib/offline-meals";
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
    if (!t) return;
    const ok = enqueueMeal({ date: format(new Date(), "yyyy-MM-dd"), meal, time, text: t });
    setSaved(ok ? "ok" : "error");
    if (ok) setText("");
    if (ok && navigator.onLine) void flushQueue();
  };

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
            Repas d&apos;aujourd&apos;hui : décris ce que tu as mangé, avec les quantités si tu les connais. Il sera
            analysé et ajouté au journal automatiquement dès que le réseau revient.
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

          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3}
            placeholder="Ex. : 2 œufs brouillés, 1 tranche de pain complet beurrée, 1 café"
            aria-label="Description du repas"
            className="w-full p-3 rounded-xl text-[15px] mb-2 resize-y"
            style={{ background: "var(--layer-1)", border: "1px solid var(--border-strong)", color: "var(--text-primary)" }} />

          <button type="button" onClick={save} disabled={!text.trim()}
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
                    <p className="text-[13px] break-words" style={{ color: "var(--text-primary)" }}>{q.text}</p>
                    {q.status === "failed" ? (
                      <p className="flex items-center gap-1 text-[12px] mt-0.5" style={{ color: "var(--danger)" }}>
                        <IconAlertTriangle size={13} /> {q.error}
                      </p>
                    ) : (
                      <p className="text-[12px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                        {q.status === "parsed" ? "Analysé, ajout au journal en cours" : online ? "En attente d'analyse" : "En attente du réseau"}
                      </p>
                    )}
                  </div>
                  {q.status === "failed" && (
                    <button type="button" onClick={() => { retryQueued(q.id); void flushQueue(); }} aria-label="Réessayer ce repas"
                      className="shrink-0 flex items-center justify-center w-10 h-10 rounded-full" style={{ color: "var(--text-secondary)" }}>
                      <IconRefresh size={16} />
                    </button>
                  )}
                  {q.status !== "parsed" && (
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
    const run = () => { if (readQueue().length) void flushQueue(); };
    run();
    window.addEventListener("online", run);
    const t = setInterval(run, 60_000);
    return () => { window.removeEventListener("online", run); clearInterval(t); };
  }, []);
  return null;
}
