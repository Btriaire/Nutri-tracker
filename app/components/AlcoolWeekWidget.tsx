"use client";

import { motion } from "framer-motion";

// Widget "Alcool cette semaine" — extrait de ProgressClient.tsx.
export default function AlcoolWeekWidget({
  pts,
  weeklyGoal,
}: {
  pts:         { date: string; alcoolUnits: number; label: string }[];
  weeklyGoal:  number;
}) {
  const weeklyTotal  = Math.round(pts.reduce((s, p) => s + p.alcoolUnits, 0) * 10) / 10;
  const dailyLimit   = Math.round(weeklyGoal / 7 * 10) / 10;
  const pctWeek      = weeklyGoal > 0 ? Math.min(1, weeklyTotal / weeklyGoal) : 0;
  const overWeek     = weeklyTotal > weeklyGoal;

  function barColor(units: number): string {
    if (units === 0)            return "rgba(192,132,252,0.15)";
    if (units > dailyLimit)     return "var(--danger)";
    if (units > dailyLimit * 0.8) return "var(--carbs)";
    return "#c084fc";
  }

  if (pts.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.05 }}
      className="mb-4 glass px-4 pt-4 pb-3"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {/* Wine glass SVG */}
          <svg width={16} height={16} viewBox="0 0 24 28" fill="none">
            <path d="M5 3 L19 3 L15.5 14 L8.5 14 Z" stroke="#c084fc" strokeWidth="1.8" strokeLinejoin="round" fill="#c084fc" fillOpacity="0.2" />
            <line x1="12" y1="14" x2="12" y2="22" stroke="#c084fc" strokeWidth="1.8" strokeLinecap="round" />
            <path d="M7 22 Q12 25 17 22" stroke="#c084fc" strokeWidth="1.8" strokeLinecap="round" fill="none" />
          </svg>
          <p className="text-[12px] font-semibold" style={{ color: "var(--text-primary)" }}>
            Alcool — 7 derniers jours
          </p>
        </div>
        <div className="text-right">
          <span className="text-[14px] font-bold tabular-nums" style={{ color: overWeek ? "var(--danger)" : "#c084fc" }}>
            {weeklyTotal.toFixed(1)}
          </span>
          <span className="text-[11px] ml-0.5" style={{ color: "var(--text-muted)" }}>
            / {weeklyGoal}u sem.
          </span>
        </div>
      </div>

      {/* Weekly progress bar */}
      <div className="h-1.5 rounded-full overflow-hidden mb-3" style={{ background: "rgba(255,255,255,0.06)" }}>
        <motion.div
          className="h-full rounded-full"
          style={{ background: overWeek ? "var(--danger)" : "linear-gradient(90deg,#a855f7,#c084fc)" }}
          initial={{ width: 0 }}
          animate={{ width: `${pctWeek * 100}%` }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>

      {/* Daily bars */}
      <div className="flex items-end justify-between gap-1" style={{ height: "52px" }}>
        {pts.map(p => {
          const pct  = dailyLimit > 0 ? Math.min(1.3, p.alcoolUnits / dailyLimit) : 0;
          const h    = Math.round(pct * 40); // max height 40px (+ 30% overflow shown in red)
          const col  = barColor(p.alcoolUnits);
          return (
            <div key={p.date} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[11px] tabular-nums" style={{ color: p.alcoolUnits > 0 ? col : "transparent" }}>
                {p.alcoolUnits > 0 ? p.alcoolUnits.toFixed(1) : "·"}
              </span>
              <div className="w-full flex items-end justify-center" style={{ height: "40px" }}>
                <motion.div
                  className="w-full rounded-t-sm"
                  style={{ background: col, minHeight: p.alcoolUnits === 0 ? 2 : undefined }}
                  initial={{ height: 0 }}
                  animate={{ height: Math.max(2, h) }}
                  transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
                />
              </div>
              <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{p.label}</span>
            </div>
          );
        })}
      </div>

      {/* Daily limit reference */}
      <p className="text-[11px] mt-2" style={{ color: "var(--text-muted)" }}>
        Seuil jour : {dailyLimit}u · OMS ≤ {weeklyGoal}u/sem.
        {overWeek && (
          <span style={{ color: "var(--danger)" }}> · +{(weeklyTotal - weeklyGoal).toFixed(1)}u au-dessus</span>
        )}
      </p>
    </motion.div>
  );
}
