"use client";

import { IconDroplet } from "@tabler/icons-react";
import {
  LineChart, Line, XAxis, YAxis, ResponsiveContainer, ReferenceArea, ReferenceLine, ReferenceDot, Tooltip,
} from "recharts";
import { computeDayStats, DEFAULT_GLUCOSE_TARGET, type MealGlucoseResponse } from "@/app/lib/glucose";
import type { GlucoseReading, MealType, NutritionGoals } from "@/app/lib/types";
import { MEAL_META } from "./meal-meta";
import { GlucoseBars, responseBars, fmt, hhmm, levelColor } from "./GlucoseSigns";

const MEALS: MealType[] = ["breakfast", "lunch", "snacks", "dinner"];
const SHORT: Record<MealType, string> = { breakfast: "P.-déj", lunch: "Déj.", snacks: "Coll.", dinner: "Dîn." };
const HOUR = 3_600_000;

interface Props {
  /** undefined = chargement, null = erreur, tableau = lectures du jour. */
  readings: GlucoseReading[] | null | undefined;
  responses: Partial<Record<MealType, MealGlucoseResponse>>;
  goals: NutritionGoals;
}

export default function GlucoseDayCard({ readings, responses, goals }: Props) {
  const target = { min: goals.glucoseTargetMinMmol ?? DEFAULT_GLUCOSE_TARGET.min, max: goals.glucoseTargetMaxMmol ?? DEFAULT_GLUCOSE_TARGET.max };

  if (readings === undefined) return null; // pas de squelette : evite un flash si la section reste vide
  if (readings === null) {
    return (
      <section aria-label="Glycémie" className="mb-5" role="alert">
        <p className="text-[12px]" style={{ color: "var(--danger)" }}>Glycémie indisponible pour l&apos;instant.</p>
      </section>
    );
  }

  const stats = computeDayStats(readings, target);
  const chartData = readings.map((r) => ({ t: r.timeMs, v: r.mmol }));

  // Repères verticaux : un par repas, seulement s'il tombe dans la plage couverte par le capteur.
  const first = readings[0]?.timeMs ?? 0;
  const last = readings[readings.length - 1]?.timeMs ?? 0;
  const markers = MEALS
    .map((meal) => ({ meal, r: responses[meal] }))
    .filter((m): m is { meal: MealType; r: MealGlucoseResponse } => !!m.r && m.r.mealTimeMs >= first - 30 * 60_000 && m.r.mealTimeMs <= last);
  const xMin = Math.min(first, ...markers.map((m) => m.r.mealTimeMs));
  const xMax = last;
  const ticks: number[] = [];
  if (readings.length > 1) {
    const d = new Date(xMin); d.setMinutes(0, 0, 0);
    for (let t = d.getTime() + HOUR; t < xMax; t += HOUR) if (new Date(t).getHours() % 3 === 0) ticks.push(t);
  }

  return (
    <section aria-label="Glycémie" className="mb-5">
      <div className="flex items-center justify-between mb-2">
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
          <p className="text-[12px] mb-1" style={{ color: "var(--text-secondary)" }}>
            Moy. <strong style={{ color: "var(--text-primary)" }}>{fmt(stats.avgMmol)}</strong> mmol/L
            <span style={{ color: "var(--text-muted)" }}> · {fmt(stats.minMmol)}–{fmt(stats.maxMmol)}</span>
          </p>

          <ResponsiveContainer width="100%" height={150}>
            <LineChart data={chartData} margin={{ top: 22, right: 8, left: 8, bottom: 0 }}>
              <ReferenceArea y1={target.min} y2={target.max} fill="var(--fat)" fillOpacity={0.07} ifOverflow="extendDomain" />
              {/* Fenetre post-prandiale (2 h) de chaque repas, dans la couleur du repas */}
              {markers.map(({ meal, r }) => (
                <ReferenceArea key={`a-${meal}`} x1={r.mealTimeMs} x2={Math.min(r.mealTimeMs + 2 * HOUR, xMax)}
                  fill={MEAL_META[meal].color} fillOpacity={0.12} ifOverflow="hidden" />
              ))}
              {/* Trait vertical a l'heure de chaque repas */}
              {markers.map(({ meal, r }) => (
                <ReferenceLine key={`l-${meal}`} x={r.mealTimeMs} stroke={MEAL_META[meal].color} strokeWidth={1.5} strokeDasharray="4 3"
                  label={{ value: SHORT[meal], position: "top", fill: MEAL_META[meal].color, fontSize: 12, fontWeight: 600 }} />
              ))}
              <XAxis dataKey="t" type="number" scale="time" domain={[xMin, xMax]} ticks={ticks} tickFormatter={hhmm}
                tick={{ fontSize: 12, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} />
              <YAxis domain={[(d: number) => Math.min(d, target.min - 1), (d: number) => Math.max(d + 2, target.max + 1)]} hide />
              <Tooltip
                labelFormatter={(t) => hhmm(t as number)}
                formatter={(v) => [`${fmt(Number(v))} mmol/L`, ""]}
                contentStyle={{ background: "var(--surface-hover)", border: "1px solid var(--border-strong)", borderRadius: 8, fontSize: 12 }}
              />
              <Line type="monotone" dataKey="v" stroke="var(--fat)" strokeWidth={2} dot={false} isAnimationActive={false} />
              {/* Pic de chaque repas */}
              {markers.filter((m) => m.r.peak).map(({ meal, r }) => (
                <ReferenceDot key={`p-${meal}`} x={r.peak!.timeMs} y={r.peak!.mmol} r={4} fill={levelColor(r.peak!.mmol, target)}
                  stroke="var(--bg)" strokeWidth={2}
                  label={{ value: fmt(r.peak!.mmol), position: "top", fill: levelColor(r.peak!.mmol, target), fontSize: 12, fontWeight: 600 }} />
              ))}
            </LineChart>
          </ResponsiveContainer>

          {MEALS.some((m) => responses[m]) && (
            <ul className="mt-3 space-y-3">
              {MEALS.filter((m) => responses[m]).map((meal) => {
                const r = responses[meal]!;
                const meta = MEAL_META[meal];
                return (
                  <li key={meal} className="flex items-center gap-3">
                    <span className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-lg"
                      style={{ background: `color-mix(in srgb, ${meta.color} 14%, transparent)`, color: meta.color }}>
                      <meta.Icon size={15} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>
                        {meta.fr} <span className="font-normal" style={{ color: "var(--text-muted)" }}>· {hhmm(r.mealTimeMs)} · {r.carbsG} g glucides</span>
                      </p>
                      <p className="text-[12px]" style={{ color: "var(--text-secondary)" }}>
                        {fmt(r.pre?.mmol)} → <strong style={{ color: levelColor(r.peak?.mmol, target) }}>{fmt(r.peak?.mmol)}</strong> → {fmt(r.post?.mmol)} mmol/L
                      </p>
                      {(r.riseMmol !== null && r.minutesToPeak !== null) && (
                        <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
                          pic +{fmt(r.riseMmol)} à {r.minutesToPeak} min
                          {r.risePer10gCarbs !== null && <> · +{fmt(r.risePer10gCarbs)} mmol / 10 g de glucides</>}
                        </p>
                      )}
                    </div>
                    <GlucoseBars values={responseBars(r)} target={target} height={30} />
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
