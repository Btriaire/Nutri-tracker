"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  IconPlayerPlay, IconPlayerPause, IconPlayerStop, IconCircleCheck,
  IconChevronLeft, IconVolume, IconHeadphones,
} from "@tabler/icons-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

// ─── Types ───────────────────────────────────────────────────────────────────

type ProgramId = "court" | "moyen" | "long";
type SoundId   = "ocean" | "rain" | "bowl" | "hz528" | "theta" | "alpha";

// ─── Ambient sound catalogue ──────────────────────────────────────────────────

interface AmbientSound {
  id:       SoundId;
  label:    string;
  emoji:    string;
  desc:     string;
  color:    string;
  bg:       string;
  headphones?: boolean; // binaural → needs headphones for effect
}

const SOUNDS: AmbientSound[] = [
  {
    id: "ocean",  label: "Vagues",         emoji: "🌊",
    desc: "Océan profond · bruit brun",
    color: "#38bdf8",
    bg: "linear-gradient(135deg, rgba(14,165,233,0.28) 0%, rgba(6,182,212,0.10) 100%)",
  },
  {
    id: "rain",   label: "Pluie douce",    emoji: "🌧",
    desc: "Bruine apaisante · bruit rose",
    color: "#94a3b8",
    bg: "linear-gradient(135deg, rgba(148,163,184,0.22) 0%, rgba(100,116,139,0.08) 100%)",
  },
  {
    id: "bowl",   label: "Bols tibétains", emoji: "🔔",
    desc: "432 Hz · harmoniques · pulsation",
    color: "#fbbf24",
    bg: "linear-gradient(135deg, rgba(251,191,36,0.22) 0%, rgba(245,158,11,0.07) 100%)",
  },
  {
    id: "hz528",  label: "528 Hz",         emoji: "✨",
    desc: "Fréquence de guérison · clarté",
    color: "#c084fc",
    bg: "linear-gradient(135deg, rgba(192,132,252,0.24) 0%, rgba(139,92,246,0.08) 100%)",
  },
  {
    id: "theta",  label: "Thêta 4 Hz",     emoji: "🧠",
    desc: "Ondes binaurales · créativité · rêve",
    color: "#818cf8",
    bg: "linear-gradient(135deg, rgba(129,140,248,0.26) 0%, rgba(99,102,241,0.08) 100%)",
    headphones: true,
  },
  {
    id: "alpha",  label: "Alpha 10 Hz",    emoji: "🌸",
    desc: "Ondes binaurales · relaxation · flow",
    color: "#f472b6",
    bg: "linear-gradient(135deg, rgba(244,114,182,0.24) 0%, rgba(236,72,153,0.08) 100%)",
    headphones: true,
  },
];

// Default sound per program
const PROGRAM_SOUND: Record<ProgramId, SoundId> = {
  court: "bowl",
  moyen: "rain",
  long:  "theta",
};

// ─── Web Audio Engine ──────────────────────────────────────────────────────────

interface AudioEngine {
  stop:   () => void;
  setVol: (v: number) => void;
}

// Brown noise (warm, low-frequency — ocean waves)
function buildBrownNoise(ctx: AudioContext): AudioBufferSourceNode {
  const sr  = ctx.sampleRate;
  const len = sr * 5;
  const buf = ctx.createBuffer(2, len, sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      d[i] = (last + 0.02 * w) / 1.02;
      last = d[i];
      d[i] *= 3.5;
    }
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  return src;
}

// Pink noise (soft, balanced — rain)
function buildPinkNoise(ctx: AudioContext): AudioBufferSourceNode {
  const sr  = ctx.sampleRate;
  const len = sr * 5;
  const buf = ctx.createBuffer(2, len, sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let b0=0, b1=0, b2=0, b3=0, b4=0, b5=0, b6=0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886*b0 + w*0.0555179; b1 = 0.99332*b1 + w*0.0750759;
      b2 = 0.96900*b2 + w*0.1538520; b3 = 0.86650*b3 + w*0.3104856;
      b4 = 0.55000*b4 + w*0.5329522; b5 = -0.7616*b5 - w*0.0168980;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    }
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  return src;
}

