"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { IconX, IconLoader2, IconCheck, IconFlask } from "@tabler/icons-react";
import { MICRONUTRIENT_DB } from "@/app/lib/micronutrients";
import type { MicronutrientCode } from "@/app/lib/types";

interface Props {
  foodName: string;
  onClose:  () => void;
  onSaved?: () => void;
}

const CODES = Object.keys(MICRONUTRIENT_DB) as MicronutrientCode[];

export default function MicronutrientEditModal({ foodName, onClose, onSaved }: Props) {
  const [values,   setValues]   = useState<Partial<Record<MicronutrientCode, string>>>({});
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/food-micronutrient-ai?name=${encodeURIComponent(foodName)}`)
      .then(r => r.ok ? r.json() : null)
      .then((d: { per100g?: { code: MicronutrientCode; amount: number }[]; verifiedManually?: boolean } | null) => {
        if (cancelled || !d) return;
        const init: Partial<Record<MicronutrientCode, string>> = {};
        for (const m of d.per100g ?? []) init[m.code] = String(m.amount);
        setValues(init);
        setVerified(!!d.verifiedManually);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [foodName]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const micronutrients = CODES
        .map(code => ({ code, amount: parseFloat(values[code] ?? ""), unit: MICRONUTRIENT_DB[code].unit }))
        .filter(m => Number.isFinite(m.amount) && m.amount > 0);
      await fetch("/api/food-micronutrient-ai", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: foodName, micronutrients }),
      });
      onSaved?.();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        key="micro-edit-overlay"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-end md:items-center justify-center"
        style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }}
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
          className="glass-strong w-full md:max-w-md rounded-t-3xl md:rounded-3xl flex flex-col"
          style={{ maxHeight: "85vh" }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-4 pb-3 flex-shrink-0"
            style={{ borderBottom: "1px solid var(--border)" }}>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <IconFlask size={14} style={{ color: "var(--indigo)" }} />
                <h2 className="text-[14px] font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                  Micronutriments — {foodName}
                </h2>
              </div>
              {verified && (
                <span className="flex items-center gap-1 text-[10px] mt-0.5" style={{ color: "var(--fiber)" }}>
                  <IconCheck size={11} /> Vérifié manuellement
                </span>
              )}
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-muted)" }}>
              <IconX size={15} />
            </button>
          </div>

          <p className="text-[11px] px-4 pt-3" style={{ color: "var(--text-muted)" }}>
            Valeurs pour 100 g. Laisse un champ vide ou à 0 si le nutriment est absent — ces valeurs
            remplacent définitivement toute estimation IA pour cet aliment.
          </p>

          {/* Body */}
          {loading ? (
            <div className="flex-1 flex items-center justify-center py-10">
              <IconLoader2 size={20} className="animate-spin" style={{ color: "var(--text-muted)" }} />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto px-4 py-3 grid grid-cols-2 gap-2">
              {CODES.map(code => {
                const info = MICRONUTRIENT_DB[code];
                return (
                  <label key={code} className="flex items-center gap-1.5 px-2 py-1.5 rounded-xl"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
                    <span className="text-[11px] flex-1 min-w-0 truncate" style={{ color: "var(--text-secondary)" }}>
                      {info.label}
                    </span>
                    <input
                      type="number" inputMode="decimal" step="any" placeholder="0"
                      value={values[code] ?? ""}
                      onChange={e => setValues(v => ({ ...v, [code]: e.target.value }))}
                      className="input text-[11px] text-right"
                      style={{ width: 56, height: 26, padding: "0 6px" }}
                    />
                    <span className="text-[9px] flex-shrink-0" style={{ color: "var(--text-muted)" }}>{info.unit}</span>
                  </label>
                );
              })}
            </div>
          )}

          {/* Footer */}
          <div className="p-4 flex-shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
            <button onClick={handleSave} disabled={saving || loading}
              className="btn btn-primary w-full flex items-center justify-center gap-2" style={{ height: 40 }}>
              {saving ? <IconLoader2 size={14} className="animate-spin" /> : <IconCheck size={14} />}
              Enregistrer
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
