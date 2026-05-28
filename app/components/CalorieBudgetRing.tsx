"use client";

import { motion } from "framer-motion";

interface Props {
  consumed:      number;
  goal:          number;
  burned?:       number | null;
  activeMinutes?: number | null;
  sessionCount?:  number;
  size?:         number;
}

export default function CalorieBudgetRing({ consumed, goal, burned, activeMinutes, sessionCount, size = 168 }: Props) {
  const net = consumed - (burned ?? 0);
  const pct = Math.min(net / goal, 1);
  const over = net > goal;

  const strokeW = 10;
  const r = (size - strokeW) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ * pct;

  const remaining = goal - net;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          {/* Track */}
          <circle
            cx={size / 2} cy={size / 2} r={r}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={strokeW}
            strokeLinecap="round"
          />
          {/* Fill */}
          <motion.circle
            cx={size / 2} cy={size / 2} r={r}
            fill="none"
            stroke={over ? "#ef4444" : "var(--calories)"}
            strokeWidth={strokeW}
            strokeLinecap="round"
            strokeDasharray={circ}
            initial={{ strokeDashoffset: circ }}
            animate={{ strokeDashoffset: circ - dash }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          />
          {/* Glow ring (same arc, blurred) */}
          {pct > 0.05 && (
            <motion.circle
              cx={size / 2} cy={size / 2} r={r}
              fill="none"
              stroke={over ? "rgba(239,68,68,0.3)" : "rgba(249,115,22,0.25)"}
              strokeWidth={strokeW + 6}
              strokeLinecap="round"
              strokeDasharray={circ}
              initial={{ strokeDashoffset: circ }}
              animate={{ strokeDashoffset: circ - dash }}
              transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
              style={{ filter: "blur(4px)" }}
            />
          )}
        </svg>

        {/* Center text */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center"
          style={{ transform: "rotate(0deg)" }}
        >
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-[28px] font-bold leading-none tabular-nums"
            style={{ color: over ? "#ef4444" : "var(--text-primary)" }}
          >
            {Math.round(net)}
          </motion.span>
          <span className="text-[11px] mt-0.5 label-xs">kcal net</span>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex gap-4 text-center">
        <div>
          <p className="text-[15px] font-semibold t-calories tabular-nums">{Math.round(consumed)}</p>
          <p className="label-xs mt-0.5">Mangées</p>
        </div>
        {burned != null && (
          <div
            className="w-px"
            style={{ background: "var(--border)" }}
          />
        )}
        {burned != null && (
          <div>
            <p className="text-[15px] font-semibold t-fiber tabular-nums">−{Math.round(burned)}</p>
            <p className="label-xs mt-0.5">Brûlées</p>
            {(activeMinutes != null || sessionCount != null) && (
              <p className="text-[9px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                {[
                  activeMinutes != null && activeMinutes > 0 ? `${activeMinutes} min` : null,
                  sessionCount != null && sessionCount > 0 ? `${sessionCount} séance${sessionCount > 1 ? "s" : ""}` : null,
                ].filter(Boolean).join(" · ") || "activité"}
              </p>
            )}
          </div>
        )}
        <div
          className="w-px"
          style={{ background: "var(--border)" }}
        />
        <div>
          <p
            className="text-[15px] font-semibold tabular-nums"
            style={{ color: remaining >= 0 ? "var(--text-primary)" : "#ef4444" }}
          >
            {remaining > 0 ? remaining : Math.abs(remaining)}
          </p>
          <p className="label-xs mt-0.5">{remaining >= 0 ? "Restantes" : "Dépassé"}</p>
        </div>
      </div>
    </div>
  );
}
