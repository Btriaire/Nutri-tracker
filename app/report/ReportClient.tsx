"use client";

import { useState, useRef, useEffect } from "react";
import { format, subDays, subMonths, subYears, startOfYear } from "date-fns";
import { fr } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import {
  FilePdf, Spinner, CalendarBlank, User, ChartBar,
  Heart, Barbell, Leaf, Drop, Footprints, Moon, Fire,
  ArrowDown, ArrowUp, Minus, Warning,
} from "@phosphor-icons/react";
import type { ReportData, DayNutrition, DayActivity } from "@/app/api/report/route";

// ─── Tiny SVG bar chart ───────────────────────────────────────────────────────

function MiniBarChart({
  data, color, height = 48, maxOverride,
}: {
  data: { val: number | null; label: string }[];
  color: string;
  height?: number;
  maxOverride?: number;
}) {
  const vals  = data.map(d => d.val ?? 0);
  const maxV  = maxOverride ?? Math.max(...vals, 1);
  const W     = 100;
  const H     = height;
  const barW  = Math.max(1, W / data.length - 1);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="none" style={{ display: "block" }}>
      {data.map((d, i) => {
        const h = d.val ? Math.max(2, (d.val / maxV) * H) : 0;
        const x = i * (W / data.length);
        return (
          <rect
            key={i}
            x={x + 0.5}
            y={H - h}
            width={Math.max(barW - 0.5, 0.5)}
            height={h}
            fill={d.val ? color : "transparent"}
            rx={1}
          />
        );
      })}
    </svg>
  );
}

// ─── Macro donut ──────────────────────────────────────────────────────────────

function MacroDonut({ p, c, f }: { p: number; c: number; f: number }) {
  const total = p + c + f || 1;
  const pPct  = p / total;
  const cPct  = c / total;
  const fPct  = f / total;

  const R = 28;
  const cx = 36;
  const cy = 36;
  const circumference = 2 * Math.PI * R;

  const segments = [
    { pct: pPct, color: "#a78bfa", label: "P" },
    { pct: cPct, color: "#fbbf24", label: "G" },
    { pct: fPct, color: "#60a5fa", label: "L" },
  ];

  let offset = 0;
  return (
    <svg viewBox="0 0 72 72" width="72" height="72">
      {segments.map(({ pct, color, label }) => {
        const dash   = pct * circumference;
        const gap    = circumference - dash;
        const rotate = offset * 360 - 90;
        offset      += pct;
        return (
          <circle
            key={label}
            cx={cx} cy={cy} r={R}
            fill="none"
            stroke={color}
            strokeWidth={8}
            strokeDasharray={`${dash} ${gap}`}
            transform={`rotate(${rotate} ${cx} ${cy})`}
          />
        );
      })}
      <circle cx={cx} cy={cy} r={20} fill="transparent" />
    </svg>
  );
}

// ─── Goal ring ────────────────────────────────────────────────────────────────

