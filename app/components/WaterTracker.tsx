"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { IconDroplet, IconPlus, IconMinus } from "@tabler/icons-react";

interface Props {
  date:     string;
  waterMl:  number;
  goalMl:   number;
  onUpdate: (newMl: number) => void;
}

const QUICK_AMOUNTS = [250, 500, 750, 1000];

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
          <IconDroplet size={14} stroke={1.5} style={{ color: "var(--steps)" }} />
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
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {Array.from({ length: Math.max(goalGlasses, glasses) }).map((_, i) => (
          <button
            key={i}
            onClick={() => adjust(i < glasses ? -(250) : 250)}
            disabled={loading}
            className="p-2 rounded-lg transition-colors hover:opacity-80"
            style={{ color: i < glasses ? "var(--steps)" : "var(--text-muted)" }}
            title={i < glasses ? "Retirer 250ml" : "Ajouter 250ml"}
          >
            <IconDroplet size={24} stroke={i < glasses ? 2 : 1.5} />
          </button>
        ))}
      </div>

      {/* Quick add buttons */}
      <div className="flex gap-2 flex-wrap">
        {QUICK_AMOUNTS.map((ml) => (
          <button
            key={ml}
            onClick={() => adjust(ml)}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-medium transition-colors hover:opacity-80"
            style={{
              background: "rgba(56,189,248,0.12)",
              border: "1px solid var(--steps)",
              color: "var(--steps)",
            }}
          >
            <IconPlus size={14} stroke={2} />
            {ml >= 1000 ? `${ml / 1000}L` : `${ml}ml`}
          </button>
        ))}
        <button
          onClick={() => adjust(-250)}
          disabled={loading || waterMl === 0}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] transition-colors disabled:opacity-30 hover:opacity-80"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid var(--border)",
            color: "var(--text-muted)",
          }}
        >
          <IconMinus size={14} stroke={2} />
          250ml
        </button>
      </div>
    </div>
  );
}
