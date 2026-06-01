"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { IconLoader2, IconChartLine, IconChevronDown } from "@tabler/icons-react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine,
} from "recharts";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import type { BodyCompPoint } from "@/app/api/withings-body/route";

// ─── Config ──────────────────────────────────────────────────────────────────

type Tab = "composition" | "vitaux" | "sommeil";

interface MetricDef {
  key:    keyof BodyCompPoint;
  label:  string;
  unit:   string;
  color:  string;
  decimals?: number;
}

const TABS: { id: Tab; label: string; emoji: string; metrics: MetricDef[] }[] = [
  {
    id:    "composition",
    label: "Composition",
    emoji: "⚖️",
    metrics: [
      { key: "bodyFatPct",   label: "Graisse",         unit: "%",  color: "#f97316" },
      { key: "muscleMassKg", label: "Masse musculaire", unit: "kg", color: "#8b5cf6", decimals: 1 },
      { key: "fatMassKg",    label: "Masse grasse",     unit: "kg", color: "#ef4444", decimals: 1 },
    ],
  },
  {
    id:    "vitaux",
    label: "Vitaux",
    emoji: "❤️",
    metrics: [
      { key: "systolicBP",  label: "Systolique",  unit: "mmHg", color: "#f43f5e" },
      { key: "diastolicBP", label: "Diastolique", unit: "mmHg", color: "#fb7185" },
      { key: "spO2Pct",     label: "SpO₂",        unit: "%",   color: "#06b6d4" },
      { key: "restingHR",   label: "FC repos",     unit: "bpm", color: "#ec4899" },
      { key: "tempCelsius", label: "Température",  unit: "°C",  color: "#f59e0b", decimals: 1 },
    ],
  },
  {
    id:    "sommeil",
    label: "Sommeil",
    emoji: "🌙",
    metrics: [
      { key: "totalSleepH", label: "Sommeil total",   unit: "h",    color: "#6366f1", decimals: 1 },
      { key: "deepSleepH",  label: "Sommeil profond", unit: "h",    color: "#4f46e5", decimals: 1 },
      { key: "remSleepH",   label: "Sommeil REM",     unit: "h",    color: "#7c3aed", decimals: 1 },
      { key: "sleepScore",  label: "Score sommeil",   unit: "/100", color: "#34d399" },
    ],
  },
];

const RANGES = [
  { label: "30j",  days: 30  },
  { label: "90j",  days: 90  },
  { label: "180j", days: 180 },
];

// ─── BP classification ─────────────────────────────────────────────────────────