function startAudioEngine(soundId: SoundId, initialVol = 0.7): AudioEngine | null {
  try {
    type AudioCtxConstructor = typeof AudioContext;
    const Ctor = (window.AudioContext ??
      (window as unknown as { webkitAudioContext: AudioCtxConstructor }).webkitAudioContext) as AudioCtxConstructor | undefined;
    if (!Ctor) return null;

    const ctx    = new Ctor();
    const master = ctx.createGain();
    master.gain.setValueAtTime(0, ctx.currentTime);
    master.gain.linearRampToValueAtTime(initialVol * 0.8, ctx.currentTime + 2.5);
    master.connect(ctx.destination);

    const stopList: (() => void)[] = [];

    const addOsc = (freq: number, type: OscillatorType, gainVal: number, dest: AudioNode) => {
      const osc = ctx.createOscillator();
      const g   = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      g.gain.value = gainVal;
      osc.connect(g);
      g.connect(dest);
      osc.start();
      stopList.push(() => { try { osc.stop(); } catch { /* already stopped */ } });
    };

    // ── Ocean ──────────────────────────────────────────────────────────────
    if (soundId === "ocean") {
      const noise  = buildBrownNoise(ctx);
      const lpf    = ctx.createBiquadFilter();
      lpf.type     = "lowpass";
      lpf.frequency.value = 320;
      lpf.Q.value  = 0.8;
      // Slow "swell" LFO
      const lfo    = ctx.createOscillator();
      const lfoG   = ctx.createGain();
      lfo.frequency.value = 0.07;
      lfoG.gain.value = 0.18;
      lfo.connect(lfoG);
      lfoG.connect(master.gain);
      noise.connect(lpf);
      lpf.connect(master);
      noise.start();
      lfo.start();
      stopList.push(() => { try { noise.stop(); } catch { /* ok */ } try { lfo.stop(); } catch { /* ok */ } });
    }

    // ── Rain ───────────────────────────────────────────────────────────────
    if (soundId === "rain") {
      const noise = buildPinkNoise(ctx);
      const bpf   = ctx.createBiquadFilter();
      bpf.type    = "bandpass";
      bpf.frequency.value = 1200;
      bpf.Q.value = 0.5;
      const lpf   = ctx.createBiquadFilter();
      lpf.type    = "lowpass";
      lpf.frequency.value = 3500;
      noise.connect(lpf);
      lpf.connect(bpf);
      bpf.connect(master);
      noise.start();
      stopList.push(() => { try { noise.stop(); } catch { /* ok */ } });
    }

    // ── Tibetan bowls ──────────────────────────────────────────────────────
    if (soundId === "bowl") {
      // Slow-swelling LFO for the singing bowl effect
      const lfo  = ctx.createOscillator();
      const lfoG = ctx.createGain();
      lfo.frequency.value = 0.12;
      lfoG.gain.value = 0.15;
      lfo.connect(lfoG);
      lfo.start();
      stopList.push(() => { try { lfo.stop(); } catch { /* ok */ } });

      const harmonics: [number, number][] = [
        [432, 0.38], [864, 0.14], [1296, 0.06], [1728, 0.03],
      ];
      harmonics.forEach(([freq, vol]) => {
        const osc = ctx.createOscillator();
        const g   = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        g.gain.value = vol;
        lfoG.connect(g.gain);
        osc.connect(g);
        g.connect(master);
        osc.start();
        stopList.push(() => { try { osc.stop(); } catch { /* ok */ } });
      });
    }

    // ── 528 Hz ────────────────────────────────────────────────────────────
    if (soundId === "hz528") {
      const lfo  = ctx.createOscillator();
      const lfoG = ctx.createGain();
      lfo.frequency.value = 0.06;
      lfoG.gain.value = 0.06;
      lfo.connect(lfoG);
      lfo.start();
      stopList.push(() => { try { lfo.stop(); } catch { /* ok */ } });

      [[528, 0.32], [1056, 0.10], [1584, 0.04]].forEach(([f, v]) => {
        const osc = ctx.createOscillator();
        const g   = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = f;
        g.gain.value = v;
        lfoG.connect(g.gain);
        osc.connect(g);
        g.connect(master);
        osc.start();
        stopList.push(() => { try { osc.stop(); } catch { /* ok */ } });
      });
    }

    // ── Binaural (theta 4 Hz / alpha 10 Hz) ────────────────────────────────
    if (soundId === "theta" || soundId === "alpha") {
      const beatHz = soundId === "theta" ? 4 : 10;

      // Noise bed (soft)
      const noise  = buildPinkNoise(ctx);
      const noiseG = ctx.createGain();
      noiseG.gain.value = 0.06;
      const lpf    = ctx.createBiquadFilter();
      lpf.type     = "lowpass";
      lpf.frequency.value = 500;
      noise.connect(lpf);
      lpf.connect(noiseG);
      noiseG.connect(master);
      noise.start();
      stopList.push(() => { try { noise.stop(); } catch { /* ok */ } });

      // Binaural tones — strict stereo separation
      const leftPan  = ctx.createStereoPanner();
      const rightPan = ctx.createStereoPanner();
      leftPan.pan.value  = -1;
      rightPan.pan.value =  1;

      const binGain = ctx.createGain();
      binGain.gain.value = 0.22;

      addOsc(432,          "sine", 1.0, leftPan);
      addOsc(432 + beatHz, "sine", 1.0, rightPan);
      leftPan.connect(binGain);
      rightPan.connect(binGain);
      binGain.connect(ctx.destination); // direct bypass — stereo must not fold into master mono
    }

    return {
      stop: () => {
        master.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.8);
        setTimeout(() => {
          stopList.forEach(fn => fn());
          ctx.close().catch(() => {});
        }, 2000);
      },
      setVol: (v: number) => {
        master.gain.setTargetAtTime(v * 0.8, ctx.currentTime, 0.15);
      },
    };
  } catch { return null; }
}

