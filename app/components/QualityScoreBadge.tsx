"use client";

import { motion } from "framer-motion";

interface Props {
  score: number | null; // 0-10, ou null si pas assez de données pour un score
  size?: number;
  strokeWidth?: number;
  showValue?: boolean;
  color?: string; // override — sinon dérivé du score
}

function bandColor(score: number): string {
  if (score >= 8.5) return "#22c55e";
  if (score >= 7)   return "#34d399";
  if (score >= 5)   return "#fbbf24";
  if (score >= 3)   return "#fb923c";
  return "#f87171";
}

/** Anneau SVG 0-10 — même langage visuel que CalorieArc (Journal), pour un
 * indicateur de qualité nutritionnelle cohérent avec le reste de l'app. */
export default function QualityScoreBadge({ score, size = 40, strokeWidth, showValue = true, color }: Props) {
  const cx = size / 2;
  const sw = strokeWidth ?? Math.max(2.5, size * 0.09);
  const R  = cx - sw;
  const circ = 2 * Math.PI * R;
  const fraction = score != null ? Math.min(1, score / 10) : 0;
  const col = score != null ? (color ?? bandColor(score)) : "var(--text-muted)";
  const dashArr = `${fraction * circ} ${circ}`;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: "block", flexShrink: 0 }}>
      <circle cx={cx} cy={cx} r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={sw} />
      {score != null && (
        <motion.circle
          cx={cx} cy={cx} r={R}
          fill="none" stroke={col} strokeWidth={sw} strokeLinecap="round"
          strokeDasharray={dashArr}
          transform={`rotate(-90 ${cx} ${cx})`}
          initial={{ strokeDasharray: `0 ${circ}` }}
          animate={{ strokeDasharray: dashArr }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        />
      )}
      {showValue && (
        <text x={cx} y={cx} textAnchor="middle" dominantBaseline="central"
          fontSize={size * 0.36} fontWeight="700" fontFamily="inherit"
          fill={score != null ? col : "var(--text-muted)"}>
          {score != null ? (Number.isInteger(score) ? score : score.toFixed(1)) : "—"}
        </text>
      )}
    </svg>
  );
}
