"use client";

import { useEffect, useMemo, useState } from "react";
import { ComposedChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceArea, ReferenceLine } from "recharts";
import { format, parseISO, addDays } from "date-fns";
import { fr } from "date-fns/locale";
import { METRICS, computeBaselines, pearson, type FaceMetrics, type MetricKey } from "@/app/lib/face-metrics";

type Overlay = "none" | "weight" | "sleep";
type ProgressPoint = { date: string; weightKg?: number; sleepMinutes?: number };

interface Props {
  /** Scans avec mesures, dans n'importe quel ordre. */
  scans: { date: string; metrics: FaceMetrics }[];
}

const AXIS = { fontSize: 12, fill: "var(--text-muted)" };
const fmt = (v: number, d = 2) => (Math.round(v * 10 ** d) / 10 ** d).toString().replace(".", ",");

/** Courbe d'une mesure sur tout l'historique, bande "ton habitude", poids ou sommeil en regard. */
export default function FaceMetricsTrend({ scans }: Props) {
  const [key, setKey] = useState<MetricKey>("volumeBasVisage");
  const [overlay, setOverlay] = useState<Overlay>("weight");
  const [points, setPoints] = useState<ProgressPoint[] | null>(null);

  const sorted = useMemo(() => [...scans].sort((a, b) => a.date.localeCompare(b.date)), [scans]);
  const from = sorted[0]?.date, to = sorted[sorted.length - 1]?.date;

  useEffect(() => {
    if (!from || !to) return;
    let cancelled = false;
    fetch(`/api/progress?from=${format(addDays(parseISO(from), -3), "yyyy-MM-dd")}&to=${to}`)
      .then((r) => (r.ok ? r.json() : { points: [] }))
      .then((d: { points?: ProgressPoint[] }) => { if (!cancelled) setPoints(d.points ?? []); })
      .catch(() => { if (!cancelled) setPoints([]); });
    return () => { cancelled = true; };
  }, [from, to]);

  if (sorted.length < 2) return null;

  const info = METRICS.find((m) => m.key === key)!;
  const base = computeBaselines(sorted.map((s) => s.metrics))[key];

  // Poids : mesure du jour ou la plus proche dans les 3 jours precedents ; sommeil : la nuit du jour du scan.
  const byDate = new Map((points ?? []).map((p) => [p.date, p]));
  const overlayFor = (date: string): number | undefined => {
    if (overlay === "sleep") { const s = byDate.get(date)?.sleepMinutes; return s ? Math.round((s / 60) * 10) / 10 : undefined; }
    if (overlay === "weight") {
      for (let k = 0; k <= 3; k++) { const w = byDate.get(format(addDays(parseISO(date), -k), "yyyy-MM-dd"))?.weightKg; if (w) return w; }
    }
    return undefined;
  };

  const data = sorted.map((s) => ({
    t: parseISO(s.date).getTime(),
    v: s.metrics[key] as number,
    low: s.metrics.quality.score < 60,
    o: overlay === "none" ? undefined : overlayFor(s.date),
  }));
  const pairs = data.filter((d) => !d.low && d.o !== undefined).map((d) => [d.v, d.o!] as [number, number]);
  const r = overlay === "none" ? null : pearson(pairs);
  const overlayLabel = overlay === "weight" ? "poids" : "sommeil";

  return (
    <section aria-label="Évolution des mesures du visage" className="glass p-4 mb-4">
      <h2 className="text-[15px] font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Évolution depuis le premier scan</h2>
      <p className="text-[12px] mb-3" style={{ color: "var(--text-secondary)" }}>
        {sorted.length} photos, du {format(parseISO(from!), "d MMM yyyy", { locale: fr })} au {format(parseISO(to!), "d MMM yyyy", { locale: fr })}.
        La bande = ton habitude ; points creux = photo de qualité moyenne.
      </p>

      <div className="flex gap-1.5 overflow-x-auto pb-1 mb-2 -mx-1 px-1" role="radiogroup" aria-label="Mesure">
        {METRICS.map((m) => (
          <button key={m.key} type="button" role="radio" aria-checked={m.key === key} onClick={() => setKey(m.key)}
            className="shrink-0 min-h-[36px] px-3 rounded-full text-[12px] font-medium whitespace-nowrap"
            style={{
              background: m.key === key ? "color-mix(in srgb, var(--indigo) 18%, transparent)" : "var(--layer-1)",
              border: `1px solid ${m.key === key ? "var(--indigo)" : "var(--border)"}`,
              color: m.key === key ? "var(--indigo)" : "var(--text-secondary)",
            }}>
            {m.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1.5 mb-2" role="radiogroup" aria-label="Afficher en regard">
        <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>En regard :</span>
        {(["weight", "sleep", "none"] as Overlay[]).map((o) => (
          <button key={o} type="button" role="radio" aria-checked={o === overlay} onClick={() => setOverlay(o)}
            className="min-h-[32px] px-2.5 rounded-lg text-[12px]"
            style={{ background: o === overlay ? "var(--layer-2)" : "transparent", color: o === overlay ? "var(--text-primary)" : "var(--text-muted)" }}>
            {o === "weight" ? "Poids" : o === "sleep" ? "Sommeil" : "Rien"}
          </button>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={data} margin={{ top: 8, right: overlay === "none" ? 8 : 0, left: -14, bottom: 0 }}>
          <CartesianGrid stroke="var(--layer-1)" vertical={false} />
          {base && <ReferenceArea yAxisId="m" y1={base.median - base.spread} y2={base.median + base.spread} fill="var(--indigo)" fillOpacity={0.1} ifOverflow="extendDomain" />}
          {base && <ReferenceLine yAxisId="m" y={base.median} stroke="var(--indigo)" strokeDasharray="4 3" strokeOpacity={0.6} />}
          <XAxis dataKey="t" type="number" scale="time" domain={["dataMin", "dataMax"]} tick={AXIS} tickLine={false} axisLine={false}
            tickFormatter={(t) => format(new Date(t), "MMM yy", { locale: fr })} minTickGap={30} />
          <YAxis yAxisId="m" tick={AXIS} tickLine={false} axisLine={false} domain={["auto", "auto"]} tickFormatter={(v) => fmt(v)} width={46} />
          {overlay !== "none" && (
            <YAxis yAxisId="o" orientation="right" tick={AXIS} tickLine={false} axisLine={false} domain={["auto", "auto"]} width={34} />
          )}
          <Tooltip
            contentStyle={{ background: "var(--surface-hover)", border: "1px solid var(--border-strong)", borderRadius: 8, fontSize: 12 }}
            labelFormatter={(t) => format(new Date(t as number), "d MMM yyyy", { locale: fr })}
            formatter={(v, name) => [name === "o" ? `${v} ${overlay === "weight" ? "kg" : "h"}` : fmt(Number(v)), name === "o" ? overlayLabel : info.label]}
          />
          <Line yAxisId="m" type="monotone" dataKey="v" stroke="var(--indigo)" strokeWidth={2} isAnimationActive={false}
            dot={(p) => <circle key={`d-${p.index}`} cx={p.cx} cy={p.cy} r={3.5} stroke="var(--indigo)" strokeWidth={1.5} fill={p.payload.low ? "var(--bg)" : "var(--indigo)"} />} />
          {overlay !== "none" && (
            <Line yAxisId="o" type="monotone" dataKey="o" stroke="var(--calories)" strokeWidth={1.5} strokeDasharray="5 4" dot={false} connectNulls isAnimationActive={false} />
          )}
        </ComposedChart>
      </ResponsiveContainer>

      <p className="text-[12px] mt-2" style={{ color: "var(--text-secondary)" }}>
        <strong style={{ color: "var(--text-primary)" }}>{info.label}</strong> : valeur haute = {info.higher}.
        {overlay !== "none" && (r === null
          ? ` Pas encore assez de scans avec ${overlayLabel} le même jour pour mesurer un lien.`
          : ` Lien avec le ${overlayLabel} : r = ${r.toFixed(2).replace(".", ",")} sur ${pairs.length} scans (${Math.abs(r) < 0.3 ? "faible" : Math.abs(r) < 0.6 ? "modéré" : "fort"}). Une corrélation n'est pas une preuve de cause.`)}
      </p>
    </section>
  );
}
