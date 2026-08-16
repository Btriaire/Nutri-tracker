"use client";

import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { IconX } from "@tabler/icons-react";
import type { MealType } from "@/app/lib/types";
import {
  DIET_PROGRAM_NAME, dietMealSummary, DIET_INTERDITS_SUMMARY,
  APPROVED_FRUITS_SUMMARY, FORBIDDEN_FRUITS_SUMMARY,
} from "@/app/lib/diet-program";

const MEAL_ORDER: MealType[] = ["breakfast", "lunch", "snacks", "dinner"];
const MEAL_LABEL: Record<MealType, string> = {
  breakfast: "Petit-déjeuner",
  lunch:     "Déjeuner",
  snacks:    "Goûter",
  dinner:    "Dîner",
};

interface Props {
  onClose: () => void;
}

export default function DietProgramInfoModal({ onClose }: Props) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="diet-info-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center px-4"
        style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 12 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 12 }}
          transition={{ duration: 0.2, ease: [0.34, 1.56, 0.64, 1] }}
          onClick={(e) => e.stopPropagation()}
          className="w-full rounded-2xl overflow-hidden flex flex-col"
          style={{ maxWidth: 420, maxHeight: "88dvh", background: "var(--surface, #1a1a1f)", border: "1px solid var(--border)" }}
        >
          <div className="flex items-center justify-between px-4 py-3 flex-shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
            <p className="text-[13.5px] font-semibold flex items-center gap-1.5" style={{ color: "var(--text-primary)" }}>
              🩺 {DIET_PROGRAM_NAME}
            </p>
            <button onClick={onClose} className="p-1 rounded-lg" style={{ color: "var(--text-muted)" }}>
              <IconX size={17} stroke={1.5} />
            </button>
          </div>

          <div className="overflow-y-auto px-4 py-4 space-y-4">
            <div>
              <p className="text-[9px] uppercase tracking-wide mb-1.5 font-semibold" style={{ color: "var(--text-muted)" }}>
                À favoriser — repères par repas (quantités)
              </p>
              <div className="space-y-1.5">
                {MEAL_ORDER.map((meal) => (
                  <div key={meal} className="px-3 py-2 rounded-lg"
                    style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.15)" }}>
                    <p className="text-[11px] font-semibold mb-0.5" style={{ color: "#22c55e" }}>{MEAL_LABEL[meal]}</p>
                    <p className="text-[10.5px]" style={{ color: "var(--text-secondary)" }}>{dietMealSummary(meal)}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[9px] uppercase tracking-wide mb-1.5 font-semibold" style={{ color: "var(--text-muted)" }}>
                Fruits autorisés
              </p>
              <div className="px-3 py-2 rounded-lg" style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.15)" }}>
                <p className="text-[10.5px]" style={{ color: "var(--text-secondary)" }}>{APPROVED_FRUITS_SUMMARY}</p>
              </div>
            </div>

            <div>
              <p className="text-[9px] uppercase tracking-wide mb-1.5 font-semibold" style={{ color: "var(--text-muted)" }}>
                Fruits interdits
              </p>
              <div className="px-3 py-2 rounded-lg" style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)" }}>
                <p className="text-[10.5px]" style={{ color: "var(--text-secondary)" }}>{FORBIDDEN_FRUITS_SUMMARY}</p>
              </div>
            </div>

            <div>
              <p className="text-[9px] uppercase tracking-wide mb-1.5 font-semibold" style={{ color: "var(--text-muted)" }}>
                Interdits (tous repas)
              </p>
              <div className="px-3 py-2 rounded-lg" style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)" }}>
                <p className="text-[10.5px]" style={{ color: "var(--text-secondary)" }}>{DIET_INTERDITS_SUMMARY}</p>
              </div>
            </div>

            <p className="text-[9px] italic px-0.5" style={{ color: "var(--text-muted)" }}>
              Aide-mémoire de la feuille de régime prescrite — en cas de doute, référez-vous
              au document original.
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}
