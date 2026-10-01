"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { IconCircleCheck, IconLoader2, IconChevronDown, IconChevronUp, IconDeviceFloppy, IconDroplet } from "@tabler/icons-react";
import type { NutritionGoals } from "@/app/lib/types";
import { DEFAULT_GLUCOSE_TARGET } from "@/app/lib/glucose";

export default function GlycemiePanel({ initialGoals }: { initialGoals: NutritionGoals }) {
  const [open,    setOpen]    = useState(false);
  const [enabled, setEnabled] = useState(initialGoals.glucoseTracking ?? false);
  const [min,     setMin]     = useState((initialGoals.glucoseTargetMinMmol ?? DEFAULT_GLUCOSE_TARGET.min).toString());
  const [max,     setMax]     = useState((initialGoals.glucoseTargetMaxMmol ?? DEFAULT_GLUCOSE_TARGET.max).toString());
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch("/api/goals", {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          glucoseTracking:      enabled,
          glucoseTargetMinMmol: parseFloat(min) || DEFAULT_GLUCOSE_TARGET.min,
          glucoseTargetMaxMmol: parseFloat(max) || DEFAULT_GLUCOSE_TARGET.max,
        }),
      });
      setSaved(true);
      setTimeout(() => { setSaved(false); setOpen(false); }, 1200);
    } finally { setSaving(false); }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.05 }}
      className="glass overflow-hidden mb-4"
    >
      <button className={`w-full flex items-center justify-between px-5 ${open ? "py-4" : "py-3"} transition-all`} onClick={() => setOpen(v => !v)}>
        <div className="flex items-center gap-3">
          <div className={`${open ? "w-9 h-9" : "w-7 h-7"} rounded-xl flex items-center justify-center flex-shrink-0 transition-all`}
            style={{ background: "color-mix(in srgb, var(--fat) 14%, transparent)", border: "1px solid color-mix(in srgb, var(--fat) 28%, transparent)" }}>
            <IconDroplet size={open ? 20 : 16} stroke={1.8} style={{ color: "var(--fat)" }} />
          </div>
          <div className="text-left">
            <p className={`font-semibold ${open ? "text-[13.5px]" : "text-[13px]"}`} style={{ color: "var(--text-primary)" }}>Glycémie</p>
            <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
              {enabled ? `Activé · cible ${min}–${max} mmol/L` : "Désactivé — cliquer pour configurer"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={e => { e.stopPropagation(); setEnabled(v => !v); }}
            className="relative flex-shrink-0 w-11 h-6 rounded-full transition-colors duration-200"
            style={{ background: enabled ? "var(--fat)" : "var(--layer-3)" }}
          >
            <span className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200"
              style={{ transform: enabled ? "translateX(20px)" : "translateX(0)" }} />
          </button>
          {open ? <IconChevronUp size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                : <IconChevronDown size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />}
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div key="glycemie-body" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
            <div className="px-5 pb-5 space-y-4" style={{ borderTop: "1px solid var(--border)" }}>

              <div className="flex items-center justify-between pt-4">
                <div>
                  <p className="text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>Activer le suivi</p>
                  <p className="text-[12px] mt-0.5 max-w-[220px]" style={{ color: "var(--text-muted)" }}>
                    {enabled
                      ? "Rapport avant/après repas dans le Journal, tendance dans Progrès et dans les rapports"
                      : "N'apparaît nulle part tant que c'est désactivé"}
                  </p>
                </div>
                <button onClick={() => setEnabled(v => !v)}
                  className="relative flex-shrink-0 w-11 h-6 rounded-full transition-colors duration-200"
                  style={{ background: enabled ? "var(--fat)" : "var(--layer-3)" }}>
                  <span className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200"
                    style={{ transform: enabled ? "translateX(20px)" : "translateX(0)" }} />
                </button>
              </div>

              <AnimatePresence initial={false}>
                {enabled && (
                  <motion.div key="glycemie-target" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                    <div className="rounded-2xl p-4 space-y-3"
                      style={{ background: "color-mix(in srgb, var(--fat) 6%, transparent)", border: "1px solid color-mix(in srgb, var(--fat) 18%, transparent)" }}>
                      <p className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: "var(--fat)" }}>Plage cible (mmol/L)</p>
                      <div className="flex items-center gap-2">
                        <input type="number" value={min} min="1" max="15" step="0.1" onChange={e => setMin(e.target.value)}
                          className="input text-center" style={{ height: 44 }} aria-label="Borne basse" />
                        <span className="text-[13px]" style={{ color: "var(--text-muted)" }}>à</span>
                        <input type="number" value={max} min="4" max="25" step="0.1" onChange={e => setMax(e.target.value)}
                          className="input text-center" style={{ height: 44 }} aria-label="Borne haute" />
                      </div>
                      <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
                        Par défaut 3,9–10,0 mmol/L (repère « temps dans la cible » du consensus international sur les capteurs continus).
                        Règle-la sur la plage que ton médecin t&apos;a donnée si elle diffère — ce n&apos;est pas un avis médical.
                      </p>
                      <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
                        Fonctionne avec un capteur relié à Google Fit (par ex. Dexcom via une appli de synchronisation). Aucune saisie manuelle requise.
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

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
