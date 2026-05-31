"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { IconRuler, IconArrowUp, IconArrowDown, IconMinus, IconCheck, IconX, IconInfoCircle, IconChartLine } from "@tabler/icons-react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import type { MeasurementEntry } from "@/app/api/measurements/route";

type MeasurementKey = "waistCm" | "hipsCm" | "chestCm" | "armsCm" | "thighsCm" | "neckCm" | "calfsCm";

const FIELDS: { key: MeasurementKey; label: string; emoji: string; color: string; svgY: number; svgX: "left" | "right" }[] = [
  { key: "neckCm",   label: "Cou",           emoji: "🦒", color: "#a78bfa", svgY: 58,  svgX: "right" },
  { key: "chestCm",  label: "Poitrine",       emoji: "🫁", color: "#60a5fa", svgY: 90,  svgX: "left"  },
  { key: "armsCm",   label: "Bras",           emoji: "💪", color: "#f97316", svgY: 105, svgX: "right" },
  { key: "waistCm",  label: "Tour de taille", emoji: "📏", color: "#34d399", svgY: 130, svgX: "left"  },
  { key: "hipsCm",   label: "Hanches",        emoji: "🍑", color: "#f472b6", svgY: 155, svgX: "right" },
  { key: "thighsCm", label: "Cuisse",         emoji: "🦵", color: "#fbbf24", svgY: 188, svgX: "left"  },
  { key: "calfsCm",  label: "Mollet",         emoji: "🦶", color: "#fb923c", svgY: 225, svgX: "right" },
];

