"use client";

import { useEffect, useState } from "react";
import { IconDroplet, IconArrowUpRight, IconArrowDownRight, IconMinus } from "@tabler/icons-react";
import {
  LineChart, Line, XAxis, YAxis, ResponsiveContainer, ReferenceArea, Tooltip,
} from "recharts";
import { matchMealGlucose, computeDayStats, DEFAULT_GLUCOSE_TARGET } from "@/app/lib/glucose";
import type { FoodEntry, GlucoseDay, MealType, NutritionGoals } from "@/app/lib/types";

const MEAL_LABEL: Record<MealType, string> = { breakfast: "Petit-déj", lunch: "Déjeuner", snacks: "Collation", dinner: "Dîner" };
const MEALS: MealType[] = ["breakfast", "lunch", "snacks", "dinner"];

function entryTimeMs(e: FoodEntry): number | null {
  const ts = e.loggedAt as unknown as { _seconds?: number; seconds?: number };
  const sec = ts?._seconds ?? ts?.seconds;
  return sec ? sec * 1000 : null;
}

export default function GlucoseDayCard({ date, entries, goals }: { date: string; entries: FoodEntry[]; goals: NutritionGoals }) {
  const [day, setDay] = useState<GlucoseDay | null | undefined>(undefined); // undefined = chargement, null = erreur
  const target = { min: goals.glucoseTargetMinMmol ?? DEFAULT_GLUCOSE_TARGET.min, max: goals.glucoseTargetMaxMmol ?? DEFAULT_GLUCOSE_TARGET.max };

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/glucose?from=${date}&to=${date}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
      .then((d: { days: GlucoseDay[] }) => { if (!cancelled) setDay(d.days[0] ?? { date, readings: [] }); })
      .catch(() => { if (!cancelled) setDay(null); });
    return () => { cancelled = true; };
  }, [date]);

  if (day === undefined) return null; // pas de squelette : evite un flash si la section reste vide
  if (day === null) {
    return (
      <div className="glass p-4 mb-5" role="alert">
        <p className="text-[12px]" style={{ color: "var(--danger)" }}>Glycémie indisponible pour l&apos;instant.</p>
      </div>
    );
  }

  const readings = day.readings;
  const stats = computeDayStats(readings, target);
  const chartData = readings.map((r) => ({ t: r.timeMs, v: r.mmol }));

  const mealsWithFood = MEALS
    .map((meal) => {
      const mealEntries = entries.filter((e) => e.meal === meal);
      if (mealEntries.length === 0) return null;
      const times = mealEntries.map(entryTimeMs).filter((t): t is number => t !== null);
      if (times.length === 0) return null;
      const mealTimeMs = Math.min(...times);
      const carbsG = mealEntries.reduce((s, e) => s + (e.nutrition?.carbsG ?? 0), 0);
      return { meal, carbsG, match: matchMealGlucose(readings, mealTimeMs) };
    })
    .filter((m): m is NonNullable<typeof m> => m !== null);

  return (
    <section aria-label="Glycémie" className="glass p-4 mb-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <IconDroplet size={16} stroke={1.8} style={{ color: "var(--fat)" }} />
          <p className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>Glycémie</p>
        </div>
        {stats.timeInRangePct !== null && (
          <span className="text-[12px] font-semibold px-2 py-0.5 rounded-full"
            style={{ color: "var(--fat)", background: "color-mix(in srgb, var(--fat) 14%, transparent)" }}>
            {stats.timeInRangePct}% dans la cible
          </span>
        )}
      </div>

      {readings.length === 0 ? (
        <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
          Aucune lecture reçue aujourd&apos;hui. Vérifie que ton capteur synchronise bien vers Google Fit.
        </p>
      ) : (
        <>
          <div className="flex items-baseline gap-4 mb-2">
            <span className="text-[12px]" style={{ color: "var(--text-secondary)" }}>
              Moy. <strong style={{ color: "var(--text-primary)" }}>{stats.avgMmol}</strong> mmol/L
            </span>
            <span className="text-[12px]" style={{ color: "var(--text-secondary)" }}>
              {stats.minMmol}–{stats.maxMmol} mmol/L
            </span>
          </div>

          <ResponsiveContainer width="100%" height={90}>
            <LineChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <ReferenceArea y1={target.min} y2={target.max} fill="var(--fat)" fillOpacity={0.08} ifOverflow="extendDomain" />
              <XAxis dataKey="t" type="number" domain={["dataMin", "dataMax"]} hide />
              <YAxis domain={[(d: number) => Math.min(d, target.min - 1), (d: number) => Math.max(d, target.max + 1)]} hide />
              <Tooltip
                labelFormatter={(t) => new Date(t as number).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                formatter={(v) => [`${v} mmol/L`, ""]}
                contentStyle={{ background: "var(--surface-hover)", border: "1px solid var(--border-strong)", borderRadius: 8, fontSize: 12 }}
              />
              <Line type="monotone" dataKey="v" stroke="var(--fat)" strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>

          {mealsWithFood.length > 0 && (
            <div className="mt-3 space-y-2">
              {mealsWithFood.map(({ meal, carbsG, match }) => {
                const delta = match.deltaMmol;
                const Icon = delta === null ? IconMinus : delta > 0.3 ? IconArrowUpRight : delta < -0.3 ? IconArrowDownRight : IconMinus;
                const color = delta === null ? "var(--text-muted)" : delta > 2.0 ? "var(--danger)" : "var(--fiber)";
                return (
                  <div key={meal} className="flex items-center justify-between text-[12px]" style={{ color: "var(--text-secondary)" }}>
                    <span className="font-medium" style={{ color: "var(--text-primary)" }}>{MEAL_LABEL[meal]}</span>
                    <span>{Math.round(carbsG)} g glucides</span>
                    <span className="flex items-center gap-1" style={{ color }}>
                      {match.pre ? `${match.pre.mmol}` : "—"} → {match.post ? `${match.post.mmol}` : "—"}
                      <Icon size={13} stroke={2} />
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </section>
  );
}
