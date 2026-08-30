"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  IconRuler, IconCheck, IconX, IconChartLine,
  IconStretching, IconLungs, IconBarbell, IconRulerMeasure, IconAdjustmentsHorizontal, IconRun, IconWalk,
} from "@tabler/icons-react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import Body, { type ExtendedBodyPart, type Slug } from "react-muscle-highlighter";
import type { MeasurementEntry } from "@/app/api/measurements/route";

type MeasurementKey = "waistCm" | "hipsCm" | "chestCm" | "armsCm" | "thighsCm" | "neckCm" | "calfsCm";

const FIELDS: { key: MeasurementKey; label: string; Icon: typeof IconRuler; color: string; slug: Slug }[] = [
  { key: "neckCm",   label: "Cou",           Icon: IconStretching,           color: "#a78bfa", slug: "neck"        },
  { key: "chestCm",  label: "Poitrine",       Icon: IconLungs,                color: "#60a5fa", slug: "chest"       },
  { key: "armsCm",   label: "Bras",           Icon: IconBarbell,              color: "#f97316", slug: "biceps"      },
  { key: "waistCm",  label: "Tour de taille", Icon: IconRulerMeasure,         color: "#34d399", slug: "abs"         },
  { key: "hipsCm",   label: "Hanches",        Icon: IconAdjustmentsHorizontal, color: "#f472b6", slug: "gluteal"     },
  { key: "thighsCm", label: "Cuisse",         Icon: IconRun,                  color: "#fbbf24", slug: "quadriceps"  },
  { key: "calfsCm",  label: "Mollet",         Icon: IconWalk,                 color: "#fb923c", slug: "calves"      },
];

const SLUG_TO_FIELD = new Map(FIELDS.map(f => [f.slug, f.key]));

// Real segmented anatomy (react-muscle-highlighter, MIT) — same component
// already used for muscle-group selection in the Fit2Be-PaLaMa project —
// instead of a hand-drawn silhouette. Each trackable zone lights up in its
// field's color; tapping the body or the list both drive the same highlight.
function AnatomicalBody({
  measurements,
  highlighted,
  onHighlight,
}: {
  measurements: Partial<Record<MeasurementKey, number | null>>;
  highlighted: MeasurementKey | null;
  onHighlight: (k: MeasurementKey | null) => void;
}) {
  const data: ExtendedBodyPart[] = FIELDS.map(({ key, slug, color }) => {
    const hasVal = (measurements[key] ?? 0) > 0;
    const isHighlighted = highlighted === key;
    const dimmed = highlighted !== null && !isHighlighted;
    const base = hasVal ? color : "#52525b";
    return { slug, color: dimmed ? `${base}40` : base };
  });

  return (
    <div className="[&_svg]:h-auto [&_svg]:w-full [&_svg]:mx-auto [&_svg]:max-w-[140px]">
      <Body
        data={data}
        side="front"
        gender="male"
        defaultFill="#27272a"
        border="rgba(255,255,255,0.12)"
        onBodyPartPress={(part) => {
          const field = part.slug ? SLUG_TO_FIELD.get(part.slug) : undefined;
          if (!field) return;
          onHighlight(highlighted === field ? null : field);
        }}
      />
    </div>
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
  const [mounted, setMounted]           = useState(false);

  const currentMonth = format(new Date(), "yyyy-MM");
  const displayMonth = format(new Date(), "MMMM yyyy", { locale: fr });

  // Form state
  const [form, setForm] = useState<Partial<Record<MeasurementKey, string>>>({});

  useEffect(() => { setMounted(true); }, []);

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

      {/* Anatomical body + labels */}
      <div className="glass p-4">
        <div className="flex gap-4">
          {/* Body diagram */}
          <div className="w-[120px] flex-shrink-0">
            {loading ? (
              <div className="w-full h-[220px] flex items-center justify-center">
                <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
                  style={{ borderColor: "rgba(139,92,246,0.3)", borderTopColor: "#a78bfa" }} />
              </div>
            ) : (
              <AnatomicalBody
                measurements={currentValues}
                highlighted={highlighted}
                onHighlight={setHighlighted}
              />
            )}
          </div>

          {/* Measurements list */}
          <div className="flex-1 space-y-1.5">
            {FIELDS.map(({ key, label, Icon, color }) => {
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
                  <Icon size={14} stroke={1.75} className="flex-shrink-0" style={{ color }} />
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
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium transition-all"
                style={{
                  background: activeChart === f.key ? `${f.color}20` : "rgba(255,255,255,0.04)",
                  border: `1px solid ${activeChart === f.key ? `${f.color}50` : "var(--border)"}`,
                  color: activeChart === f.key ? f.color : "var(--text-muted)",
                }}>
                <f.Icon size={11} stroke={1.75} />
                {f.label}
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

      {/* Entry form modal — portaled to <body> so its z-index isn't capped by
          this page's own z-10 stacking-context wrapper (which otherwise sits
          below the fixed bottom nav's z-50 no matter how high a z-index is
          set here — that's what made "Enregistrer" unreachable). */}
      {showForm && mounted && createPortal(
      <AnimatePresence>
          <>
            <motion.div key="bmt-backdrop" className="fixed inset-0 z-[200]"
              style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowForm(false)} />
            <motion.div
              key="bmt-sheet"
              className="fixed bottom-0 left-0 right-0 z-[200] max-w-md mx-auto"
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
                  {FIELDS.map(({ key, label, Icon, color }) => (
                    <div key={key} className="flex items-center gap-3">
                      <div className="w-7 flex-shrink-0 flex items-center justify-center">
                        <Icon size={17} stroke={1.75} style={{ color }} />
                      </div>
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
      </AnimatePresence>,
      document.body,
      )}
    </div>
  );
}
