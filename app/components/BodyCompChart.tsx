"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { IconLoader2, IconChartLine, IconChevronDown, IconInfoCircle } from "@tabler/icons-react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine,
} from "recharts";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import type { BodyCompPoint } from "@/app/api/withings-body/route";
import type { Gender } from "@/app/lib/types";
import type { MeasurementEntry } from "@/app/api/measurements/route";
import type { LipidReading } from "@/app/lib/blood-doctor-source";

// ─── Config ──────────────────────────────────────────────────────────────────

type Tab = "composition" | "vitaux" | "sommeil" | "visceral";

interface MetricDef {
  key:    keyof BodyCompPoint;
  label:  string;
  unit:   string;
  color:  string;
  decimals?: number;
}

// ─── Visceral Fat Estimation ─────────────────────────────────────────────────

interface VisceralsEstimate {
  vai: number | null;
  wc: number | null;
  tg: number | null;
  hdl: number | null;
  imc: number | null;
  wcMeasured: boolean;
  tgMeasured: boolean;
  hdlMeasured: boolean;
}

interface RealVisceralInputs {
  wc?:  number | null; // tour de taille reel (mensurations), en cm
  tg?:  number | null; // triglycerides reels (Blood Doctor), en mg/dL
  hdl?: number | null; // HDL reel (Blood Doctor), en mg/dL
}

/** Dernier tour de taille connu (mensurations) a une date donnee ou avant — les mensurations
 *  sont saisies au mois, donc on prend la plus recente entree <= au mois du point. */
function waistCmForDate(date: string, history: { month: string; waistCm: number | null }[]): number | null {
  const month = date.slice(0, 7);
  let best: number | null = null;
  for (const h of history) {
    if (h.waistCm != null && h.month <= month) best = h.waistCm;
  }
  return best;
}

/** Derniers TG/HDL connus (Blood Doctor) a une date donnee ou avant — `history` doit etre trie par date croissante. */
function lipidsForDate(date: string, history: LipidReading[]): { tg: number | null; hdl: number | null } {
  let tg: number | null = null, hdl: number | null = null;
  for (const r of history) {
    if (r.date > date) break;
    if (r.tgMgDl != null)  tg  = r.tgMgDl;
    if (r.hdlMgDl != null) hdl = r.hdlMgDl;
  }
  return { tg, hdl };
}

function estimateWaistCircumference(
  imb: number,
  bodyFatPct: number,
  age: number,
  gender: Gender | undefined
): number {
  // Simple regression-based estimation WC from IMC + %fat + age + sex
  if (gender === "male") {
    return Math.round((70 + 1.5 * imb + 0.2 * bodyFatPct + 0.05 * age) * 10) / 10;
  } else {
    return Math.round((65 + 1.2 * imb + 0.15 * bodyFatPct + 0.03 * age) * 10) / 10;
  }
}

function estimateTriglycerides(
  bodyFatPct: number,
  age: number,
  gender: Gender | undefined
): number {
  // Estimate TG (mg/dL) from body fat % + age + sex
  if (gender === "male") {
    return Math.round(50 + 2 * bodyFatPct + 0.05 * age);
  } else {
    return Math.round(40 + 1.5 * bodyFatPct + 0.03 * age);
  }
}

function estimateHDL(bodyFatPct: number, gender: Gender | undefined): number {
  // Estimate HDL (mg/dL) from body fat % — inverse correlation
  if (gender === "male") {
    return Math.round(60 - 0.3 * bodyFatPct);
  } else {
    return Math.round(70 - 0.2 * bodyFatPct);
  }
}

function calculateVAI(
  wc: number,
  imc: number,
  tg: number,
  hdl: number,
  gender: Gender | undefined
): number {
  // VAI formula (Amato et al., 2010) — adapted for mg/dL units
  const genderCoef = gender === "male" ? { wc: 39.68, bmiFactor: 1.88, tgDiv: 1.03, hdlMult: 1.31 } :
                                          { wc: 36.58, bmiFactor: 1.89, tgDiv: 0.81, hdlMult: 1.52 };

  const numerator = (wc / (genderCoef.wc + genderCoef.bmiFactor * imc)) * (tg / genderCoef.tgDiv) * (genderCoef.hdlMult / hdl);
  return Math.round(numerator * 100) / 100;
}

