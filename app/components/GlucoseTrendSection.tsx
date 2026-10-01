"use client";

import { useEffect, useState } from "react";
import { format, parseISO, subDays } from "date-fns";
import { fr } from "date-fns/locale";
import { IconDroplet, IconChartLine } from "@tabler/icons-react";
import { LineChart, Line, XAxis, YAxis, ReferenceArea, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { computeDayStats, DEFAULT_GLUCOSE_TARGET } from "@/app/lib/glucose";
import type { GlucoseDay, NutritionGoals } from "@/app/lib/types";

type Range = "1j" | "7d" | "30d" | "3m" | "6m" | "1y" | "all";
const RANGE_DAYS: Record<Range, number> = { "1j": 1, "7d": 7, "30d": 30, "3m": 90, "6m": 90, "1y": 90, all: 90 };

export default function GlucoseTrendSection({ goals, range }: { goals: NutritionGoals; range: Range }) {
  const [days, setDays] = useState<GlucoseDay[] | null>(null);
  const [failed, setFailed] = useState(false);
  const target = { min: goals.glucoseTargetMinMmol ?? DEFAULT_GLUCOSE_TARGET.min, max: goals.glucoseTargetMaxMmol ?? DEFAULT_GLUCOSE_TARGET.max };
  const spanDays = RANGE_DAYS[range];

  useEffect(() => {
    let cancelled = false;
    const to = format(new Date(), "yyyy-MM-dd");
    const from = format(subDays(new Date(), spanDays - 1), "yyyy-MM-dd");
    fetch(`/api/glucose?from=${from}&to=${to}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
      .then((d: { days: GlucoseDay[] }) => { if (!cancelled) setDays(d.days); })
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
        </>
      )}
    </div>
  );
}
