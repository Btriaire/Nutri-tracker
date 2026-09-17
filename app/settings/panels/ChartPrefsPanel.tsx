"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { IconLoader2, IconChevronDown, IconChevronUp } from "@tabler/icons-react";

const CHART_TYPE_OPTIONS: { value: string; label: string; icon: string }[] = [
  { value: "area", label: "Aire",     icon: "📈" },
  { value: "bar",  label: "Barres",   icon: "📊" },
  { value: "line", label: "Ligne",    icon: "〰️" },
];

const MACRO_DISPLAY_OPTIONS: { value: string; label: string; icon: string }[] = [
  { value: "rings", label: "Anneaux", icon: "🔵" },
  { value: "bars",  label: "Barres",  icon: "📊" },
  { value: "pie",   label: "Camembert", icon: "🥧" },
];

export default function ChartPrefsPanel() {
  const [calType,    setCalType]    = useState<string>("area");
  const [wtType,     setWtType]     = useState<string>("line");
  const [macroDisp,  setMacroDisp]  = useState<string>("rings");
  const [showMicro,  setShowMicro]  = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [saved,      setSaved]      = useState(false);
  const [open,       setOpen]       = useState(false);

  // Load current saved prefs on open
  useEffect(() => {
    fetch("/api/goals")
      .then((r) => r.json())
      .then((data: { chartPrefs?: { calorieTrend?: string; weightTrend?: string; macroDisplay?: string; showMicroNutrients?: boolean } | null }) => {
        if (!data.chartPrefs) return;
        if (data.chartPrefs.calorieTrend)  setCalType(data.chartPrefs.calorieTrend);
        if (data.chartPrefs.weightTrend)   setWtType(data.chartPrefs.weightTrend);
        if (data.chartPrefs.macroDisplay)  setMacroDisp(data.chartPrefs.macroDisplay);
        if (data.chartPrefs.showMicroNutrients != null) setShowMicro(data.chartPrefs.showMicroNutrients);
      })
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch("/api/goals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chartPrefs: {
            calorieTrend:       calType,
            weightTrend:        wtType,
            macroDisplay:       macroDisp,
            showMicroNutrients: showMicro,
            showSleepData:      true,
            showHeartRate:      true,
          },
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally { setSaving(false); }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.12 }}
      className="glass overflow-hidden"
    >
      {/* Collapsible header */}
      <button className="w-full flex items-center justify-between px-5 py-4" onClick={() => setOpen(v => !v)}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0"
            style={{ background: "rgba(167,139,250,0.12)", border: "1px solid rgba(167,139,250,0.2)" }}>
            🎨
          </div>
          <div className="text-left">
            <p className="font-semibold text-[13.5px]" style={{ color: "var(--text-primary)" }}>Graphiques</p>
            <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Apparence &amp; données</p>
          </div>
        </div>
        {open
          ? <IconChevronUp  size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
          : <IconChevronDown size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="chart-prefs-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{ overflow: "hidden" }}
          >
            <div className="px-5 pb-5 space-y-5" style={{ borderTop: "1px solid var(--border)" }}>

              {/* ── Calories chart type ── */}
              <div className="pt-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide mb-2.5" style={{ color: "var(--text-muted)" }}>
                  Tendance calories
                </p>
                <div className="flex gap-2">
                  {CHART_TYPE_OPTIONS.map(opt => (
                    <button key={opt.value} onClick={() => setCalType(opt.value)}
                      className="flex-1 flex flex-col items-center gap-1.5 py-3 rounded-2xl transition-all"
                      style={{
                        background: calType === opt.value ? "rgba(167,139,250,0.15)" : "rgba(255,255,255,0.03)",
                        border: `1.5px solid ${calType === opt.value ? "rgba(167,139,250,0.5)" : "rgba(255,255,255,0.07)"}`,
                      }}>
                      <span style={{ fontSize: 20 }}>{opt.icon}</span>
                      <span className="text-[11px] font-medium"
                        style={{ color: calType === opt.value ? "var(--protein)" : "var(--text-muted)" }}>
                        {opt.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Macros display ── */}
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide mb-2.5" style={{ color: "var(--text-muted)" }}>
                  Affichage macros
                </p>
                <div className="flex gap-2">
                  {MACRO_DISPLAY_OPTIONS.map(opt => (
                    <button key={opt.value} onClick={() => setMacroDisp(opt.value)}
                      className="flex-1 flex flex-col items-center gap-1.5 py-3 rounded-2xl transition-all"
                      style={{
                        background: macroDisp === opt.value ? "rgba(52,211,153,0.12)" : "rgba(255,255,255,0.03)",
                        border: `1.5px solid ${macroDisp === opt.value ? "rgba(52,211,153,0.4)" : "rgba(255,255,255,0.07)"}`,
                      }}>
                      <span style={{ fontSize: 20 }}>{opt.icon}</span>
                      <span className="text-[11px] font-medium"
                        style={{ color: macroDisp === opt.value ? "var(--fiber)" : "var(--text-muted)" }}>
                        {opt.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Weight trend ── */}
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide mb-2.5" style={{ color: "var(--text-muted)" }}>
                  Courbe de poids
                </p>
                <div className="flex gap-2">
                  {CHART_TYPE_OPTIONS.map(opt => (
                    <button key={opt.value} onClick={() => setWtType(opt.value)}
                      className="flex-1 flex flex-col items-center gap-1.5 py-3 rounded-2xl transition-all"
                      style={{
                        background: wtType === opt.value ? "rgba(251,191,36,0.12)" : "rgba(255,255,255,0.03)",
                        border: `1.5px solid ${wtType === opt.value ? "rgba(251,191,36,0.4)" : "rgba(255,255,255,0.07)"}`,
                      }}>
                      <span style={{ fontSize: 20 }}>{opt.icon}</span>
                      <span className="text-[11px] font-medium"
                        style={{ color: wtType === opt.value ? "var(--carbs)" : "var(--text-muted)" }}>
                        {opt.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Toggles ── */}
              <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                <button
                  className="w-full flex items-center justify-between px-4 py-3 transition-colors"
                  style={{ background: showMicro ? "rgba(167,139,250,0.06)" : "transparent" }}
                  onClick={() => setShowMicro(v => !v)}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-base">🔬</span>
                    <span className="text-[12.5px]" style={{ color: "var(--text-secondary)" }}>Micro-nutriments</span>
                  </div>
                  <div className="w-10 h-5.5 rounded-full relative flex-shrink-0 transition-all"
                    style={{ background: showMicro ? "var(--protein)" : "rgba(255,255,255,0.12)", height: "22px" }}>
                    <span className="absolute top-[2px] w-[18px] h-[18px] rounded-full transition-all"
                      style={{ background: "#fff", left: showMicro ? "calc(100% - 20px)" : "2px" }} />
                  </div>
                </button>
              </div>

              {/* ── Save ── */}
              <button onClick={handleSave} disabled={saving}
                className="btn btn-primary w-full gap-2 text-[13px]" style={{ height: "42px" }}>
                {saved ? "✓ Préférences sauvegardées" : saving ? <><IconLoader2 size={12} className="animate-spin" /> Sauvegarde…</> : "Appliquer les préférences"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Tracked Nutrients Panel ──────────────────────────────────────────────────
