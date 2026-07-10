"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { IconDroplet, IconMinus } from "@tabler/icons-react";

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

  return (
    <div className="glass px-4 py-3">
      {/* Line 1: label + value + progress bar */}
      <div className="flex items-center gap-3">
        <IconDroplet size={16} stroke={1.5} style={{ color: "var(--steps)", flexShrink: 0 }} />
        <p className="text-[12px] tabular-nums flex-shrink-0" style={{ color: "var(--steps)" }}>
          <span className="font-semibold">{waterMl >= 1000 ? `${(waterMl / 1000).toFixed(1)}L` : `${waterMl}ml`}</span>
          <span style={{ color: "var(--text-muted)" }}>
            {" "}/ {goalMl >= 1000 ? `${(goalMl / 1000).toFixed(1)}L` : `${goalMl}ml`}
          </span>
        </p>
        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
          <motion.div
            className="h-full rounded-full"
            style={{ background: "var(--steps)" }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>
      </div>

      {/* Line 2: quick add buttons */}
      <div className="flex gap-1.5 mt-2.5">
        {QUICK_AMOUNTS.map((ml) => (
          <button
            key={ml}
            onClick={() => adjust(ml)}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-[12px] font-medium transition-colors hover:opacity-80"
            style={{
              background: "rgba(56,189,248,0.12)",
              border: "1px solid var(--steps)",
              color: "var(--steps)",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2.69s-5.5 6.14-5.5 10.31a5.5 5.5 0 0 0 11 0c0-4.17-5.5-10.31-5.5-10.31z" />
            </svg>
            {ml >= 1000 ? `${ml / 1000}L` : `${ml}ml`}
          </button>
        ))}
        <button
          onClick={() => adjust(-250)}
          disabled={loading || waterMl === 0}
          className="flex items-center justify-center px-2.5 py-2 rounded-lg transition-colors disabled:opacity-30 hover:opacity-80"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid var(--border)",
            color: "var(--text-muted)",
          }}
        >
          <IconMinus size={14} stroke={2} />
        </button>
      </div>
    </div>
  );
}
