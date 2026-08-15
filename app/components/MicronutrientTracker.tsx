"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { IconChevronDown } from "@tabler/icons-react";
import type { MicronutrientDay, MicronutrientCode } from "@/app/lib/types";
import { MICRONUTRIENT_DB, formatMicroAmount } from "@/app/lib/micronutrients";
import { useCustomNutrients } from "@/app/lib/useCustomNutrients";

interface Props {
  date: string;
  micronutrientData?: MicronutrientDay | null;
}

interface Row {
  code: MicronutrientCode;
  label: string;
  symbol: string;
  unit: string;
  color: string;
  amount: number;
  rda: number;
  pct: number; // uncapped, used for status; display bar caps at 100
}

function statusOf(pct: number): { label: string; color: string } {
  if (pct === 0) return { label: "—", color: "var(--text-muted)" };
  if (pct < 50) return { label: "Faible", color: "#f87171" };
  if (pct < 80) return { label: "Partiel", color: "#fbbf24" };
  if (pct <= 150) return { label: "Atteint", color: "#34d399" };
  return { label: "Élevé", color: "#60a5fa" };
}

export default function MicronutrientTracker({ date, micronutrientData }: Props) {
  useCustomNutrients();
  const [open, setOpen] = useState(false);

  const rows = useMemo<Row[]>(() => {
    const intakes = micronutrientData?.intakes ?? [];
    if (!intakes.length) return [];
    const codes = Array.from(new Set(intakes.map(i => i.code))) as MicronutrientCode[];
    const built = codes.map((code) => {
      // Falls back gracefully if this is a custom nutrient whose definition hasn't
      // finished loading yet (useCustomNutrients merges it in asynchronously).
      const info = MICRONUTRIENT_DB[code] ?? { code, label: code, symbol: code.slice(0, 3).toUpperCase(), unit: "", color: "#94a3b8" };
      const amount = intakes.filter(i => i.code === code).reduce((sum, i) => sum + i.amount, 0);
      const rda = info.recommendedDailyIntake || 0;
      const pct = rda > 0 ? (amount / rda) * 100 : 0;
      return { code, label: info.label, symbol: info.symbol, unit: info.unit, color: info.color, amount, rda, pct };
    });
    // Nutrients furthest from their target surface first — that's the actionable info.
    return built.sort((a, b) => a.pct - b.pct);
  }, [micronutrientData]);

  if (!rows.length) {
    return (
      <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
        <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
          Aucun micronutriment suivi pour aujourd&apos;hui
        </p>
      </div>
    );
  }

  const lowCount = rows.filter(r => r.rda > 0 && r.pct < 50).length;

  const renderRow = (row: Row, i: number) => {
    const barPct = row.rda > 0 ? Math.min(row.pct, 100) : 0;
    const status = statusOf(row.pct);
    return (
      <motion.div
        key={row.code}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: Math.min(i, 6) * 0.02 }}
        className="flex items-center gap-2 py-1.5"
      >
        <span
          className="flex-shrink-0 flex items-center justify-center rounded-md text-[9px] font-bold"
          style={{ width: 26, height: 20, background: `${row.color}1f`, color: row.color, border: `1px solid ${row.color}40` }}
        >
          {row.symbol}
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[11px] font-medium truncate" style={{ color: "var(--text-primary)" }}>
              {row.label}
            </span>
            <span className="text-[10px] flex-shrink-0" style={{ color: "var(--text-muted)" }}>
              {formatMicroAmount(row.amount)}
              {row.rda > 0 && <>/{formatMicroAmount(row.rda)}</>}
              {row.unit}
            </span>
          </div>
          <div className="mt-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
            <motion.div
              className="h-full rounded-full"
              style={{ background: row.color }}
              initial={{ width: 0 }}
              animate={{ width: `${barPct}%` }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
        </div>

        <span
          className="flex-shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded-full text-right"
          style={{ color: status.color, background: `${status.color}18`, minWidth: 46, textAlign: "center" }}
        >
          {status.label}
        </span>
      </motion.div>
    );
  };

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-1.5 px-3 py-2.5"
      >
        <h3 className="text-[12px] font-semibold" style={{ color: "var(--text-primary)" }}>
          Micronutriments ({rows.length})
        </h3>
        {lowCount > 0 && (
          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ color: "#f87171", background: "#f8717118" }}>
            {lowCount} faible{lowCount > 1 ? "s" : ""}
          </span>
        )}
        <IconChevronDown
          size={13}
          style={{ color: "var(--text-muted)", marginLeft: "auto", transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            style={{ overflow: "hidden" }}
          >
            <div className="px-3 pb-3 divide-y" style={{ borderColor: "var(--border)" }}>
              {rows.map(renderRow)}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
