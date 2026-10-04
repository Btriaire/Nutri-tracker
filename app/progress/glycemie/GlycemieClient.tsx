"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { IconArrowLeft, IconDroplet } from "@tabler/icons-react";
import {
  ComposedChart, Area, Line, LineChart, ScatterChart, Scatter, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid,
  ReferenceArea, ReferenceLine, Tooltip, ResponsiveContainer, LabelList,
} from "recharts";
import {
  meanCurve, mealStats, macroFit, isolatedEffects, splitByMacro, measurable, CURVE_OFFSETS,
  type InsightsResponse, type Macro, type MealRow,
} from "@/app/lib/glucose-insights";
import type { MealType } from "@/app/lib/types";
import { MEAL_META } from "@/app/components/meal-meta";
import { GlucoseBars, fmt, levelColor } from "@/app/components/GlucoseSigns";

const ALL_MEALS: MealType[] = ["breakfast", "lunch", "snacks", "dinner"];
const SHORT: Record<MealType, string> = { breakfast: "P.-déj", lunch: "Déj.", snacks: "Coll.", dinner: "Dîn." };
const RANGES = [7, 14, 30, 90] as const;
const AXIS = { fontSize: 12, fill: "var(--text-muted)" };
const TOOLTIP = { background: "var(--surface-hover)", border: "1px solid var(--border-strong)", borderRadius: 8, fontSize: 12 };

const BANDS: { key: keyof NonNullable<InsightsResponse["range"]>; label: string; color: string }[] = [
  { key: "veryHigh", label: "Très haut", color: "var(--danger)" },
  { key: "high",     label: "Haut",      color: "var(--calories)" },
  { key: "inRange",  label: "Dans la cible", color: "var(--fat)" },
  { key: "low",      label: "Bas",       color: "var(--carbs)" },
  { key: "veryLow",  label: "Très bas",  color: "var(--weight)" },
];

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="glass p-4 mb-5">
      <h2 className="text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>{title}</h2>
      {hint && <p className="text-[12px] mt-0.5 mb-3" style={{ color: "var(--text-muted)" }}>{hint}</p>}
      {!hint && <div className="mb-3" />}
      {children}
    </section>
  );
}

function Kpi({ label, value, unit, sub, color }: { label: string; value: string; unit?: string; sub?: string; color: string }) {
  return (
    <div>
      <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>{label}</p>
      <p className="text-[24px] font-bold leading-tight tabular-nums" style={{ color }}>
        {value}{unit && <span className="text-[12px] font-normal ml-1" style={{ color: "var(--text-muted)" }}>{unit}</span>}
      </p>
      {sub && <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>{sub}</p>}
    </div>
  );
}

const Empty = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[13px] leading-snug" style={{ color: "var(--text-secondary)" }}>{children}</p>
);

