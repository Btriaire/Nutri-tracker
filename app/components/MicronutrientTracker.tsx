"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import type { MicronutrientDay, MicronutrientCode } from "@/app/lib/types";
import { MICRONUTRIENT_DB } from "@/app/lib/micronutrients";

interface Props {
  date: string;
  micronutrientData?: MicronutrientDay | null;
}

export default function MicronutrientTracker({ date, micronutrientData }: Props) {
  const [displayCodes, setDisplayCodes] = useState<MicronutrientCode[]>([]);

  useEffect(() => {
    // Afficher seulement les micronutriments ayant des intakes ou une config favorite
    if (micronutrientData?.intakes?.length) {
      const codes = Array.from(new Set(micronutrientData.intakes.map(i => i.code)));
      setDisplayCodes(codes as MicronutrientCode[]);
    }
  }, [micronutrientData]);

  if (!displayCodes.length) {
    return (
      <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
        <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
          Aucun micronutriment suivi pour aujourd'hui
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>
        Micronutriments
      </h3>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {displayCodes.map(code => {
          const info = MICRONUTRIENT_DB[code];
          const intakes = micronutrientData?.intakes?.filter(i => i.code === code) || [];
          const totalAmount = intakes.reduce((sum, i) => sum + i.amount, 0);
          const rda = info.recommendedDailyIntake || 0;
          const pct = rda > 0 ? Math.min((totalAmount / rda) * 100, 100) : 0;

          return (
            <motion.div
              key={code}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-lg p-3 text-center transition-all hover:opacity-80"
              style={{
                background: `${info.color}15`,
                border: `1px solid ${info.color}33`,
              }}
            >
              {/* Circular progress */}
              <div className="relative w-12 h-12 mx-auto mb-2">
                <svg className="w-full h-full" viewBox="0 0 40 40">
                  <circle
                    cx="20"
                    cy="20"
                    r="18"
                    fill="none"
                    stroke="rgba(255,255,255,0.1)"
                    strokeWidth="2"
                  />
                  <motion.circle
                    cx="20"
                    cy="20"
                    r="18"
                    fill="none"
                    stroke={info.color}
                    strokeWidth="2"
                    strokeDasharray={`${113.1 * pct / 100} 113.1`}
                    strokeDashoffset="0"
                    strokeLinecap="round"
                    animate={{ strokeDasharray: `${113.1 * pct / 100} 113.1` }}
                    transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                    transform="rotate(-90) translate(0 -40)"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[11px] font-bold" style={{ color: info.color }}>
                    {Math.round(pct)}%
                  </span>
                </div>
              </div>

              {/* Label */}
              <p className="text-[11px] font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                {info.symbol}
              </p>
              <p className="text-[9px]" style={{ color: "var(--text-muted)" }}>
                {totalAmount.toFixed(0)} / {rda}
                {info.unit}
              </p>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
