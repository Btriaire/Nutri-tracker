"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Stop, Timer } from "@phosphor-icons/react";

// ─── Programs ────────────────────────────────────────────────────────────────

interface Phase {
  label:    string;
  seconds:  number;
  scale:    number;
  opacity:  number;
}

interface Program {
  id:      string;
  emoji:   string;
  name:    string;
  desc:    string;
  color:   string;
  glow:    string;
  phases:  Phase[];
  recMin?: number;
}

const PROGRAMS: Program[] = [
  {
    id: "coherence", emoji: "💙", name: "Cohérence cardiaque",
    desc: "5s inspire · 5s expire · réduit le cortisol",
    color: "#60a5fa", glow: "rgba(96,165,250,0.35)",
    recMin: 3,
    phases: [
      { label: "Inspirez",  seconds: 5, scale: 1.35, opacity: 1    },
      { label: "Expirez",   seconds: 5, scale: 0.70, opacity: 0.55 },
    ],
  },
  {
    id: "box", emoji: "🟦", name: "Box breathing",
    desc: "4s · 4s · 4s · 4s · technique Navy SEALs",
    color: "#34d399", glow: "rgba(52,211,153,0.35)",
    recMin: 5,
    phases: [
      { label: "Inspirez",  seconds: 4, scale: 1.35, opacity: 1    },
      { label: "Retenez",   seconds: 4, scale: 1.35, opacity: 0.80 },
      { label: "Expirez",   seconds: 4, scale: 0.70, opacity: 0.55 },
      { label: "Retenez",   seconds: 4, scale: 0.70, opacity: 0.40 },
    ],
  },
  {
    id: "sleep", emoji: "🌙", name: "Sommeil 4-7-8",
    desc: "4s · 7s · 8s · induction du sommeil",
    color: "#a78bfa", glow: "rgba(167,139,250,0.35)",
    recMin: 4,
    phases: [
      { label: "Inspirez",  seconds: 4,  scale: 1.35, opacity: 1    },
      { label: "Retenez",   seconds: 7,  scale: 1.35, opacity: 0.80 },
      { label: "Expirez",   seconds: 8,  scale: 0.70, opacity: 0.55 },
    ],
  },
];

const DURATIONS = [
  { label: "3 min",  value: 3  },
  { label: "5 min",  value: 5  },
  { label: "10 min", value: 10 },
  { label: "∞",      value: 0  },
];

