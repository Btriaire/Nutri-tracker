"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { format, subDays } from "date-fns";
import { IconChevronLeft, IconChevronRight, IconCheck } from "@tabler/icons-react";
import type { DayTrendPoint, NutritionGoals } from "@/app/lib/types";

const PLEDGE_KEY = "nutri-review-pledge";

interface Weak { key: string; title: string; detail: string; pledge: string }

export default function ReviewClient() {
  const [points, setPoints] = useState<DayTrendPoint[] | null>(null);
  const [goals, setGoals] = useState<NutritionGoals | null>(null);
  const [failed, setFailed] = useState(false);
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(() => {
    try { return typeof window !== "undefined" && localStorage.getItem(PLEDGE_KEY + ":done") === "1"; } catch { return false; }
  });

  useEffect(() => {
    const to = format(new Date(), "yyyy-MM-dd");
    const from = format(subDays(new Date(), 6), "yyyy-MM-dd");
    Promise.all([
      fetch(`/api/progress?from=${from}&to=${to}`).then(r => r.json()),
      fetch("/api/goals").then(r => r.json()),
    ])
      .then(([p, g]: [{ points?: DayTrendPoint[] }, { goals?: NutritionGoals }]) => {
        setPoints(p.points ?? []);
        setGoals(g.goals ?? null);
      })
      .catch(() => setFailed(true));
  }, []);

  const stats = useMemo(() => {
    if (!points || !goals) return null;
    const logged = points.filter(p => p.calories > 0);
    const calOk = logged.filter(p => Math.abs(p.calories - goals.dailyCalories) <= goals.dailyCalories * 0.1).length;
    const protOk = logged.filter(p => p.proteinG >= goals.proteinGrams * 0.9).length;
    const over = logged.filter(p => p.calories > goals.dailyCalories * 1.1).length;
    const shortSleep = points.filter(p => p.sleepMinutes != null && p.sleepMinutes < 360).length;
    const lowWater = logged.filter(p => (p.waterMl ?? 0) < 1500).length;
    const weights = points.filter(p => p.weightKg != null).map(p => p.weightKg as number);
    const weightDelta = weights.length >= 2 ? Math.round((weights[weights.length - 1] - weights[0]) * 10) / 10 : null;

    const weak: Weak[] = [
      { key: "protein", title: "Protéines", detail: `${logged.length - protOk} jour(s) sous ta cible`, pledge: `Ajouter une source de protéines à chaque déjeuner (cible ${Math.round(goals.proteinGrams)} g).` },
      { key: "over", title: "Calories", detail: `${over} jour(s) au-dessus de ta cible`, pledge: "Noter le dîner avant de le manger, pour ajuster la portion." },
      { key: "sleep", title: "Sommeil", detail: `${shortSleep} nuit(s) sous 6 h`, pledge: "Se coucher 30 minutes plus tôt, 4 soirs sur 7." },
      { key: "water", title: "Hydratation", detail: `${lowWater} jour(s) sous 1,5 L`, pledge: "Un verre d'eau avec chaque repas (bouton +250 ml du journal)." },
    ];
    const score = [logged.length / 7, logged.length ? calOk / logged.length : 0, logged.length ? protOk / logged.length : 0];
    const points100 = Math.round((score[0] * 0.4 + score[1] * 0.3 + score[2] * 0.3) * 100);
    const problemOf = (k: string) => k === "protein" ? logged.length - protOk : k === "over" ? over : k === "sleep" ? shortSleep : lowWater;
    const worst = [...weak].sort((a, b) => problemOf(b.key) - problemOf(a.key))[0];
    const win = protOk >= 3 ? `${protOk} jours de protéines atteintes`
      : calOk >= 3 ? `${calOk} jours dans ta cible calorique`
      : logged.length >= 1 ? `${logged.length} jour(s) notés cette semaine` : null;
    return { logged: logged.length, calOk, protOk, weightDelta, worst, win, points100 };
  }, [points, goals]);

  const pledgeText = stats?.worst.pledge ?? "";
  const togglePledge = () => {
    const next = !done;
    setDone(next);
    try { localStorage.setItem(PLEDGE_KEY + ":done", next ? "1" : "0"); } catch { /* stockage indisponible */ }
  };

  const cards = stats ? [
    { label: "Ta semaine", big: `${stats.points100}`, unit: "/ 100", text: `${stats.logged} jour(s) notés sur 7 · ${stats.calOk} dans la cible calorique · ${stats.protOk} avec les protéines`, color: "var(--protein)" },
    { label: "Poids", big: stats.weightDelta == null ? "—" : `${stats.weightDelta > 0 ? "+" : stats.weightDelta < 0 ? "−" : ""}${Math.abs(stats.weightDelta).toFixed(1).replace(".", ",")}`, unit: stats.weightDelta == null ? "" : "kg", text: stats.weightDelta == null ? "Pas assez de pesées cette semaine." : "Écart entre la première et la dernière pesée de la semaine.", color: "var(--weight)" },
    { label: "Victoire", big: "", unit: "", text: stats.win ?? "Note quelques repas cette semaine pour trouver ta victoire.", color: "var(--fiber)" },
    { label: "Point à améliorer", big: stats.worst.title, unit: "", text: stats.worst.detail, color: "var(--carbs)" },
    { label: "Ton engagement", big: "", unit: "", text: pledgeText, color: "var(--steps)" },
  ] : [];

  const card = cards[step];

  return (
    <main className="max-w-md mx-auto px-4 py-6 md:ml-[220px]" style={{ paddingBottom: "96px" }}>
      <div className="flex items-center justify-between mb-4">
        <Link href="/dashboard" className="flex items-center min-h-[44px] text-[13px]" style={{ color: "var(--text-secondary)" }}>
          <IconChevronLeft size={16} /> Retour
        </Link>
        <p className="text-[12px] tabular-nums" style={{ color: "var(--text-muted)" }}>{cards.length ? `${step + 1} / ${cards.length}` : ""}</p>
      </div>

      {failed && <p role="alert" style={{ color: "var(--danger)" }}>Impossible de charger ta semaine, réessaie.</p>}
      {!failed && !stats && <div className="h-[320px] rounded-3xl" style={{ background: "var(--surface)" }} aria-busy="true" />}

      {card && (
        <section aria-live="polite" className="rounded-3xl p-6 min-h-[320px] flex flex-col justify-center"
          style={{ background: "var(--surface)", border: "1px solid var(--border-strong)", boxShadow: `0 0 36px color-mix(in srgb, ${card.color} 22%, transparent)` }}>
          <p className="text-[12px] font-medium uppercase tracking-[0.06em]" style={{ color: card.color }}>{card.label}</p>
          {card.big && (
            <p className="mt-2 flex items-baseline gap-2">
              <span className="text-[56px] leading-none font-semibold font-mono tabular-nums" style={{ color: card.color }}>{card.big}</span>
              <span className="text-[16px]" style={{ color: "var(--text-secondary)" }}>{card.unit}</span>
            </p>
          )}
          <p className="mt-3 text-[18px] leading-snug" style={{ color: "var(--text-primary)" }}>{card.text}</p>
          {step === cards.length - 1 && (
            <button type="button" onClick={togglePledge} aria-pressed={done}
              className="mt-5 flex items-center justify-center gap-2 min-h-[48px] rounded-2xl text-[15px] font-semibold"
              style={{ background: done ? "var(--fiber)" : "var(--layer-2)", color: done ? "var(--bg)" : "var(--text-primary)", border: "1px solid var(--border-strong)" }}>
              <IconCheck size={18} stroke={2.6} /> {done ? "Engagement tenu" : "Je m'y engage"}
            </button>
          )}
        </section>
      )}

      {cards.length > 0 && (
        <div className="flex gap-3 mt-4">
          <button type="button" disabled={step === 0} onClick={() => setStep(s => s - 1)} aria-label="Carte précédente"
            className="flex-1 min-h-[48px] rounded-2xl flex items-center justify-center disabled:opacity-40"
            style={{ background: "var(--layer-2)", color: "var(--text-primary)", border: "1px solid var(--border-strong)" }}>
            <IconChevronLeft size={20} />
          </button>
          <button type="button" disabled={step === cards.length - 1} onClick={() => setStep(s => s + 1)} aria-label="Carte suivante"
            className="flex-[2] min-h-[48px] rounded-2xl flex items-center justify-center gap-2 font-semibold disabled:opacity-40"
            style={{ background: "linear-gradient(90deg, var(--protein), var(--steps))", color: "var(--bg)" }}>
            Suivant <IconChevronRight size={20} />
          </button>
        </div>
      )}
    </main>
  );
}
