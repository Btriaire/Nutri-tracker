"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, Pause, Stop, MusicNote, CheckCircle, Flower, Timer,
  ArrowLeft, SpeakerHigh, SpeakerSlash,
} from "@phosphor-icons/react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

// ─── Types ───────────────────────────────────────────────────────────────────

type ProgramId = "court" | "moyen" | "long";

interface Program {
  id:          ProgramId;
  label:       string;
  durationMin: number;
  emoji:       string;
  description: string;
  color:       string;
  steps:       { label: string; durationSec: number; instruction: string }[];
  soundType:   "bowl" | "nature" | "binaural";
}

const PROGRAMS: Program[] = [
  {
    id:          "court",
    label:       "Pleine présence",
    durationMin: 5,
    emoji:       "🌸",
    description: "Ancrage rapide · respiration · calme l'esprit en 5 minutes",
    color:       "#a3e4a3",
    soundType:   "bowl",
    steps: [
      { label: "Arrivée",       durationSec: 30,  instruction: "Installez-vous confortablement. Fermez doucement les yeux. Sentez le contact de votre corps avec le sol ou votre siège." },
      { label: "Respiration",   durationSec: 120, instruction: "Respirez naturellement. Observez le souffle entrer… et sortir. Sans forcer, sans contrôler. Juste observer." },
      { label: "Présence",      durationSec: 120, instruction: "Ramenez doucement l'attention à ce moment présent. Si l'esprit s'égare, revenez au souffle, sans jugement." },
      { label: "Retour",        durationSec: 30,  instruction: "Prenez conscience de votre corps entier. Bougez doucement les doigts. Ouvrez les yeux avec douceur." },
    ],
  },
  {
    id:          "moyen",
    label:       "Scan corporel",
    durationMin: 15,
    emoji:       "🪷",
    description: "Relaxation profonde · libération des tensions · conscience du corps",
    color:       "#86d4a6",
    soundType:   "nature",
    steps: [
      { label: "Installation",  durationSec: 60,  instruction: "Allongez-vous ou asseyez-vous. Relâchez les épaules. Laissez la mâchoire se détendre. Fermez les yeux." },
      { label: "Souffle",       durationSec: 120, instruction: "3 grandes respirations. À chaque expiration, sentez le corps s'alourdir, s'enfoncer, se relâcher." },
      { label: "Pieds & jambes",durationSec: 150, instruction: "Portez l'attention sur vos pieds. Sentez le sol sous eux. Remontez lentement vers les mollets, les genoux, les cuisses." },
      { label: "Tronc & dos",   durationSec: 150, instruction: "Observez le ventre qui se soulève et s'abaisse. Relâchez le dos, les reins, les omoplates, les épaules." },
      { label: "Tête & visage", durationSec: 150, instruction: "Détendez le cou, la nuque, le cuir chevelu. Relâchez les sourcils, les paupières, les joues, les lèvres." },
      { label: "Unité du corps",durationSec: 150, instruction: "Ressentez le corps comme un tout, de la tête aux pieds. Baignez-le d'une lumière verte apaisante." },
      { label: "Retour",        durationSec: 120, instruction: "Revenez doucement. Bougez les doigts et les orteils. Étirez-vous si besoin. Ouvrez les yeux." },
    ],
  },
  {
    id:          "long",
    label:       "Méditation profonde",
    durationMin: 30,
    emoji:       "☸️",
    description: "Pleine conscience · visualisation · transformation intérieure",
    color:       "#6dd6b5",
    soundType:   "binaural",
    steps: [
      { label: "Ancrage",       durationSec: 120, instruction: "Sentez le sol, les racines qui descendent profondément dans la terre. Vous êtes en sécurité. Vous êtes ici." },
      { label: "Purification",  durationSec: 180, instruction: "À chaque inspiration, imaginez une lumière blanche pure entrer. À chaque expiration, laissez partir tensions et soucis." },
      { label: "Souffle 4-7-8", durationSec: 240, instruction: "Inspirez 4 secondes — Retenez 7 secondes — Expirez 8 secondes. Répétez. Ce rythme active le système parasympathique." },
      { label: "Espace mental", durationSec: 300, instruction: "Imaginez un lac parfaitement calme. Votre esprit est cette surface limpide. Les pensées sont des nuages qui passent sans attacher." },
      { label: "Compassion",    durationSec: 300, instruction: "Générez un sentiment de bienveillance envers vous-même. Dites intérieurement : 'Je suis en paix. Je suis bien. Je suis heureux.'" },
      { label: "Visualisation", durationSec: 300, instruction: "Visualisez la version la plus saine et sereine de vous-même. Ressentez cet état comme déjà réel, dans chaque cellule." },
      { label: "Gratitude",     durationSec: 240, instruction: "Pensez à 3 choses pour lesquelles vous êtes reconnaissant aujourd'hui. Laissez ce sentiment se répandre dans tout le corps." },
      { label: "Intégration",   durationSec: 120, instruction: "Prenez conscience que vous emportez cet état de paix avec vous. La méditation ne se termine pas — elle se continue dans chaque action." },
    ],
  },
];

