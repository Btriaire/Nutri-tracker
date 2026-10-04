"use client";

import { useEffect, useState } from "react";
import { IconDroplet, IconRefresh, IconPencil, IconChevronDown } from "@tabler/icons-react";
import {
  LineChart, Line, XAxis, YAxis, ResponsiveContainer, ReferenceArea, ReferenceLine, ReferenceDot, Tooltip,
} from "recharts";
import { computeDayStats, DEFAULT_GLUCOSE_TARGET, type MealGlucoseResponse } from "@/app/lib/glucose";
import type { GlucoseReading, MealType, NutritionGoals } from "@/app/lib/types";
import { MEAL_META } from "./meal-meta";
import { GlucoseBars, responseBars, mmol, hhmm, levelColor } from "./GlucoseSigns";

const MEALS: MealType[] = ["breakfast", "lunch", "snacks", "dinner"];
const SHORT: Record<MealType, string> = { breakfast: "P.-déj", lunch: "Déj.", snacks: "Coll.", dinner: "Dîn." };
const HOUR = 3_600_000;

function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

function ago(ms: number): string {
  const min = Math.max(0, Math.round(ms / 60_000));
  if (min < 2) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  return `il y a ${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")}`;
}

interface Props {
  /** undefined = chargement, null = erreur, tableau = lectures du jour. */
  readings: GlucoseReading[] | null | undefined;
  /** Fin naturelle de la courbe (derniere lecture du jour, sans la queue du lendemain). */
  dayEndMs?: number | null;
  syncing?: boolean;
  onRefresh?: () => void;
  responses: Partial<Record<MealType, MealGlucoseResponse>>;
  goals: NutritionGoals;
  onEditMealTime?: (meal: MealType) => void;
}

