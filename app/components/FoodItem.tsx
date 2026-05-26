"use client";

import { useState } from "react";
import { Trash } from "@phosphor-icons/react";
import { motion, AnimatePresence } from "framer-motion";
import type { FoodEntry } from "@/app/lib/types";

const SOURCE_DOT: Record<string, string> = {
  ciqual: "var(--fiber)",
  off:    "var(--steps)",
  usda:   "var(--carbs)",
  custom: "var(--protein)",
};

interface Props {
  entry: FoodEntry;
  date: string;
  onDelete: (id: string) => void;
}

export default function FoodItem({ entry, date, onDelete }: Props) {
  const [hovering, setHovering] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    await fetch(`/api/log/${entry.id}?date=${date}`, { method: "DELETE" });
    onDelete(entry.id);
  };

  return (
    <AnimatePresence>
      {!deleting && (
        <motion.div
          layout
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, height: 0, marginBottom: 0 }}
          className="flex items-center gap-3 py-2.5 border-b last:border-b-0"
          style={{ borderColor: "var(--border)" }}
          onMouseEnter={() => setHovering(true)}
          onMouseLeave={() => setHovering(false)}
        >
          {/* Source dot */}
          <div
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ background: SOURCE_DOT[entry.source] ?? "var(--text-muted)" }}
          />

          {/* Food info */}
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium truncate" style={{ color: "var(--text-primary)" }}>
              {entry.name}
            </p>
            <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
              {entry.servingQty}{entry.servingUnit}
              {entry.brand ? ` · ${entry.brand}` : ""}
            </p>
          </div>

          {/* Nutrition */}
          <div className="text-right flex-shrink-0">
            <p className="text-[13px] font-semibold t-calories tabular-nums">
              {Math.round(entry.nutrition.calories)} kcal
            </p>
            <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
              P{Math.round(entry.nutrition.proteinG)} · G{Math.round(entry.nutrition.carbsG)} · L{Math.round(entry.nutrition.fatG)}
            </p>
          </div>

          {/* Delete */}
          <AnimatePresence>
            {hovering && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onClick={handleDelete}
                className="btn-icon flex-shrink-0"
                aria-label="Supprimer"
              >
                <Trash size={13} />
              </motion.button>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