function bpClass(sys: number, dia: number): { label: string; color: string; bg: string } {
  if (sys < 90 || dia < 60)      return { label: "Hypotension",     color: "#60a5fa", bg: "rgba(96,165,250,0.08)"  };
  if (sys < 120 && dia < 80)     return { label: "Optimal",         color: "#34d399", bg: "rgba(52,211,153,0.08)"  };
  if (sys < 130 && dia < 80)     return { label: "Normal élevé",    color: "#a3e635", bg: "rgba(163,230,53,0.08)"  };
  if (sys < 140 || dia < 90)     return { label: "HTA grade 1",     color: "#fb923c", bg: "rgba(251,146,60,0.08)"  };
  if (sys < 180 || dia < 110)    return { label: "HTA grade 2",     color: "#f87171", bg: "rgba(248,113,113,0.08)" };
  return                                  { label: "HTA grade 3",     color: "#ef4444", bg: "rgba(239,68,68,0.1)"   };
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label, metrics }: {
  active?: boolean;
  payload?: { color: string; name: string; value: number }[];
  label?: string;
  metrics: MetricDef[];
}) {
  if (!active || !payload?.length) return null;
  const date = label ? format(parseISO(label), "d MMM", { locale: fr }) : "";
  return (
    <div className="rounded-xl px-3 py-2.5 text-[11px] space-y-1"
      style={{ background: "rgba(15,15,22,0.97)", border: "1px solid var(--border-strong)", boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}>
      <p className="font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>{date}</p>
      {payload.map((p) => {
        const def = metrics.find(m => m.label === p.name);
        return (
          <div key={p.name} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
            <span style={{ color: "var(--text-muted)" }}>{p.name}</span>
            <span className="font-bold tabular-nums ml-auto" style={{ color: p.color }}>
              {def?.decimals ? p.value.toFixed(def.decimals) : Math.round(p.value)}{def?.unit ?? ""}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Mini stat ────────────────────────────────────────────────────────────────

function MiniStat({ label, value, unit, color, trend }: {
  label: string; value: number | null; unit: string; color: string; trend?: number | null;
}) {
  if (value == null) return null;
  return (
    <div className="flex flex-col gap-0.5 p-2.5 rounded-xl flex-1"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
      <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{label}</span>
      <div className="flex items-baseline gap-0.5">
        <span className="text-[18px] font-bold tabular-nums" style={{ color }}>
          {typeof value === "number" && unit !== "/100"
            ? value >= 10 ? Math.round(value) : value.toFixed(1)
            : Math.round(value ?? 0)}
        </span>
        <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{unit}</span>
      </div>
      {trend != null && (
        <span className="text-[9px] tabular-nums" style={{ color: trend >= 0 ? "#f87171" : "#34d399" }}>
          {trend >= 0 ? "▲" : "▼"} {Math.abs(trend).toFixed(1)}{unit.replace("/100", "")}
        </span>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function BodyCompChart() {
  const [tab,        setTab]       = useState<Tab>("composition");
  const [days,       setDays]      = useState(90);
  const [points,     setPoints]    = useState<BodyCompPoint[]>([]);
  const [loading,    setLoading]   = useState(false);
  const [hidden,     setHidden]    = useState<Set<string>>(new Set());
  const [bpListOpen, setBpListOpen] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/withings-body?days=${days}`)
      .then(r => r.json())
      .then((d: { points: BodyCompPoint[] }) => setPoints(d.points ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [days]);

  const currentTab = TABS.find(t => t.id === tab)!;
  const metrics    = currentTab.metrics;

  // Latest + previous values for stats
  const latest   = [...points].reverse().find(p => metrics.some(m => p[m.key] != null));
  const previous = latest
    ? [...points].reverse().slice(1).find(p => metrics.some(m => p[m.key] != null))
    : null;

  // Filter points that have at least one metric from this tab
  const chartData = points.filter(p => metrics.some(m => p[m.key] != null));

  // Y domain per-tab
  const allValues = chartData.flatMap(p => metrics.map(m => p[m.key] as number | null).filter((v): v is number => v != null));
  const yMin = allValues.length ? Math.floor(Math.min(...allValues) * 0.95) : 0;
  const yMax = allValues.length ? Math.ceil(Math.max(...allValues)  * 1.05) : 100;

  const toggleMetric = (label: string) => {
    setHidden(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label); else next.add(label);
      return next;
    });
  };

  const hasData = chartData.length > 0;

  return (
    <div className="glass rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <div className="flex items-center gap-2">
          <IconChartLine size={16} stroke={1.5} style={{ color: "var(--text-muted)" }} />
          <h3 className="text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>
            Composition corporelle
          </h3>
        </div>
        {/* Range selector */}
        <div className="flex gap-1">
          {RANGES.map(r => (
            <button key={r.days} onClick={() => setDays(r.days)}
              className="px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all"
              style={{
                background: days === r.days ? "rgba(167,139,250,0.15)" : "transparent",
                color:      days === r.days ? "var(--protein)"          : "var(--text-muted)",
                border:     days === r.days ? "1px solid rgba(167,139,250,0.4)" : "1px solid transparent",
              }}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab bar */}
      <div className="px-4 pb-3">
        <div className="flex gap-1 p-1 rounded-xl"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)" }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => { setTab(t.id); setHidden(new Set()); }}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-medium transition-all"
              style={{
                background: tab === t.id ? "rgba(167,139,250,0.15)" : "transparent",
                color:      tab === t.id ? "var(--protein)"          : "var(--text-muted)",
                border:     tab === t.id ? "1px solid rgba(167,139,250,0.3)" : "1px solid transparent",
              }}>
              <span>{t.emoji}</span>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center items-center py-12">
          <IconLoader2 size={18} stroke={2} className="animate-spin" style={{ color: "var(--text-muted)" }} />
        </div>
      )}

      {!loading && !hasData && (
        <div className="flex flex-col items-center gap-2 py-10 px-4 text-center">
          <span className="text-3xl">📊</span>
          <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>
            {tab === "sommeil"
              ? "Aucune donnée de sommeil disponible"
              : tab === "vitaux"
                ? "Aucun signal vital disponible"
                : false
                  ? "Aucune donnée avancée (hydratation, os, viscérale)"
                  : "Aucune donnée de composition corporelle"}
          </p>
          <p className="text-[11px]" style={{ color: "var(--text-muted)", opacity: 0.7 }}>
            {tab === "sommeil"
              ? "Synchronisez Withings ou entrez le sommeil manuellement"
              : tab === "vitaux"
                ? "SpO₂ requiert ScanWatch · TA requiert Withings BPM"
                : false
                  ? "Requiert une balance connectée Withings (Body+/Body Scan)"
                  : "Synchronisez votre balance Withings dans Réglages"}
          </p>
        </div>
      )}

      {!loading && hasData && (
        <>
          {/* Mini stats row */}
          <div className="px-4 pb-3 flex gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            {metrics.map(m => {
              const val  = latest?.[m.key] as number | null ?? null;
              const prev = previous?.[m.key] as number | null ?? null;
              const trend = val != null && prev != null ? val - prev : null;
              return <MiniStat key={m.key} label={m.label} value={val} unit={m.unit} color={m.color} trend={trend} />;
            })}
          </div>

          {/* Metric toggles */}
          <div className="px-4 pb-2 flex flex-wrap gap-1.5">
            {metrics.map(m => {
              const isHidden = hidden.has(m.label);
              return (
                <button key={m.label} onClick={() => toggleMetric(m.label)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all"
                  style={{
                    background: isHidden ? "rgba(255,255,255,0.03)" : `${m.color}18`,
                    border: `1px solid ${isHidden ? "var(--border)" : `${m.color}55`}`,
                    color: isHidden ? "var(--text-muted)" : m.color,
                    opacity: isHidden ? 0.5 : 1,
                  }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: isHidden ? "var(--text-muted)" : m.color }} />
                  {m.label}
                </button>
              );
            })}
          </div>

          {/* Chart */}
          <motion.div
            key={`${tab}-${days}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className="px-1 pb-4"
            style={{ height: 220 }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 9, fill: "var(--text-muted)" }}
                  tickFormatter={d => format(parseISO(d), "d MMM", { locale: fr })}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  domain={[yMin, yMax]}
                  tick={{ fontSize: 9, fill: "var(--text-muted)" }}
                  tickLine={false}
                  axisLine={false}
                  width={36}
                />
                <Tooltip content={<CustomTooltip metrics={metrics} />} />

                {/* Reference lines */}
                {tab === "sommeil" && <ReferenceLine y={7}   stroke="rgba(99,102,241,0.3)"  strokeDasharray="4 4" />}
                {tab === "vitaux"  && <ReferenceLine y={95}  stroke="rgba(6,182,212,0.25)"  strokeDasharray="4 4" />}
                {tab === "vitaux"  && <ReferenceLine y={120} stroke="rgba(244,63,94,0.2)"   strokeDasharray="4 4" />}
                {tab === "vitaux"  && <ReferenceLine y={80}  stroke="rgba(251,113,133,0.2)" strokeDasharray="4 4" />}
                {false  && <ReferenceLine y={13}  stroke="rgba(251,146,60,0.25)" strokeDasharray="4 4" label={{ value: "VF seuil", fill: "rgba(251,146,60,0.5)", fontSize: 9, position: "insideTopRight" }} />}

                {metrics.map(m => (
                  <Line
                    key={m.key}
                    dataKey={m.key as string}
                    name={m.label}
                    stroke={m.color}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 0 }}
                    connectNulls
                    hide={hidden.has(m.label)}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Legend note + source badges */}
          {tab === "sommeil" && (
            <div className="flex items-center justify-center gap-3 pb-3">
              <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>— 7h recommandées</p>
              {/* Show which sources are used */}
              {(() => {
                const sources = new Set(chartData.map(p => p.sleepSource).filter(Boolean));
                const SOURCE_LABEL: Record<string, string> = {
                  withings:    "🛏 Withings",
                  applehealth: "🍎 Apple",
                  googlefit:   "💚 Google Fit",
                  manual:      "✏️ Manuel",
                };
                return Array.from(sources).map(s => s && (
                  <span key={s} className="text-[9px] px-1.5 py-0.5 rounded-full"
                    style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
                    {SOURCE_LABEL[s] ?? s}
                  </span>
                ));
              })()}
            </div>
          )}
          {tab === "vitaux" && (() => {
            const bpPoints = [...points]
              .filter(p => p.systolicBP != null && p.diastolicBP != null)
              .reverse(); // most recent first
            return (
              <div className="px-4 pb-1">
                {/* Legend row */}
                <div className="flex items-center justify-center flex-wrap gap-2 pb-2">
                  <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>— SpO₂ 95% · TA 120/80 mmHg</p>
                </div>

                {/* Collapsible BP list */}
                {bpPoints.length > 0 && (
                  <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                    {/* Header / toggle */}
                    <button
                      onClick={() => setBpListOpen(o => !o)}
                      className="w-full flex items-center justify-between px-3 py-2.5 transition-colors"
                      style={{ background: "rgba(244,63,94,0.05)" }}>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold" style={{ color: "#f43f5e" }}>
                          ❤️ Historique tensions
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full tabular-nums"
                          style={{ background: "rgba(244,63,94,0.12)", color: "#f43f5e" }}>
                          {bpPoints.length} mesures
                        </span>
                      </div>
                      <motion.div animate={{ rotate: bpListOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                        <IconChevronDown size={14} style={{ color: "#f43f5e" }} />
                      </motion.div>
                    </button>

                    {/* Expandable list */}
                    <AnimatePresence initial={false}>
                      {bpListOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                          style={{ overflow: "hidden" }}>
                          <div style={{ maxHeight: 280, overflowY: "auto", scrollbarWidth: "none" }}>
                            {bpPoints.map((p, i) => {
                              const cls = bpClass(p.systolicBP!, p.diastolicBP!);
                              return (
                                <div key={p.date}
                                  className="flex items-center gap-3 px-3 py-2"
                                  style={{ borderTop: i === 0 ? "1px solid var(--border)" : "1px solid rgba(255,255,255,0.03)", background: i % 2 === 0 ? "rgba(255,255,255,0.01)" : "transparent" }}>
                                  {/* Date */}
                                  <span className="text-[10px] w-[52px] flex-shrink-0 tabular-nums" style={{ color: "var(--text-muted)" }}>
                                    {format(parseISO(p.date), "dd MMM", { locale: fr })}
                                  </span>
                                  {/* Values */}
                                  <span className="text-[13px] font-bold tabular-nums flex-1" style={{ color: cls.color }}>
                                    {p.systolicBP}
                                    <span className="text-[10px] font-normal mx-0.5" style={{ color: "var(--text-muted)" }}>/</span>
                                    {p.diastolicBP}
                                    <span className="text-[9px] font-normal ml-1" style={{ color: "var(--text-muted)" }}>mmHg</span>
                                  </span>
                                  {/* Classification badge */}
                                  <span className="text-[9px] px-2 py-0.5 rounded-full flex-shrink-0 font-medium"
                                    style={{ background: cls.bg, color: cls.color, border: `1px solid ${cls.color}33` }}>
                                    {cls.label}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            );
          })()}
          {false && (
            <div className="flex items-center justify-center flex-wrap gap-2 pb-3 px-4">
              <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>— Graisse viscérale : seuil 13</p>
              <span className="text-[9px] px-1.5 py-0.5 rounded-full"
                style={{ background: "rgba(34,211,238,0.06)", color: "#22d3ee", border: "1px solid rgba(34,211,238,0.2)" }}>
                Body Scan Withings
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