export default function GlucoseDayCard({ readings, dayEndMs, syncing, onRefresh, responses, goals, onEditMealTime }: Props) {
  const target = { min: goals.glucoseTargetMinMmol ?? DEFAULT_GLUCOSE_TARGET.min, max: goals.glucoseTargetMaxMmol ?? DEFAULT_GLUCOSE_TARGET.max };
  const now = useNow(60_000);
  // Le resume par repas est deja sous chaque repas : ici le detail complet est replie par defaut.
  const [detailOpen, setDetailOpen] = useState(false);

  if (readings === undefined) return null; // pas de squelette : evite un flash si la section reste vide
  if (readings === null) {
    return (
      <section aria-label="Glycémie" className="mb-5" role="alert">
        <p className="text-[12px]" style={{ color: "var(--danger)" }}>Glycémie indisponible pour l&apos;instant.</p>
      </section>
    );
  }

  const stats = computeDayStats(readings, target);
  const first = readings[0]?.timeMs ?? 0;
  const last = readings[readings.length - 1]?.timeMs ?? 0;
  const fresh = last > 0 && now - last < 24 * HOUR;

  // Reperes verticaux : un par repas avec une reponse, dans la plage couverte par le capteur.
  const markers = MEALS
    .map((meal) => ({ meal, r: responses[meal] }))
    .filter((m): m is { meal: MealType; r: MealGlucoseResponse } => !!m.r && m.r.status !== "no-data" && m.r.mealTimeMs >= first - 30 * 60_000 && m.r.mealTimeMs <= last);
  const lastMealEnd = markers.length ? Math.max(...markers.map((m) => m.r.mealTimeMs)) + 3 * HOUR : 0;
  const xMin = Math.min(first, ...markers.map((m) => m.r.mealTimeMs));
  // La courbe s'arrete a la fin du jour, sauf si un repas tardif a besoin de sa queue apres minuit.
  const xMax = Math.min(last, Math.max(dayEndMs ?? last, lastMealEnd));
  const chartData = readings.filter((r) => r.timeMs <= xMax).map((r) => ({ t: r.timeMs, v: r.mmol }));
  const ticks: number[] = [];
  if (readings.length > 1) {
    const d = new Date(xMin); d.setMinutes(0, 0, 0);
    for (let t = d.getTime() + HOUR; t < xMax; t += HOUR) if (new Date(t).getHours() % 3 === 0) ticks.push(t);
  }
  const rows = MEALS.filter((m) => responses[m]);

  return (
    <section aria-label="Glycémie" className="mb-5">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <IconDroplet size={16} stroke={1.8} style={{ color: "var(--fat)" }} />
          <p className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>Glycémie</p>
        </div>
        <div className="flex items-center gap-1">
          {stats.timeInRangePct !== null && (
            <span className="text-[12px] font-semibold px-2 py-0.5 rounded-full"
              style={{ color: "var(--fat)", background: "color-mix(in srgb, var(--fat) 14%, transparent)" }}>
              {stats.timeInRangePct} % dans la cible
            </span>
          )}
          {onRefresh && (
            <button type="button" onClick={onRefresh} disabled={syncing} aria-label="Actualiser la glycémie"
              className="flex items-center justify-center w-9 h-9 -mr-2 rounded-full disabled:opacity-60" style={{ color: "var(--text-muted)" }}>
              <IconRefresh size={16} stroke={1.8} className={syncing ? "animate-spin" : ""} />
            </button>
          )}
        </div>
      </div>
      <p className="text-[12px] mb-2" style={{ color: "var(--text-muted)" }} aria-live="polite">
        {syncing ? "Synchronisation avec Google Fit…" : last > 0 ? `Dernière lecture ${hhmm(last)}${fresh ? ` · ${ago(now - last)}` : ""}` : "Aucune lecture reçue"}
      </p>

      {readings.length === 0 ? (
        <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
          Aucune lecture reçue pour ce jour. Vérifie que ton capteur synchronise bien vers Google Fit.
        </p>
      ) : (
        <>
          <p className="text-[12px] mb-1" style={{ color: "var(--text-secondary)" }}>
            Moy. <strong style={{ color: "var(--text-primary)" }}>{mmol(stats.avgMmol)}</strong> mmol/L
            <span style={{ color: "var(--text-muted)" }}> · {mmol(stats.minMmol)}–{mmol(stats.maxMmol)}</span>
          </p>

          <ResponsiveContainer width="100%" height={150}>
            <LineChart data={chartData} margin={{ top: 22, right: 8, left: 8, bottom: 0 }}>
              <ReferenceArea y1={target.min} y2={target.max} fill="var(--fat)" fillOpacity={0.07} ifOverflow="extendDomain" />
              {markers.map(({ meal, r }) => (
                <ReferenceArea key={`a-${meal}`} x1={r.mealTimeMs} x2={Math.min(r.mealTimeMs + 2 * HOUR, xMax)}
                  fill={MEAL_META[meal].color} fillOpacity={0.12} ifOverflow="hidden" />
              ))}
              {markers.map(({ meal, r }) => (
                <ReferenceLine key={`l-${meal}`} x={r.mealTimeMs} stroke={MEAL_META[meal].color} strokeWidth={1.5} strokeDasharray="4 3"
                  label={{ value: SHORT[meal], position: "top", fill: MEAL_META[meal].color, fontSize: 12, fontWeight: 600 }} />
              ))}
              <XAxis dataKey="t" type="number" scale="time" domain={[xMin, xMax]} ticks={ticks} tickFormatter={hhmm}
                tick={{ fontSize: 12, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} />
              <YAxis domain={[(d: number) => Math.min(d, target.min - 1), (d: number) => Math.max(d + 2, target.max + 1)]} hide />
              <Tooltip
                labelFormatter={(t) => hhmm(t as number)}
                formatter={(v) => [`${mmol(Number(v))} mmol/L`, ""]}
                contentStyle={{ background: "var(--surface-hover)", border: "1px solid var(--border-strong)", borderRadius: 8, fontSize: 12 }}
              />
              <Line type="monotone" dataKey="v" stroke="var(--fat)" strokeWidth={2} dot={false} isAnimationActive={false} />
              {markers.filter((m) => m.r.peak).map(({ meal, r }) => (
                <ReferenceDot key={`p-${meal}`} x={r.peak!.timeMs} y={r.peak!.mmol} r={4} fill={levelColor(r.peak!.mmol, target)}
                  stroke="var(--bg)" strokeWidth={2}
                  label={{ value: mmol(r.peak!.mmol), position: "top", fill: levelColor(r.peak!.mmol, target), fontSize: 12, fontWeight: 600 }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </>
      )}

      {rows.length > 0 && (
        <button type="button" onClick={() => setDetailOpen((v) => !v)} aria-expanded={detailOpen}
          className="mt-2 w-full flex items-center justify-between min-h-[40px] text-[12px] font-medium"
          style={{ color: "var(--text-secondary)" }}>
          <span>Détail par repas ({rows.length}) · heure, glucides, pic</span>
          <IconChevronDown size={15} style={{ transform: detailOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
        </button>
      )}
      {rows.length > 0 && detailOpen && (
        <ul className="mt-1 space-y-3">
          {rows.map((meal) => {
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
                    {meta.fr}{" "}
                    {onEditMealTime ? (
                      <button type="button" onClick={() => onEditMealTime(meal)} aria-label={`Heure du repas ${hhmm(r.mealTimeMs)}. Modifier`}
                        className="inline-flex items-center gap-1 font-normal tabular-nums underline decoration-dotted underline-offset-2"
                        style={{ color: "var(--text-secondary)" }}>
                        {hhmm(r.mealTimeMs)} <IconPencil size={12} />
                      </button>
                    ) : <span className="font-normal" style={{ color: "var(--text-muted)" }}>{hhmm(r.mealTimeMs)}</span>}
                    <span className="font-normal" style={{ color: "var(--text-muted)" }}> · {r.carbsG} g glucides</span>
                  </p>

                  {r.status === "no-data" ? (
                    <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
                      Aucune lecture autour de ce repas
                      {r.firstReadingMs && r.lastReadingMs ? ` (capteur : ${hhmm(r.firstReadingMs)}–${hhmm(r.lastReadingMs)}). Corrige l'heure du repas si besoin.` : "."}
                    </p>
                  ) : (
                    <>
                      <p className="text-[12px]" style={{ color: "var(--text-secondary)" }}>
                        {mmol(r.pre?.mmol)} → <strong style={{ color: levelColor(r.peak?.mmol, target) }}>{mmol(r.peak?.mmol)}</strong> → {mmol(r.post?.mmol)} mmol/L
                      </p>
                      <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
                        {r.status === "pending"
                          ? `Réponse en cours — dernière lecture ${r.lastReadingMs ? hhmm(r.lastReadingMs) : "?"}`
                          : r.riseMmol !== null && r.minutesToPeak !== null && (
                            <>pic +{mmol(r.riseMmol)} à {r.minutesToPeak} min{r.risePer10gCarbs !== null && <> · +{mmol(r.risePer10gCarbs)} mmol / 10 g de glucides</>}</>
                          )}
                      </p>
                    </>
                  )}
                </div>
                {r.status !== "no-data" && <GlucoseBars values={responseBars(r)} target={target} height={30} />}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
