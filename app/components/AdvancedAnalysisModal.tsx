"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { IconX, IconLoader2, IconBrain, IconFlame, IconScale, IconRun, IconMoon, IconHeart } from "@tabler/icons-react";

type Period = "7d" | "1m" | "3m";

const PERIODS: { key: Period; label: string }[] = [
  { key: "7d", label: "7 jours" },
  { key: "1m", label: "1 mois"  },
  { key: "3m", label: "3 mois"  },
];

interface AnalysisData {
  logDays:         number;
  fitDays:         number;
  avgCalories:     number | null;
  avgProtein:      number | null;
  avgCarbs:        number | null;
  avgFat:          number | null;
  avgFiber:        number | null;
  avgWaterL:       number | null;
  firstWeight:     number | null;
  lastWeight:      number | null;
  weightDelta:     number | null;
  avgSteps:        number | null;
  avgActiveMin:    number | null;
  avgBurned:       number | null;
  avgSleepMin:     number | null;
  avgHR:           number | null;
  avgBpSys:        number | null;
  avgBpDia:        number | null;
  activityCount:   number;
  activityMinTotal: number;
  topActivities:   string[];
}

interface Props {
  open:    boolean;
  onClose: () => void;
}

function SleepLabel(min: number | null): string {
  if (!min) return "—";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}

function StatRow({ icon, label, value, unit, color }: {
  icon: React.ReactNode; label: string; value: string | number | null; unit?: string; color?: string;
}) {
  if (value == null || value === 0) return null;
  return (
    <div className="flex items-center justify-between py-1.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      <div className="flex items-center gap-2">
        <span style={{ color: color ?? "var(--text-muted)" }}>{icon}</span>
        <span className="text-[12px]" style={{ color: "var(--text-secondary)" }}>{label}</span>
      </div>
      <span className="text-[12px] font-semibold tabular-nums" style={{ color: color ?? "var(--text-primary)" }}>
        {value}{unit ? ` ${unit}` : ""}
      </span>
    </div>
  );
}

// Parse AI markdown text into sections for nice rendering
function parseAnalysis(text: string): { emoji: string; title: string; body: string }[] {
  const sections: { emoji: string; title: string; body: string }[] = [];
  // Split on lines starting with emoji + **
  const parts = text.split(/\n(?=[🍽️⚖️🏃😴🎯])/u);
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    // Extract emoji + title from **…**
    const m = trimmed.match(/^([🍽️⚖️🏃😴🎯]\s*)\*\*([^*]+)\*\*\s*[—–-]?\s*([\s\S]*)$/u);
    if (m) {
      sections.push({ emoji: m[1].trim(), title: m[2].trim(), body: m[3].trim() });
    } else {
      // Fallback: no title, whole thing is body
      sections.push({ emoji: "", title: "", body: trimmed });
    }
  }
  return sections;
}

