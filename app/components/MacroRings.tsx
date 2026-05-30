"use client";

import { motion } from "framer-motion";
import { levelColor } from "@/app/lib/colors";

interface MacroRingProps {
  value: number;
  goal: number;
  label: string;
  color: string;
  glow: string;
  unit?: string;
  size?: number;
  delay?: number;
}

function MacroRing({ value, goal, label, color, glow, unit = "g", size = 64, delay = 0 }: MacroRingProps) {
  const strokeW = 5;
  const r = (size - strokeW) / 2;
  const circ = 2 * Math.PI * r;
  const fraction = value / goal;
  const pct = Math.min(fraction, 1);
  const dash = circ * pct;
  const over = value > goal;
  const ringColor = over ? "#ef4444" : levelColor(fraction);
  const ringGlow  = over ? "rgba(239,68,68,0.3)" : `${ringColor}44`;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          <circle
            cx={size / 2} cy={size / 2} r={r}
            fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={strokeW}
          />
          {/* Glow */}
          {pct > 0.05 && (
            <motion.circle
              cx={size / 2} cy={size / 2} r={r}
              fill="none"
              stroke={ringGlow}
              strokeWidth={strokeW + 4}
              strokeLinecap="round"
              strokeDasharray={circ}
              initial={{ strokeDashoffset: circ }}
              animate={{ strokeDashoffset: circ - dash }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay }}
              style={{ filter: "blur(3px)" }}
            />
          )}
          <motion.circle
            cx={size / 2} cy={size / 2} r={r}
            fill="none"
            stroke={ringColor}
            strokeWidth={strokeW}
            strokeLinecap="round"
            strokeDasharray={circ}
            initial={{ strokeDashoffset: circ }}
            animate={{ strokeDashoffset: circ - dash }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="text-[11px] font-semibold tabular-nums"
            style={{ color: ringColor }}
          >
            {Math.round(value)}
          </span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-[11px] font-medium" style={{ color: "var(--text-secondary)" }}>{label}</p>
        <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>/{goal}{unit}</p>
      </div>
    </div>
  );
}

interface Props {
  proteinG: number;  proteinGoal: number;
  carbsG: number;    carbsGoal: number;
  fatG: number;      fatGoal: number;
  fiberG?: number;   fiberGoal?: number;
}

export default function MacroRings({ proteinG, proteinGoal, carbsG, carbsGoal, fatG, fatGoal, fiberG, fiberGoal }: Props) {
  return (
    <div className="flex justify-around items-start">
      <MacroRing value={proteinG} goal={proteinGoal} label="Protéines" color="var(--protein)" glow="rgba(167,139,250,0.3)" delay={0} />
      <MacroRing value={carbsG}   goal={carbsGoal}   label="Glucides"  color="var(--carbs)"   glow="rgba(251,191,36,0.3)"  delay={0.1} />
      <MacroRing value={fatG}     goal={fatGoal}     label="Lipides"   color="var(--fat)"     glow="rgba(96,165,250,0.3)"  delay={0.2} />
      {fiberGoal != null && (
        <MacroRing value={fiberG ?? 0} goal={fiberGoal} label="Fibres" color="var(--fiber)" glow="rgba(52,211,153,0.3)" delay={0.3} />
      )}
    </div>
  );
}
