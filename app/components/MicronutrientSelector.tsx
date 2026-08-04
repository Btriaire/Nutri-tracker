"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { IconPlus, IconTrash, IconLoader2, IconSparkles } from "@tabler/icons-react";
import type { MicronutrientCode, MicronutrientInfo, SupplementMicronutrient } from "@/app/lib/types";
import { MICRONUTRIENT_DB, mergeCustomNutrients } from "@/app/lib/micronutrients";
import { useCustomNutrients } from "@/app/lib/useCustomNutrients";

interface Props {
  micronutrients: SupplementMicronutrient[];
  onChange: (micronutrients: SupplementMicronutrient[]) => void;
}

export default function MicronutrientSelector({ micronutrients, onChange }: Props) {
  useCustomNutrients();
  const [showSelector, setShowSelector] = useState(false);
  const [showCreate,   setShowCreate]   = useState(false);
  const [newLabel,     setNewLabel]     = useState("");
  const [newUnit,      setNewUnit]      = useState("mg");
  const [newRda,       setNewRda]       = useState("");
  const [creating,     setCreating]     = useState(false);

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

  const handleCreateCustom = async () => {
    const label = newLabel.trim();
    const unit  = newUnit.trim();
    if (!label || !unit) return;
    setCreating(true);
    try {
      const res = await fetch("/api/custom-nutrients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label, unit,
          ...(newRda ? { recommendedDailyIntake: parseFloat(newRda) } : {}),
        }),
      });
      if (res.ok) {
        const data = await res.json() as { nutrient: MicronutrientInfo };
        mergeCustomNutrients([data.nutrient]);
        handleAdd(data.nutrient.code);
        setNewLabel(""); setNewUnit("mg"); setNewRda("");
        setShowCreate(false);
        setShowSelector(false);
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>
          Micronutriments
        </label>
        <button
          type="button"
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
                type="button"
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
        {showSelector && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-1 mt-2 pt-2 border-t"
            style={{ borderColor: "var(--border)" }}
          >
            {availableCodes.length === 0 && (
              <p className="text-[10px] px-1 pb-1" style={{ color: "var(--text-muted)" }}>
                Tous les micronutriments connus sont ajoutés
              </p>
            )}
            {availableCodes.map(code => {
              const info = MICRONUTRIENT_DB[code];
              return (
                <button
                  type="button"
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

            {/* Create a custom nutrient */}
            {!showCreate ? (
              <button
                type="button"
                onClick={() => setShowCreate(true)}
                className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded text-[11px] font-medium transition-all hover:opacity-80"
                style={{ background: "rgba(232,121,249,0.1)", border: "1px dashed rgba(232,121,249,0.4)", color: "#e879f9" }}
              >
                <IconSparkles size={12} />
                Créer un nutriment personnalisé
              </button>
            ) : (
              <div className="p-2 rounded-lg space-y-1.5" style={{ background: "rgba(232,121,249,0.06)", border: "1px solid rgba(232,121,249,0.25)" }}>
                <input
                  type="text" placeholder="Nom (ex: Choline)" value={newLabel}
                  onChange={e => setNewLabel(e.target.value)}
                  className="w-full px-2 py-1 rounded text-[11px]"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                />
                <div className="flex gap-1.5">
                  <input
                    type="text" placeholder="Unité (mg, µg...)" value={newUnit}
                    onChange={e => setNewUnit(e.target.value)}
                    className="flex-1 min-w-0 px-2 py-1 rounded text-[11px]"
                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                  />
                  <input
                    type="number" placeholder="AJR (optionnel)" value={newRda}
                    onChange={e => setNewRda(e.target.value)}
                    className="flex-1 min-w-0 px-2 py-1 rounded text-[11px]"
                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                  />
                </div>
                <div className="flex gap-1.5">
                  <button type="button" onClick={() => setShowCreate(false)}
                    className="flex-1 py-1 rounded text-[10px] font-medium"
                    style={{ background: "rgba(255,255,255,0.05)", color: "var(--text-muted)" }}>
                    Annuler
                  </button>
                  <button type="button" onClick={handleCreateCustom} disabled={creating || !newLabel.trim() || !newUnit.trim()}
                    className="flex-1 flex items-center justify-center gap-1 py-1 rounded text-[10px] font-semibold"
                    style={{ background: "#e879f9", color: "#1a0a1f", opacity: (creating || !newLabel.trim() || !newUnit.trim()) ? 0.5 : 1 }}>
                    {creating ? <IconLoader2 size={11} className="animate-spin" /> : <IconPlus size={11} />}
                    Créer et ajouter
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
