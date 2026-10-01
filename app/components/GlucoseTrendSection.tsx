"use client";

import { useEffect, useState } from "react";
import { format, parseISO, subDays } from "date-fns";
import { fr } from "date-fns/locale";
import { IconDroplet, IconChartLine } from "@tabler/icons-react";
import { LineChart, Line, XAxis, YAxis, ReferenceArea, ReferenceLine, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { computeDayStats, DEFAULT_GLUCOSE_TARGET } from "@/app/lib/glucose";
import type { GlucoseDay, NutritionGoals } from "@/app/lib/types";

type Range = "1j" | "7d" | "30d" | "3m" | "6m" | "1y" | "all";
const RANGE_DAYS: Record<Range, number> = { "1j": 1, "7d": 7, "30d": 30, "3m": 90, "6m": 180, "1y": 365, all: 365 };

export default function GlucoseTrendSection({ goals, range }: { goals: NutritionGoals; range: Range }) {
  const [days, setDays] = useState<GlucoseDay[] | null>(null);
  const [meals, setMeals] = useState<{ date: string; meal: string; timeMs: number }[]>([]);
  const [failed, setFailed] = useState(false);
  const target = { min: goals.glucoseTargetMinMmol ?? DEFAULT_GLUCOSE_TARGET.min, max: goals.glucoseTargetMaxMmol ?? DEFAULT_GLUCOSE_TARGET.max };
  const spanDays = RANGE_DAYS[range];

  useEffect(() => {
    let cancelled = false;
    const to = format(new Date(), "yyyy-MM-dd");
    const from = format(subDays(new Date(), spanDays - 1), "yyyy-MM-dd");
    fetch(`/api/glucose?from=${from}&to=${to}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
      .then((d: { days: GlucoseDay[]; meals?: { date: string; meal: string; timeMs: number }[] }) => { if (!cancelled) { setDays(d.days); setMeals(d.meals ?? []); } })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [spanDays]);

  if (!goals.glucoseTracking) return null;

  const daysWithData = (days ?? []).filter((d) => d.readings.length > 0);
  const allReadings = daysWithData.flatMap((d) => d.readings);
  const overall = computeDayStats(allReadings, target);
  const chartData = daysWithData.map((d) => ({
    date: d.date,
    label: format(parseISO(d.date), "d MMM", { locale: fr }),
    ...computeDayStats(d.readings, target),
  }));
  const mealLabels: Record<string, string> = { breakfast: "Petit-déjeuner", lunch: "Déjeuner", dinner: "Dîner", snacks: "Collation" };
  const mealColors: Record<string, string> = { breakfast: "var(--protein)", lunch: "var(--calories)", dinner: "var(--fat)", snacks: "var(--fiber)" };
  const profileBuckets = Array.from({ length: 13 }, (_, i) => i * 15 - 30);
  const profileData = profileBuckets.map((minute) => {
    const point: Record<string, number | null> = { minute };
    for (const meal of Object.keys(mealLabels)) {
      const values = meals.filter((m) => m.meal === meal).flatMap((m) => {
        const day = days?.find((d) => d.date === m.date);
        return (day?.readings ?? []).filter((r) => Math.round((r.timeMs - m.timeMs) / 60_000 / 15) * 15 === minute).map((r) => r.mmol);
      });
      point[meal] = values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length * 10) / 10 : null;
    }
    return point;
  });

  return (
    <div className="glass p-4 mb-5">
      <div className="flex items-center gap-2 mb-3">
        <IconDroplet size={14} stroke={1.8} style={{ color: "var(--fat)" }} />
        <p className="label-xs">Glycémie</p>
      </div>

      {failed && <p className="text-[12px]" style={{ color: "var(--danger)" }}>Impossible de charger la glycémie.</p>}

      {!failed && daysWithData.length === 0 && (
        <div className="flex items-start gap-3">
          <IconChartLine size={20} stroke={1.75} style={{ color: "var(--fat)", flexShrink: 0 }} />
          <p className="text-[13px] leading-snug" style={{ color: "var(--text-secondary)" }}>
            Aucune lecture reçue sur cette période. Vérifie que ton capteur synchronise bien vers Google Fit.
          </p>
        </div>
      )}

      {daysWithData.length === 1 && (
        <p className="text-[12px] mb-2" style={{ color: "var(--text-muted)" }}>
          Un seul jour de données pour l&apos;instant — la tendance apparaîtra avec plus d&apos;historique.
        </p>
      )}

      {daysWithData.length > 0 && (
        <>
          <div className="flex items-center gap-4 mb-3">
            <div>
              <p className="text-[22px] font-bold tabular-nums" style={{ color: "var(--fat)" }}>{overall.avgMmol}</p>
              <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>mmol/L moyen</p>
            </div>
            <div>
              <p className="text-[22px] font-bold tabular-nums" style={{ color: "var(--fiber)" }}>{overall.timeInRangePct}%</p>
              <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>dans la cible ({target.min}–{target.max})</p>
            </div>
          </div>

          {daysWithData.length >= 2 && (
            <ResponsiveContainer width="100%" height={140}>
              <LineChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--layer-1)" />
                <ReferenceArea y1={target.min} y2={target.max} fill="var(--fat)" fillOpacity={0.07} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} domain={["auto", "auto"]} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const p = payload[0]?.payload as { avgMmol: number; minMmol: number; maxMmol: number };
                    return (
                      <div className="px-2.5 py-1.5 rounded-lg text-[11px]" style={{ background: "var(--surface-hover)", border: "1px solid var(--border-strong)" }}>
                        <p style={{ color: "var(--text-muted)" }}>{label}</p>
                        <p className="font-bold" style={{ color: "var(--fat)" }}>{p.avgMmol} mmol/L ({p.minMmol}–{p.maxMmol})</p>
                      </div>
                    );
                  }}
                />
                <Line type="monotone" dataKey="avgMmol" stroke="var(--fat)" strokeWidth={2.5} dot={{ fill: "var(--fat)", r: 3, strokeWidth: 0 }} connectNulls activeDot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
          {meals.length > 0 && (
            <div className="mt-4">
              <p className="text-[12px] font-medium mb-1" style={{ color: "var(--text-primary)" }}>Réponse moyenne autour des repas</p>
              <p className="text-[10px] mb-2" style={{ color: "var(--text-muted)" }}>Chaque courbe est centrée sur le repas : −30 min à +2 h 30.</p>
              <ResponsiveContainer width="100%" height={170}>
                <LineChart data={profileData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--layer-1)" />
                  <ReferenceArea x1={-30} x2={0} fill="var(--text-muted)" fillOpacity={0.05} />
                  <ReferenceArea x1={0} x2={150} fill="var(--fat)" fillOpacity={0.05} />
                  <ReferenceLine x={0} stroke="var(--fat)" strokeDasharray="3 3" label={{ value: "Repas", position: "insideTop", fill: "var(--fat)", fontSize: 10 }} />
                  <XAxis dataKey="minute" tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickFormatter={(v) => `${v}′`} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} domain={["auto", "auto"]} />
                  <Tooltip labelFormatter={(v) => `${v} min`} formatter={(v, name) => [`${v ?? "—"} mmol/L`, mealLabels[String(name)] ?? name]} />
                  {Object.keys(mealLabels).map((meal) => <Line key={meal} type="monotone" dataKey={meal} stroke={mealColors[meal]} strokeWidth={2} dot={false} connectNulls />)}
                </LineChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                {Object.keys(mealLabels).map((meal) => <span key={meal} className="text-[10px]" style={{ color: mealColors[meal] }}>{mealLabels[meal]}</span>)}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
