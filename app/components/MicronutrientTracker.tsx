"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { IconChevronDown } from "@tabler/icons-react";
import type { MicronutrientDay, MicronutrientCode } from "@/app/lib/types";
import { MICRONUTRIENT_DB } from "@/app/lib/micronutrients";
import { useCustomNutrients } from "@/app/lib/useCustomNutrients";

interface Props {
  date: string;
  micronutrientData?: MicronutrientDay | null;
}

const COLLAPSE_THRESHOLD = 4; // beyond this, chips would wrap to a 2nd line — collapse by default

export default function MicronutrientTracker({ date, micronutrientData }: Props) {
  useCustomNutrients();
  const [displayCodes, setDisplayCodes] = useState<MicronutrientCode[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (micronutrientData?.intakes?.length) {
      const codes = Array.from(new Set(micronutrientData.intakes.map(i => i.code)));
      setDisplayCodes(codes as MicronutrientCode[]);
    } else {
      setDisplayCodes([]);
    }
  }, [micronutrientData]);

  if (!displayCodes.length) {
    return (
      <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
        <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
          Aucun micronutriment suivi pour aujourd'hui
        </p>
      </div>
    );
  }

  const shouldCollapse = displayCodes.length > COLLAPSE_THRESHOLD;

  const renderChip = (code: MicronutrientCode) => {
    // Falls back gracefully if this is a custom nutrient whose definition hasn't
    // finished loading yet (useCustomNutrients merges it in asynchronously).
    const info = MICRONUTRIENT_DB[code] ?? { code, label: code, symbol: code.slice(0, 3).toUpperCase(), unit: "", color: "#94a3b8" };
    const intakes = micronutrientData?.intakes?.filter(i => i.code === code) || [];
    const totalAmount = intakes.reduce((sum, i) => sum + i.amount, 0);
    const rda = info.recommendedDailyIntake || 0;
    const pct = rda > 0 ? Math.min((totalAmount / rda) * 100, 100) : 0;
    const circumference = 2 * Math.PI * 9;

    return (
      <motion.div
        key={code}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-full"
        style={{ background: `${info.color}15`, border: `1px solid ${info.color}33` }}
      >
        <div className="relative w-5 h-5 flex-shrink-0">
          <svg className="w-full h-full" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="9" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="2" />
            <motion.circle
              cx="12" cy="12" r="9"
              fill="none"
              stroke={info.color}
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray={`${circumference * pct / 100} ${circumference}`}
              animate={{ strokeDasharray: `${circumference * pct / 100} ${circumference}` }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              transform="rotate(-90 12 12)"
            />
          </svg>
        </div>
        <span className="text-[10px] font-semibold" style={{ color: "var(--text-primary)" }}>
          {info.symbol}
        </span>
        <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>
          {totalAmount.toFixed(0)}/{rda}{info.unit}
        </span>
      </motion.div>
    );
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => shouldCollapse && setExpanded(v => !v)}
        className="w-full flex items-center gap-1.5"
        style={{ cursor: shouldCollapse ? "pointer" : "default" }}
      >
        <h3 className="text-[12px] font-semibold" style={{ color: "var(--text-primary)" }}>
          Micronutriments ({displayCodes.length})
        </h3>
        {shouldCollapse && (
          <IconChevronDown
            size={13}
            style={{ color: "var(--text-muted)", marginLeft: "auto", transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}
          />
        )}
      </button>

      {!shouldCollapse ? (
        <div className="flex flex-wrap gap-1.5">
          {displayCodes.map(renderChip)}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5">
            {displayCodes.slice(0, COLLAPSE_THRESHOLD).map(renderChip)}
          </div>
          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="flex flex-wrap gap-1.5 overflow-hidden"
              >
                {displayCodes.slice(COLLAPSE_THRESHOLD).map(renderChip)}
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}