// ─── Programs ─────────────────────────────────────────────────────────────────

interface Program {
  id:          ProgramId;
  label:       string;
  durationMin: number;
  emoji:       string;
  description: string;
  color:       string;
  steps:       { label: string; durationSec: number; instruction: string }[];
}

const PROGRAMS: Program[] = [
  {
    id: "court", label: "Pleine présence", durationMin: 5, emoji: "🌸",
    description: "Ancrage rapide · respiration · calme l'esprit en 5 minutes",
    color: "#a3e4a3",
    steps: [
      { label: "Arrivée",     durationSec: 30,  instruction: "Installez-vous confortablement. Fermez doucement les yeux. Sentez le contact de votre corps avec le sol ou votre siège." },
      { label: "Respiration", durationSec: 120, instruction: "Respirez naturellement. Observez le souffle entrer… et sortir. Sans forcer, sans contrôler. Juste observer." },
      { label: "Présence",    durationSec: 120, instruction: "Ramenez doucement l'attention à ce moment présent. Si l'esprit s'égare, revenez au souffle, sans jugement." },
      { label: "Retour",      durationSec: 30,  instruction: "Prenez conscience de votre corps entier. Bougez doucement les doigts. Ouvrez les yeux avec douceur." },
    ],
  },
  {
    id: "moyen", label: "Scan corporel", durationMin: 15, emoji: "🪷",
    description: "Relaxation profonde · libération des tensions · conscience du corps",
    color: "#86d4a6",
    steps: [
      { label: "Installation",   durationSec: 60,  instruction: "Allongez-vous ou asseyez-vous. Relâchez les épaules. Laissez la mâchoire se détendre. Fermez les yeux." },
      { label: "Souffle",        durationSec: 120, instruction: "3 grandes respirations. À chaque expiration, sentez le corps s'alourdir, s'enfoncer, se relâcher." },
      { label: "Pieds & jambes", durationSec: 150, instruction: "Portez l'attention sur vos pieds. Sentez le sol sous eux. Remontez lentement vers les mollets, les genoux, les cuisses." },
      { label: "Tronc & dos",    durationSec: 150, instruction: "Observez le ventre qui se soulève et s'abaisse. Relâchez le dos, les reins, les omoplates, les épaules." },
      { label: "Tête & visage",  durationSec: 150, instruction: "Détendez le cou, la nuque, le cuir chevelu. Relâchez les sourcils, les paupières, les joues, les lèvres." },
      { label: "Unité",          durationSec: 150, instruction: "Ressentez le corps comme un tout, de la tête aux pieds. Baignez-le d'une lumière verte apaisante." },
      { label: "Retour",         durationSec: 120, instruction: "Revenez doucement. Bougez les doigts et les orteils. Étirez-vous si besoin. Ouvrez les yeux." },
    ],
  },
  {
    id: "long", label: "Méditation profonde", durationMin: 30, emoji: "☸️",
    description: "Pleine conscience · visualisation · transformation intérieure",
    color: "#6dd6b5",
    steps: [
      { label: "Ancrage",       durationSec: 120, instruction: "Sentez le sol, les racines qui descendent profondément dans la terre. Vous êtes en sécurité. Vous êtes ici." },
      { label: "Purification",  durationSec: 180, instruction: "À chaque inspiration, imaginez une lumière blanche pure entrer. À chaque expiration, laissez partir tensions et soucis." },
      { label: "Souffle 4-7-8", durationSec: 240, instruction: "Inspirez 4 secondes — Retenez 7 secondes — Expirez 8 secondes. Ce rythme active le système parasympathique." },
      { label: "Espace mental", durationSec: 300, instruction: "Imaginez un lac parfaitement calme. Votre esprit est cette surface limpide. Les pensées sont des nuages qui passent." },
      { label: "Compassion",    durationSec: 300, instruction: "Générez un sentiment de bienveillance. Dites intérieurement : « Je suis en paix. Je suis bien. Je suis heureux. »" },
      { label: "Visualisation", durationSec: 300, instruction: "Visualisez la version la plus saine de vous-même. Ressentez cet état comme déjà réel, dans chaque cellule." },
      { label: "Gratitude",     durationSec: 240, instruction: "Pensez à 3 choses pour lesquelles vous êtes reconnaissant. Laissez ce sentiment se répandre dans tout le corps." },
      { label: "Intégration",   durationSec: 120, instruction: "Prenez conscience que vous emportez cet état de paix avec vous. La paix continue dans chaque action." },
    ],
  },
];

