"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { IconCircleCheck, IconLoader2, IconChevronDown, IconChevronUp, IconDeviceFloppy } from "@tabler/icons-react";

const FASTING_DURATIONS: { h: 8 | 12 | 16 | 24; label: string; desc: string }[] = [
  { h: 8,  label: "8h",  desc: "Sauté" },
  { h: 12, label: "12h", desc: "Léger" },
  { h: 16, label: "16h", desc: "16:8" },
  { h: 24, label: "24h", desc: "Complet" },
];

const WEEK_DAYS = [
  { dow: 1, short: "L" },
  { dow: 2, short: "M" },
  { dow: 3, short: "M" },
  { dow: 4, short: "J" },
  { dow: 5, short: "V" },
  { dow: 6, short: "S" },
  { dow: 0, short: "D" },
];

export default function FastingPanel() {
  const [open,      setOpen]      = useState(false);
  const [enabled,   setEnabled]   = useState(false);
  const [duration,  setDuration]  = useState<8 | 12 | 16 | 24>(16);
  const [days,      setDays]      = useState<number[]>([1, 2, 3, 4, 5]);
  const [saving,    setSaving]    = useState(false);
  const [saved,     setSaved]     = useState(false);

  useEffect(() => {
    fetch("/api/goals")
      .then(r => r.json())
      .then((d: { goals?: { intermittentFasting?: { enabled: boolean; durationH: 8|12|16|24; days: number[] } } }) => {
        const f = d.goals?.intermittentFasting;
        if (f) {
          setEnabled(f.enabled);
          setDuration(f.durationH);
          setDays(f.days);
        }
      })
      .catch(() => {});
  }, []);

  const toggleDay = (dow: number) => {
    setDays(prev => prev.includes(dow) ? prev.filter(d => d !== dow) : [...prev, dow].sort());
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch("/api/goals", {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          intermittentFasting: { enabled, durationH: duration, days },
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
      transition={{ duration: 0.3, delay: 0.13 }}
      className="glass overflow-hidden"
    >
      {/* Collapsible header */}
      <button className="w-full flex items-center justify-between px-5 py-4" onClick={() => setOpen(v => !v)}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0"
            style={{ background: "rgba(129,140,248,0.12)", border: "1px solid rgba(129,140,248,0.22)" }}>
            🌿
          </div>
          <div className="text-left">
            <p className="font-semibold text-[13.5px]" style={{ color: "var(--text-primary)" }}>Jeûne Intermittent</p>
            <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
              {enabled ? `${duration}h · ${days.length} jour${days.length > 1 ? "s" : ""}/sem` : "Désactivé"}
            </p>
          </div>
        </div>
        {open
          ? <IconChevronUp  size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
          : <IconChevronDown size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 space-y-5" style={{ borderTop: "1px solid var(--border)" }}>

              {/* Toggle */}
              <div className="flex items-center justify-between pt-4">
                <div>
                  <p className="text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>Activer</p>
                  <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                    Affiche un chrono sur le dashboard et le journal
                  </p>
                </div>
                <button
                  onClick={() => setEnabled(v => !v)}
                  className="relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0"
                  style={{
                    background: enabled ? "#818cf8" : "rgba(255,255,255,0.1)",
                    border: "1px solid rgba(255,255,255,0.1)",
                  }}
                >
                  <span
                    className="absolute top-0.5 rounded-full bg-white transition-all duration-200"
                    style={{
                      width: 20, height: 20,
                      left: enabled ? "calc(100% - 22px)" : "2px",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                    }}
                  />
                </button>
              </div>

              {enabled && (
                <>
                  {/* Duration */}
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>
                      Durée du jeûne
                    </p>
                    <div className="grid grid-cols-4 gap-2">
                      {FASTING_DURATIONS.map(({ h, label, desc }) => (
                        <button
                          key={h}
                          onClick={() => setDuration(h)}
                          className="flex flex-col items-center gap-1 py-3 rounded-2xl transition-all"
                          style={{
                            background: duration === h ? "rgba(129,140,248,0.18)" : "rgba(255,255,255,0.04)",
                            border: `1.5px solid ${duration === h ? "#818cf8" : "rgba(255,255,255,0.07)"}`,
                            boxShadow: duration === h ? "0 0 12px rgba(129,140,248,0.2)" : "none",
                          }}
                        >
                          <span className="text-[16px] font-bold"
                            style={{ color: duration === h ? "#818cf8" : "var(--text-primary)" }}>
                            {label}
                          </span>
                          <span className="text-[11px]"
                            style={{ color: duration === h ? "#818cf8" : "var(--text-muted)" }}>
                            {desc}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Days of week */}
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>
                      Jours de la semaine
                    </p>
                    <div className="flex justify-between gap-1.5">
                      {WEEK_DAYS.map(({ dow, short }) => {
                        const on = days.includes(dow);
                        return (
                          <button
                            key={dow}
                            onClick={() => toggleDay(dow)}
                            className="flex-1 h-10 rounded-xl text-[12px] font-bold transition-all"
                            style={{
                              background: on ? "rgba(129,140,248,0.18)" : "rgba(255,255,255,0.04)",
                              color:      on ? "#818cf8" : "var(--text-muted)",
                              border:     `1.5px solid ${on ? "#818cf8" : "rgba(255,255,255,0.07)"}`,
                            }}
                          >
                            {short}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[11px] mt-2" style={{ color: "var(--text-muted)" }}>
                      {days.length === 0
                        ? "Aucun jour sélectionné"
                        : `${days.length} jour${days.length > 1 ? "s" : ""} par semaine`}
                    </p>
                  </div>
                </>
              )}

              {/* Save */}
              <button onClick={handleSave} disabled={saving || saved} className="btn btn-primary w-full gap-2" style={{ height: "40px" }}>
                {saved   ? <><IconCircleCheck size={14} stroke={2} /> Enregistré !</>
                 : saving ? <><IconLoader2 size={13} stroke={2} className="animate-spin" /> Sauvegarde…</>
                 : <><IconDeviceFloppy size={14} /> Enregistrer</>}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ─── Theme Picker ─────────────────────────────────────────────────────────── */
