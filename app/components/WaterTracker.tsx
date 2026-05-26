"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Drop, Plus, Minus } from "@phosphor-icons/react";

interface Props {
  date:     string;
  waterMl:  number;
  goalMl:   number;
  onUpdate: (newMl: number) => void;
}

const QUICK_AMOUNTS = [150, 200, 250, 330, 500];

export default function WaterTracker({ date, waterMl, goalMl, onUpdate }: Props) {
  const [loading, setLoading] = useState(false);

  const pct = Math.min((waterMl / goalMl) * 100, 100);

  const adjust = async (deltaMl: number) => {
    const newVal = Math.max(0, waterMl + deltaMl);
    setLoading(true);
    try {
      await fetch("/api/log/water", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, waterMl: newVal }),
      });
      onUpdate(newVal);
    } finally {
      setLoading(false);
    }
  };

  const glasses = Math.round(waterMl / 250);
  const goalGlasses = Math.ceil(goalMl / 250);

  return (
    <div className="glass p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Drop size={14} weight="fill" style={{ color: "var(--steps)" }} />
          <p className="label-xs">Hydratation</p>
        </div>
        <p className="text-[12px] tabular-nums" style={{ color: "var(--steps)" }}>
          <span className="font-semibold">{waterMl >= 1000 ? `${(waterMl / 1000).toFixed(1)}L` : `${waterMl}ml`}</span>
          <span style={{ color: "var(--text-muted)" }}>
            {" "}/ {goalMl >= 1000 ? `${(goalMl / 1000).toFixed(1)}L` : `${goalMl}ml`}
          </span>
        </p>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full mb-3 overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
        <motion.div
          className="h-full rounded-full"
          style={{ background: "var(--steps)" }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>

      {/* Glass icons */}
      <div className="flex items-center gap-1 mb-3 flex-wrap">
        {Array.from({ length: Math.max(goalGlasses, glasses) }).map((_, i) => (
          <button
            key={i}
            onClick={() => adjust(i < glasses ? -(250) : 250)}
            disabled={loading}
            className="p-1 rounded-lg transition-colors"
            style={{ color: i < glasses ? "var(--steps)" : "var(--text-muted)" }}
            title={i < glasses ? "Retirer 250ml" : "Ajouter 250ml"}
          >
            <Drop size={16} weight={i < glasses ? "fill" : "regular"} />
          </button>
        ))}
      </div>

      {/* Quick add buttons */}
      <div className="flex gap-1.5 flex-wrap">
        {QUICK_AMOUNTS.map((ml) => (
          <button
            key={ml}
            onClick={() => adjust(ml)}
            disabled={loading}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid var(--border)",
              color: "var(--text-secondary)",
            }}
          >
            <Plus size={9} weight="bold" />
            {ml >= 1000 ? `${ml / 1000}L` : `${ml}ml`}
          </button>
        ))}
        <button
          onClick={() => adjust(-250)}
          disabled={loading || waterMl === 0}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] transition-colors disabled:opacity-30"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid var(--border)",
            color: "var(--text-muted)",
          }}
        >
          <Minus size={9} weight="bold" />
          250ml
        </button>
      </div>
    </div>
  );
}