function calculateVisceralsForPoint(
  point: BodyCompPoint,
  userAge: number | undefined,
  userGender: Gender | undefined,
  userHeightCm: number | undefined,
  userCurrentWeightKg: number | undefined,
  real?: RealVisceralInputs
): VisceralsEstimate {
  if (!point.bodyFatPct || !userHeightCm || !userCurrentWeightKg || !userGender) {
    return { vai: null, wc: null, tg: null, hdl: null, imc: null, wcMeasured: false, tgMeasured: false, hdlMeasured: false };
  }

  const heightM = userHeightCm / 100;
  const imc = Math.round((userCurrentWeightKg / (heightM * heightM)) * 10) / 10;

  const wcMeasured  = real?.wc  != null;
  const tgMeasured  = real?.tg  != null;
  const hdlMeasured = real?.hdl != null;

  const wc  = real?.wc  ?? estimateWaistCircumference(imc, point.bodyFatPct, userAge ?? 40, userGender);
  const tg  = real?.tg  ?? estimateTriglycerides(point.bodyFatPct, userAge ?? 40, userGender);
  const hdl = real?.hdl ?? estimateHDL(point.bodyFatPct, userGender);
  const vai = calculateVAI(wc, imc, tg, hdl, userGender);

  return { vai, wc, tg, hdl, imc, wcMeasured, tgMeasured, hdlMeasured };
}

const TABS: { id: Tab; label: string; emoji: string; metrics?: MetricDef[] }[] = [
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
      { key: "restingHR",   label: "FC repos",     unit: "bpm", color: "#ec4899" },
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
  {
    id:    "visceral",
    label: "Viscéral",
    emoji: "🫀",
    metrics: [], // Custom display, no standard metrics
  },
];

const RANGES = [
  { label: "30j",  days: 30  },
  { label: "90j",  days: 90  },
  { label: "180j", days: 180 },
];

// ─── Moving average (trend curve) ──────────────────────────────────────────
// Composition/vitaux measurements are noisy day-to-day (hydration, time of
// day, device). Raw points stay visible as dots but the eye should follow
// the smoothed trend, not the jitter — same idea as METRIC_MIN_SPAN above.

function movingAverage(data: BodyCompPoint[], key: keyof BodyCompPoint, window: number): (number | null)[] {
  const values = data.map(p => (p[key] as number | null | undefined) ?? null);
  return values.map((_, i) => {
    const lo = Math.max(0, i - Math.floor(window / 2));
    const hi = Math.min(values.length - 1, i + Math.floor(window / 2));
    const slice = values.slice(lo, hi + 1).filter((v): v is number => v != null);
    return slice.length ? Math.round((slice.reduce((a, b) => a + b, 0) / slice.length) * 100) / 100 : null;
  });
}

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
        const def = metrics.find(m => m.label === p.name.replace(/ \(moy\.\)$/, ""));
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

interface BodyCompChartProps {
  userAge?: number;
  userGender?: Gender;
  userHeightCm?: number;
  userCurrentWeightKg?: number;
}

