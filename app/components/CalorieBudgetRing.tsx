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

export default function CalorieBudgetRing({ consumed, goal, burned, activeMinutes, sessionCount, steps, stepsGoal = 10000, size = 172, onBurnedClick }: Props) {
  const burnedVal  = burned ?? 0;
  const remaining  = goal - consumed;             // restantes brutes (sans activité)
  const net        = consumed - burnedVal;        // net = consommé − brûlé
  const netRemain  = goal - net;                  // restantes nettes (avec activité)
  const hasActivity = burnedVal > 0;
  // What the center shows: net when activity data is present, raw otherwise
  const centerVal  = hasActivity ? netRemain : remaining;
  const over       = hasActivity ? net > goal : consumed > goal;

  // ── Outer ring: burned calories ────────────────────────────────────────────
  const swOuter = 8;
  const rOuter  = (size - swOuter) / 2;
  const circOut = 2 * Math.PI * rOuter;
  const burnPct = burnedVal > 0 ? Math.min(burnedVal / goal, 1) : 0;
  const burnDash = circOut * burnPct;

  // ── Inner ring: net calories consumed (consumed − burned) ─────────────────
  const gap    = 10;                             // space between rings
  const swInner = 12;
  const rInner  = rOuter - swOuter / 2 - gap - swInner / 2;
  const circIn  = 2 * Math.PI * rInner;
  // Ring fills based on net consumption when activity data present
  const netForRing = hasActivity ? Math.max(net, 0) : consumed;
  const consPct  = Math.min(netForRing / goal, 1);
  const consDash = circIn * consPct;

  // ── Activity ring: steps vs goal ──────────────────────────────────────────
  const gap2   = 8;
  const swAct  = 7;
  const rAct   = rInner - swInner / 2 - gap2 - swAct / 2;
  const circAct = 2 * Math.PI * rAct;
  const stepsPct = (steps != null && stepsGoal > 0) ? Math.min(steps / stepsGoal, 1) : 0;
  const stepsDash = circAct * stepsPct;
  const stepsGoalReached = steps != null && steps >= stepsGoal;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>

          {/* ── Outer track (burned background) ── */}
          <circle cx={size/2} cy={size/2} r={rOuter}
            fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={swOuter} />

          {/* ── Burned arc (green, transparent) — only if data ── */}
          {burnedVal > 0 && (
            <>
              {/* Glow */}
              <motion.circle
                cx={size/2} cy={size/2} r={rOuter}
                fill="none"
                stroke="rgba(52,211,153,0.15)"
                strokeWidth={swOuter + 6}
                strokeLinecap="round"
                strokeDasharray={circOut}
                initial={{ strokeDashoffset: circOut }}
                animate={{ strokeDashoffset: circOut - burnDash }}
                transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
                style={{ filter: "blur(5px)" }}
              />
              {/* Arc */}
              <motion.circle
                cx={size/2} cy={size/2} r={rOuter}
                fill="none"
                stroke="rgba(52,211,153,0.55)"
                strokeWidth={swOuter}
                strokeLinecap="round"
                strokeDasharray={circOut}
                initial={{ strokeDashoffset: circOut }}
                animate={{ strokeDashoffset: circOut - burnDash }}
                transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
              />
            </>
          )}

          {/* ── Inner track (consumed background) ── */}
          <circle cx={size/2} cy={size/2} r={rInner}
            fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={swInner} />

          {/* ── Remaining indicator (light fill on remaining arc) ── */}
          {centerVal > 0 && centerVal < goal && (
            <motion.circle
              cx={size/2} cy={size/2} r={rInner}
              fill="none"
              stroke="rgba(249,115,22,0.08)"
              strokeWidth={swInner}
              strokeLinecap="round"
              strokeDasharray={circIn}
              initial={{ strokeDashoffset: 0 }}
              animate={{ strokeDashoffset: -(consDash) }}
              transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            />
          )}

          {/* ── Consumed arc glow ── */}
          {consPct > 0.02 && (
            <motion.circle
              cx={size/2} cy={size/2} r={rInner}
              fill="none"
              stroke={over ? "rgba(239,68,68,0.25)" : "rgba(249,115,22,0.2)"}
              strokeWidth={swInner + 8}
              strokeLinecap="round"
              strokeDasharray={circIn}
              initial={{ strokeDashoffset: circIn }}
              animate={{ strokeDashoffset: circIn - consDash }}
              transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
              style={{ filter: "blur(5px)" }}
            />
          )}

          {/* ── Consumed arc ── */}
          <motion.circle
            cx={size/2} cy={size/2} r={rInner}
            fill="none"
            stroke={over ? "#ef4444" : "var(--calories)"}
            strokeWidth={swInner}
            strokeLinecap="round"
            strokeDasharray={circIn}
            initial={{ strokeDashoffset: circIn }}
            animate={{ strokeDashoffset: circIn - consDash }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          />

          {/* ── Steps track ── */}
          <circle cx={size/2} cy={size/2} r={rAct}
            fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={swAct} />

          {/* ── Steps arc ── */}
          {stepsPct > 0.01 && (
            <>
              {/* Glow */}
              <motion.circle
                cx={size/2} cy={size/2} r={rAct}
                fill="none"
                stroke={stepsGoalReached ? "rgba(167,139,250,0.25)" : "rgba(99,102,241,0.2)"}
                strokeWidth={swAct + 6}
                strokeLinecap="round"
                strokeDasharray={circAct}
                initial={{ strokeDashoffset: circAct }}
                animate={{ strokeDashoffset: circAct - stepsDash }}
                transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
                style={{ filter: "blur(4px)" }}
              />
              {/* Arc */}
              <motion.circle
                cx={size/2} cy={size/2} r={rAct}
                fill="none"
                stroke={stepsGoalReached ? "rgba(167,139,250,0.9)" : "rgba(99,102,241,0.75)"}
                strokeWidth={swAct}
                strokeLinecap="round"
                strokeDasharray={circAct}
                initial={{ strokeDashoffset: circAct }}
                animate={{ strokeDashoffset: circAct - stepsDash }}
                transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
              />
            </>
          )}
        </svg>

        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
          <motion.span
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.35, duration: 0.4 }}
            className="text-[30px] font-bold leading-none tabular-nums"
            style={{ color: over ? "#ef4444" : "var(--text-primary)" }}
          >
            {over ? `+${Math.round(Math.abs(centerVal))}` : Math.round(centerVal > 0 ? centerVal : 0)}
          </motion.span>
          <span className="text-[10px] font-medium" style={{ color: over ? "#ef4444" : "var(--text-muted)" }}>
            {over ? "dépassé" : "restantes"}
          </span>
          {hasActivity && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="text-[9px] mt-0.5 px-1.5 py-0.5 rounded-full"
              style={{ color: "rgba(52,211,153,0.9)", background: "rgba(52,211,153,0.08)" }}
            >
              🔥 −{Math.round(burnedVal)} activité
            </motion.span>
          )}
          {hasActivity && remaining > 0 && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
              className="text-[8px]"
              style={{ color: "var(--text-muted)" }}
            >
              sans activité : {Math.round(remaining)}
            </motion.span>
          )}
        </div>

        {/* Legend dots */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="absolute bottom-1 right-1 flex flex-col gap-0.5 items-end"
        >
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--calories)" }} />
            <span className="text-[7px]" style={{ color: "var(--text-muted)" }}>consommé</span>
          </div>
          {burnedVal > 0 && (
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: "rgba(52,211,153,0.6)" }} />
              <span className="text-[7px]" style={{ color: "var(--text-muted)" }}>brûlé</span>
            </div>
          )}
          {steps != null && steps > 0 && (
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: stepsGoalReached ? "rgba(167,139,250,0.9)" : "rgba(99,102,241,0.75)" }} />
              <span className="text-[7px]" style={{ color: "var(--text-muted)" }}>pas</span>
            </div>
          )}
        </motion.div>
      </div>

      {/* Stats row */}
      <div className="flex gap-5 text-center">
        <div>
          <p className="text-[15px] font-semibold t-calories tabular-nums">{Math.round(consumed)}</p>
          <p className="label-xs mt-0.5">Mangées</p>
        </div>
        <div className="w-px" style={{ background: "var(--border)" }} />
        <div>
          <p className="text-[15px] font-semibold tabular-nums"
            style={{ color: over ? "#ef4444" : "var(--text-primary)" }}>
            {goal}
          </p>
          <p className="label-xs mt-0.5">Objectif</p>
        </div>
        {burnedVal > 0 && (
          <>
            <div className="w-px" style={{ background: "var(--border)" }} />
            <button
              onClick={onBurnedClick}
              className="flex flex-col items-center transition-opacity active:opacity-60"
              style={{ cursor: onBurnedClick ? "pointer" : "default" }}
            >
              <p className="text-[15px] font-semibold tabular-nums" style={{ color: "rgba(52,211,153,0.9)" }}>
                −{Math.round(burnedVal)}
              </p>
              <p className="label-xs mt-0.5 flex items-center gap-0.5">
                Brûlées
                {onBurnedClick && <span className="text-[8px]" style={{ color: "var(--text-muted)" }}>ℹ</span>}
              </p>
              {(activeMinutes != null || sessionCount != null) && (
                <p className="text-[9px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                  {[
                    activeMinutes != null && activeMinutes > 0 ? `${activeMinutes} min` : null,
                    sessionCount  != null && sessionCount  > 0 ? `${sessionCount} séance${sessionCount > 1 ? "s" : ""}` : null,
                  ].filter(Boolean).join(" · ") || "activité"}
                </p>
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