// ─── SoundGrid ────────────────────────────────────────────────────────────────

function SoundGrid({
  selected, onChange, compact = false,
}: {
  selected: SoundId;
  onChange: (s: SoundId) => void;
  compact?: boolean;
}) {
  return (
    <div className={`grid grid-cols-3 ${compact ? "gap-1.5" : "gap-2"}`}>
      {SOUNDS.map((s) => {
        const active = s.id === selected;
        return (
          <motion.button
            key={s.id}
            type="button"
            onClick={() => onChange(s.id)}
            whileTap={{ scale: 0.95 }}
            className={`flex flex-col items-center ${compact ? "gap-1 py-2 px-1" : "gap-1.5 py-3 px-2"} rounded-2xl relative overflow-hidden transition-all`}
            style={{
              background: active ? s.bg : "rgba(255,255,255,0.03)",
              border: `1px solid ${active ? s.color + "55" : "rgba(255,255,255,0.07)"}`,
              boxShadow: active ? `0 0 18px ${s.color}22` : "none",
            }}
          >
            {/* Glow ring when active */}
            {active && (
              <motion.div
                className="absolute inset-0 rounded-2xl pointer-events-none"
                animate={{ opacity: [0.4, 0.8, 0.4] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                style={{ border: `1px solid ${s.color}70`, borderRadius: "inherit" }}
              />
            )}
            <span style={{ fontSize: compact ? 22 : 28, lineHeight: 1 }}>{s.emoji}</span>
            <p className={`font-semibold leading-tight text-center ${compact ? "text-[9px]" : "text-[11px]"}`}
              style={{ color: active ? s.color : "var(--text-secondary)" }}>
              {s.label}
            </p>
            {!compact && (
              <p className="text-[8px] text-center leading-tight"
                style={{ color: "var(--text-muted)" }}>
                {s.desc}
              </p>
            )}
            {s.headphones && (
              <div className="absolute top-1.5 right-1.5">
                <IconHeadphones size={9} style={{ color: active ? s.color : "var(--text-muted)", opacity: 0.7 }} />
              </div>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}

// ─── AmbientPlayer (in-session) ───────────────────────────────────────────────

function AmbientPlayer({
  soundId, active, onChange,
}: {
  soundId:  SoundId;
  active:   boolean;
  onChange: (s: SoundId) => void;
}) {
  const engineRef = useRef<AudioEngine | null>(null);
  const [vol,     setVol]     = useState(0.75);
  const [started, setStarted] = useState(false);
  const sound = SOUNDS.find(s => s.id === soundId)!;

  // Start engine on mount / soundId change
  useEffect(() => {
    if (!active) return;
    engineRef.current?.stop();
    engineRef.current = null;
    setStarted(false);
    // Small delay so the page is ready / user gesture happened
    const t = setTimeout(() => {
      const eng = startAudioEngine(soundId, vol);
      if (eng) { engineRef.current = eng; setStarted(true); }
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soundId, active]);

  // Stop on deactivate
  useEffect(() => {
    if (!active) { engineRef.current?.stop(); engineRef.current = null; setStarted(false); }
  }, [active]);

  // Cleanup on unmount
  useEffect(() => () => { engineRef.current?.stop(); }, []);

  const handleVol = (v: number) => {
    setVol(v);
    engineRef.current?.setVol(v);
  };

  const handleChange = (s: SoundId) => {
    onChange(s);
  };

  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ background: `linear-gradient(160deg, ${sound.bg})`, border: `1px solid ${sound.color}30` }}>

      {/* Ambient visual */}
      <div style={{ position: "relative", height: 120 }}
        className="flex items-center justify-center overflow-hidden">
        {/* Background mandala */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: `repeating-radial-gradient(circle at 50% 50%, transparent 24px, ${sound.color}08 25px, transparent 26px)`,
        }} />
        {/* Outer aura */}
        <motion.div
          animate={{ scale: [1, 1.18, 1], opacity: [0.12, 0.28, 0.12] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          style={{
            position: "absolute",
            width: 88, height: 88, borderRadius: "50%",
            background: `radial-gradient(circle, ${sound.color}40 0%, transparent 70%)`,
          }}
        />
        {/* Inner orb */}
        <motion.div
          animate={{ scale: started ? [1, 1.08, 1] : 1, opacity: started ? 1 : 0.4 }}
          transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
          style={{
            width: 56, height: 56, borderRadius: "50%",
            background: `radial-gradient(circle, ${sound.color}50 0%, ${sound.color}15 60%, transparent 100%)`,
            border: `1px solid ${sound.color}50`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 26, position: "relative", zIndex: 2,
          }}
        >
          {sound.emoji}
        </motion.div>
        {/* Status */}
        <div className="absolute bottom-2 left-0 right-0 flex justify-center">
          <p className="text-[9px] tracking-widest uppercase"
            style={{ color: started ? sound.color : "var(--text-muted)", opacity: 0.8 }}>
            {started ? "♪ en cours" : "…démarrage"}
          </p>
        </div>
      </div>

      {/* Volume */}
      <div className="flex items-center gap-3 px-4 py-2">
        <IconVolume size={13} style={{ color: sound.color, flexShrink: 0 }} />
        <input
          type="range" min={0} max={1} step={0.02} value={vol}
          onChange={(e) => handleVol(parseFloat(e.target.value))}
          className="flex-1 h-1 rounded-full appearance-none"
          style={{ accentColor: sound.color }}
        />
        <span className="text-[10px] tabular-nums w-7 text-right"
          style={{ color: "var(--text-muted)" }}>
          {Math.round(vol * 100)}
        </span>
      </div>

      {/* Sound grid — compact */}
      <div className="px-3 pb-3">
        <SoundGrid selected={soundId} onChange={handleChange} compact />
        {SOUNDS.find(s => s.id === soundId)?.headphones && (
          <p className="text-[9px] text-center mt-2 flex items-center justify-center gap-1"
            style={{ color: "var(--text-muted)" }}>
            <IconHeadphones size={9} /> Ondes binaurales · casque recommandé pour l'effet complet
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MeditationPlayer() {
  const [selected,     setSelected]     = useState<Program | null>(null);
  const [running,      setRunning]      = useState(false);
  const [paused,       setPaused]       = useState(false);
  const [stepIdx,      setStepIdx]      = useState(0);
  const [stepElapsed,  setStepElapsed]  = useState(0);
  const [totalElapsed, setTotalElapsed] = useState(0);
  const [completed,    setCompleted]    = useState<ProgramId[]>([]);
  const [sessions,     setSessions]     = useState<{ programId: ProgramId; date: string; completedAt: number }[]>([]);
  const [currentSound, setCurrentSound] = useState<SoundId>("bowl");

  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const pausedRef = useRef(false);

  // Load sessions from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("meditation_sessions");
      if (saved) setSessions(JSON.parse(saved));
    } catch { /* ignore */ }
  }, []);

  const startProgram = useCallback((program: Program) => {
    setSelected(program);
    setCurrentSound(PROGRAM_SOUND[program.id]);
    setRunning(true);
    setPaused(false);
    setStepIdx(0);
    setStepElapsed(0);
    setTotalElapsed(0);
    pausedRef.current = false;
  }, []);

  const stopSession = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setRunning(false);
    setPaused(false);
    setStepIdx(0);
    setStepElapsed(0);
  }, []);

  const togglePause = useCallback(() => {
    if (!running) return;
    pausedRef.current = !pausedRef.current;
    setPaused(p => !p);
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
          setStepIdx(si => {
            const nextSi = si + 1;
            if (nextSi >= selected.steps.length) {
              clearInterval(timerRef.current!);
              setRunning(false);
              setCompleted(c => [...new Set([...c, selected.id])]);
              const newSess = { programId: selected.id, date: format(new Date(), "yyyy-MM-dd"), completedAt: Date.now() };
              setSessions(prev => {
                const updated = [...prev, newSess];
                try { localStorage.setItem("meditation_sessions", JSON.stringify(updated)); } catch { /* ok */ }
                return updated;
              });
              fetch("/api/meditation", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  programId:    selected.id,
                  programLabel: selected.label,
                  durationMin:  selected.durationMin,
                }),
              }).catch(() => {});
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

  const fmtTime = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  const currentStep   = selected?.steps[stepIdx];
  const totalDuration = selected ? selected.steps.reduce((a, s) => a + s.durationSec, 0) : 0;
  const progressPct   = totalDuration > 0 ? Math.min((totalElapsed / totalDuration) * 100, 100) : 0;

  // Weekly stats
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weekSessions = sessions.filter(s => new Date(s.completedAt) >= weekStart);
  const weekMinutes  = weekSessions.reduce((a, s) => {
    const p = PROGRAMS.find(pr => pr.id === s.programId);
    return a + (p?.durationMin ?? 0);
  }, 0);

  // ── Running state ──────────────────────────────────────────────────────────

  if (running && selected) {
    const sound = SOUNDS.find(s => s.id === currentSound)!;
    return (
      <div className="rounded-2xl overflow-hidden"
        style={{
          background: `linear-gradient(160deg, ${sound.color}08 0%, rgba(13,13,17,0.6) 100%)`,
          border: `1px solid ${sound.color}22`,
        }}>

        {/* Progress bar */}
        <div className="h-1 w-full" style={{ background: `${sound.color}15` }}>
          <motion.div className="h-full rounded-full" animate={{ width: `${progressPct}%` }}
            transition={{ duration: 1, ease: "linear" }}
            style={{ background: `linear-gradient(90deg, ${sound.color}, ${sound.color}aa)` }} />
        </div>

        <div className="p-4 space-y-3">
          {/* Header controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[24px]">{selected.emoji}</span>
              <div>
                <p className="text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>{selected.label}</p>
                <p className="text-[11px]" style={{ color: sound.color }}>{fmtTime(totalElapsed)} / {fmtTime(totalDuration)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={togglePause}
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: `${sound.color}18` }}>
                {paused
                  ? <IconPlayerPlay  size={14} stroke={1.5} style={{ color: sound.color }} />
                  : <IconPlayerPause size={14} stroke={1.5} style={{ color: sound.color }} />}
              </button>
              <button onClick={stopSession}
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: "rgba(239,68,68,0.1)" }}>
                <IconPlayerStop size={14} stroke={1.5} style={{ color: "#f87171" }} />
              </button>
            </div>
          </div>

          {/* Step dots */}
          <div className="flex items-center gap-1">
            {selected.steps.map((_, i) => (
              <motion.div key={i} className="flex-1 h-1 rounded-full"
                animate={{ background: i < stepIdx ? sound.color : i === stepIdx ? sound.color + "bb" : "rgba(255,255,255,0.08)" }}
                transition={{ duration: 0.5 }}
              />
            ))}
          </div>

          {/* Current step card */}
          <AnimatePresence mode="wait">
            <motion.div key={stepIdx}
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.5 }}
              className="px-4 py-4 rounded-2xl"
              style={{ background: `${sound.color}0a`, border: `1px solid ${sound.color}22` }}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: sound.color }}>
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

          {/* Breathing orb */}
          <div className="flex justify-center py-1">
            <motion.div className="rounded-full"
              style={{
                width: 56, height: 56,
                background: `radial-gradient(circle, ${sound.color}35 0%, ${sound.color}10 60%, transparent 100%)`,
                border: `1px solid ${sound.color}40`,
              }}
              animate={{ scale: paused ? 1 : [1, 1.28, 1], opacity: paused ? 0.3 : [0.5, 1, 0.5] }}
              transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
            />
          </div>

          {paused && (
            <p className="text-center text-[11px]" style={{ color: "var(--text-muted)" }}>
              En pause · appuyez ▶ pour reprendre
            </p>
          )}

          {/* Ambient player */}
          <AmbientPlayer soundId={currentSound} active={running} onChange={setCurrentSound} />
        </div>
      </div>
    );
  }

  // ── Completed ──────────────────────────────────────────────────────────────

  if (completed.includes(selected?.id ?? "" as ProgramId) && !running) {
    const prog  = selected!;
    const sound = SOUNDS.find(s => s.id === PROGRAM_SOUND[prog.id])!;
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="p-6 rounded-2xl text-center"
        style={{ background: `linear-gradient(135deg, ${sound.color}10 0%, rgba(13,13,17,0.6) 100%)`, border: `1px solid ${sound.color}30` }}>
        <div className="text-[40px] mb-2">{prog.emoji}</div>
        <div className="flex justify-center mb-3">
          <IconCircleCheck size={32} stroke={1.5} style={{ color: sound.color }} />
        </div>
        <p className="text-[16px] font-semibold mb-1" style={{ color: sound.color }}>Séance complète ✨</p>
        <p className="text-[13px] mb-1" style={{ color: "var(--text-secondary)" }}>{prog.label} · {prog.durationMin} min</p>
        <p className="text-[11px] mb-4" style={{ color: "var(--text-muted)" }}>
          Prenez un moment pour ressentir les bénéfices de cette pratique.
        </p>
        <button onClick={() => { setSelected(null); setCompleted([]); }}
          className="flex items-center gap-2 mx-auto px-4 py-2 rounded-xl text-[13px]"
          style={{ background: `${sound.color}18`, color: sound.color, border: `1px solid ${sound.color}40` }}>
          <IconChevronLeft size={13} stroke={2} /> Retour aux programmes
        </button>
      </motion.div>
    );
  }

  // ── Program selection ──────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[18px]">☸️</span>
          <p className="text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>Méditation guidée</p>
        </div>
        <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
          Sons générés localement · aucune connexion requise
        </p>
      </div>

      {/* Weekly stats */}
      {weekSessions.length > 0 && (
        <div className="flex gap-3">
          {[
            { v: weekSessions.length, l: "séances cette semaine" },
            { v: `${weekMinutes} min`, l: "de pratique" },
            { v: sessions.length, l: "au total" },
          ].map(({ v, l }) => (
            <div key={l} className="flex-1 px-3 py-2.5 rounded-xl"
              style={{ background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.15)" }}>
              <p className="text-[18px] font-bold leading-tight" style={{ color: "#34d399" }}>{v}</p>
              <p className="text-[9px] mt-0.5" style={{ color: "var(--text-muted)" }}>{l}</p>
            </div>
          ))}
        </div>
      )}

      {/* Programs */}
      {PROGRAMS.map((program) => {
        const doneSessions = sessions.filter(s => s.programId === program.id).length;
        const lastDate     = sessions
          .filter(s => s.programId === program.id)
          .sort((a, b) => b.completedAt - a.completedAt)[0]?.date;
        const defSound = SOUNDS.find(s => s.id === PROGRAM_SOUND[program.id])!;

        return (
          <motion.div key={program.id}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl overflow-hidden"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)" }}
          >
            <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${program.color}60, ${program.color}15)` }} />
            <div className="p-4">
              {/* Top row */}
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
                      <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                        {defSound.emoji} {defSound.label}
                      </span>
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

              <p className="text-[12px] mb-4 leading-relaxed" style={{ color: "var(--text-muted)" }}>
                {program.description}
              </p>

              {/* Steps preview */}
              <div className="flex gap-1 mb-4">
                {program.steps.map((s, i) => (
                  <div key={i} className="flex-1 px-1.5 py-1 rounded-lg text-center"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)" }}>
                    <p className="text-[8px] leading-tight truncate" style={{ color: "var(--text-muted)" }}>{s.label}</p>
                    <p className="text-[7px]" style={{ color: `${program.color}80` }}>
                      {s.durationSec >= 60 ? `${Math.round(s.durationSec / 60)}m` : `${s.durationSec}s`}
                    </p>
                  </div>
                ))}
              </div>

              {/* ── Atmosphere picker ─────────────────────────────────────── */}
              <p className="text-[9px] uppercase tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>
                Choisir l'atmosphère
              </p>
              <SoundGrid
                selected={currentSound}
                onChange={setCurrentSound}
              />

              {lastDate && (
                <p className="text-[10px] mt-3" style={{ color: "var(--text-muted)" }}>
                  Dernière séance : {format(new Date(lastDate + "T00:00:00"), "d MMMM", { locale: fr })}
                </p>
              )}

              <button
                onClick={() => startProgram(program)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-semibold transition-all mt-3"
                style={{
                  background: `linear-gradient(135deg, ${program.color}25, ${program.color}12)`,
                  border: `1px solid ${program.color}40`,
                  color: program.color,
                }}
              >
                <IconPlayerPlay size={14} stroke={2} />
                Commencer · {program.durationMin} min
              </button>
            </div>
          </motion.div>
        );
      })}

      <p className="text-[10px] text-center" style={{ color: "var(--text-muted)" }}>
        🎵 Sons générés par Web Audio · fonctionne hors connexion
      </p>
    </div>
  );
}
