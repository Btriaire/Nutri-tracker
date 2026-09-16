"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { IconCircleCheck, IconLoader2, IconChevronDown, IconChevronUp, IconDeviceFloppy } from "@tabler/icons-react";
import type { NutritionGoals } from "@/app/lib/types";

export default function AlcoolPanel({ initialGoals }: { initialGoals: NutritionGoals }) {
  const [open,       setOpen]       = useState(false);
  const [enabled,    setEnabled]    = useState(initialGoals.alcoholTracking ?? false);
  const [weeklyGoal, setWeeklyGoal] = useState((initialGoals.weeklyAlcoolUnitsGoal ?? 14).toString());
  const [saving,     setSaving]     = useState(false);
  const [saved,      setSaved]      = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch("/api/goals", {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          alcoholTracking:       enabled,
          weeklyAlcoolUnitsGoal: enabled ? (parseFloat(weeklyGoal) || 14) : 0,
        }),
      });
      setSaved(true);
      // auto-collapse the panel after 1s so user sees the confirmation
      setTimeout(() => {
        setSaved(false);
        setOpen(false);
      }, 1200);
    } finally { setSaving(false); }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.04 }}
      className="glass overflow-hidden mb-4"
    >
      {/* Collapsible header */}
      <button className={`w-full flex items-center justify-between px-5 ${open ? "py-4" : "py-3"} transition-all`} onClick={() => setOpen(v => !v)}>
        <div className="flex items-center gap-3">
          <div className={`${open ? "w-9 h-9" : "w-7 h-7"} rounded-xl flex items-center justify-center flex-shrink-0 transition-all`}
            style={{ background: "rgba(192,132,252,0.12)", border: "1px solid rgba(192,132,252,0.22)" }}>
            {/* Wine glass SVG icon */}
            <svg width={open ? 20 : 16} height={open ? 20 : 16} viewBox="0 0 24 28" fill="none">
              <path d="M5 3 L19 3 L15.5 14 L8.5 14 Z" stroke="#c084fc" strokeWidth="1.7" strokeLinejoin="round" fill="#c084fc" fillOpacity="0.2" />
              <line x1="12" y1="14" x2="12" y2="22" stroke="#c084fc" strokeWidth="1.7" strokeLinecap="round" />
              <path d="M7 22 Q12 25 17 22" stroke="#c084fc" strokeWidth="1.7" strokeLinecap="round" fill="none" />
              <circle cx="11" cy="9" r="1.2" fill="#c084fc" fillOpacity="0.5" />
            </svg>
          </div>
          <div className="text-left">
            <p className={`font-semibold ${open ? "text-[13.5px]" : "text-[13px]"}`} style={{ color: "var(--text-primary)" }}>Suivi Alcool</p>
            <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
              {enabled ? `Activé · objectif ${weeklyGoal} u/sem.` : "Désactivé — cliquer pour configurer"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          {/* Quick toggle in header — stop propagation so it doesn't also open/close */}
          <button
            onClick={e => { e.stopPropagation(); setEnabled(v => !v); }}
            className="relative flex-shrink-0 w-11 h-6 rounded-full transition-colors duration-200"
            style={{ background: enabled ? "#c084fc" : "rgba(255,255,255,0.12)" }}
          >
            <span
              className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200"
              style={{ transform: enabled ? "translateX(20px)" : "translateX(0)" }}
            />
          </button>
          {open
            ? <IconChevronUp  size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
            : <IconChevronDown size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />}
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="alcool-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 space-y-4" style={{ borderTop: "1px solid var(--border)" }}>

              {/* Toggle */}
              <div className="flex items-center justify-between pt-4">
                <div>
                  <p className="text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>
                    Activer le suivi
                  </p>
                  <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {enabled
                      ? "Verre SVG animé + presets rapides dans le Journal"
                      : "N'apparaît pas dans le Journal"}
                  </p>
                </div>
                <button
                  onClick={() => setEnabled(v => !v)}
                  className="relative flex-shrink-0 w-11 h-6 rounded-full transition-colors duration-200"
                  style={{ background: enabled ? "#c084fc" : "rgba(255,255,255,0.12)" }}
                >
                  <span
                    className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200"
                    style={{ transform: enabled ? "translateX(20px)" : "translateX(0)" }}
                  />
                </button>
              </div>

              {/* Weekly goal — only when enabled */}
              <AnimatePresence initial={false}>
                {enabled && (
                  <motion.div
                    key="alcool-goal"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="rounded-2xl p-4 space-y-3"
                      style={{ background: "rgba(192,132,252,0.06)", border: "1px solid rgba(192,132,252,0.18)" }}>
                      <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "#c084fc" }}>
                        Objectif hebdomadaire
                      </p>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setWeeklyGoal(v => String(Math.max(1, (parseFloat(v) || 14) - 1)))}
                          className="w-9 h-9 rounded-xl flex items-center justify-center text-xl font-bold transition-colors"
                          style={{ background: "rgba(255,255,255,0.07)", color: "var(--text-secondary)" }}
                        >−</button>
                        <input
                          type="number" value={weeklyGoal} min="1" max="100" step="1"
                          onChange={e => setWeeklyGoal(e.target.value)}
                          className="w-16 text-center text-[18px] font-bold rounded-xl outline-none tabular-nums"
                          style={{
                            background: "rgba(192,132,252,0.08)",
                            border: "1px solid rgba(192,132,252,0.30)",
                            color: "#c084fc", padding: "7px 4px",
                          }}
                        />
                        <button
                          onClick={() => setWeeklyGoal(v => String((parseFloat(v) || 14) + 1))}
                          className="w-9 h-9 rounded-xl flex items-center justify-center text-xl font-bold transition-colors"
                          style={{ background: "rgba(255,255,255,0.07)", color: "var(--text-secondary)" }}
                        >+</button>
                        <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>unités / semaine</span>
                      </div>
                      <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                        🌍 OMS : ≤ 10 u/sem pour les femmes · ≤ 14 u/sem pour les hommes.
                        1 unité standard = 10 g d&apos;alcool pur.
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Save */}
              <button onClick={handleSave} disabled={saving || saved}
                className="btn btn-primary w-full gap-2" style={{ height: "40px" }}>
                {saved
                  ? <><IconCircleCheck size={14} stroke={2} /> Enregistré !</>
                  : saving
                    ? <><IconLoader2 size={13} stroke={2} className="animate-spin" /> Sauvegarde…</>
                    : <><IconDeviceFloppy size={14} /> Enregistrer</>}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Chart Preferences Panel ─────────────────────────────────────────────────
