"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import type { MicronutrientCode, SupplementMicronutrient } from "@/app/lib/types";
import { MICRONUTRIENT_DB } from "@/app/lib/micronutrients";

interface Props {
  micronutrients: SupplementMicronutrient[];
  onChange: (micronutrients: SupplementMicronutrient[]) => void;
}

export default function MicronutrientSelector({ micronutrients, onChange }: Props) {
  const [showSelector, setShowSelector] = useState(false);

  const allCodes = Object.keys(MICRONUTRIENT_DB) as MicronutrientCode[];
  const selectedCodes = new Set(micronutrients.map(m => m.code));
  const availableCodes = allCodes.filter(code => !selectedCodes.has(code));

  const handleAdd = (code: MicronutrientCode) => {
    const info = MICRONUTRIENT_DB[code];
    onChange([
      ...micronutrients,
      { code, amount: info.recommendedDailyIntake || 0, unit: info.unit },
    ]);
  };

  const handleRemove = (code: MicronutrientCode) => {
    onChange(micronutrients.filter(m => m.code !== code));
  };

  const handleAmountChange = (code: MicronutrientCode, amount: number) => {
    onChange(
      micronutrients.map(m => (m.code === code ? { ...m, amount } : m))
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>
          Micronutriments
        </label>
        <button
          onClick={() => setShowSelector(!showSelector)}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium transition-all"
          style={{
            background: "rgba(99,102,241,0.12)",
            border: "1px solid rgba(99,102,241,0.3)",
            color: "var(--text-primary)",
          }}
        >
          <IconPlus size={12} />
          Ajouter
        </button>
      </div>

      {/* Selected items */}
      <div className="space-y-1.5">
        {micronutrients.map(m => {
          const info = MICRONUTRIENT_DB[m.code];
          return (
            <div
              key={m.code}
              className="flex items-center gap-2 p-2 rounded-lg"
              style={{ background: `${info.color}15`, border: `1px solid ${info.color}33` }}
            >
              <span className="text-[10px] font-semibold flex-shrink-0" style={{ color: info.color }}>
                {info.symbol}
              </span>
              <input
                type="number"
                value={m.amount}
                onChange={e => handleAmountChange(m.code, parseFloat(e.target.value) || 0)}
                className="w-16 px-1.5 py-1 rounded text-[11px]"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
              />
              <span className="text-[10px] flex-shrink-0" style={{ color: "var(--text-muted)" }}>
                {m.unit}
              </span>
              <button
                onClick={() => handleRemove(m.code)}
                className="ml-auto p-1 rounded hover:opacity-70 transition-opacity"
              >
                <IconTrash size={12} style={{ color: "var(--error)" }} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Selector dropdown */}
      <AnimatePresence>
        {showSelector && availableCodes.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-1 mt-2 pt-2 border-t"
            style={{ borderColor: "var(--border)" }}
          >
            {availableCodes.map(code => {
              const info = MICRONUTRIENT_DB[code];
              return (
                <button
                  key={code}
                  onClick={() => {
                    handleAdd(code);
                    setShowSelector(false);
                  }}
                  className="w-full text-left px-2 py-1.5 rounded text-[11px] transition-all hover:opacity-80"
                  style={{
                    background: `${info.color}12`,
                    border: `1px solid ${info.color}25`,
                    color: "var(--text-primary)",
                  }}
                >
                  <span style={{ color: info.color, fontWeight: "600" }}>{info.symbol}</span> — {info.label}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {availableCodes.length === 0 && micronutrients.length > 0 && (
        <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
          Tous les micronutriments sont ajoutés
        </p>
      )}
    </div>
  );
}
