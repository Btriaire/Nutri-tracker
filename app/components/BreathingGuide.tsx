"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Stop, Timer, CaretDown, CaretUp, SpeakerHigh, SpeakerSlash } from "@phosphor-icons/react";

// ─── Web Audio zen sound engine ───────────────────────────────────────────────

function createZenAudio(color: string) {
  const ctx  = new AudioContext();

  // ── 1. Drone base (low sine, barely audible) ──────────────────────────────
  const droneFreq: Record<string, number> = {
    "#60a5fa": 136.1, // OM frequency — blue (cohérence)
    "#34d399": 174.0, // solfège Fa — green (box)
    "#a78bfa": 111.0, // very low, sleepy — purple (4-7-8)
  };
  const freq   = droneFreq[color] ?? 136.1;
  const drone  = ctx.createOscillator();
  const droneG = ctx.createGain();
  drone.type      = "sine";
  drone.frequency.value = freq;
  droneG.gain.value     = 0;
  drone.connect(droneG);
  droneG.connect(ctx.destination);
  drone.start();

  // ── 2. Soft noise (filtered white noise = wind) ───────────────────────────
  const bufLen = ctx.sampleRate * 3;
  const buf    = ctx.createBuffer(1, bufLen, ctx.sampleRate);
  const data   = buf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
  const noise    = ctx.createBufferSource();
  noise.buffer   = buf;
  noise.loop     = true;
  const biquad   = ctx.createBiquadFilter();
  biquad.type    = "lowpass";
  biquad.frequency.value = 300;
  biquad.Q.value         = 0.5;
  const noiseG   = ctx.createGain();
  noiseG.gain.value = 0;
  noise.connect(biquad);
  biquad.connect(noiseG);
  noiseG.connect(ctx.destination);
  noise.start();

  // ── 3. Bell on phase change ───────────────────────────────────────────────
  function playBell() {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type   = "sine";
    osc.frequency.setValueAtTime(freq * 3, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq * 2, ctx.currentTime + 1.2);
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 2);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + 2.2);
  }

  // ── Public API ────────────────────────────────────────────────────────────
  function setInhale(durationS: number) {
    const t = ctx.currentTime;
    droneG.gain.cancelScheduledValues(t);
    noiseG.gain.cancelScheduledValues(t);
    droneG.gain.linearRampToValueAtTime(0.06, t + durationS * 0.6);
    noiseG.gain.linearRampToValueAtTime(0.04, t + durationS * 0.6);
  }
  function setHold() {
    // gentle plateau — keep current volume
  }
  function setExhale(durationS: number) {
    const t = ctx.currentTime;
    droneG.gain.cancelScheduledValues(t);
    noiseG.gain.cancelScheduledValues(t);
    droneG.gain.linearRampToValueAtTime(0.02, t + durationS * 0.7);
    noiseG.gain.linearRampToValueAtTime(0.01, t + durationS * 0.7);
  }
  function stop() {
    const t = ctx.currentTime;
    droneG.gain.linearRampToValueAtTime(0, t + 1);
    noiseG.gain.linearRampToValueAtTime(0, t + 1);
    setTimeout(() => ctx.close(), 1200);
  }

  return { playBell, setInhale, setHold, setExhale, stop };
}

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
  const [collapsed,   setCollapsed]   = useState(true);
  const [selectedId,  setSelectedId]  = useState<string>("coherence");
  const [active,      setActive]      = useState(false);
  const [phaseIdx,    setPhaseIdx]    = useState(0);
  const [phaseTick,   setPhaseTick]   = useState(0); // tenths of a second (0-9 per sec)
  const [cycleCount,  setCycleCount]  = useState(0);
  const [elapsed,     setElapsed]     = useState(0); // seconds
  const [duration,    setDuration]    = useState(3); // minutes, 0=infinite
  const [soundOn,     setSoundOn]     = useState(true);

  const tickRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<ReturnType<typeof createZenAudio> | null>(null);
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
            // Trigger audio for next phase
            if (audioRef.current) {
              const nextPhase = prog.phases[nextPi];
              audioRef.current.playBell();
              if (nextPhase.label === "Inspirez")      audioRef.current.setInhale(nextPhase.seconds);
              else if (nextPhase.label === "Expirez")  audioRef.current.setExhale(nextPhase.seconds);
              else                                     audioRef.current.setHold();
            }
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

  // ── Audio: start/stop engine with session ────────────────────────────────
  const handleStart = useCallback(() => {
    setPhaseIdx(0); setPhaseTick(0); setCycleCount(0); setElapsed(0);
    if (soundOn) {
      try {
        audioRef.current = createZenAudio(prog.color);
        audioRef.current.playBell();
        audioRef.current.setInhale(prog.phases[0].seconds);
      } catch { /* AudioContext may be blocked */ }
    }
    setActive(true);
  }, [soundOn, prog]);

  const handleStop = useCallback(() => {
    setActive(false);
    setPhaseIdx(0); setPhaseTick(0); setCycleCount(0); setElapsed(0);
    if (audioRef.current) { audioRef.current.stop(); audioRef.current = null; }
  }, []);

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
      {/* Collapsible header */}
      <button
        className="w-full flex items-center justify-between"
        onClick={() => setCollapsed(v => !v)}
      >
        <p className="label-xs">🫁 Respiration guidée</p>
        {collapsed
          ? <CaretDown size={14} style={{ color: "var(--text-muted)" }} />
          : <CaretUp   size={14} style={{ color: "var(--text-muted)" }} />
        }
      </button>

      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            key="breathing-content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{ overflow: "hidden" }}
          >
            <div className="mt-3">

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

        {/* Sound toggle */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setSoundOn(v => !v)}
            className="flex items-center gap-1.5 text-[11px] transition-all"
            style={{ color: soundOn ? prog.color : "var(--text-muted)" }}>
            {soundOn
              ? <SpeakerHigh size={13} weight="fill" />
              : <SpeakerSlash size={13} weight="fill" />}
            {soundOn ? "Sons zen activés" : "Sons désactivés"}
          </button>
          {soundOn && !active && (
            <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>
              Drone · Vent · Cloche
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
