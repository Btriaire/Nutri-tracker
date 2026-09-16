"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { IconCircleCheck, IconChevronDown, IconChevronUp } from "@tabler/icons-react";
import type { DietProgramPrefs, DietProgramId } from "@/app/lib/types";
import {
  DIET_PROGRAMS, dietMealSummary, DIET_INTERDITS_SUMMARY,
  APPROVED_FRUITS_SUMMARY, FORBIDDEN_FRUITS_SUMMARY,
  CHOLESTEROL_FAVORISER_SUMMARY, CHOLESTEROL_LIMITER_SUMMARY,
  resolveDietProgramId,
} from "@/app/lib/diet-program";

import type { MealType } from "@/app/lib/types";

const DIET_MEAL_ORDER: MealType[] = ["breakfast", "lunch", "snacks", "dinner"];
const DIET_MEAL_LABEL: Record<MealType, string> = {
  breakfast: "Petit-déjeuner",
  lunch:     "Déjeuner",
  snacks:    "Goûter",
  dinner:    "Dîner",
};

const DIET_PROGRAM_OPTIONS: { id: DietProgramId | null; label: string }[] = [
  { id: null,          label: "Aucun" },
  { id: "tl",          label: DIET_PROGRAMS.tl.name },
  { id: "cholesterol", label: DIET_PROGRAMS.cholesterol.name },
];

export default function DietProgramPanel() {
  const [open,      setOpen]      = useState(false);
  const [programId, setProgramId] = useState<DietProgramId | null>(null);
  const [saving,    setSaving]    = useState(false);
  const [saved,     setSaved]     = useState(false);

  useEffect(() => {
    fetch("/api/goals")
      .then(r => r.json())
      .then((d: { dietProgram?: DietProgramPrefs | null }) => {
        setProgramId(resolveDietProgramId(d.dietProgram));
      })
      .catch(() => {});
  }, []);

  const handleSelect = async (next: DietProgramId | null) => {
    setProgramId(next);
    setSaving(true);
    try {
      await fetch("/api/goals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dietProgram: { programId: next, enabled: next === "tl" } as DietProgramPrefs }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 1200);
    } finally { setSaving(false); }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.075 }} className="glass p-4 mb-4">

      {/* Header */}
      <button className="w-full flex items-center gap-3" onClick={() => setOpen(v => !v)}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0"
          style={{ background: "rgba(56,189,248,0.12)" }}>{programId ? DIET_PROGRAMS[programId].icon : "🍽️"}</div>
        <div className="flex-1 min-w-0 text-left">
          <p className="font-semibold text-[13.5px]" style={{ color: "var(--text-primary)" }}>Programme diététique</p>
          <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            {programId ? `${DIET_PROGRAMS[programId].name} — actif` : "Aucun régime actif"}
          </p>
        </div>
        {open ? <IconChevronUp size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
               : <IconChevronDown size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />}
      </button>

      <AnimatePresence initial={false}>
      {open && (
      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
        exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }} style={{ overflow: "hidden" }}>
        <div className="mt-4 space-y-3">

          {/* Sélecteur de programme */}
          <div className="flex gap-1.5 flex-wrap">
            {DIET_PROGRAM_OPTIONS.map(({ id, label }) => {
              const active = programId === id;
              return (
                <button key={label} onClick={() => !saving && handleSelect(id)} disabled={saving}
                  className="px-3 py-1.5 rounded-full text-[11.5px] font-medium transition-all"
                  style={{
                    background: active ? "rgba(56,189,248,0.15)" : "rgba(255,255,255,0.04)",
                    border:     active ? "1px solid rgba(56,189,248,0.5)" : "1px solid var(--border)",
                    color:      active ? "#38bdf8" : "var(--text-muted)",
                  }}>
                  {label}
                </button>
              );
            })}
          </div>

          {saved && (
            <p className="text-[11px] flex items-center gap-1.5 px-1" style={{ color: "#22c55e" }}>
              <IconCircleCheck size={13} /> Enregistré
            </p>
          )}

          {programId === "tl" && (
            <>
              {/* Repères par repas */}
              <div>
                <p className="text-[9px] uppercase tracking-wide mb-1.5 font-semibold" style={{ color: "var(--text-muted)" }}>
                  Repères par repas
                </p>
                <div className="space-y-1.5">
                  {DIET_MEAL_ORDER.map((meal) => (
                    <div key={meal} className="px-3 py-2 rounded-lg"
                      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
                      <p className="text-[11px] font-semibold mb-0.5" style={{ color: "var(--text-primary)" }}>{DIET_MEAL_LABEL[meal]}</p>
                      <p className="text-[10.5px]" style={{ color: "var(--text-secondary)" }}>{dietMealSummary(meal)}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Fruits autorisés */}
              <div>
                <p className="text-[9px] uppercase tracking-wide mb-1.5 font-semibold" style={{ color: "var(--text-muted)" }}>
                  Fruits autorisés
                </p>
                <p className="text-[10.5px] px-0.5" style={{ color: "var(--text-secondary)" }}>
                  {APPROVED_FRUITS_SUMMARY}
                </p>
              </div>

              {/* Fruits interdits */}
              <div>
                <p className="text-[9px] uppercase tracking-wide mb-1.5 font-semibold" style={{ color: "var(--text-muted)" }}>
                  Fruits interdits
                </p>
                <p className="text-[10.5px] px-0.5" style={{ color: "var(--text-secondary)" }}>
                  {FORBIDDEN_FRUITS_SUMMARY}
                </p>
              </div>

              {/* Interdits */}
              <div>
                <p className="text-[9px] uppercase tracking-wide mb-1.5 font-semibold" style={{ color: "var(--text-muted)" }}>
                  Interdits (tous repas)
                </p>
                <p className="text-[10.5px] px-0.5" style={{ color: "var(--text-secondary)" }}>
                  {DIET_INTERDITS_SUMMARY}
                </p>
              </div>

              <p className="text-[9px] italic px-0.5" style={{ color: "var(--text-muted)" }}>
                Détection automatique par mots-clés sur le nom des aliments — vérifiez toujours
                visuellement, ce n&apos;est pas un contrôle médical.
              </p>
            </>
          )}

          {programId === "cholesterol" && (
            <>
              <div>
                <p className="text-[9px] uppercase tracking-wide mb-1.5 font-semibold" style={{ color: "var(--text-muted)" }}>
                  À favoriser
                </p>
                <p className="text-[10.5px] px-0.5" style={{ color: "var(--text-secondary)" }}>
                  {CHOLESTEROL_FAVORISER_SUMMARY}
                </p>
              </div>

              <div>
                <p className="text-[9px] uppercase tracking-wide mb-1.5 font-semibold" style={{ color: "var(--text-muted)" }}>
                  À limiter
                </p>
                <p className="text-[10.5px] px-0.5" style={{ color: "var(--text-secondary)" }}>
                  {CHOLESTEROL_LIMITER_SUMMARY}
                </p>
              </div>

              <p className="text-[9px] italic px-0.5" style={{ color: "var(--text-muted)" }}>
                Repérage automatique par mots-clés — pas un contrôle médical. Les apports en
                graisses saturées en grammes restent suivis ailleurs dans l&apos;app (pastille
                &quot;Lip.sat.&quot;, score de qualité nutritionnelle).
              </p>
            </>
          )}

        </div>
      </motion.div>
      )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Export Panel ─────────────────────────────────────────────────────────────