export default function BodyCompChart({
  userAge,
  userGender,
  userHeightCm,
  userCurrentWeightKg,
}: BodyCompChartProps) {
  const [tab,        setTab]       = useState<Tab>("composition");
  const [days,       setDays]      = useState(90);
  const [points,     setPoints]    = useState<BodyCompPoint[]>([]);
  const [loading,    setLoading]   = useState(false);
  const [hidden,     setHidden]    = useState<Set<string>>(new Set());
  const [bpListOpen, setBpListOpen] = useState(false);
  const [waistHistory, setWaistHistory] = useState<{ month: string; waistCm: number | null }[]>([]);
  const [lipidHistory, setLipidHistory] = useState<LipidReading[]>([]);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/withings-body?days=${days}`)
      .then(r => r.json())
      .then((d: { points: BodyCompPoint[] }) => setPoints(d.points ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [days]);

  // Valeurs reelles pour le VAI — independantes de `days` (mesures ponctuelles, pas
  // des donnees quotidiennes) : chargees une seule fois, appliquees a chaque point
  // via waistCmForDate/lipidsForDate ("derniere valeur connue a cette date ou avant").
  useEffect(() => {
    fetch("/api/measurements?months=24")
      .then(r => r.json())
      .then((d: { entries?: MeasurementEntry[] }) => {
        setWaistHistory((d.entries ?? []).map(e => ({ month: e.month, waistCm: e.waistCm })));
      })
      .catch(() => {});
    fetch("/api/blood-doctor/lipids")
      .then(r => r.json())
      .then((d: { readings?: LipidReading[] }) => setLipidHistory(d.readings ?? []))
      .catch(() => {});
  }, []);

  const currentTab = TABS.find(t => t.id === tab)!;
  const metrics    = currentTab.metrics ?? [];

  // Latest + previous values for stats
  const latest   = [...points].reverse().find(p => metrics.length === 0 || metrics.some(m => p[m.key] != null));
  const previous = latest
    ? [...points].reverse().slice(1).find(p => metrics.length === 0 || metrics.some(m => p[m.key] != null))
    : null;

  // Filter points that have at least one metric from this tab (or tab is visceral)
  const chartData = tab === "visceral"
    ? points.filter(p => p.bodyFatPct != null && (p.systolicBP != null || p.diastolicBP != null))
    : points.filter(p => metrics.some(m => p[m.key] != null));

  // Trend curve (moving average) — Composition/Vitaux only, per explicit request:
  // the smoothed curve should read as the primary trend, raw points stay visible
  // but muted (see the Line pairs rendered per metric below).
  const showAverage = tab === "composition" || tab === "vitaux";
  const avgWindow = chartData.length >= 20 ? 7 : chartData.length >= 10 ? 5 : 3;
  const chartDataWithAvg = showAverage
    ? (() => {
        const avgByKey = new Map(metrics.map(m => [m.key as string, movingAverage(chartData, m.key, avgWindow)]));
        return chartData.map((p, i) => {
          const out: Record<string, unknown> = { ...p };
          metrics.forEach(m => { out[`${String(m.key)}Avg`] = avgByKey.get(m.key as string)![i]; });
          return out;
        });
      })()
    : chartData;

  // Y domain per-tab
  const allValues = chartData.flatMap(p => metrics.map(m => p[m.key] as number | null).filter((v): v is number => v != null));
  const yMin = allValues.length ? Math.floor(Math.min(...allValues) * 0.95) : 0;
  const yMax = allValues.length ? Math.ceil(Math.max(...allValues)  * 1.05) : 100;

  // Realistic minimum span per metric — body composition changes slowly, and Withings'
  // bioimpedance body-fat% reading in particular is noisy day-to-day (hydration, time of
  // day) with no real underlying change. Padding tightly around the raw min/max (as before)
  // turned that measurement noise into what looked like dramatic swings. These floors keep
  // the chart honest: real trends still show fully, but normal noise doesn't dominate.
  const METRIC_MIN_SPAN: Partial<Record<keyof BodyCompPoint, number>> = {
    bodyFatPct:   6,   // percentage points
    muscleMassKg: 4,   // kg
    fatMassKg:    4,   // kg
    restingHR:    20,  // bpm
  };

  // Per-metric domain — used on tabs (e.g. Composition) that mix metrics with very
  // different natural scales (body fat % vs muscle/fat mass in kg) on the same
  // chart: sharing one axis would flatten the smaller-range metric's real variation.
  const getMetricDomain = (key: keyof BodyCompPoint): [number, number] => {
    const values = chartData.map(p => p[key] as number | null).filter((v): v is number => v != null);
    if (!values.length) return [0, 100];
    const min = Math.min(...values), max = Math.max(...values);
    const dataSpan = max - min;
    const minSpan  = METRIC_MIN_SPAN[key] ?? Math.max(2, Math.abs((min + max) / 2) * 0.1);
    const span     = Math.max(dataSpan, minSpan);
    const center   = (min + max) / 2;
    const pad      = span * 0.1;
    return [Math.floor((center - span / 2 - pad) * 10) / 10, Math.ceil((center + span / 2 + pad) * 10) / 10];
  };

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
                : "Aucune donnée de composition corporelle"}
          </p>
          <p className="text-[11px]" style={{ color: "var(--text-muted)", opacity: 0.7 }}>
            {tab === "sommeil"
              ? "Synchronisez Withings ou entrez le sommeil manuellement"
              : tab === "vitaux"
                ? "SpO₂ requiert ScanWatch · TA requiert Withings BPM"
                : "Synchronisez votre balance Withings dans Réglages"}
          </p>
        </div>
      )}

      {!loading && hasData && (
        <>
          {/* Viscéral tab — chart + stats */}
          {tab === "visceral" && (() => {
            if (!userGender || !userHeightCm || !userCurrentWeightKg) {
              return (
                <div className="flex flex-col items-center gap-2 py-10 px-4 text-center">
                  <span className="text-3xl">🫀</span>
                  <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>
                    Veuillez compléter votre profil (âge, sexe, taille, poids) dans les réglages
                  </p>
                </div>
              );
            }

            // Enrich all points with VAI — WC/TG/HDL reels (mensurations + Blood Doctor)
            // quand disponibles a la date du point, sinon estimation a partir du % de graisse.
            const visceralsData = chartData.map(p => {
              const wc = waistCmForDate(p.date, waistHistory);
              const { tg, hdl } = lipidsForDate(p.date, lipidHistory);
              const v = calculateVisceralsForPoint(p, userAge, userGender, userHeightCm, userCurrentWeightKg, { wc, tg, hdl });
              return { ...p, estimatedVAI: v.vai };
            }).filter(p => p.estimatedVAI != null);

            if (visceralsData.length === 0) {
              return (
                <div className="flex flex-col items-center gap-2 py-10 px-4 text-center">
                  <span className="text-3xl">🫀</span>
                  <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>
                    Données de composition corporelle manquantes
                  </p>
                </div>
              );
            }

            // Latest VAI and previous
            const latestV = visceralsData[visceralsData.length - 1];
            const previousV = visceralsData.length > 1 ? visceralsData[visceralsData.length - 2] : null;
            const vaiTrend = latestV.estimatedVAI && previousV?.estimatedVAI
              ? latestV.estimatedVAI - previousV.estimatedVAI
              : null;

            const vaiStatus = latestV.estimatedVAI
              ? latestV.estimatedVAI < 1.0 ? { label: "Faible risque", color: "#34d399", bg: "rgba(52,211,153,0.08)" }
              : latestV.estimatedVAI < 1.5 ? { label: "Risque modéré", color: "#fbbf24", bg: "rgba(251,191,36,0.08)" }
              : latestV.estimatedVAI < 2.0 ? { label: "Risque élevé", color: "#fb923c", bg: "rgba(251,146,60,0.08)" }
              :             { label: "Risque très élevé", color: "#ef4444", bg: "rgba(239,68,68,0.1)" }
              : null;

            const latestWc = waistCmForDate(latestV.date, waistHistory);
            const latestLipids = lipidsForDate(latestV.date, lipidHistory);
            const latestCalc = calculateVisceralsForPoint(
              latestV, userAge, userGender, userHeightCm, userCurrentWeightKg,
              { wc: latestWc, tg: latestLipids.tg, hdl: latestLipids.hdl }
            );
            const allMeasured = latestCalc.wcMeasured && latestCalc.tgMeasured && latestCalc.hdlMeasured;
            const someMeasured = latestCalc.wcMeasured || latestCalc.tgMeasured || latestCalc.hdlMeasured;

            return (
              <>
                {/* Mini stat row */}
                <div className="px-4 pb-3 flex gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
                  {/* VAI stat */}
                  <div className="flex flex-col gap-0.5 p-2.5 rounded-xl flex-1"
                    style={{ background: vaiStatus?.bg, border: `1px solid ${vaiStatus?.color}33` }}>
                    <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>VAI (estimé)</span>
                    <div className="flex items-baseline gap-0.5">
                      <span className="text-[18px] font-bold tabular-nums" style={{ color: vaiStatus?.color }}>
                        {latestV.estimatedVAI?.toFixed(2)}
                      </span>
                    </div>
                    {vaiTrend != null && (
                      <span className="text-[9px] tabular-nums" style={{ color: vaiTrend >= 0 ? "#f87171" : "#34d399" }}>
                        {vaiTrend >= 0 ? "▲" : "▼"} {Math.abs(vaiTrend).toFixed(2)}
                      </span>
                    )}
                  </div>

                  {/* Detail metrics */}
                  <div className="flex flex-col gap-0.5 p-2.5 rounded-xl flex-1" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
                    <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                      WC (cm) {latestCalc.wcMeasured && <span style={{ color: "#34d399" }}>· mesuré</span>}
                    </span>
                    <span className="text-[18px] font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>
                      {latestCalc.wc?.toFixed(1)}
                    </span>
                  </div>

                  <div className="flex flex-col gap-0.5 p-2.5 rounded-xl flex-1" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
                    <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                      TG (mg/dL) {latestCalc.tgMeasured && <span style={{ color: "#34d399" }}>· mesuré</span>}
                    </span>
                    <span className="text-[18px] font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>
                      {latestCalc.tg}
                    </span>
                  </div>

                  <div className="flex flex-col gap-0.5 p-2.5 rounded-xl flex-1" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
                    <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                      HDL (mg/dL) {latestCalc.hdlMeasured && <span style={{ color: "#34d399" }}>· mesuré</span>}
                    </span>
                    <span className="text-[18px] font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>
                      {latestCalc.hdl}
                    </span>
                  </div>
                </div>

                {/* Legend */}
                <div className="px-4 pb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                      {allMeasured
                        ? "✅ Basé sur vos mesures réelles"
                        : someMeasured
                          ? "⚠️ PARTIELLEMENT ESTIMÉ — certaines valeurs mesurées, d'autres estimées"
                          : "⚠️ ESTIMATION"} · Normal VAI &lt; 1.0 · Risque &gt; 1.5
                    </span>
                  </div>
                </div>

                {/* Chart */}
                <motion.div
                  key={`visceral-${days}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                  className="px-1 pb-4"
                  style={{ height: 220 }}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={visceralsData} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
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
                        domain={[0.5, 2.5]}
                        tick={{ fontSize: 9, fill: "var(--text-muted)" }}
                        tickLine={false}
                        axisLine={false}
                        width={36}
                      />
                      <Tooltip content={<CustomTooltip metrics={[{ key: "estimatedVAI" as keyof BodyCompPoint, label: "VAI", unit: "", color: "#8b5cf6" }]} />} />
                      <ReferenceLine y={1.0} stroke="rgba(52,211,153,0.3)" strokeDasharray="4 4" />
                      <ReferenceLine y={1.5} stroke="rgba(251,146,60,0.3)" strokeDasharray="4 4" />
                      <Line
                        type="monotone"
                        yAxisId="left"
                        dataKey="estimatedVAI"
                        name="VAI"
                        stroke="#8b5cf6"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4, strokeWidth: 0 }}
                        connectNulls
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </motion.div>

                {/* Info card */}
                <div className="px-4 pb-4">
                  <div className="rounded-xl p-3" style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.3)" }}>
                    <div className="text-[11px] space-y-1" style={{ color: "var(--text-primary)" }}>
                      <p>
                        <strong>Formule VAI :</strong> [WC/(39.68+1.88×IMC)] × (TG/1.03) × (1.31/HDL)
                      </p>
                      <p style={{ color: "var(--text-muted)", fontSize: "10px" }}>
                        WC = tour de taille (mesuré via Mensurations si disponible, sinon estimé) ·
                        TG/HDL = mesurés via Blood Doctor si une analyse existe, sinon estimés à partir du % de graisse
                      </p>
                    </div>
                  </div>
                </div>
              </>
            );
          })()}

          {tab !== "visceral" && (
            <>
              {/* Mini stats row */}
              <div className="px-4 pb-3 flex gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
                {/* Combined BP stat — Vitaux tab only */}
                {tab === "vitaux" && (() => {
              const latestBP = [...points].reverse().find(p => p.systolicBP != null && p.diastolicBP != null);
              if (!latestBP) return null;
              const cls = bpClass(latestBP.systolicBP!, latestBP.diastolicBP!);
              return (
                <div className="flex flex-col gap-0.5 p-2.5 rounded-xl flex-shrink-0"
                  style={{ background: cls.bg, border: `1px solid ${cls.color}33`, minWidth: 96 }}>
                  <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>Tension</span>
                  <div className="flex items-baseline gap-0.5">
                    <span className="text-[18px] font-bold tabular-nums" style={{ color: cls.color }}>
                      {latestBP.systolicBP}
                    </span>
                    <span className="text-[12px] font-normal" style={{ color: "rgba(255,255,255,0.3)" }}>/</span>
                    <span className="text-[18px] font-bold tabular-nums" style={{ color: cls.color }}>
                      {latestBP.diastolicBP}
                    </span>
                    <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>mmHg</span>
                  </div>
                  <span className="text-[9px] font-medium" style={{ color: cls.color }}>{cls.label}</span>
                </div>
              );
            })()}
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
              <LineChart data={chartDataWithAvg as BodyCompPoint[]} margin={{ top: 8, right: tab === "vitaux" ? 36 : 12, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 9, fill: "var(--text-muted)" }}
                  tickFormatter={d => format(parseISO(d), "d MMM", { locale: fr })}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                {/* Left Y — FC repos (bpm) on Vitaux, or shared scale elsewhere */}
                <YAxis
                  yAxisId="left"
                  domain={tab === "vitaux" ? getMetricDomain("restingHR") : (tab === "composition" ? [0, 100] : [yMin, yMax])}
                  hide={tab === "composition"}
                  tick={{ fontSize: 9, fill: "var(--text-muted)" }}
                  tickLine={false}
                  axisLine={false}
                  width={36}
                />
                {/* Composition tab: one hidden axis per metric — bodyFatPct(%) and
                    muscleMassKg/fatMassKg(kg) have very different natural ranges,
                    sharing one axis flattens whichever has the smaller range */}
                {tab === "composition" && metrics.map(m => (
                  <YAxis key={`axis-${m.key}`} yAxisId={m.key as string} hide domain={getMetricDomain(m.key)} />
                ))}
                {/* Right Y — BP axis, zoomed to the actual readings instead of a fixed 50–200 span */}
                {tab === "vitaux" && (
                  <YAxis
                    yAxisId="bp"
                    orientation="right"
                    domain={(() => {
                      const bpValues = chartData.flatMap(p =>
                        [p.systolicBP, p.diastolicBP].filter((v): v is number => v != null)
                      );
                      if (!bpValues.length) return [50, 200] as [number, number];
                      const min = Math.min(...bpValues), max = Math.max(...bpValues);
                      const pad = Math.max(4, (max - min) * 0.15);
                      return [Math.floor(min - pad), Math.ceil(max + pad)] as [number, number];
                    })()}
                    tick={{ fontSize: 9, fill: "rgba(244,63,94,0.5)" }}
                    tickLine={false}
                    axisLine={false}
                    width={30}
                    tickFormatter={v => `${v}`}
                  />
                )}
                <Tooltip content={<CustomTooltip metrics={metrics} />} />

                {/* Reference lines */}
                {tab === "sommeil" && <ReferenceLine yAxisId="left" y={7}   stroke="rgba(99,102,241,0.3)"  strokeDasharray="4 4" />}
                {tab === "vitaux"  && <ReferenceLine yAxisId="bp"   y={120} stroke="rgba(244,63,94,0.2)"   strokeDasharray="4 4" />}
                {tab === "vitaux"  && <ReferenceLine yAxisId="bp"   y={80}  stroke="rgba(251,113,133,0.2)" strokeDasharray="4 4" />}

                {metrics.flatMap(m => {
                  const isBP = m.key === "systolicBP" || m.key === "diastolicBP";
                  const yAxisId = isBP ? "bp" : (tab === "composition" ? (m.key as string) : "left");
                  const lines = [
                    // Raw readings — muted, points only once a trend curve carries the eye.
                    <Line
                      key={`${m.key}-raw`}
                      type={isBP ? "linear" : "monotone"}
                      yAxisId={yAxisId}
                      dataKey={m.key as string}
                      name={m.label}
                      stroke={showAverage ? "none" : m.color}
                      strokeWidth={2}
                      dot={{ r: isBP ? 3 : 2.5, fill: m.color, stroke: "var(--bg)", strokeWidth: 1, fillOpacity: showAverage ? 0.5 : 1 }}
                      activeDot={{ r: 4.5, strokeWidth: 0 }}
                      connectNulls
                      hide={hidden.has(m.label)}
                    />,
                  ];
                  if (showAverage) {
                    lines.push(
                      <Line
                        key={`${m.key}-avg`}
                        type="monotone"
                        yAxisId={yAxisId}
                        dataKey={`${String(m.key)}Avg`}
                        name={`${m.label} (moy.)`}
                        stroke={m.color}
                        strokeWidth={2.75}
                        dot={false}
                        activeDot={{ r: 5, strokeWidth: 0 }}
                        connectNulls
                        hide={hidden.has(m.label)}
                      />
                    );
                  }
                  return lines;
                })}
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
                  <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>— TA 120/80 mmHg</p>
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
            </>
          )}
        </>
      )}
    </div>
  );
}
