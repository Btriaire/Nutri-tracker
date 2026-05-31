"use client";

import { motion } from "framer-motion";
import { IconScale } from "@tabler/icons-react";
import type { WeightPoint } from "@/app/lib/types";

interface Props {
  weight: WeightPoint | null;
  previous?: WeightPoint | null;
}

export default function WeightWidget({ weight, previous }: Props) {
  const delta = weight && previous ? weight.kg - previous.kg : null;
  const trend = delta != null ? (delta < -0.05 ? "↓" : delta > 0.05 ? "↑" : "→") : null;
  const trendColor = delta != null
    ? delta < -0.05 ? "var(--fiber)"   // losing = green
    : delta > 0.05  ? "#ef4444"         // gaining = red
    : "var(--text-muted)"
    : "var(--text-muted)";

  return (
    <div className="card flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <IconScale size={14} stroke={1.5} style={{ color: "var(--weight)" }} />
        <span className="label-xs">Poids</span>
      </div>

      <div className="flex items-end gap-2">
        <span
          className="text-[26px] font-bold tabular-nums leading-none"
          style={{ color: weight ? "var(--text-primary)" : "var(--text-muted)" }}
        >
          {weight ? weight.kg.toFixed(1) : "—"}
        </span>
        {weight && (
          <span className="text-[13px] mb-0.5" style={{ color: "var(--text-muted)" }}>kg</span>
        )}
        {trend && delta != null && (
          <motion.span
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-[12px] font-semibold mb-0.5"
            style={{ color: trendColor }}
          >
            {trend} {Math.abs(delta).toFixed(1)}kg
          </motion.span>
        )}
      </div>

      {weight ? (
        <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
          Mesuré le {new Date(weight.date).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}
        </p>
      ) : (
        <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
          Synchroniser Withings pour voir votre poids
        </p>
      )}
    </div>
  );
}