function GoalRing({ pct, color, size = 44 }: { pct: number; color: string; size?: number }) {
  const R   = size / 2 - 5;
  const c   = 2 * Math.PI * R;
  const p   = Math.min(pct / 100, 1);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="flex-shrink-0">
      <circle cx={size / 2} cy={size / 2} r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={4} />
      <circle
        cx={size / 2} cy={size / 2} r={R}
        fill="none"
        stroke={color}
        strokeWidth={4}
        strokeDasharray={`${p * c} ${c}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}

// ─── Score badge ─────────────────────────────────────────────────────────────

function score(pct: number) {
  if (pct >= 90) return { label: "Excellent", color: "#34d399", bg: "rgba(52,211,153,0.12)", border: "rgba(52,211,153,0.3)" };
  if (pct >= 70) return { label: "Bon",        color: "#60a5fa", bg: "rgba(96,165,250,0.12)", border: "rgba(96,165,250,0.3)" };
  if (pct >= 50) return { label: "Passable",   color: "#fbbf24", bg: "rgba(251,191,36,0.12)", border: "rgba(251,191,36,0.3)" };
  return               { label: "À améliorer", color: "#f87171", bg: "rgba(248,113,113,0.12)", border: "rgba(248,113,113,0.3)" };
}

// ─── Period presets ───────────────────────────────────────────────────────────

const today = format(new Date(), "yyyy-MM-dd");
const PRESETS = [
  { label: "7 jours",    from: format(subDays(new Date(), 6), "yyyy-MM-dd"),    to: today },
  { label: "30 jours",   from: format(subDays(new Date(), 29), "yyyy-MM-dd"),   to: today },
  { label: "3 mois",     from: format(subMonths(new Date(), 3), "yyyy-MM-dd"),  to: today },
  { label: "6 mois",     from: format(subMonths(new Date(), 6), "yyyy-MM-dd"),  to: today },
  { label: "Cette année",from: format(startOfYear(new Date()), "yyyy-MM-dd"),   to: today },
  { label: "1 an",       from: format(subYears(new Date(), 1), "yyyy-MM-dd"),   to: today },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(d: string) {
  return format(new Date(d + "T12:00:00"), "d MMM yyyy", { locale: fr });
}
function fmtN(n: number | null, unit = "", dec = 0) {
  if (n === null || n === undefined) return "—";
  return dec ? n.toFixed(dec) + unit : Math.round(n) + unit;
}

// ─── Report sections ─────────────────────────────────────────────────────────

function SectionTitle({ icon, title, color }: { icon: string; title: string; color: string }) {
  return (
    <div className="flex items-center gap-3 mb-4 pb-3 report-section-title"
      style={{ borderBottom: `2px solid ${color}33` }}>
      <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: `${color}18` }}>
        <span className="text-[15px]">{icon}</span>
      </div>
      <h2 className="text-[15px] font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
        {title}
      </h2>
      <div className="flex-1 h-px ml-2" style={{ background: `${color}20` }} />
    </div>
  );
}

function KpiCard({
  icon, label, value, unit, sub, color, pct,
}: {
  icon: React.ReactNode; label: string; value: string; unit?: string;
  sub?: string; color: string; pct?: number;
}) {
  return (
    <div className="glass p-3.5 flex items-start gap-3 report-card">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: `${color}18` }}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-wider mb-0.5"
          style={{ color: "var(--text-muted)" }}>{label}</p>
        <p className="text-[18px] font-bold leading-none" style={{ color }}>
          {value}{unit && <span className="text-[11px] font-normal ml-0.5" style={{ color: "var(--text-muted)" }}>{unit}</span>}
        </p>
        {sub && <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>{sub}</p>}
      </div>
      {pct !== undefined && <GoalRing pct={pct} color={color} size={36} />}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ReportClient() {
  const [from,    setFrom]    = useState(PRESETS[1].from);
  const [to,      setTo]      = useState(today);
  const [data,    setData]    = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const generate = async () => {
    setLoading(true);
    setError(false);
    setData(null);
    try {
      const res = await fetch(`/api/report?from=${from}&to=${to}`);
      if (!res.ok) { setError(true); return; }
      setData(await res.json() as ReportData);
    } catch { setError(true); }
    finally  { setLoading(false); }
  };

  const downloadPDF = () => {
    window.print();
  };

  // Print styles injected once
  useEffect(() => {
    const style = document.createElement("style");
    style.id = "report-print-styles";
    style.textContent = `
@media print {
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  @page { size: A4 portrait; margin: 12mm 14mm 14mm 14mm; }
  body { background: #ffffff !important; color: #1a1a2e !important; }
  nav, .print-hide, .bg-orbs { display: none !important; }
  .print-container { max-width: 100% !important; padding: 0 !important; margin: 0 !important; }
  .report-cover { page-break-after: always; }
  .report-page-break { page-break-before: always; }
  .glass, .glass-strong { background: #f8f9fc !important; border: 1px solid #e2e8f0 !important; border-radius: 8px !important; }
  :root { --text-primary: #0f172a !important; --text-secondary: #334155 !important; --text-muted: #64748b !important; --border: #e2e8f0 !important; }
  .report-card { break-inside: avoid !important; }
  .report-section-title { border-bottom-color: currentColor !important; }
}
    `;
    if (!document.getElementById("report-print-styles")) {
      document.head.appendChild(style);
    }
    return () => { document.getElementById("report-print-styles")?.remove(); };
  }, []);

  return (
    <div className="relative min-h-screen">
      <div className="bg-orbs" />
      <div className="relative z-10 max-w-2xl mx-auto px-4 py-6 md:ml-[220px] print-container" style={{ paddingBottom: 100 }}>

        {/* ── Controls (hidden on print) ── */}
        <div className="print-hide">
          <div className="mb-1">
            <p className="text-[11px] uppercase tracking-wider font-medium" style={{ color: "var(--text-muted)" }}>Analyses</p>
          </div>
          <div className="flex items-center justify-between mb-5">
            <h1 className="text-[22px] font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
              Rapport de santé
            </h1>
            <FilePdf size={20} style={{ color: "#f97316" }} />
          </div>

          {/* Period selector */}
          <div className="glass p-4 mb-4 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <CalendarBlank size={14} style={{ color: "var(--text-muted)" }} />
              <p className="text-[12px] font-semibold" style={{ color: "var(--text-primary)" }}>Sélectionner la période</p>
            </div>

            {/* Presets */}
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map(p => {
                const active = from === p.from && to === p.to;
                return (
                  <button key={p.label}
                    onClick={() => { setFrom(p.from); setTo(p.to); }}
                    className="px-3 py-1.5 rounded-full text-[11px] font-medium transition-all"
                    style={{
                      background: active ? "rgba(249,115,22,0.15)" : "rgba(255,255,255,0.04)",
                      border:     active ? "1px solid rgba(249,115,22,0.5)" : "1px solid var(--border)",
                      color:      active ? "#f97316" : "var(--text-muted)",
                    }}>
                    {p.label}
                  </button>
                );
              })}
            </div>

            {/* Custom range */}
            <div className="flex gap-3 items-center">
              <div className="flex-1">
                <p className="text-[10px] mb-1" style={{ color: "var(--text-muted)" }}>Du</p>
                <input type="date" value={from} max={to} onChange={e => setFrom(e.target.value)}
                  className="input text-[12px] w-full" style={{ height: 36 }} />
              </div>
              <div className="flex-1">
                <p className="text-[10px] mb-1" style={{ color: "var(--text-muted)" }}>Au</p>
                <input type="date" value={to} min={from} max={today} onChange={e => setTo(e.target.value)}
                  className="input text-[12px] w-full" style={{ height: 36 }} />
              </div>
            </div>

            <button onClick={generate} disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-[13px] font-semibold transition-all"
              style={{
                background: "linear-gradient(135deg,rgba(249,115,22,0.18),rgba(251,191,36,0.15))",
                border: "1px solid rgba(249,115,22,0.4)",
                color: "#f97316",
              }}>
              {loading
                ? <><Spinner size={14} className="animate-spin" />Génération en cours…</>
                : <><ChartBar size={14} />Générer le rapport</>
              }
            </button>
          </div>

          {error && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-[12px] mb-4"
              style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.25)", color: "#f87171" }}>
              <Warning size={13} weight="fill" /> Erreur de génération. Vérifiez la connexion et réessayez.
            </div>
          )}
        </div>

        {/* ── Report content ── */}
        <AnimatePresence>
          {data && (
            <motion.div
              ref={reportRef}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}
            >
              {/* Download button (screen only) */}
              <div className="print-hide flex justify-end mb-4">
                <button onClick={downloadPDF}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold transition-all"
                  style={{
                    background: "linear-gradient(135deg,rgba(248,113,113,0.18),rgba(249,115,22,0.18))",
                    border: "1px solid rgba(248,113,113,0.4)",
                    color: "#f87171",
                  }}>
                  <FilePdf size={16} weight="fill" />
                  Télécharger PDF
                </button>
              </div>

              {/* ═══════════════════════════════════════════════════════════
                  COVER PAGE
              ═══════════════════════════════════════════════════════════ */}
              <div className="report-cover mb-6 rounded-2xl overflow-hidden"
                style={{ background: "linear-gradient(135deg,rgba(249,115,22,0.12),rgba(167,139,250,0.12),rgba(96,165,250,0.08))", border: "1px solid var(--border)" }}>

                {/* Top accent bar */}
                <div style={{ height: 4, background: "linear-gradient(90deg,#f97316,#a78bfa,#60a5fa)" }} />

                <div className="p-6 md:p-8">
                  {/* Logo + title */}
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: "linear-gradient(135deg,#f97316,#fb923c)" }}>
                      <span className="text-[18px]">🥦</span>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#f97316" }}>NutriTracker</p>
                      <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Rapport de santé personnel</p>
                    </div>
                  </div>

                  {/* User identity */}
                  <div className="flex items-center gap-4 mb-8">
                    {data.profile.photoUrl ? (
                      <img src={data.profile.photoUrl} alt="avatar"
                        className="w-16 h-16 rounded-full object-cover flex-shrink-0"
                        style={{ border: "2px solid rgba(249,115,22,0.4)" }} />
                    ) : (
                      <div className="w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ background: "rgba(249,115,22,0.15)", border: "2px solid rgba(249,115,22,0.3)" }}>
                        <User size={28} style={{ color: "#f97316" }} />
                      </div>
                    )}
                    <div>
                      <h1 className="text-[22px] font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
                        {data.profile.displayName}
                      </h1>
                      <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>{data.profile.email}</p>
                    </div>
                  </div>

                  {/* Period + meta */}
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { icon: "📅", label: "Période analysée", value: `${fmtDate(data.meta.from)} → ${fmtDate(data.meta.to)}` },
                      { icon: "📊", label: "Durée",            value: `${data.meta.totalDays} jours calendaires` },
                      { icon: "🍽️", label: "Jours enregistrés (nutrition)", value: `${data.nutrition.daysLogged} jours` },
                      { icon: "🏃", label: "Jours avec activité",           value: `${data.activity.daysWithData} jours` },
                    ].map(({ icon, label, value }) => (
                      <div key={label} className="glass p-3 rounded-xl">
                        <p className="text-[10px] mb-1" style={{ color: "var(--text-muted)" }}>{icon} {label}</p>
                        <p className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>{value}</p>
                      </div>
                    ))}
                  </div>

                  <p className="text-[10px] mt-4 text-right" style={{ color: "var(--text-muted)" }}>
                    Généré le {format(new Date(data.meta.generatedAt), "d MMMM yyyy 'à' HH:mm", { locale: fr })}
                  </p>
                </div>
              </div>

              {/* ═══════════════════════════════════════════════════════════
                  RÉSUMÉ EXÉCUTIF
              ═══════════════════════════════════════════════════════════ */}
              <div className="glass p-5 mb-5 report-page-break">
                <SectionTitle icon="📋" title="Résumé exécutif" color="#f97316" />

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <KpiCard
                    icon={<Fire size={14} style={{ color: "#f97316" }} />}
                    label="Calories moy / jour"
                    value={fmtN(data.nutrition.avgCalories)}
                    unit="kcal"
                    sub={`Objectif : ${data.profile.goals.dailyCalories} kcal`}
                    color="#f97316"
                    pct={data.nutrition.pctCalGoal}
                  />
                  <KpiCard
                    icon={<Leaf size={14} style={{ color: "#a78bfa" }} />}
                    label="Protéines moy / jour"
                    value={fmtN(data.nutrition.avgProteinG)}
                    unit="g"
                    sub={`Objectif : ${data.profile.goals.proteinGrams} g`}
                    color="#a78bfa"
                    pct={data.profile.goals.proteinGrams ? Math.round(data.nutrition.avgProteinG / data.profile.goals.proteinGrams * 100) : 0}
                  />
                  <KpiCard
                    icon={<Footprints size={14} style={{ color: "#4285F4" }} />}
                    label="Pas moy / jour"
                    value={data.activity.avgSteps ? data.activity.avgSteps.toLocaleString("fr-FR") : "—"}
                    sub={`Objectif : ${data.profile.goals.stepsGoal.toLocaleString("fr-FR")}`}
                    color="#4285F4"
                    pct={data.activity.pctStepsGoal}
                  />
                  <KpiCard
                    icon={<Moon size={14} style={{ color: "#7986CB" }} />}
                    label="Sommeil moy / nuit"
                    value={fmtN(data.activity.avgSleepH, "h", 1)}
                    sub={`Objectif : ${(data.profile.goals.sleepGoalMin / 60).toFixed(1)}h`}
                    color="#7986CB"
                    pct={data.activity.pctSleepGoal}
                  />
                  <KpiCard
                    icon={<Heart size={14} weight="fill" style={{ color: "#EA4335" }} />}
                    label="FC moyenne"
                    value={fmtN(data.health.avgHR)}
                    unit="bpm"
                    sub={data.health.avgSys ? `Tension : ${data.health.avgSys}/${data.health.avgDia} mmHg` : "Pas de mesure"}
                    color="#EA4335"
                  />
                  <KpiCard
                    icon={<Drop size={14} weight="fill" style={{ color: "#60a5fa" }} />}
                    label="Hydratation moy"
                    value={fmtN(data.nutrition.avgWaterMl)}
                    unit="mL"
                    sub={`Objectif : ${data.profile.goals.waterMl} mL`}
                    color="#60a5fa"
                    pct={data.nutrition.pctWaterGoal}
                  />
                </div>

                {/* Score globaux */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "Nutrition",  pct: data.nutrition.pctCalGoal },
                    { label: "Activité",   pct: data.activity.pctStepsGoal },
                    { label: "Hydratation",pct: data.nutrition.pctWaterGoal },
                  ].map(({ label, pct }) => {
                    const s = score(pct);
                    return (
                      <div key={label} className="flex flex-col items-center gap-1 py-3 rounded-xl"
                        style={{ background: s.bg, border: `1px solid ${s.border}` }}>
                        <p className="text-[9px] font-medium uppercase tracking-wider" style={{ color: s.color }}>{label}</p>
                        <p className="text-[16px] font-bold" style={{ color: s.color }}>{pct}%</p>
                        <p className="text-[9px]" style={{ color: s.color }}>{s.label}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ═══════════════════════════════════════════════════════════
                  NUTRITION
              ═══════════════════════════════════════════════════════════ */}
              <div className="glass p-5 mb-5">
                <SectionTitle icon="🍽️" title="Nutrition" color="#f97316" />

                <div className="grid grid-cols-2 gap-4 mb-5">
                  {/* Macro donut */}
                  <div className="flex items-center gap-3">
                    <MacroDonut
                      p={data.nutrition.avgProteinG * 4}
                      c={data.nutrition.avgCarbsG   * 4}
                      f={data.nutrition.avgFatG      * 9}
                    />
                    <div className="space-y-1.5">
                      {[
                        { label: "Protéines", val: data.nutrition.avgProteinG, goal: data.profile.goals.proteinGrams, color: "#a78bfa", unit: "g" },
                        { label: "Glucides",  val: data.nutrition.avgCarbsG,   goal: data.profile.goals.carbsGrams,   color: "#fbbf24", unit: "g" },
                        { label: "Lipides",   val: data.nutrition.avgFatG,     goal: data.profile.goals.fatGrams,     color: "#60a5fa", unit: "g" },
                        { label: "Fibres",    val: data.nutrition.avgFiberG,   goal: data.profile.goals.fiberGrams,   color: "#34d399", unit: "g" },
                      ].map(({ label, val, goal, color, unit }) => (
                        <div key={label} className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                          <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{label}</span>
                          <span className="text-[11px] font-semibold ml-auto" style={{ color }}>{val}{unit}</span>
                          <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>/{goal}{unit}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Water + fiber stats */}
                  <div className="space-y-2">
                    {[
                      { icon: "💧", label: "Eau / jour",     val: data.nutrition.avgWaterMl,  goal: data.profile.goals.waterMl,   unit: " mL",  color: "#60a5fa" },
                      { icon: "🌿", label: "Fibres / jour",  val: data.nutrition.avgFiberG,   goal: data.profile.goals.fiberGrams, unit: " g",  color: "#34d399" },
                      { icon: "📅", label: "Jours loggés",   val: data.nutrition.daysLogged,  goal: data.meta.totalDays,          unit: " j",  color: "#f97316" },
                    ].map(({ icon, label, val, goal, unit, color }) => (
                      <div key={label} className="flex items-center justify-between px-3 py-2 rounded-xl"
                        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
                        <div className="flex items-center gap-2">
                          <span className="text-[12px]">{icon}</span>
                          <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{label}</span>
                        </div>
                        <span className="text-[12px] font-semibold" style={{ color }}>
                          {val}{unit} <span className="text-[10px] font-normal" style={{ color: "var(--text-muted)" }}>/{goal}{unit}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Calories trend */}
                {data.nutrition.daily.length > 1 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                        Évolution des calories
                      </p>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                          <div className="w-3 h-2 rounded" style={{ background: "#f97316" }} />
                          <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>Calories</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-3 h-px" style={{ background: "rgba(249,115,22,0.4)" }} />
                          <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>Objectif</span>
                        </div>
                      </div>
                    </div>
                    <div className="relative rounded-xl overflow-hidden" style={{ height: 70, background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)" }}>
                      <MiniBarChart
                        data={(data.nutrition.daily as DayNutrition[]).map(d => ({ val: d.calories, label: d.date }))}
                        color="#f97316"
                        height={70}
                        maxOverride={Math.max(data.profile.goals.dailyCalories * 1.3, ...data.nutrition.daily.map((d: DayNutrition) => d.calories))}
                      />
                      {/* Goal line overlay */}
                      <div className="absolute inset-0 pointer-events-none">
                        <svg width="100%" height="100%" viewBox="0 0 100 70" preserveAspectRatio="none">
                          <line
                            x1="0" y1={70 - (data.profile.goals.dailyCalories / (data.profile.goals.dailyCalories * 1.3)) * 70}
                            x2="100" y2={70 - (data.profile.goals.dailyCalories / (data.profile.goals.dailyCalories * 1.3)) * 70}
                            stroke="rgba(249,115,22,0.4)" strokeWidth={0.8} strokeDasharray="3 2"
                          />
                        </svg>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ═══════════════════════════════════════════════════════════
                  ACTIVITÉ PHYSIQUE
              ═══════════════════════════════════════════════════════════ */}
              <div className="glass p-5 mb-5 report-page-break">
                <SectionTitle icon="🏃" title="Activité physique" color="#34A853" />

                <div className="grid grid-cols-2 gap-3 mb-4">
                  {[
                    { icon: <Footprints size={13} style={{ color: "#4285F4" }} />, label: "Pas / jour", val: data.activity.avgSteps ? data.activity.avgSteps.toLocaleString("fr-FR") : "—", sub: `/ ${data.profile.goals.stepsGoal.toLocaleString("fr-FR")}`, color: "#4285F4", pct: data.activity.pctStepsGoal },
                    { icon: <Moon size={13} style={{ color: "#7986CB" }} />,       label: "Sommeil",   val: fmtN(data.activity.avgSleepH, "h", 1),                                          sub: `/ ${(data.profile.goals.sleepGoalMin / 60).toFixed(1)}h`,    color: "#7986CB", pct: data.activity.pctSleepGoal },
                    { icon: <Fire size={13} style={{ color: "#EA4335" }} />,       label: "Cal. brûlées", val: fmtN(data.activity.avgCaloriesBurned, " kcal"),                              sub: "moyenne / jour",                                             color: "#EA4335" },
                    { icon: <Barbell size={13} style={{ color: "#34A853" }} />,    label: "Séances",   val: String(data.activity.totalSessions),                                            sub: "sur la période",                                             color: "#34A853" },
                  ].map(({ icon, label, val, sub, color, pct }) => (
                    <KpiCard key={label} icon={icon} label={label} value={val} sub={sub} color={color} pct={pct} />
                  ))}
                </div>

                {/* Steps trend */}
                {data.activity.daily.filter(d => d.steps !== null).length > 1 && (
                  <div className="mb-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>Évolution des pas</p>
                    <div className="rounded-xl overflow-hidden" style={{ height: 60, background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)" }}>
                      <MiniBarChart
                        data={(data.activity.daily as DayActivity[]).map(d => ({ val: d.steps, label: d.date }))}
                        color="#4285F4"
                        height={60}
                        maxOverride={Math.max(data.profile.goals.stepsGoal * 1.3, ...data.activity.daily.map((d: DayActivity) => d.steps ?? 0))}
                      />
                    </div>
                  </div>
                )}

                {/* Sleep trend */}
                {data.activity.daily.filter(d => d.sleepMin !== null).length > 1 && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>Évolution du sommeil</p>
                    <div className="rounded-xl overflow-hidden" style={{ height: 50, background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)" }}>
                      <MiniBarChart
                        data={(data.activity.daily as DayActivity[]).map(d => ({ val: d.sleepMin ? d.sleepMin / 60 : null, label: d.date }))}
                        color="#7986CB"
                        height={50}
                        maxOverride={12}
                      />
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>{fmtDate(data.meta.from)}</span>
                      <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>{fmtDate(data.meta.to)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* ═══════════════════════════════════════════════════════════
                  SANTÉ & VITAUX
              ═══════════════════════════════════════════════════════════ */}
              <div className="glass p-5 mb-5">
                <SectionTitle icon="❤️" title="Santé & Constantes vitales" color="#EA4335" />

                {/* Weight */}
                {(data.health.weightStart || data.health.weightEnd) && (
                  <div className="glass p-4 mb-4 rounded-xl">
                    <p className="text-[10px] font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>
                      ⚖️ Évolution du poids
                    </p>
                    <div className="flex items-center justify-between">
                      <div className="text-center">
                        <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Début</p>
                        <p className="text-[20px] font-bold" style={{ color: "var(--text-primary)" }}>
                          {fmtN(data.health.weightStart, " kg", 1)}
                        </p>
                      </div>
                      <div className="flex-1 flex items-center justify-center gap-2 px-4">
                        <div className="h-px flex-1" style={{ background: "var(--border)" }} />
                        {data.health.weightDelta !== null && (
                          <div className="flex items-center gap-1 px-2 py-1 rounded-full"
                            style={{
                              background: data.health.weightDelta < 0 ? "rgba(52,211,153,0.1)" : data.health.weightDelta > 0 ? "rgba(248,113,113,0.1)" : "rgba(255,255,255,0.05)",
                              border: `1px solid ${data.health.weightDelta < 0 ? "rgba(52,211,153,0.3)" : data.health.weightDelta > 0 ? "rgba(248,113,113,0.3)" : "var(--border)"}`,
                            }}>
                            {data.health.weightDelta < 0 ? <ArrowDown size={11} weight="bold" style={{ color: "#34d399" }} /> :
                             data.health.weightDelta > 0 ? <ArrowUp size={11} weight="bold" style={{ color: "#f87171" }} /> :
                             <Minus size={11} weight="bold" style={{ color: "var(--text-muted)" }} />}
                            <span className="text-[11px] font-semibold"
                              style={{ color: data.health.weightDelta < 0 ? "#34d399" : data.health.weightDelta > 0 ? "#f87171" : "var(--text-muted)" }}>
                              {data.health.weightDelta > 0 ? "+" : ""}{data.health.weightDelta} kg
                            </span>
                          </div>
                        )}
                        <div className="h-px flex-1" style={{ background: "var(--border)" }} />
                      </div>
                      <div className="text-center">
                        <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Fin</p>
                        <p className="text-[20px] font-bold" style={{ color: "var(--text-primary)" }}>
                          {fmtN(data.health.weightEnd, " kg", 1)}
                        </p>
                      </div>
                    </div>
                    {data.profile.goals.targetWeightKg && (
                      <div className="mt-3 pt-3 flex items-center justify-between" style={{ borderTop: "1px solid var(--border)" }}>
                        <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>Objectif</span>
                        <span className="text-[12px] font-semibold" style={{ color: "#f472b6" }}>
                          {data.profile.goals.targetWeightKg} kg
                          {data.health.weightEnd && (
                            <span className="text-[10px] font-normal ml-1.5" style={{ color: "var(--text-muted)" }}>
                              (encore {Math.abs(Math.round((data.health.weightEnd - data.profile.goals.targetWeightKg) * 10) / 10)} kg)
                            </span>
                          )}
                        </span>
                      </div>
                    )}
                    {data.health.bodyFatEnd && (
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>% masse grasse</span>
                        <span className="text-[12px] font-semibold" style={{ color: "#fb923c" }}>{data.health.bodyFatEnd}%</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Vitals grid */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {[
                    { icon: "❤️", label: "FC moyenne",   val: fmtN(data.health.avgHR, " bpm"),   color: "#EA4335" },
                    { icon: "🩸", label: "Tension moy",  val: data.health.avgSys ? `${data.health.avgSys}/${data.health.avgDia}` : "—", unit: "mmHg", color: "#f87171" },
                    { icon: "💨", label: "SpO₂",         val: fmtN(data.health.latestSpO2, "%"),  color: "#60a5fa" },
                  ].filter(v => v.val !== "—").map(({ icon, label, val, unit, color }) => (
                    <div key={label} className="glass px-3 py-2.5 rounded-xl flex items-center gap-3">
                      <span className="text-[14px]">{icon}</span>
                      <div>
                        <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{label}</p>
                        <p className="text-[15px] font-bold" style={{ color }}>
                          {val}{unit && <span className="text-[10px] font-normal ml-0.5" style={{ color: "var(--text-muted)" }}>{unit}</span>}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Symptoms summary */}
                {data.health.symptomsTotal > 0 && (
                  <div className="rounded-xl overflow-hidden mb-3" style={{ border: "1px solid var(--border)" }}>
                    <div className="px-3 py-2.5 flex items-center justify-between" style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid var(--border)" }}>
                      <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                        🩺 Symptômes enregistrés
                      </p>
                      <span className="text-[10px] px-2 py-0.5 rounded-full"
                        style={{ background: "rgba(251,146,60,0.12)", color: "#fb923c", border: "1px solid rgba(251,146,60,0.3)" }}>
                        {data.health.symptomsTotal} occurrences
                      </span>
                    </div>
                    <div className="divide-y" style={{ borderColor: "var(--border)" }}>
                      {data.health.topSymptoms.map(s => (
                        <div key={s.name} className="flex items-center justify-between px-3 py-2">
                          <div>
                            <p className="text-[12px] font-medium" style={{ color: "var(--text-primary)" }}>{s.name}</p>
                            <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{s.category}</p>
                          </div>
                          <span className="text-[12px] font-semibold px-2 py-0.5 rounded-full"
                            style={{ background: "rgba(251,146,60,0.08)", color: "#fb923c" }}>
                            ×{s.count}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Medications */}
                {data.health.medicationsTotal > 0 && (
                  <div className="flex items-center justify-between px-3 py-2.5 rounded-xl"
                    style={{ background: "rgba(192,132,252,0.07)", border: "1px solid rgba(192,132,252,0.2)" }}>
                    <div className="flex items-center gap-2">
                      <span className="text-[14px]">💊</span>
                      <p className="text-[12px]" style={{ color: "var(--text-secondary)" }}>Médicaments enregistrés</p>
                    </div>
                    <p className="text-[13px] font-semibold" style={{ color: "#c084fc" }}>{data.health.medicationsTotal} prises</p>
                  </div>
                )}
              </div>

              {/* ═══════════════════════════════════════════════════════════
                  FOOTER
              ═══════════════════════════════════════════════════════════ */}
              <div className="text-center py-6 space-y-1">
                <p className="text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>NutriTracker · Rapport personnel de santé</p>
                <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                  Généré le {format(new Date(data.meta.generatedAt), "d MMMM yyyy 'à' HH:mm", { locale: fr })} · Données confidentielles
                </p>
                <p className="text-[9px]" style={{ color: "var(--text-muted)", opacity: 0.6 }}>
                  Ce rapport est indicatif et ne remplace pas un avis médical professionnel.
                </p>
              </div>

            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
