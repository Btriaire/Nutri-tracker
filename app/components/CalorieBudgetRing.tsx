"use client";

import { motion } from "framer-motion";

interface Props {
  consumed:        number;
  goal:            number;
  burned?:         number | null;
  activeMinutes?:  number | null;
  sessionCount?:   number;
  steps?:          number | null;
  stepsGoal?:      number;
  size?:           number;
  onBurnedClick?:  () => void;
}

// ── Ring colours ──────────────────────────────────────────────────────────────
const C_CONSUMED = "var(--calories)";           // orange
const C_CONSUMED_OVER = "#ef4444";              // red if over goal
const C_BURNED   = "rgba(52,211,153,0.85)";     // green
const C_STEPS    = "rgba(129,140,248,0.85)";    // indigo
const C_STEPS_DONE = "rgba(167,139,250,0.9)";  // violet when goal reached

export default function CalorieBudgetRing({
  consumed, goal, burned, activeMinutes, sessionCount, steps, stepsGoal = 10000,
  size = 188, onBurnedClick,
}: Props) {
  const burnedVal   = burned ?? 0;
  const hasActivity = burnedVal > 0;
  const hasSteps    = steps != null && steps > 0;

  // Net calories (what the user really has left)
  const net       = consumed - burnedVal;
  const netRemain = goal - net;
  const rawRemain = goal - consumed;
  const centerVal = hasActivity ? netRemain : rawRemain;
  const over      = hasActivity ? net > goal : consumed > goal;

  // ── Ring geometry: outer → consumed, middle → burned, inner → steps ─────────
  const SW = 9;   // stroke width (all rings equal for clean look)
  const GAP = 8;  // gap between rings

  const rOuter  = (size - SW) / 2;
  const rMiddle = rOuter  - SW / 2 - GAP - SW / 2;
  const rInner  = rMiddle - SW / 2 - GAP - SW / 2;

  // Circumferences
  const circOuter  = 2 * Math.PI * rOuter;
  const circMiddle = 2 * Math.PI * rMiddle;
  const circInner  = 2 * Math.PI * rInner;

  // Progress fractions (capped at 1 for arc, uncapped for "over" detection)
  const consPct   = Math.min(consumed / goal, 1);
  const burnPct   = Math.min(burnedVal / goal, 1);
  const stepsPct  = Math.min((steps ?? 0) / stepsGoal, 1);
  const stepsOver = steps != null && steps >= stepsGoal;

  const consDash  = circOuter  * consPct;
  const burnDash  = circMiddle * burnPct;
  const stepsDash = circInner  * stepsPct;

  const springIn = (delay = 0) => ({
    duration: 1.1, ease: [0.16, 1, 0.3, 1] as [number, number, number, number], delay,
  });

  return (
    <div className="flex flex-col items-center gap-4">
      {/* ── SVG Rings ── */}
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>

          {/* ═══ OUTER RING: Consommé (orange) ═══ */}
          <circle cx={size/2} cy={size/2} r={rOuter}
            fill="none" stroke="rgba(249,115,22,0.10)" strokeWidth={SW} />
          {consPct > 0.01 && (
            <>
              <motion.circle cx={size/2} cy={size/2} r={rOuter}
                fill="none"
                stroke={over ? "rgba(239,68,68,0.30)" : "rgba(249,115,22,0.22)"}
                strokeWidth={SW + 8} strokeLinecap="round"
                strokeDasharray={circOuter}
                initial={{ strokeDashoffset: circOuter }}
                animate={{ strokeDashoffset: circOuter - consDash }}
                transition={springIn(0)}
                style={{ filter: "blur(6px)" }}
              />
              <motion.circle cx={size/2} cy={size/2} r={rOuter}
                fill="none"
                stroke={over ? C_CONSUMED_OVER : C_CONSUMED}
                strokeWidth={SW} strokeLinecap="round"
                strokeDasharray={circOuter}
                initial={{ strokeDashoffset: circOuter }}
                animate={{ strokeDashoffset: circOuter - consDash }}
                transition={springIn(0)}
              />
            </>
          )}

          {/* ═══ MIDDLE RING: Brûlé (green) ═══ */}
          <circle cx={size/2} cy={size/2} r={rMiddle}
            fill="none" stroke="rgba(52,211,153,0.08)" strokeWidth={SW} />
          {burnPct > 0.01 && (
            <>
              <motion.circle cx={size/2} cy={size/2} r={rMiddle}
                fill="none"
                stroke="rgba(52,211,153,0.20)"
                strokeWidth={SW + 8} strokeLinecap="round"
                strokeDasharray={circMiddle}
                initial={{ strokeDashoffset: circMiddle }}
                animate={{ strokeDashoffset: circMiddle - burnDash }}
                transition={springIn(0.15)}
                style={{ filter: "blur(5px)" }}
              />
              <motion.circle cx={size/2} cy={size/2} r={rMiddle}
                fill="none"
                stroke={C_BURNED}
                strokeWidth={SW} strokeLinecap="round"
                strokeDasharray={circMiddle}
                initial={{ strokeDashoffset: circMiddle }}
                animate={{ strokeDashoffset: circMiddle - burnDash }}
                transition={springIn(0.15)}
              />
            </>
          )}

          {/* ═══ INNER RING: Activité / Pas (indigo) ═══ */}
          <circle cx={size/2} cy={size/2} r={rInner}
            fill="none" stroke="rgba(129,140,248,0.08)" strokeWidth={SW} />
          {stepsPct > 0.01 && (
            <>
              <motion.circle cx={size/2} cy={size/2} r={rInner}
                fill="none"
                stroke={stepsOver ? "rgba(167,139,250,0.22)" : "rgba(129,140,248,0.18)"}
                strokeWidth={SW + 8} strokeLinecap="round"
                strokeDasharray={circInner}
                initial={{ strokeDashoffset: circInner }}
                animate={{ strokeDashoffset: circInner - stepsDash }}
                transition={springIn(0.30)}
                style={{ filter: "blur(5px)" }}
              />
              <motion.circle cx={size/2} cy={size/2} r={rInner}
                fill="none"
                stroke={stepsOver ? C_STEPS_DONE : C_STEPS}
                strokeWidth={SW} strokeLinecap="round"
                strokeDasharray={circInner}
                initial={{ strokeDashoffset: circInner }}
                animate={{ strokeDashoffset: circInner - stepsDash }}
                transition={springIn(0.30)}
              />
            </>
          )}
        </svg>

        {/* ── Center text — large and uncluttered ── */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
          <motion.span
            initial={{ opacity: 0, scale: 0.75 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="text-[34px] font-bold leading-none tabular-nums"
            style={{ color: over ? C_CONSUMED_OVER : "var(--text-primary)" }}
          >
            {over
              ? `+${Math.round(Math.abs(centerVal))}`
              : Math.round(centerVal > 0 ? centerVal : 0)}
          </motion.span>
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.45 }}
            className="text-[11px] font-medium tracking-wide"
            style={{ color: over ? C_CONSUMED_OVER : "var(--text-muted)" }}
          >
            {over ? "kcal dépassé" : "kcal restantes"}
          </motion.span>
        </div>

        {/* ── Legend (bottom-right corner) ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.85 }}
          className="absolute bottom-2 right-2 flex flex-col gap-0.5 items-end"
        >
          <LegendDot color={over ? C_CONSUMED_OVER : C_CONSUMED} label="consommé" />
          {hasActivity && <LegendDot color={C_BURNED}  label="brûlé" />}
          {hasSteps    && <LegendDot color={stepsOver ? C_STEPS_DONE : C_STEPS} label="pas" />}
        </motion.div>
      </div>

      {/* ── Stats row ── */}
      <div className="w-full flex items-stretch justify-center"
        style={{ borderRadius: 12, overflow: "hidden", background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>

        {/* Consommé */}
        <StatCell
          value={Math.round(consumed)}
          label="Mangées"
          color={over ? C_CONSUMED_OVER : C_CONSUMED}
        />

        <div className="w-px self-stretch" style={{ background: "var(--border)" }} />

        {/* Objectif */}
        <StatCell value={goal} label="Objectif" />

        {/* Brûlées (conditionnel) */}
        {hasActivity && (
          <>
            <div className="w-px self-stretch" style={{ background: "var(--border)" }} />
            <button
              onClick={onBurnedClick}
              className="flex-1 flex flex-col items-center justify-center px-3 py-2 transition-opacity active:opacity-60"
              style={{ cursor: onBurnedClick ? "pointer" : "default" }}
            >
              <span className="text-[15px] font-semibold tabular-nums" style={{ color: C_BURNED }}>
                −{Math.round(burnedVal)}
              </span>
              <span className="label-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                Brûlées{onBurnedClick ? " ℹ" : ""}
              </span>
              {(activeMinutes != null && activeMinutes > 0 || sessionCount != null && sessionCount > 0) && (
                <span className="text-[9px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                  {[
                    activeMinutes ? `${activeMinutes} min` : null,
                    sessionCount  ? `${sessionCount} séance${sessionCount > 1 ? "s" : ""}` : null,
                  ].filter(Boolean).join(" · ")}
                </span>
              )}
            </button>
          </>
        )}

        {/* Pas (conditionnel) */}
        {hasSteps && (
          <>
            <div className="w-px self-stretch" style={{ background: "var(--border)" }} />
            <StatCell
              value={steps!.toLocaleString("fr-FR")}
              label={`/ ${stepsGoal.toLocaleString("fr-FR")} pas`}
              color={stepsOver ? C_STEPS_DONE : C_STEPS}
            />
          </>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatCell({ value, label, color }: { value: string | number; label: string; color?: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-3 py-2">
      <span className="text-[15px] font-semibold tabular-nums"
        style={{ color: color ?? "var(--text-primary)" }}>
        {value}
      </span>
      <span className="label-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{label}</span>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1">
      <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
      <span className="text-[7px]" style={{ color: "var(--text-muted)" }}>{label}</span>
    </div>
  );
}