export default function GlycemieClient() {
  const [days, setDays] = useState<number>(30);
  const [state, setState] = useState<{ days: number; data: InsightsResponse | null } | null>(null);
  const [picked, setPicked] = useState<MealType[]>(ALL_MEALS);

  useEffect(() => {
    let cancelled = false;
    const tz = -new Date().getTimezoneOffset();
    fetch(`/api/glucose/insights?days=${days}&tz=${tz}&to=${format(new Date(), "yyyy-MM-dd")}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
      .then((d: InsightsResponse) => { if (!cancelled) setState({ days, data: d }); })
      .catch(() => { if (!cancelled) setState({ days, data: null }); });
    return () => { cancelled = true; };
  }, [days]);

  const data = state?.days === days ? state.data : undefined;   // undefined = chargement, null = erreur
  const target = data?.target ?? { min: 3.9, max: 10 };

  const selectedRows = useMemo<MealRow[]>(() => (data ? data.meals.filter((m) => picked.includes(m.meal)) : []), [data, picked]);
  const toggle = (m: MealType) => setPicked((p) => (p.includes(m) ? (p.length > 1 ? p.filter((x) => x !== m) : p) : [...p, m]));

  return (
    <div className="relative min-h-screen">
      <div className="bg-orbs" />
      <div className="relative z-10 max-w-md mx-auto px-4 py-6 md:ml-[220px] md:max-w-2xl" style={{ paddingBottom: 96 }}>
        <Link href="/progress" className="flex items-center gap-1.5 min-h-[44px] text-[13px] -mt-2" style={{ color: "var(--text-secondary)" }}>
          <IconArrowLeft size={15} /> Progrès
        </Link>
        <div className="flex items-center gap-2 mb-1">
          <IconDroplet size={22} stroke={1.8} style={{ color: "var(--fat)" }} />
          <h1 className="text-[22px] font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>Glycémie</h1>
        </div>
        <p className="text-[12px] mb-4" style={{ color: "var(--text-muted)" }}>Vue globale, repas par repas, et impact des glucides, fibres et lipides.</p>

        <div className="flex gap-2 mb-5" role="group" aria-label="Période">
          {RANGES.map((d) => (
            <button key={d} type="button" onClick={() => setDays(d)} aria-pressed={days === d}
              className="flex-1 min-h-[44px] rounded-full text-[13px] font-medium transition-colors"
              style={{
                background: days === d ? "color-mix(in srgb, var(--fat) 18%, transparent)" : "var(--layer-1)",
                color: days === d ? "var(--fat)" : "var(--text-secondary)",
              }}>
              {d} j
            </button>
          ))}
        </div>

        {data === undefined && <div className="h-[260px] rounded-2xl" style={{ background: "var(--surface)" }} aria-busy="true" />}
        {data === null && <p role="alert" className="text-[13px]" style={{ color: "var(--danger)" }}>Impossible de charger la glycémie. Réessaie dans un instant.</p>}

        {data && !data.enabled && (
          <Section title="Suivi désactivé"><Empty>Active le suivi de glycémie dans Réglages pour voir cet écran.</Empty></Section>
        )}

        {data && data.enabled && data.daysWithData === 0 && (
          <Section title="Pas encore de données">
            <Empty>Aucune lecture sur cette période. Vérifie que ton capteur synchronise bien vers Google Fit, ou choisis une période plus longue.</Empty>
          </Section>
        )}

        {data && data.enabled && data.daysWithData > 0 && (
          <>
            {/* ── 1. Vue d'ensemble ───────────────────────────────────────── */}
            <Section title="Vue d'ensemble" hint={`${data.daysWithData} jour${data.daysWithData > 1 ? "s" : ""} de données · ${data.overview.readings.toLocaleString("fr-FR")} lectures`}>
              <div className="flex gap-5">
                {data.range && (
                  <div className="flex flex-col items-center flex-shrink-0" role="img"
                    aria-label={BANDS.map((b) => `${b.label} ${fmt(data.range![b.key])} %`).join(", ")}>
                    <div className="flex flex-col w-9 rounded-xl overflow-hidden" style={{ height: 172 }}>
                      {BANDS.filter((b) => data.range![b.key] > 0).map((b) => (
                        <div key={b.key} style={{ flexGrow: data.range![b.key], flexBasis: 0, minHeight: 3, background: b.color }} />
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex-1 min-w-0 space-y-3">
                  {data.range && (
                    <ul className="space-y-1">
                      {BANDS.map((b) => (
                        <li key={b.key} className="flex items-center gap-2 text-[12px]">
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: b.color }} />
                          <span style={{ color: "var(--text-secondary)" }}>{b.label}</span>
                          <span className="ml-auto font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>{fmt(data.range![b.key])} %</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>Cible : {fmt(target.min)}–{fmt(target.max)} mmol/L</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
                <Kpi label="Moyenne" value={fmt(data.overview.avgMmol)} unit="mmol/L" color="var(--fat)" />
                <Kpi label="Variabilité" value={data.overview.cvPct === null ? "—" : `${data.overview.cvPct} %`}
                  sub={data.overview.cvPct === null ? undefined : data.overview.cvPct < 36 ? "stable (< 36 %)" : "variable (≥ 36 %)"}
                  color={data.overview.cvPct !== null && data.overview.cvPct >= 36 ? "var(--calories)" : "var(--fiber)"} />
                <Kpi label="HbA1c estimée (GMI)" value={data.overview.gmiPct === null ? "—" : `${fmt(data.overview.gmiPct)} %`} sub="estimation, pas un résultat de labo" color="var(--protein)" />
                <Kpi label="Écart-type" value={fmt(data.overview.sdMmol)} unit="mmol/L" color="var(--text-primary)" />
              </div>
            </Section>

            {/* ── 2. Journée type ─────────────────────────────────────────── */}
            <Section title="Ta journée type" hint="Médiane et zones (25–75 % et 10–90 %) de tes lectures, heure par heure. Les traits verticaux sont tes heures de repas habituelles.">
              <ResponsiveContainer width="100%" height={200}>
                <ComposedChart data={data.agp.map((p) => ({ hour: p.hour, p50: p.p50, b90: [p.p10, p.p90], b75: [p.p25, p.p75] }))} margin={{ top: 22, right: 8, left: -18, bottom: 0 }}>
                  <ReferenceArea y1={target.min} y2={target.max} fill="var(--fat)" fillOpacity={0.07} ifOverflow="extendDomain" />
                  <CartesianGrid stroke="var(--layer-1)" vertical={false} />
                  {ALL_MEALS.map((m) => {
                    const h = data.typicalHours[m];
                    if (h === null || h === undefined) return null;
                    return (
                      <ReferenceLine key={m} x={Math.min(h, 24)} stroke={MEAL_META[m].color} strokeWidth={1.5} strokeDasharray="4 3"
                        label={{ value: SHORT[m], position: "top", fill: MEAL_META[m].color, fontSize: 12, fontWeight: 600 }} />
                    );
                  })}
                  <XAxis dataKey="hour" type="number" domain={[0, 24]} ticks={[0, 3, 6, 9, 12, 15, 18, 21, 24]} tick={AXIS} tickLine={false} axisLine={false} tickFormatter={(h) => `${h} h`} />
                  <YAxis tick={AXIS} tickLine={false} axisLine={false} domain={[(d: number) => Math.min(d, target.min - 0.5), (d: number) => Math.max(d + 1, target.max + 1)]} tickFormatter={(v) => fmt(Math.round(v))} />
                  <Tooltip contentStyle={TOOLTIP} labelFormatter={(h) => `${h} h`}
                    formatter={(v, name) => (Array.isArray(v) ? [`${fmt(v[0])}–${fmt(v[1])}`, name === "b90" ? "10–90 %" : "25–75 %"] : [`${fmt(Number(v))} mmol/L`, "Médiane"])} />
                  <Area type="monotone" dataKey="b90" stroke="none" fill="var(--fat)" fillOpacity={0.15} isAnimationActive={false} />
                  <Area type="monotone" dataKey="b75" stroke="none" fill="var(--fat)" fillOpacity={0.3} isAnimationActive={false} />
                  <Line type="monotone" dataKey="p50" stroke="var(--fat)" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </Section>

            {/* ── 3. Par repas ────────────────────────────────────────────── */}
            <Section title="Repas par repas" hint="Choisis les repas à comparer : la courbe montre l'écart moyen à ta glycémie d'avant le repas, pendant les 3 h qui suivent.">
              <div className="flex flex-wrap gap-2 mb-4" role="group" aria-label="Repas affichés">
                {ALL_MEALS.map((m) => {
                  const on = picked.includes(m);
                  const meta = MEAL_META[m];
                  return (
                    <button key={m} type="button" onClick={() => toggle(m)} aria-pressed={on}
                      className="flex items-center gap-1.5 min-h-[40px] px-3.5 rounded-full text-[13px] font-medium transition-colors"
                      style={{
                        background: on ? `color-mix(in srgb, ${meta.color} 18%, transparent)` : "var(--layer-1)",
                        color: on ? meta.color : "var(--text-muted)",
                      }}>
                      <meta.Icon size={14} />{SHORT[m]}
                    </button>
                  );
                })}
              </div>

              {(() => {
                const curves = picked.map((m) => ({ m, curve: meanCurve(data.meals.filter((r) => r.meal === m)) })).filter((c) => c.curve.some((p) => p.mean !== null));
                if (curves.length === 0) return <Empty>Pas encore assez de repas mesurés pour tracer une courbe moyenne (3 minimum par repas).</Empty>;
                const series = CURVE_OFFSETS.map((offset, i) => ({ offset, ...Object.fromEntries(curves.map((c) => [c.m, c.curve[i].mean])) }));
                return (
                  <ResponsiveContainer width="100%" height={190}>
                    <LineChart data={series} margin={{ top: 22, right: 8, left: -18, bottom: 0 }}>
                      <CartesianGrid stroke="var(--layer-1)" vertical={false} />
                      <ReferenceLine y={0} stroke="var(--border-strong)" />
                      <ReferenceLine x={120} stroke="var(--border-strong)" strokeDasharray="3 3" label={{ value: "2 h", position: "top", fill: "var(--text-muted)", fontSize: 12 }} />
                      <XAxis dataKey="offset" type="number" domain={[0, 180]} ticks={[0, 30, 60, 90, 120, 150, 180]} tick={AXIS} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}'`} />
                      <YAxis tick={AXIS} tickLine={false} axisLine={false} tickFormatter={(v) => fmt(v)} />
                      <Tooltip contentStyle={TOOLTIP} labelFormatter={(v) => `+${v} min`} formatter={(v, n) => [`${Number(v) > 0 ? "+" : ""}${fmt(Number(v))} mmol/L`, MEAL_META[n as MealType].fr]} />
                      {curves.map((c) => (
                        <Line key={c.m} type="monotone" dataKey={c.m} stroke={MEAL_META[c.m].color} strokeWidth={2.5} dot={false} connectNulls isAnimationActive={false} />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                );
              })()}

              <ul className="mt-4 space-y-4">
                {picked.map((m) => {
                  const s = mealStats(data.meals, m, target);
                  const meta = MEAL_META[m];
                  return (
                    <li key={m} className="flex items-center gap-3">
                      <span className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-lg" style={{ background: `color-mix(in srgb, ${meta.color} 14%, transparent)`, color: meta.color }}>
                        <meta.Icon size={16} />
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>
                          {meta.fr} <span className="font-normal" style={{ color: "var(--text-muted)" }}>· {s.n} repas mesuré{s.n > 1 ? "s" : ""}</span>
                        </p>
                        {s.n === 0 ? (
                          <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>Pas encore de mesure pour ce repas.</p>
                        ) : (
                          <>
                            <p className="text-[12px]" style={{ color: "var(--text-secondary)" }}>
                              {fmt(s.avgPre)} → <strong style={{ color: levelColor(s.avgPeak, target) }}>{fmt(s.avgPeak)}</strong> → {fmt(s.avgPost)} mmol/L
                            </p>
                            <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
                              hausse +{fmt(s.avgRise)} en {s.avgMinutesToPeak} min · {s.pctPeakInRange} % des pics ≤ {fmt(target.max)}
                            </p>
                          </>
                        )}
                      </div>
                      {s.n > 0 && <GlucoseBars values={[{ label: "avant", mmol: s.avgPre }, { label: "pic", mmol: s.avgPeak }, { label: "2 h après", mmol: s.avgPost }]} target={target} height={34} />}
                    </li>
                  );
                })}
              </ul>
            </Section>

            {/* ── 4. Impact des macronutriments ───────────────────────────── */}
            <MacroImpact rows={selectedRows} picked={picked} target={target} />
          </>
        )}
      </div>
    </div>
  );
}