function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function BreathingGuide() {
  const [selectedId,  setSelectedId]  = useState<string>("coherence");
  const [active,      setActive]      = useState(false);
  const [phaseIdx,    setPhaseIdx]    = useState(0);
  const [phaseTick,   setPhaseTick]   = useState(0); // tenths of a second (0-9 per sec)
  const [cycleCount,  setCycleCount]  = useState(0);
  const [elapsed,     setElapsed]     = useState(0); // seconds
  const [duration,    setDuration]    = useState(3); // minutes, 0=infinite

  const tickRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const prog     = PROGRAMS.find(p => p.id === selectedId)!;

  // Tick every 100ms
  useEffect(() => {
    if (!active) return;
    const phase = prog.phases[phaseIdx];
    const totalTenths = phase.seconds * 10;

    tickRef.current = setInterval(() => {
      setPhaseTick(t => {
        const next = t + 1;
        if (next >= totalTenths) {
          // Advance phase
          setPhaseIdx(pi => {
            const nextPi = (pi + 1) % prog.phases.length;
            if (nextPi === 0) setCycleCount(c => c + 1);
            return nextPi;
          });
          return 0;
        }
        return next;
      });
      setElapsed(e => {
        const ne = e + 0.1;
        if (duration > 0 && ne >= duration * 60) {
          setActive(false);
        }
        return ne;
      });
    }, 100);

    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [active, phaseIdx, prog, duration]);

  const handleStart = () => {
    setPhaseIdx(0); setPhaseTick(0); setCycleCount(0); setElapsed(0);
    setActive(true);
  };

  const handleStop = () => {
    setActive(false);
    setPhaseIdx(0); setPhaseTick(0); setCycleCount(0); setElapsed(0);
  };

  const handleSelectProgram = (id: string) => {
    if (active) handleStop();
    setSelectedId(id);
  };

  const phase         = prog.phases[phaseIdx];
  const phaseProgress = phaseTick / (phase.seconds * 10); // 0→1
  const elapsedSec    = Math.floor(elapsed);
  const remaining     = duration > 0 ? Math.max(0, duration * 60 - elapsedSec) : null;

  return (
    <div className="glass p-4">
      <p className="label-xs mb-3">🫁 Respiration guidée</p>

      {/* Program selector */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {PROGRAMS.map(p => {
          const sel = selectedId === p.id;
          return (
            <button key={p.id} onClick={() => handleSelectProgram(p.id)}
              className="flex flex-col items-center gap-1 p-2.5 rounded-xl transition-all text-center"
              style={{
                background: sel ? `${p.color}18` : "rgba(255,255,255,0.03)",
                border: `1px solid ${sel ? p.color + "55" : "var(--border)"}`,
              }}>
              <span className="text-[20px]">{p.emoji}</span>
              <p className="text-[10px] font-semibold leading-tight" style={{ color: sel ? p.color : "var(--text-primary)" }}>
                {p.name}
              </p>
            </button>
          );
        })}
      </div>

      {/* Animated orb */}
      <div className="flex flex-col items-center py-5 relative">

        {/* Outer glow ring */}
        <AnimatePresence mode="wait">
          {active && (
            <motion.div
              key={`glow-${phaseIdx}`}
              className="absolute rounded-full"
              style={{ width: 180, height: 180, background: "transparent",
                border: `2px solid ${prog.color}30`, top: "50%", left: "50%",
                x: "-50%", y: "-50%", marginTop: 20 }}
              animate={{ scale: [1, 1.08, 1], opacity: [0.4, 0.7, 0.4] }}
              transition={{ duration: phase.seconds, ease: "easeInOut", repeat: 0 }}
            />
          )}
        </AnimatePresence>

        {/* Orb */}
        <motion.div
          animate={{
            scale:   active ? phase.scale   : 1,
            opacity: active ? phase.opacity : 0.6,
          }}
          transition={{
            duration: phase.seconds,
            ease: phase.label === "Inspirez" ? [0.4, 0, 0.2, 1] : [0.6, 0, 0.4, 1],
          }}
          className="relative flex items-center justify-center rounded-full"
          style={{
            width: 130, height: 130,
            background: `radial-gradient(circle at 40% 35%, ${prog.color}cc, ${prog.color}55)`,
            boxShadow: active ? `0 0 40px 8px ${prog.glow}, 0 0 80px 20px ${prog.glow}55` : "none",
          }}
        >
          {/* Phase label + countdown */}
          <div className="flex flex-col items-center select-none">
            <AnimatePresence mode="wait">
              <motion.p key={`label-${phaseIdx}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25 }}
                className="text-[13px] font-semibold text-white">
                {active ? phase.label : prog.name.split(" ")[0]}
              </motion.p>
            </AnimatePresence>
            {active && (
              <p className="text-[22px] font-bold tabular-nums text-white leading-none mt-0.5">
                {Math.ceil(phase.seconds - phaseProgress * phase.seconds)}
              </p>
            )}
          </div>

          {/* Arc progress */}
          {active && (
            <svg className="absolute inset-0 w-full h-full" style={{ transform: "rotate(-90deg)" }}>
              <circle cx="65" cy="65" r="60" fill="none"
                stroke="rgba(255,255,255,0.12)" strokeWidth="3" />
              <motion.circle cx="65" cy="65" r="60" fill="none"
                stroke="rgba(255,255,255,0.7)" strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 60}`}
                animate={{ strokeDashoffset: (1 - phaseProgress) * 2 * Math.PI * 60 }}
                transition={{ duration: 0.1, ease: "linear" }}
              />
            </svg>
          )}
        </motion.div>

        {/* Stats row */}
        {active && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex items-center gap-4 mt-4 text-center">
            <div>
              <p className="text-[18px] font-bold tabular-nums" style={{ color: prog.color }}>{cycleCount}</p>
              <p className="text-[9px]" style={{ color: "var(--text-muted)" }}>cycles</p>
            </div>
            <div className="w-px h-6" style={{ background: "var(--border)" }} />
            <div>
              <p className="text-[18px] font-bold tabular-nums" style={{ color: prog.color }}>
                {remaining !== null ? fmtTime(remaining) : fmtTime(elapsedSec)}
              </p>
              <p className="text-[9px]" style={{ color: "var(--text-muted)" }}>
                {remaining !== null ? "restantes" : "écoulé"}
              </p>
            </div>
          </motion.div>
        )}

        {/* Hint when idle */}
        {!active && (
          <p className="text-[11px] mt-3 text-center" style={{ color: "var(--text-muted)" }}>
            {prog.desc}
          </p>
        )}
      </div>

      {/* Duration + controls */}
      <div className="space-y-3 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
        {/* Duration chips */}
        <div className="flex items-center gap-1.5">
          <Timer size={12} style={{ color: "var(--text-muted)" }} className="flex-shrink-0" />
          {DURATIONS.map(d => {
            const sel = duration === d.value;
            return (
              <button key={d.value} onClick={() => setDuration(d.value)}
                disabled={active}
                className="px-2 py-0.5 rounded-lg text-[10px] font-medium transition-all"
                style={{
                  background: sel ? `${prog.color}25` : "rgba(255,255,255,0.04)",
                  border: `1px solid ${sel ? prog.color + "60" : "var(--border)"}`,
                  color: sel ? prog.color : "var(--text-muted)",
                  opacity: active ? 0.5 : 1,
                }}>
                {d.label}
              </button>
            );
          })}
          {prog.recMin && !active && (
            <span className="text-[9px] ml-auto" style={{ color: "var(--text-muted)" }}>
              Recommandé : {prog.recMin} min
            </span>
          )}
        </div>

        {/* Start / Stop */}
        {active ? (
          <button onClick={handleStop}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-[13px] transition-all"
            style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.35)", color: "#f87171" }}>
            <Stop size={14} weight="fill" />
            Arrêter
          </button>
        ) : (
          <motion.button onClick={handleStart}
            whileTap={{ scale: 0.97 }}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-[13px] transition-all"
            style={{ background: `${prog.color}22`, border: `1px solid ${prog.color}55`, color: prog.color }}>
            <Play size={14} weight="fill" />
            Commencer
          </motion.button>
        )}
      </div>
    </div>
  );
}