export default function AdvancedAnalysisModal({ open, onClose }: Props) {
  const [period,   setPeriod]   = useState<Period>("1m");
  const [loading,  setLoading]  = useState(false);
  const [result,   setResult]   = useState<{ text: string; data: AnalysisData; periodLabel: string } | null>(null);
  const [error,    setError]    = useState<string | null>(null);

  const run = useCallback(async (p: Period) => {
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch(`/api/ai/advanced-analysis?period=${p}`);
      if (!res.ok) { setError("Erreur serveur"); return; }
      const json = await res.json() as { text: string; data: AnalysisData; periodLabel: string };
      setResult(json);
    } catch {
      setError("Impossible de générer l'analyse");
    } finally { setLoading(false); }
  }, []);

  if (!open) return null;

  const sections = result ? parseAnalysis(result.text) : [];
  const d = result?.data;

  return (
    <AnimatePresence>
      <motion.div
        key="aa-overlay"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex flex-col"
        style={{ background: "rgba(0,0,0,0.88)", backdropFilter: "blur(10px)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-safe-top pt-4 pb-3 flex-shrink-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(139,92,246,0.2)", border: "1px solid rgba(139,92,246,0.4)" }}>
              <IconBrain size={16} style={{ color: "#a78bfa" }} />
            </div>
            <div>
              <h2 className="text-[17px] font-semibold" style={{ color: "var(--text-primary)" }}>
                Analyse Avancée
              </h2>
              <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                Bilan holistique IA de toutes vos données
              </p>
            </div>
          </div>
          <button onClick={onClose} className="btn-icon">
            <IconX size={18} />
          </button>
        </div>

        {/* Period selector + Run button */}
        <div className="flex gap-2 px-4 py-3 flex-shrink-0">
          {PERIODS.map(p => (
            <button key={p.key} onClick={() => setPeriod(p.key)}
              className="flex-1 py-2 rounded-xl text-[12px] font-medium transition-all"
              style={{
                background: period === p.key ? "rgba(139,92,246,0.15)" : "rgba(255,255,255,0.05)",
                border: `1px solid ${period === p.key ? "rgba(139,92,246,0.5)" : "var(--border)"}`,
                color: period === p.key ? "#a78bfa" : "var(--text-secondary)",
              }}>
              {p.label}
            </button>
          ))}
          <button
            onClick={() => run(period)}
            disabled={loading}
            className="px-4 py-2 rounded-xl text-[12px] font-semibold transition-all flex items-center gap-1.5 flex-shrink-0"
            style={{
              background: loading ? "rgba(139,92,246,0.1)" : "rgba(139,92,246,0.2)",
              border: "1px solid rgba(139,92,246,0.5)",
              color: "#a78bfa",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading
              ? <><IconLoader2 size={13} className="animate-spin" /> Analyse…</>
              : <><IconBrain size={13} /> Analyser</>
            }
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 pb-8" style={{ scrollbarWidth: "none" }}>

          {/* Initial state */}
          {!loading && !result && !error && (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.25)" }}>
                <IconBrain size={32} style={{ color: "rgba(139,92,246,0.6)" }} />
              </div>
              <div className="text-center">
                <p className="text-[14px] font-medium mb-1" style={{ color: "var(--text-primary)" }}>
                  Analyse holistique IA
                </p>
                <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
                  Sélectionne une période et lance l&apos;analyse
                </p>
              </div>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <div className="relative w-16 h-16">
                <div className="absolute inset-0 rounded-2xl animate-pulse"
                  style={{ background: "rgba(139,92,246,0.15)" }} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <IconBrain size={28} style={{ color: "#a78bfa" }} />
                </div>
              </div>
              <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>
                Analyse de toutes vos données…
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="glass p-4 mt-4 text-center">
              <p className="text-[13px]" style={{ color: "var(--fit-red)" }}>{error}</p>
            </div>
          )}

          {/* Result */}
          {result && d && !loading && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }} className="space-y-4">

              {/* Period label */}
              <p className="text-[11px] pt-1" style={{ color: "var(--text-muted)" }}>
                Analyse sur les {result.periodLabel} · {d.logDays} jours de nutrition · {d.fitDays} jours fitness
              </p>

              {/* Stats grid */}
              <div className="glass p-4 rounded-2xl space-y-0">
                <p className="text-[11px] font-semibold mb-2 uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                  Données brutes
                </p>
                <StatRow icon={<IconFlame size={14} />} label="Calories moy." value={d.avgCalories} unit="kcal/j" color="var(--calories)" />
                <StatRow icon={<span className="text-[12px]">🥩</span>} label="Protéines moy." value={d.avgProtein} unit="g/j" color="var(--protein)" />
                <StatRow icon={<span className="text-[12px]">💧</span>} label="Eau moy." value={d.avgWaterL} unit="L/j" color="#38bdf8" />
                {d.lastWeight && (
                  <StatRow icon={<IconScale size={14} />} label="Poids actuel" value={d.lastWeight} unit="kg" color="var(--fiber)" />
                )}
                {d.weightDelta !== null && (
                  <StatRow
                    icon={<span className="text-[12px]">{(d.weightDelta ?? 0) <= 0 ? "📉" : "📈"}</span>}
                    label="Variation poids"
                    value={`${(d.weightDelta ?? 0) > 0 ? "+" : ""}${d.weightDelta}`}
                    unit="kg"
                    color={(d.weightDelta ?? 0) <= 0 ? "var(--fit-green)" : "var(--fit-red)"}
                  />
                )}
                <StatRow icon={<IconRun size={14} />} label="Pas moy." value={d.avgSteps?.toLocaleString("fr-FR") ?? null} color="var(--steps)" />
                <StatRow icon={<IconMoon size={14} />} label="Sommeil moy." value={SleepLabel(d.avgSleepMin)} color="#818cf8" />
                <StatRow icon={<IconHeart size={14} />} label="FC repos moy." value={d.avgHR} unit="bpm" color="var(--fit-red)" />
                {d.avgBpSys && (
                  <StatRow icon={<span className="text-[12px]">🩺</span>} label="Tension moy." value={`${d.avgBpSys}/${d.avgBpDia}`} unit="mmHg" color="var(--text-secondary)" />
                )}
                {d.activityCount > 0 && (
                  <StatRow icon={<span className="text-[12px]">🏋️</span>} label="Séances sport" value={d.activityCount} color="var(--protein)" />
                )}
              </div>

              {/* AI Analysis sections */}
              <div className="space-y-3">
                {sections.length > 0 ? sections.map((s, i) => (
                  <motion.div key={i}
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08 }}
                    className="glass p-4 rounded-2xl"
                  >
                    {s.title && (
                      <p className="text-[13px] font-semibold mb-1.5" style={{ color: "var(--text-primary)" }}>
                        {s.emoji} {s.title}
                      </p>
                    )}
                    <p className="text-[12px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                      {s.body}
                    </p>
                  </motion.div>
                )) : (
                  // Fallback: render plain text
                  <div className="glass p-4 rounded-2xl">
                    <p className="text-[13px] leading-relaxed whitespace-pre-wrap" style={{ color: "var(--text-secondary)" }}>
                      {result.text}
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