// ─── Impact des glucides, fibres et lipides ──────────────────────────────────

const MACROS: { key: Macro; label: string; unit: string; per: string; color: string; value: (r: MealRow) => number }[] = [
  { key: "carbs", label: "Glucides", unit: "g", per: "10 g", color: "var(--carbs)", value: (r) => r.carbsG },
  { key: "fiber", label: "Fibres",   unit: "g", per: "5 g",  color: "var(--fiber)", value: (r) => r.fiberG },
  { key: "fat",   label: "Lipides",  unit: "g", per: "10 g", color: "var(--fat)",   value: (r) => r.fatG },
];

function MacroImpact({ rows, picked, target }: { rows: MealRow[]; picked: MealType[]; target: { min: number; max: number } }) {
  const ok = measurable(rows);
  const effects = isolatedEffects(rows);
  const names = picked.map((m) => SHORT[m]).join(", ");

  return (
    <Section title="Glucides, fibres, lipides : leur impact" hint={`Chaque point est un repas (${names}) : hausse de glycémie en fonction de ce qu'il contenait.`}>
      {ok.length < 5 ? (
        <Empty>Pas encore assez de repas mesurés ({ok.length}) : il en faut au moins 5 pour voir une tendance. Continue à noter tes repas avec leurs heures.</Empty>
      ) : (
        <>
          <div className="space-y-5">
            {MACROS.map((mc) => {
              const fit = macroFit(rows, mc.key);
              const pts = ok.map((r) => ({ x: mc.value(r), y: r.rise as number, meal: r.meal }));
              const xs = pts.map((p) => p.x);
              const x0 = Math.min(...xs), x1 = Math.max(...xs);
              const per = mc.key === "fiber" ? 5 : 10;
              return (
                <div key={mc.key}>
                  <div className="flex items-baseline justify-between mb-1">
                    <p className="text-[13px] font-semibold" style={{ color: mc.color }}>{mc.label}</p>
                    {fit && (
                      <p className="text-[12px] tabular-nums" style={{ color: "var(--text-secondary)" }}>
                        {fit.slope * per >= 0 ? "+" : "−"}{fmt(Math.round(Math.abs(fit.slope * per) * 10) / 10)} mmol/L par {per} g · r = {fmt(Math.round(fit.r * 100) / 100)}
                      </p>
                    )}
                  </div>
                  <ResponsiveContainer width="100%" height={150}>
                    <ScatterChart margin={{ top: 6, right: 10, left: -18, bottom: 0 }}>
                      <CartesianGrid stroke="var(--layer-1)" />
                      <XAxis type="number" dataKey="x" name={mc.label} unit=" g" domain={[0, "auto"]} tick={AXIS} tickLine={false} axisLine={false} />
                      <YAxis type="number" dataKey="y" name="Hausse" tick={AXIS} tickLine={false} axisLine={false} tickFormatter={(v) => fmt(v)} />
                      <Tooltip cursor={{ strokeDasharray: "3 3" }} contentStyle={TOOLTIP}
                        formatter={(v, n) => [n === "Hausse" ? `+${fmt(Number(v))} mmol/L` : `${fmt(Number(v))} g`, n]} />
                      {fit && <ReferenceLine segment={[{ x: x0, y: fit.intercept + fit.slope * x0 }, { x: x1, y: fit.intercept + fit.slope * x1 }]} stroke={mc.color} strokeWidth={2} strokeDasharray="6 4" />}
                      <Scatter data={pts} isAnimationActive={false}>
                        {pts.map((p, i) => <Cell key={i} fill={MEAL_META[p.meal].color} fillOpacity={0.85} />)}
                      </Scatter>
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              );
            })}
          </div>

          {/* Effet isole : les trois macros ensemble */}
          <div className="mt-6 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
            <p className="text-[13px] font-semibold mb-0.5" style={{ color: "var(--text-primary)" }}>Toutes choses égales par ailleurs</p>
            <p className="text-[12px] mb-3" style={{ color: "var(--text-muted)" }}>
              Effet de chaque macro sur la hausse, en séparant les trois (un repas riche en glucides l&apos;est souvent aussi en lipides).
            </p>
            {!effects ? (
              <Empty>Il faut au moins 15 repas mesurés avec des compositions variées pour séparer les effets ({ok.length} pour l&apos;instant).</Empty>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={170}>
                  <BarChart data={[
                    { name: "+10 g glucides", v: effects.carbsPer10g },
                    { name: "+5 g fibres", v: effects.fiberPer5g },
                    { name: "+10 g lipides", v: effects.fatPer10g },
                  ]} margin={{ top: 22, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid stroke="var(--layer-1)" vertical={false} />
                    <ReferenceLine y={0} stroke="var(--border-strong)" />
                    <XAxis dataKey="name" tick={AXIS} tickLine={false} axisLine={false} interval={0} tickMargin={6} />
                    <YAxis domain={[(d: number) => Math.min(d, 0) - 0.5, (d: number) => Math.max(d, 0) + 0.3]} tick={AXIS} tickLine={false} axisLine={false} tickFormatter={(v) => fmt(v)} />
                    <Tooltip contentStyle={TOOLTIP} formatter={(v) => [`${Number(v) > 0 ? "+" : ""}${fmt(Number(v))} mmol/L`, "Effet sur la hausse"]} />
                    <Bar dataKey="v" radius={[6, 6, 0, 0]} isAnimationActive={false}>
                      {[effects.carbsPer10g, effects.fiberPer5g, effects.fatPer10g].map((v, i) => <Cell key={i} fill={v > 0 ? "var(--danger)" : "var(--fiber)"} />)}
                      <LabelList dataKey="v" content={(p) => {
                        const { x, y, width, height, value } = p as { x: number; y: number; width: number; height: number; value: number };
                        const top = Math.min(y, y + height), bottom = Math.max(y, y + height);
                        const neg = value < 0;
                        return (
                          <text x={x + width / 2} y={neg ? (top + bottom) / 2 + 4 : top - 6} textAnchor="middle"
                            style={{ fill: neg ? "var(--bg)" : "var(--text-primary)", fontSize: 12, fontWeight: 600 }}>
                            {`${neg ? "" : "+"}${fmt(value)}`}
                          </text>
                        );
                      }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
                  Rouge : fait monter · vert : amortit. Basé sur {effects.n} repas ; ces trois macros expliquent {Math.round(effects.r2 * 100)} % des écarts entre tes repas.
                </p>
              </>
            )}
          </div>

          {/* A glucides comparables */}
          {(() => {
            const splits = (["fiber", "fat"] as Macro[]).map((m) => splitByMacro(rows, m)).filter((s): s is NonNullable<typeof s> => s !== null);
            if (splits.length === 0) return null;
            const label: Record<Macro, string> = { carbs: "Glucides", fiber: "Fibres", fat: "Lipides" };
            return (
              <div className="mt-6 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
                <p className="text-[13px] font-semibold mb-0.5" style={{ color: "var(--text-primary)" }}>À glucides comparables (≥ 20 g)</p>
                <p className="text-[12px] mb-3" style={{ color: "var(--text-muted)" }}>Hausse moyenne des repas en dessous / au-dessus de la médiane de chaque macro.</p>
                <div className="grid grid-cols-2 gap-4">
                  {splits.map((s) => (
                    <div key={s.macro}>
                      <p className="text-[12px] font-medium mb-1" style={{ color: "var(--text-secondary)" }}>{label[s.macro]} · seuil {fmt(s.threshold)} g</p>
                      <ResponsiveContainer width="100%" height={130}>
                        <BarChart data={[{ n: "moins", v: s.lowAvg }, { n: "plus", v: s.highAvg }]} margin={{ top: 18, right: 4, left: 4, bottom: 0 }}>
                          <XAxis dataKey="n" tick={AXIS} tickLine={false} axisLine={false} />
                          <YAxis hide domain={[0, "dataMax + 1"]} />
                          <Bar dataKey="v" radius={[6, 6, 0, 0]} isAnimationActive={false}>
                            <Cell fill="var(--layer-3)" /><Cell fill={s.highAvg < s.lowAvg ? "var(--fiber)" : "var(--danger)"} />
                            <LabelList dataKey="v" position="top" formatter={(v: unknown) => `+${fmt(Number(v))}`} style={{ fill: "var(--text-primary)", fontSize: 12, fontWeight: 600 }} />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                      <p className="text-[12px] text-center" style={{ color: "var(--text-muted)" }}>{s.lowN} / {s.highN} repas</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          <p className="text-[12px] mt-5" style={{ color: "var(--text-muted)" }}>
            Ce sont des corrélations observées sur tes propres repas, pas des preuves de cause : la glycémie dépend aussi du sommeil, du stress,
            de l&apos;activité et de l&apos;ordre des aliments. Cible utilisée : {fmt(target.min)}–{fmt(target.max)} mmol/L. Ce n&apos;est pas un avis médical.
          </p>
        </>
      )}
    </Section>
  );
}