function HumanoidSVG({
  measurements,
  previous,
  highlighted,
  onHighlight,
}: {
  measurements: Partial<Record<MeasurementKey, number | null>>;
  previous: Partial<Record<MeasurementKey, number | null>>;
  highlighted: MeasurementKey | null;
  onHighlight: (k: MeasurementKey | null) => void;
}) {
  return (
    <svg viewBox="0 0 200 290" className="w-full max-w-[180px] mx-auto" style={{ filter: "drop-shadow(0 4px 16px rgba(0,0,0,0.3))" }}>
      {/* Body silhouette */}
      <defs>
        <linearGradient id="bodyGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"  stopColor="rgba(139,92,246,0.15)" />
          <stop offset="100%" stopColor="rgba(59,130,246,0.08)" />
        </linearGradient>
      </defs>

      {/* Head */}
      <ellipse cx="100" cy="28" rx="18" ry="22"
        fill="url(#bodyGrad)" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" />

      {/* Neck */}
      <rect x="93" y="48" width="14" height="16" rx="4"
        fill="url(#bodyGrad)" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />

      {/* Torso */}
      <path d="M72 64 Q65 75 63 100 L60 150 Q60 160 70 162 L130 162 Q140 160 140 150 L137 100 Q135 75 128 64 Z"
        fill="url(#bodyGrad)" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" />

      {/* Left arm */}
      <path d="M72 66 Q58 80 53 110 Q51 120 55 125 Q60 128 64 120 Q67 105 72 90 Z"
        fill="url(#bodyGrad)" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />

      {/* Right arm */}
      <path d="M128 66 Q142 80 147 110 Q149 120 145 125 Q140 128 136 120 Q133 105 128 90 Z"
        fill="url(#bodyGrad)" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />

      {/* Left forearm */}
      <path d="M55 125 Q50 140 52 158 Q55 162 58 160 Q61 158 62 145 Q63 132 64 120 Z"
        fill="url(#bodyGrad)" stroke="rgba(255,255,255,0.10)" strokeWidth="1.5" />

      {/* Right forearm */}
      <path d="M145 125 Q150 140 148 158 Q145 162 142 160 Q139 158 138 145 Q137 132 136 120 Z"
        fill="url(#bodyGrad)" stroke="rgba(255,255,255,0.10)" strokeWidth="1.5" />

      {/* Hips/pelvis */}
      <path d="M63 155 Q58 165 60 175 Q65 185 80 186 L120 186 Q135 185 140 175 Q142 165 137 155 Z"
        fill="url(#bodyGrad)" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />

      {/* Left thigh */}
      <path d="M63 173 Q56 190 57 215 Q60 225 68 225 Q75 225 77 215 Q79 195 80 180 Z"
        fill="url(#bodyGrad)" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />

      {/* Right thigh */}
      <path d="M137 173 Q144 190 143 215 Q140 225 132 225 Q125 225 123 215 Q121 195 120 180 Z"
        fill="url(#bodyGrad)" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />

      {/* Left calf */}
      <path d="M57 215 Q54 235 56 252 Q60 260 67 258 Q73 256 74 245 Q75 232 68 215 Z"
        fill="url(#bodyGrad)" stroke="rgba(255,255,255,0.10)" strokeWidth="1.5" />

      {/* Right calf */}
      <path d="M143 215 Q146 235 144 252 Q140 260 133 258 Q127 256 126 245 Q125 232 132 215 Z"
        fill="url(#bodyGrad)" stroke="rgba(255,255,255,0.10)" strokeWidth="1.5" />

      {/* Left foot */}
      <ellipse cx="62" cy="262" rx="11" ry="6"
        fill="url(#bodyGrad)" stroke="rgba(255,255,255,0.10)" strokeWidth="1.5" />

      {/* Right foot */}
      <ellipse cx="138" cy="262" rx="11" ry="6"
        fill="url(#bodyGrad)" stroke="rgba(255,255,255,0.10)" strokeWidth="1.5" />

      {/* Measurement indicators */}
      {FIELDS.map(({ key, svgY, svgX, color }) => {
        const val = measurements[key];
        const prev = previous[key];
        const isHighlighted = highlighted === key;
        const hasVal = val != null && val > 0;

        const xFrom = svgX === "left" ? 62 : 138;
        const xLabel = svgX === "left" ? 14 : 186;

        return (
          <g key={key} onClick={() => onHighlight(highlighted === key ? null : key)} style={{ cursor: "pointer" }}>
            {/* Horizontal measurement line */}
            <line
              x1={xFrom} y1={svgY} x2={xLabel} y2={svgY}
              stroke={hasVal ? color : "rgba(255,255,255,0.15)"}
              strokeWidth={isHighlighted ? 2 : 1}
              strokeDasharray={hasVal ? "none" : "3,2"}
            />
            {/* Dot on body */}
            <circle cx={xFrom} cy={svgY} r={isHighlighted ? 5 : 3}
              fill={hasVal ? color : "rgba(255,255,255,0.2)"}
              stroke={isHighlighted ? "white" : "none"}
              strokeWidth="1.5"
            />
            {/* Value badge */}
            {hasVal && (
              <text
                x={svgX === "left" ? xLabel - 2 : xLabel + 2}
                y={svgY + 4}
                fontSize="8"
                fontWeight="600"
                fill={isHighlighted ? "white" : color}
                textAnchor={svgX === "left" ? "end" : "start"}
                fontFamily="system-ui"
              >
                {val}
              </text>
            )}
            {/* "+" indicator when no value */}
            {!hasVal && (
              <text
                x={svgX === "left" ? xLabel - 2 : xLabel + 2}
                y={svgY + 4}
                fontSize="10"
                fill="rgba(255,255,255,0.2)"
                textAnchor={svgX === "left" ? "end" : "start"}
              >+</text>
            )}
            {/* Delta indicator */}
            {hasVal && prev != null && prev > 0 && val !== prev && (
              <text
                x={svgX === "left" ? xLabel - 2 : xLabel + 2}
                y={svgY - 4}
                fontSize="7"
                fill={val < prev ? "#4ade80" : "#f87171"}
                textAnchor={svgX === "left" ? "end" : "start"}
                fontFamily="system-ui"
              >
                {val < prev ? "↓" : "↑"}{Math.abs(val - prev).toFixed(1)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export default function BodyMeasurementsTab() {
  const [entries, setEntries]           = useState<MeasurementEntry[]>([]);
  const [loading, setLoading]           = useState(true);
  const [saving,  setSaving]            = useState(false);
  const [showForm, setShowForm]         = useState(false);
  const [highlighted, setHighlighted]   = useState<MeasurementKey | null>(null);
  const [activeChart, setActiveChart]   = useState<MeasurementKey>("waistCm");
  const [saved, setSaved]               = useState(false);

  const currentMonth = format(new Date(), "yyyy-MM");
  const displayMonth = format(new Date(), "MMMM yyyy", { locale: fr });

  // Form state
  const [form, setForm] = useState<Partial<Record<MeasurementKey, string>>>({});

  useEffect(() => {
    fetch("/api/measurements?months=12")
      .then(r => r.json())
      .then((d: { entries?: MeasurementEntry[] }) => {
        setEntries(d.entries ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const currentEntry = entries.find(e => e.month === currentMonth);
  const previousEntry = entries.length > 1 ? entries[entries.length - 2] : null;

  const currentValues: Partial<Record<MeasurementKey, number | null>> = currentEntry
    ? Object.fromEntries(FIELDS.map(f => [f.key, currentEntry[f.key]]))
    : {};

  const previousValues: Partial<Record<MeasurementKey, number | null>> = previousEntry
    ? Object.fromEntries(FIELDS.map(f => [f.key, previousEntry[f.key]]))
    : {};

  const handleSave = async () => {
    setSaving(true);
    try {
      const body: Partial<Record<MeasurementKey, number | null>> = {};
      for (const { key } of FIELDS) {
        const v = form[key];
        body[key] = v && v.trim() !== "" ? parseFloat(v) : null;
      }
      await fetch("/api/measurements", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      });
      // Reload
      const res = await fetch("/api/measurements?months=12");
      const data = await res.json() as { entries?: MeasurementEntry[] };
      setEntries(data.entries ?? []);
      setSaved(true);
      setShowForm(false);
      setTimeout(() => setSaved(false), 3000);
    } catch { /* noop */ }
    finally { setSaving(false); }
  };

  const openForm = () => {
    // Prefill from current month if exists
    if (currentEntry) {
      const prefill: Partial<Record<MeasurementKey, string>> = {};
      for (const { key } of FIELDS) {
        const v = currentEntry[key];
        if (v != null) prefill[key] = String(v);
      }
      setForm(prefill);
    } else {
      setForm({});
    }
    setShowForm(true);
  };

  // Chart data
  const chartData = entries.map(e => ({
    label: format(parseISO(e.month + "-01"), "MMM yy", { locale: fr }),
    ...Object.fromEntries(FIELDS.map(f => [f.key, e[f.key] ?? null])),
  }));

  const activeField = FIELDS.find(f => f.key === activeChart)!;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="label-xs mb-0.5">Suivi mensuel</p>
          <p className="text-[15px] font-semibold" style={{ color: "var(--text-primary)" }}>
            Mensurations corporelles
          </p>
          <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
            📅 {displayMonth} {currentEntry ? "· Saisie effectuée ✓" : "· Pas encore saisi ce mois"}
          </p>
        </div>
        <button
          onClick={openForm}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-medium"
          style={{
            background: "rgba(139,92,246,0.12)",
            border: "1px solid rgba(139,92,246,0.3)",
            color: "#a78bfa",
          }}
        >
          <IconRuler size={13} stroke={2} />
          {currentEntry ? "Modifier" : "Saisir"}
        </button>
      </div>

      {saved && (
        <motion.div
          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          className="flex items-center gap-2 px-3 py-2 rounded-xl"
          style={{ background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.3)" }}
        >
          <IconCheck size={13} stroke={2} style={{ color: "#34d399" }} />
          <span className="text-[12px]" style={{ color: "#34d399" }}>Mensurations enregistrées !</span>
        </motion.div>
      )}

      {/* Humanoid + labels */}
      <div className="glass p-4">
        <div className="flex gap-4">
          {/* SVG */}
          <div className="w-[120px] flex-shrink-0">
            {loading ? (
              <div className="w-full h-[220px] flex items-center justify-center">
                <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
                  style={{ borderColor: "rgba(139,92,246,0.3)", borderTopColor: "#a78bfa" }} />
              </div>
            ) : (
              <HumanoidSVG
                measurements={currentValues}
                previous={previousValues}
                highlighted={highlighted}
                onHighlight={setHighlighted}
              />
            )}
          </div>

          {/* Measurements list */}
          <div className="flex-1 space-y-1.5">
            {FIELDS.map(({ key, label, emoji, color }) => {
              const curr = currentValues[key];
              const prev = previousValues[key];
              const hasVal = curr != null && curr > 0;
              const delta  = (hasVal && prev != null && prev > 0) ? curr - prev : null;

              return (
                <button
                  key={key}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl transition-all text-left"
                  onClick={() => setHighlighted(highlighted === key ? null : key)}
                  style={{
                    background: highlighted === key ? `${color}15` : "rgba(255,255,255,0.03)",
                    border: `1px solid ${highlighted === key ? `${color}40` : "var(--border)"}`,
                  }}
                >
                  <span className="text-sm flex-shrink-0">{emoji}</span>
                  <span className="text-[11px] flex-1" style={{ color: "var(--text-secondary)" }}>{label}</span>
                  {hasVal ? (
                    <div className="flex items-center gap-1">
                      <span className="text-[13px] font-bold tabular-nums" style={{ color }}>{curr} cm</span>
                      {delta !== null && (
                        <span className="text-[9px]" style={{ color: delta < 0 ? "#4ade80" : "#f87171" }}>
                          {delta > 0 ? "+" : ""}{delta.toFixed(1)}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>—</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
        <p className="text-[10px] mt-3 text-center" style={{ color: "var(--text-muted)" }}>
          💡 Mesurez toujours au même moment · Maximum 1 saisie / mois recommandée
        </p>
      </div>

      {/* Trend chart */}
      {entries.length > 1 && (
        <div className="glass p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <IconChartLine size={13} stroke={1.5} style={{ color: activeField.color }} />
              <p className="label-xs">Évolution · {activeField.label}</p>
            </div>
          </div>
          {/* Selector */}
          <div className="flex gap-1.5 flex-wrap mb-3">
            {FIELDS.map(f => (
              <button key={f.key}
                onClick={() => setActiveChart(f.key)}
                className="px-2 py-1 rounded-lg text-[10px] font-medium transition-all"
                style={{
                  background: activeChart === f.key ? `${f.color}20` : "rgba(255,255,255,0.04)",
                  border: `1px solid ${activeChart === f.key ? `${f.color}50` : "var(--border)"}`,
                  color: activeChart === f.key ? f.color : "var(--text-muted)",
                }}>
                {f.emoji} {f.label}
              </button>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={120}>
            <LineChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="label" tick={{ fontSize: 9, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 9, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} domain={["auto", "auto"]} tickFormatter={v => `${v}`} />
              <Tooltip content={({ active, payload, label: lbl }) => {
                if (!active || !payload?.length) return null;
                const v = payload[0]?.value;
                return (
                  <div className="px-2.5 py-1.5 rounded-lg text-[11px]"
                    style={{ background: "rgba(13,13,17,0.96)", border: "1px solid var(--border)" }}>
                    <p style={{ color: "var(--text-muted)" }}>{lbl}</p>
                    <p className="font-bold" style={{ color: activeField.color }}>{v} cm</p>
                  </div>
                );
              }} />
              <Line type="monotone" dataKey={activeChart}
                stroke={activeField.color} strokeWidth={2.5}
                dot={{ fill: activeField.color, r: 3, strokeWidth: 0 }}
                connectNulls activeDot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Entry form modal */}
      <AnimatePresence>
        {showForm && (
          <>
            <motion.div className="fixed inset-0 z-40"
              style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowForm(false)} />
            <motion.div
              className="fixed bottom-0 left-0 right-0 z-50 max-w-md mx-auto"
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 400, damping: 40 }}
            >
              <div className="rounded-t-2xl p-5 pb-10"
                style={{ background: "var(--surface)", border: "1px solid var(--border)", borderBottom: "none", maxHeight: "80vh", overflowY: "auto" }}>
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-[15px] font-semibold" style={{ color: "var(--text-primary)" }}>Saisir mes mensurations</p>
                    <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{displayMonth}</p>
                  </div>
                  <button onClick={() => setShowForm(false)}
                    className="w-7 h-7 rounded-full flex items-center justify-center"
                    style={{ background: "rgba(255,255,255,0.06)" }}>
                    <IconX size={13} stroke={2} style={{ color: "var(--text-muted)" }} />
                  </button>
                </div>

                {/* Fields */}
                <div className="space-y-3 mb-5">
                  {FIELDS.map(({ key, label, emoji, color }) => (
                    <div key={key} className="flex items-center gap-3">
                      <span className="text-[18px] w-7 flex-shrink-0 text-center">{emoji}</span>
                      <label className="flex-1 text-[13px]" style={{ color: "var(--text-secondary)" }}>{label}</label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number" step="0.1" min="0" max="300"
                          value={form[key] ?? ""}
                          onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                          placeholder="—"
                          className="w-20 px-2 py-1.5 rounded-xl text-[13px] text-right tabular-nums outline-none"
                          style={{
                            background: "rgba(255,255,255,0.06)",
                            border: `1px solid ${form[key] ? color + "50" : "var(--border)"}`,
                            color: form[key] ? color : "var(--text-muted)",
                          }}
                        />
                        <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>cm</span>
                      </div>
                    </div>
                  ))}
                </div>

                <p className="text-[10px] mb-4" style={{ color: "var(--text-muted)" }}>
                  💡 Mesurez à jeun, le matin, toujours au même endroit.
                  Tour de taille : au nombril. Bras : à mi-chemin entre coude et épaule.
                </p>

                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full py-3 rounded-xl text-[14px] font-semibold flex items-center justify-center gap-2"
                  style={{
                    background: "linear-gradient(135deg, rgba(139,92,246,0.8), rgba(59,130,246,0.8))",
                    color: "white",
                    opacity: saving ? 0.7 : 1,
                  }}
                >
                  {saving ? (
                    <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  ) : (
                    <IconCheck size={16} stroke={1.5} />
                  )}
                  Enregistrer
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
