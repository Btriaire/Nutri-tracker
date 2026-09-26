"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { IconArrowRight } from "@tabler/icons-react";

interface Props {
  caloriesGoal: number;
  caloriesConsumed: number;
  caloriesBurned: number | null;
  proteinGoal: number;
  proteinConsumed: number;
  waterMl: number;
  waterGoalMl: number;
}

function nextMeal(hour: number): string {
  if (hour < 11) return "le petit-déjeuner";
  if (hour < 15) return "le déjeuner";
  if (hour < 18) return "la collation";
  return "le dîner";
}

// Une phrase qui repond a "ou j'en suis, que faire maintenant ?" + une seule action.
export default function TodayVerdict({
  caloriesGoal, caloriesConsumed, caloriesBurned, proteinGoal, proteinConsumed, waterMl, waterGoalMl,
}: Props) {
  // L'heure depend du client : rien n'est rendu cote serveur pour eviter un ecart d'hydratation.
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);
  if (!mounted) return <div className="mb-4 h-[168px] rounded-3xl" style={{ background: "var(--surface)" }} aria-hidden />;
  const hour = new Date().getHours();
  const budget = caloriesGoal + (caloriesBurned ?? 0);
  const left = Math.round(budget - caloriesConsumed);
  const proteinLeft = Math.max(0, Math.round(proteinGoal - proteinConsumed));
  const over = left < 0;
  const empty = caloriesConsumed <= 0;
  const lowWater = hour >= 12 && waterGoalMl > 0 && waterMl / waterGoalMl < 0.5;

  const color = over ? "var(--carbs)" : "var(--protein)";
  const action = empty
    ? { label: `Ajouter ${nextMeal(hour)}`, href: "/log" }
    : lowWater
      ? { label: "Boire de l'eau", href: "/log" }
      : !over && proteinLeft > 0
        ? { label: `Ajouter ${nextMeal(hour)}`, href: "/log" }
        : null;

  return (
    <section aria-label="Bilan du jour" className="mb-4 rounded-3xl p-5"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border-strong)",
        boxShadow: "0 0 32px color-mix(in srgb, var(--protein) 18%, transparent)",
      }}>
      <p className="text-[12px] font-medium uppercase tracking-[0.06em]" style={{ color: "var(--text-muted)" }}>
        {empty ? "Aujourd'hui" : over ? "Objectif dépassé" : "Il reste"}
      </p>
      {empty ? (
        <p className="text-[20px] font-semibold leading-snug mt-1" style={{ color: "var(--text-primary)" }}>
          Rien de noté pour l&apos;instant.
          <span className="block text-[14px] font-normal mt-1" style={{ color: "var(--text-secondary)" }}>
            Objectif : {Math.round(caloriesGoal)} kcal et {Math.round(proteinGoal)} g de protéines.
          </span>
        </p>
      ) : (
        <>
          <p className="flex items-baseline gap-2 mt-1">
            <span className="text-[56px] leading-none font-semibold tabular-nums font-mono"
              style={{ background: `linear-gradient(90deg, ${color}, var(--steps))`, WebkitBackgroundClip: "text", color: "transparent" }}>
              {Math.abs(left)}
            </span>
            <span className="text-[16px]" style={{ color: "var(--text-secondary)" }}>kcal</span>
          </p>
          <p className="text-[14px] mt-2" style={{ color: "var(--text-secondary)" }}>
            {proteinLeft > 0
              ? <>et encore <strong style={{ color: "var(--protein)" }}>{proteinLeft} g</strong> de protéines pour atteindre ta cible.</>
              : <>Protéines : objectif atteint.</>}
          </p>
        </>
      )}
      {action && (
        <Link href={action.href}
          className="mt-4 flex items-center justify-center gap-2 min-h-[48px] rounded-2xl text-[15px] font-semibold active:scale-[0.98] transition-transform"
          style={{ background: "linear-gradient(90deg, var(--protein), var(--steps))", color: "var(--bg)" }}>
          {action.label} <IconArrowRight size={18} stroke={2.4} />
        </Link>
      )}
    </section>
  );
}
