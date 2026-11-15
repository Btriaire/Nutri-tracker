"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MEAL_SHARE_ORDER, MEAL_SHARE_LABELS, DEFAULT_MEAL_SHARES, type MealShares } from "@/app/lib/meal-shares";

export default function MealSharesPanel() {
  const [open, setOpen] = useState(false);
  const [shares, setShares] = useState<MealShares>(DEFAULT_MEAL_SHARES);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/goals")
      .then(r => r.json())
      .then((d: { mealShares?: MealShares }) => {
        setShares(d.mealShares ?? DEFAULT_MEAL_SHARES);
      })
      .catch(() => {});
  }, []);

  const total = MEAL_SHARE_ORDER.reduce((sum, key) => {
    const val = shares[key];
    const num = typeof val === "number" && !isNaN(val) ? val : 0;
    return sum + num;
  }, 0);

  const handleSave = async () => {
    setSaving(true);
    setError(false);
    try {
      const res = await fetch("/api/goals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mealShares: shares }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setShares(DEFAULT_MEAL_SHARES);
    setError(false);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.075 }} className="glass p-4 mb-4">

      <button className="w-full flex items-center gap-3" onClick={() => setOpen(v => !v)}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0"
          style={{ background: "rgba(56,189,248,0.12)" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 2v10l7.07 7.07" />
          </svg>
        </div>
        <div className="flex-1 min-w-0 text-left">
          <p className="font-semibold text-[13.5px]" style={{ color: "var(--text-primary)" }}>Répartition de mes repas</p>
          <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
            Part des calories de chaque repas, pour les journées et périodes estimées
          </p>
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: "var(--text-muted)", flexShrink: 0 }}>
          {open ? <path d="m18 15-6-6-6 6" /> : <path d="m6 9 6 6 6-6" />}
        </svg>
      </button>

      <AnimatePresence initial={false}>
      {open && (
      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
        exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }} style={{ overflow: "hidden" }}>
        <div className="mt-4 space-y-3">

          {MEAL_SHARE_ORDER.map(key => (
            <div key={key} className="flex items-center justify-between gap-2">
              <label htmlFor={`meal-share-${key}`} className="text-[13px] flex-1" style={{ color: "var(--text-primary)" }}>
                {MEAL_SHARE_LABELS[key]}
              </label>
              <div className="flex items-center gap-1">
                <input
                  id={`meal-share-${key}`}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={100}
                  step={1}
                  value={shares[key] ?? 0}
                  onChange={(e) => {
                    const val = e.target.value;
                    const num = val === "" ? 0 : Number(val);
                    setShares(prev => ({ ...prev, [key]: isNaN(num) ? 0 : num }));
                  }}
                  className="w-[4.5rem] px-2 py-1.5 rounded-lg text-[13px] text-right"
                  style={{
                    background: "var(--layer-1)",
                    border: "1px solid var(--border)",
                    color: "var(--text-primary)",
                  }}
                />
                <span className="text-[13px]" style={{ color: "var(--text-secondary)" }}>%</span>
              </div>
            </div>
          ))}

          <div className="pt-2 border-t" style={{ borderColor: "var(--border)" }}>
            <p className="text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>
              Total : {total} %
            </p>
            {total !== 100 && (
              <p role="alert" className="text-[12px] mt-1" style={{ color: "var(--danger)" }}>
                Le total doit faire 100 %.
              </p>
            )}
          </div>

          {saved && (
            <p className="text-[12px] px-1" style={{ color: "var(--ok)" }}>
              Enregistré
            </p>
          )}
          {error && (
            <p role="alert" className="text-[12px] px-1" style={{ color: "var(--danger)" }}>
              Enregistrement impossible.
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSave}
              disabled={total !== 100 || saving}
              className="flex-1 min-h-[44px] px-4 rounded-xl text-[13px] font-medium transition-all disabled:opacity-50"
              style={{
                background: "rgba(56,189,248,0.15)",
                border: "1px solid rgba(56,189,248,0.5)",
                color: "#38bdf8",
              }}>
              Enregistrer
            </button>
            <button
              onClick={handleReset}
              className="flex-1 min-h-[44px] px-4 rounded-xl text-[13px] font-medium transition-all"
              style={{
                background: "var(--layer-1)",
                border: "1px solid var(--border)",
                color: "var(--text-secondary)",
              }}>
              Valeurs par défaut
            </button>
          </div>

        </div>
      </motion.div>
      )}
      </AnimatePresence>
    </motion.div>
  );
}