// ─── Zen Audio Engine ─────────────────────────────────────────────────────────

function createMeditationAudio(soundType: "bowl" | "nature" | "binaural") {
  const ctx  = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.6, ctx.currentTime);
  master.connect(ctx.destination);

  let nodes: AudioNode[] = [];

  function start() {
    nodes.forEach(n => { try { (n as OscillatorNode | AudioBufferSourceNode).stop?.(); } catch {} });
    nodes = [];

    if (soundType === "bowl") {
      // Tibetan bowl simulation: fundamental + harmonics with slow decay cycle
      const fundamental = 174.6; // F3
      const harmonics = [1, 2.76, 5.4, 8.93]; // Tibetan bowl ratios
      const gainNodes: GainNode[] = [];

      harmonics.forEach((ratio, i) => {
        const osc  = ctx.createOscillator();
        const g    = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(fundamental * ratio, ctx.currentTime);
        g.gain.setValueAtTime(0, ctx.currentTime);
        osc.connect(g);
        g.connect(master);
        osc.start();
        nodes.push(osc, g);
        gainNodes.push(g);

        // Pulse every 7 seconds (delayed by harmonic index)
        function ringBowl() {
          const t = ctx.currentTime;
          const vol = i === 0 ? 0.4 : 0.2 / (i + 1);
          g.gain.cancelScheduledValues(t);
          g.gain.setValueAtTime(0, t);
          g.gain.linearRampToValueAtTime(vol, t + 0.08);
          g.gain.exponentialRampToValueAtTime(0.001, t + 6);
          setTimeout(ringBowl, (7 + i * 2.3) * 1000);
        }
        setTimeout(ringBowl, i * 1200);
      });

      // Soft ambient drone
      const drone = ctx.createOscillator();
      const droneGain = ctx.createGain();
      const droneFilter = ctx.createBiquadFilter();
      drone.type = "sine";
      drone.frequency.setValueAtTime(87.3, ctx.currentTime); // B1
      droneFilter.type = "lowpass";
      droneFilter.frequency.setValueAtTime(200, ctx.currentTime);
      droneGain.gain.setValueAtTime(0.08, ctx.currentTime);
      drone.connect(droneFilter);
      droneFilter.connect(droneGain);
      droneGain.connect(master);
      drone.start();
      nodes.push(drone, droneGain, droneFilter);

    } else if (soundType === "nature") {
      // Rain + soft wind
      const bufSize = ctx.sampleRate * 2;
      const noiseBuffer = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

      function makeRainLayer(freq: number, q: number, vol: number) {
        const src = ctx.createBufferSource();
        src.buffer = noiseBuffer;
        src.loop = true;
        const filter = ctx.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.setValueAtTime(freq, ctx.currentTime);
        filter.Q.setValueAtTime(q, ctx.currentTime);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(vol, ctx.currentTime);
        src.connect(filter);
        filter.connect(gain);
        gain.connect(master);
        src.start();
        nodes.push(src, filter, gain);
      }

      makeRainLayer(800, 0.8, 0.25);  // high-freq drops
      makeRainLayer(300, 1.5, 0.15);  // mid rumble
      makeRainLayer(100, 2.0, 0.1);   // low rumble

      // Cricket/bird chirp simulation
      function makeChirp() {
        const osc = ctx.createOscillator();
        const g   = ctx.createGain();
        const freq = 2400 + Math.random() * 800;
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        g.gain.setValueAtTime(0, ctx.currentTime);
        g.gain.linearRampToValueAtTime(0.04, ctx.currentTime + 0.02);
        g.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.15);
        osc.connect(g);
        g.connect(master);
        osc.start();
        osc.stop(ctx.currentTime + 0.2);
        setTimeout(makeChirp, 3000 + Math.random() * 7000);
      }
      setTimeout(makeChirp, 2000);

    } else if (soundType === "binaural") {
      // Binaural beats: 432 Hz (left) + 436 Hz (right) = 4 Hz Theta
      const merger = ctx.createChannelMerger(2);
      merger.connect(master);

      const leftOsc  = ctx.createOscillator();
      const rightOsc = ctx.createOscillator();
      const leftSplit  = ctx.createGain();
      const rightSplit = ctx.createGain();

      leftOsc.type  = "sine";
      rightOsc.type = "sine";
      leftOsc.frequency.setValueAtTime(432, ctx.currentTime);
      rightOsc.frequency.setValueAtTime(436, ctx.currentTime);
      leftSplit.gain.setValueAtTime(0.3, ctx.currentTime);
      rightSplit.gain.setValueAtTime(0.3, ctx.currentTime);

      leftOsc.connect(leftSplit);
      rightOsc.connect(rightSplit);
      leftSplit.connect(merger, 0, 0);
      rightSplit.connect(merger, 0, 1);

      leftOsc.start();
      rightOsc.start();
      nodes.push(leftOsc, rightOsc, leftSplit, rightSplit, merger);

      // Deep drone
      const droneOsc = ctx.createOscillator();
      const droneGain = ctx.createGain();
      droneOsc.type = "sine";
      droneOsc.frequency.setValueAtTime(108, ctx.currentTime);
      droneGain.gain.setValueAtTime(0.12, ctx.currentTime);
      droneOsc.connect(droneGain);
      droneGain.connect(master);
      droneOsc.start();
      nodes.push(droneOsc, droneGain);
    }
  }

  function stop() {
    nodes.forEach(n => { try { (n as OscillatorNode | AudioBufferSourceNode).stop?.(); } catch {} });
    nodes = [];
    master.gain.setTargetAtTime(0, ctx.currentTime, 0.5);
    setTimeout(() => { try { ctx.close(); } catch {} }, 1500);
  }

  function setVolume(v: number) {
    master.gain.setTargetAtTime(v * 0.7, ctx.currentTime, 0.3);
  }

  return { start, stop, setVolume };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MeditationPlayer() {
  const [selected,     setSelected]     = useState<Program | null>(null);
  const [running,      setRunning]      = useState(false);
  const [paused,       setPaused]       = useState(false);
  const [stepIdx,      setStepIdx]      = useState(0);
  const [stepElapsed,  setStepElapsed]  = useState(0);
  const [totalElapsed, setTotalElapsed] = useState(0);
  const [soundOn,      setSoundOn]      = useState(true);
  const [completed,    setCompleted]    = useState<ProgramId[]>([]);
  const [sessions,     setSessions]     = useState<{ programId: ProgramId; date: string; completedAt: number }[]>([]);

  const audioRef   = useRef<ReturnType<typeof createMeditationAudio> | null>(null);
  const timerRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const pausedRef  = useRef(false);

  // Load sessions from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("meditation_sessions");
      if (saved) setSessions(JSON.parse(saved));
    } catch {}
  }, []);

  const saveSessions = (s: typeof sessions) => {
    setSessions(s);
    try { localStorage.setItem("meditation_sessions", JSON.stringify(s)); } catch {}
  };

  const startProgram = useCallback((program: Program) => {
    setSelected(program);
    setRunning(true);
    setPaused(false);
    setStepIdx(0);
    setStepElapsed(0);
    setTotalElapsed(0);
    pausedRef.current = false;

    if (soundOn) {
      audioRef.current?.stop();
      audioRef.current = createMeditationAudio(program.soundType);
      audioRef.current.start();
    }
  }, [soundOn]);

  const stopSession = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    audioRef.current?.stop();
    audioRef.current = null;
    setRunning(false);
    setPaused(false);
    setStepIdx(0);
    setStepElapsed(0);
  }, []);

  const togglePause = useCallback(() => {
    if (!running) return;
    pausedRef.current = !pausedRef.current;
    setPaused(p => !p);
    if (audioRef.current) {
      audioRef.current.setVolume(pausedRef.current ? 0.1 : 1);
    }
  }, [running]);

  // Timer
  useEffect(() => {
    if (!running || !selected) return;
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      if (pausedRef.current) return;

      setStepElapsed(prev => {
        const next = prev + 1;
        const currentStep = selected.steps[stepIdx];
        if (next >= currentStep.durationSec) {
          // Advance to next step
          setStepIdx(si => {
            const nextSi = si + 1;
            if (nextSi >= selected.steps.length) {
              // Session complete
              clearInterval(timerRef.current!);
              audioRef.current?.stop();
              audioRef.current = null;
              setRunning(false);
              setCompleted(c => [...new Set([...c, selected.id])]);
              const newSession = { programId: selected.id, date: format(new Date(), "yyyy-MM-dd"), completedAt: Date.now() };
              setSessions(prev => {
                const updated = [...prev, newSession];
                try { localStorage.setItem("meditation_sessions", JSON.stringify(updated)); } catch {}
                return updated;
              });
              return si;
            }
            return nextSi;
          });
          return 0;
        }
        return next;
      });

      setTotalElapsed(t => t + 1);
    }, 1000);

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, selected, stepIdx]);

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    if (audioRef.current) audioRef.current.setVolume(next ? 1 : 0);
  };

  const fmtTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  const currentStep = selected?.steps[stepIdx];
  const totalDuration = selected ? selected.steps.reduce((a, s) => a + s.durationSec, 0) : 0;
  const progressPct = totalDuration > 0 ? Math.min((totalElapsed / totalDuration) * 100, 100) : 0;

  // Weekly stats
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weekSessions = sessions.filter(s => new Date(s.completedAt) >= weekStart);
  const weekMinutes  = weekSessions.reduce((a, s) => {
    const p = PROGRAMS.find(pr => pr.id === s.programId);
    return a + (p?.durationMin ?? 0);
  }, 0);

  if (running && selected) {
    return (
      <div className="rounded-2xl overflow-hidden"
        style={{ background: "linear-gradient(160deg, rgba(16,185,129,0.06) 0%, rgba(52,211,153,0.03) 100%)", border: "1px solid rgba(52,211,153,0.2)" }}>

        {/* Progress bar top */}
        <div className="h-1 w-full" style={{ background: "rgba(52,211,153,0.1)" }}>
          <motion.div className="h-full rounded-full" animate={{ width: `${progressPct}%` }}
            transition={{ duration: 1, ease: "linear" }}
            style={{ background: "linear-gradient(90deg, #34d399, #6ee7b7)" }} />
        </div>

        <div className="p-5">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-[24px]">{selected.emoji}</span>
              <div>
                <p className="text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>{selected.label}</p>
                <p className="text-[11px]" style={{ color: "#34d399" }}>{fmtTime(totalElapsed)} / {fmtTime(totalDuration)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={toggleSound}
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: "rgba(52,211,153,0.1)" }}>
                {soundOn ? <SpeakerHigh size={14} style={{ color: "#34d399" }} /> : <SpeakerSlash size={14} style={{ color: "var(--text-muted)" }} />}
              </button>
              <button onClick={togglePause}
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: "rgba(52,211,153,0.12)" }}>
                {paused ? <Play size={14} style={{ color: "#34d399" }} /> : <Pause size={14} style={{ color: "#34d399" }} />}
              </button>
              <button onClick={stopSession}
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: "rgba(239,68,68,0.1)" }}>
                <Stop size={14} style={{ color: "#f87171" }} />
              </button>
            </div>
          </div>

          {/* Step name */}
          <div className="flex items-center gap-2 mb-3">
            {selected.steps.map((s, i) => (
              <motion.div key={i}
                className="flex-1 h-1 rounded-full"
                animate={{ background: i < stepIdx ? "#34d399" : i === stepIdx ? selected.color : "rgba(255,255,255,0.08)" }}
                transition={{ duration: 0.5 }}
              />
            ))}
          </div>

          {/* Current step */}
          <AnimatePresence mode="wait">
            <motion.div key={stepIdx}
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.5 }}
              className="px-4 py-4 rounded-2xl mb-4"
              style={{ background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.15)" }}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: "#34d399" }}>
                  {currentStep?.label}
                </p>
                <span className="text-[11px] tabular-nums" style={{ color: "var(--text-muted)" }}>
                  {fmtTime(Math.max(0, (currentStep?.durationSec ?? 0) - stepElapsed))}
                </span>
              </div>
              <p className="text-[13px] leading-relaxed italic" style={{ color: "var(--text-secondary)" }}>
                {currentStep?.instruction}
              </p>
            </motion.div>
          </AnimatePresence>

          {/* Breathing animation */}
          <div className="flex justify-center">
            <motion.div
              className="rounded-full"
              style={{ width: 64, height: 64, background: `radial-gradient(circle, ${selected.color}30 0%, ${selected.color}10 60%, transparent 100%)`, border: `1px solid ${selected.color}40` }}
              animate={{ scale: paused ? 1 : [1, 1.25, 1], opacity: paused ? 0.3 : [0.6, 1, 0.6] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            />
          </div>

          {paused && (
            <p className="text-center text-[11px] mt-3" style={{ color: "var(--text-muted)" }}>En pause · appuyez ▶ pour reprendre</p>
          )}
        </div>
      </div>
    );
  }

  // Completed state
  if (completed.includes(selected?.id ?? "" as ProgramId) && !running) {
    const prog = selected!;
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="p-6 rounded-2xl text-center"
        style={{ background: "linear-gradient(135deg, rgba(52,211,153,0.08) 0%, rgba(16,185,129,0.05) 100%)", border: "1px solid rgba(52,211,153,0.25)" }}>
        <div className="text-[40px] mb-2">{prog.emoji}</div>
        <div className="flex justify-center mb-3">
          <CheckCircle size={32} weight="fill" style={{ color: "#34d399" }} />
        </div>
        <p className="text-[16px] font-semibold mb-1" style={{ color: "#34d399" }}>Séance complète ✨</p>
        <p className="text-[13px] mb-1" style={{ color: "var(--text-secondary)" }}>{prog.label} · {prog.durationMin} min</p>
        <p className="text-[11px] mb-4" style={{ color: "var(--text-muted)" }}>
          Prenez un moment pour ressentir les bénéfices de cette pratique.
        </p>
        <button onClick={() => { setSelected(null); setCompleted([]); }}
          className="flex items-center gap-2 mx-auto px-4 py-2 rounded-xl text-[13px]"
          style={{ background: "rgba(52,211,153,0.12)", color: "#34d399", border: "1px solid rgba(52,211,153,0.3)" }}>
          <ArrowLeft size={13} /> Retour aux programmes
        </button>
      </motion.div>
    );
  }

  // ── Program selection ──
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[18px]">☸️</span>
        <div>
          <p className="text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>Méditation guidée</p>
          <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>3 programmes · sons zen libres de droit</p>
        </div>
      </div>

      {/* Weekly stats */}
      {weekSessions.length > 0 && (
        <div className="flex gap-3">
          <div className="flex-1 px-3 py-2.5 rounded-xl"
            style={{ background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.15)" }}>
            <p className="text-[20px] font-bold" style={{ color: "#34d399" }}>{weekSessions.length}</p>
            <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>séances cette semaine</p>
          </div>
          <div className="flex-1 px-3 py-2.5 rounded-xl"
            style={{ background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.15)" }}>
            <p className="text-[20px] font-bold" style={{ color: "#34d399" }}>{weekMinutes} min</p>
            <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>de pratique cette semaine</p>
          </div>
          <div className="flex-1 px-3 py-2.5 rounded-xl"
            style={{ background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.15)" }}>
            <p className="text-[20px] font-bold" style={{ color: "#34d399" }}>{sessions.length}</p>
            <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>séances au total</p>
          </div>
        </div>
      )}

      {/* Programs */}
      {PROGRAMS.map((program) => {
        const doneSessions = sessions.filter(s => s.programId === program.id).length;
        const lastDate = sessions.filter(s => s.programId === program.id).sort((a,b) => b.completedAt - a.completedAt)[0]?.date;
        return (
          <motion.div key={program.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl overflow-hidden"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)" }}
          >
            {/* Color bar */}
            <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${program.color}60, ${program.color}20)` }} />

            <div className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-[26px]"
                    style={{ background: `${program.color}15`, border: `1px solid ${program.color}30` }}>
                    {program.emoji}
                  </div>
                  <div>
                    <p className="text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>{program.label}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] font-medium px-1.5 py-0.5 rounded-md"
                        style={{ background: `${program.color}15`, color: program.color }}>
                        {program.durationMin} min
                      </span>
                      {program.soundType === "bowl"     && <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>🔔 Bols tibétains</span>}
                      {program.soundType === "nature"   && <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>🌧 Pluie & nature</span>}
                      {program.soundType === "binaural" && <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>🎵 Binaural 4Hz</span>}
                    </div>
                  </div>
                </div>
                {doneSessions > 0 && (
                  <div className="flex flex-col items-end">
                    <span className="text-[16px] font-bold" style={{ color: program.color }}>{doneSessions}×</span>
                    <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>complétées</span>
                  </div>
                )}
              </div>

              <p className="text-[12px] mb-3 leading-relaxed" style={{ color: "var(--text-muted)" }}>
                {program.description}
              </p>

              {/* Steps preview */}
              <div className="flex gap-1 mb-3">
                {program.steps.map((s, i) => (
                  <div key={i} className="flex-1 px-1.5 py-1 rounded-lg text-center"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)" }}>
                    <p className="text-[8px] leading-tight truncate" style={{ color: "var(--text-muted)" }}>{s.label}</p>
                    <p className="text-[7px]" style={{ color: `${program.color}80` }}>
                      {s.durationSec >= 60 ? `${s.durationSec / 60}m` : `${s.durationSec}s`}
                    </p>
                  </div>
                ))}
              </div>

              {lastDate && (
                <p className="text-[10px] mb-2" style={{ color: "var(--text-muted)" }}>
                  Dernière séance : {format(new Date(lastDate + "T00:00:00"), "d MMMM", { locale: fr })}
                </p>
              )}

              <button
                onClick={() => startProgram(program)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-semibold transition-all"
                style={{
                  background: `linear-gradient(135deg, ${program.color}25, ${program.color}15)`,
                  border: `1px solid ${program.color}40`,
                  color: program.color,
                }}
              >
                <Play size={14} weight="fill" />
                Commencer · {program.durationMin} min
              </button>
            </div>
          </motion.div>
        );
      })}

      <p className="text-[10px] text-center" style={{ color: "var(--text-muted)" }}>
        💚 Sons générés en temps réel par synthèse audio · Aucun fichier externe requis
      </p>
    </div>
  );
}
