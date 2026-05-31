"use client";

import { motion } from "framer-motion";
import { IconShoe } from "@tabler/icons-react";

interface Props {
  steps: number | null;
  goal?: number;
}

export default function StepsWidget({ steps, goal = 10000 }: Props) {
  const pct = steps != null ? Math.min(steps / goal, 1) : 0;

  return (
    <div className="card flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <IconShoe size={14} stroke={1.5} style={{ color: "var(--steps)" }} />
          <span className="label-xs">Pas aujourd'hui</span>
        </div>
        <span className="label-xs">{goal.toLocaleString("fr-FR")}</span>
      </div>

      <div className="flex items-end gap-3">
        <span
          className="text-[26px] font-bold tabular-nums leading-none"
          style={{ color: steps != null ? "var(--text-primary)" : "var(--text-muted)" }}
        >
          {steps != null ? steps.toLocaleString("fr-FR") : "—"}
        </span>
        {steps != null && (
          <span className="text-[12px] mb-0.5" style={{ color: "var(--text-muted)" }}>
            pas
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
        <motion.div
          className="h-full rounded-full"
          style={{ background: "linear-gradient(90deg, var(--steps), rgba(34,211,238,0.6))" }}
          initial={{ width: 0 }}
          animate={{ width: `${pct * 100}%` }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>

      <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
        {steps != null
          ? pct >= 1
            ? "🎉 Objectif atteint !"
            : `${Math.round((1 - pct) * goal).toLocaleString("fr-FR")} pas restants`
          : "Synchroniser Google Fit pour voir vos pas"}
      </p>
    </div>
  );
}
