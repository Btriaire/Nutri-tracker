"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Play, Pause, SpeakerHigh, SpeakerLow, SpeakerX, Timer } from "@phosphor-icons/react";
import { motion, AnimatePresence } from "framer-motion";

// ─── Sound definitions ─────────────────────────────────────────────────────

interface SoundDef {
  id:    string;
  emoji: string;
  name:  string;
  desc:  string;
  color: string;
}

const SOUNDS: SoundDef[] = [
  { id: "rain",     emoji: "🌧️", name: "Pluie douce",    desc: "Bruissement de pluie légère",       color: "#60a5fa" },
  { id: "ocean",    emoji: "🌊", name: "Vagues",          desc: "Vagues rythmiques de l'océan",      color: "#34d399" },
  { id: "forest",   emoji: "🌲", name: "Forêt",           desc: "Oiseaux et feuillages frémissants", color: "#86efac" },
  { id: "fire",     emoji: "🔥", name: "Feu de cheminée", desc: "Crépitement chaleureux du bois",    color: "#fb923c" },
  { id: "tibetan",  emoji: "🎵", name: "Bol tibétain",    desc: "432 Hz · vibrations méditatives",   color: "#c084fc" },
  { id: "wind",     emoji: "🍃", name: "Brise zen",       desc: "Vent doux et apaisant",             color: "#a3e635" },
  { id: "binaural", emoji: "🧘", name: "Ondes alpha",     desc: "Binaural 10 Hz · relaxation profonde (casque)", color: "#f9a8d4" },
];

const TIMERS = [
  { label: "5 min",  value: 5  },
  { label: "15 min", value: 15 },
  { label: "30 min", value: 30 },
  { label: "1 h",    value: 60 },
];

// ─── Web Audio engine ──────────────────────────────────────────────────────

interface AudioEngine {
  stop:      () => void;
  setVolume: (v: number) => void;
}

// Small 1-second loop buffer — avoids heavy computation on mobile
function makeNoiseBuffer(ctx: AudioContext, kind: "white" | "pink" | "brown"): AudioBuffer {
  const sr  = ctx.sampleRate || 44100;
  const len = Math.ceil(sr * 1); // 1 second
  const buf = ctx.createBuffer(1, len, sr);
  const d   = buf.getChannelData(0);

  if (kind === "white") {
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  } else if (kind === "pink") {
    let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0=0.99886*b0+w*0.0555179; b1=0.99332*b1+w*0.0750759;
      b2=0.96900*b2+w*0.1538520; b3=0.86650*b3+w*0.3104856;
      b4=0.55000*b4+w*0.5329522; b5=-0.7616*b5-w*0.0168980;
      d[i] = (b0+b1+b2+b3+b4+b5+b6+w*0.5362)*0.11; b6=w*0.115926;
    }
  } else {
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random()*2-1;
      last = (last + 0.02*w) / 1.02;
      d[i] = last * 3.5;
    }
  }
  return buf;
}

function noiseSource(ctx: AudioContext, kind: "white" | "pink" | "brown"): AudioBufferSourceNode {
  const src = ctx.createBufferSource();
  src.buffer = makeNoiseBuffer(ctx, kind);
  src.loop = true;
  return src;
}

function buildEngine(ctx: AudioContext, id: string, master: GainNode): AudioEngine {
  const gain = ctx.createGain();
  gain.connect(master);

  const nodes: AudioNode[] = [];
  const intervals: ReturnType<typeof setInterval>[] = [];

  const osc = (freq: number, type: OscillatorType = "sine"): OscillatorNode => {
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq;
    nodes.push(o); return o;
  };
  const ns = (kind: "white"|"pink"|"brown"): AudioBufferSourceNode => {
    const s = noiseSource(ctx, kind); nodes.push(s); return s;
  };
  const bq = (type: BiquadFilterType, freq: number, q = 1): BiquadFilterNode => {
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; return f;
  };
  const g = (val: number): GainNode => {
    const n = ctx.createGain(); n.gain.value = val; return n;
  };

  switch (id) {

    case "rain": {
      const s1 = ns("white");
      const f1 = bq("bandpass", 1200, 1.5);
      s1.connect(f1); f1.connect(gain);

      const s2 = ns("pink");
      const f2 = bq("lowpass", 400);
      const g2 = g(0.35);
      s2.connect(f2); f2.connect(g2); g2.connect(gain);

      s1.start(); s2.start();
      break;
    }

    case "ocean": {
      const s = ns("pink");
      const lp = bq("lowpass", 550);
      const wg = g(0.65);
      s.connect(lp); lp.connect(wg); wg.connect(gain);
      s.start();
      // JS-based LFO (more compatible than AudioParam connection)
      let t = 0;
      const iv = setInterval(() => {
        t += 0.05;
        wg.gain.value = 0.45 + 0.35 * Math.sin(t * 0.14 * 2 * Math.PI);
      }, 50);
      intervals.push(iv);
      break;
    }

    case "forest": {
      const s = ns("pink");
      const bp = bq("bandpass", 800, 2.5);
      const wg = g(0.45);
      s.connect(bp); bp.connect(wg); wg.connect(gain);
      s.start();

      const chirp = () => {
        const o = ctx.createOscillator();
        const og = ctx.createGain();
        o.frequency.value = 2000 + Math.random()*1800;
        o.type = "sine";
        og.gain.setValueAtTime(0, ctx.currentTime);
        og.gain.linearRampToValueAtTime(0.08, ctx.currentTime+0.04);
        og.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime+0.22);
        o.connect(og); og.connect(gain);
        o.start(); o.stop(ctx.currentTime+0.25);
      };
      const iv = setInterval(() => {
        if (Math.random() > 0.35) chirp();
        if (Math.random() > 0.65) setTimeout(chirp, 350);
      }, 1400);
      intervals.push(iv);
      break;
    }

    case "fire": {
      const s = ns("brown");
      const lp = bq("lowpass", 900);
      const wg = g(0.7);
      s.connect(lp); lp.connect(wg); wg.connect(gain);
      s.start();
      // JS crackle LFO
      let t = 0;
      const iv = setInterval(() => {
        t += 0.05;
        wg.gain.value = 0.5 + 0.25 * Math.sin(t * 9 * 2 * Math.PI) + 0.15 * (Math.random() - 0.5);
      }, 50);
      intervals.push(iv);
      break;
    }

    case "tibetan": {
      [432, 864, 1296].forEach((freq, i) => {
        const o = osc(freq);
        const og = g(0.01);
        og.gain.linearRampToValueAtTime(0.14/(i+1), ctx.currentTime + 0.8);
        o.connect(og); og.connect(gain);
        o.start();
      });
      // Slow breath modulation via JS
      let t = 0;
      const iv = setInterval(() => {
        t += 0.05;
        gain.gain.value = 0.85 + 0.15 * Math.sin(t * 0.4 * 2 * Math.PI);
      }, 50);
      intervals.push(iv);
      break;
    }

    case "wind": {
      const s = ns("brown");
      const bp = bq("bandpass", 300, 3.5);
      s.connect(bp); bp.connect(gain);
      s.start();
      // JS-based sweeping filter
      let t = 0;
      const iv = setInterval(() => {
        t += 0.05;
        bp.frequency.value = 200 + 200 * Math.sin(t * 0.07 * 2 * Math.PI);
      }, 50);
      intervals.push(iv);
      break;
    }

    case "binaural": {
      const merger = ctx.createChannelMerger(2);

      const left = osc(200); const lg = g(0.15);
      left.connect(lg); lg.connect(merger, 0, 0);

      const right = osc(210); const rg = g(0.15);
      right.connect(rg); rg.connect(merger, 0, 1);

      merger.connect(gain);
      left.start(); right.start();

      const s = ns("pink");
      const lp = bq("lowpass", 320);
      const ng = g(0.12);
      s.connect(lp); lp.connect(ng); ng.connect(gain);
      s.start();
      break;
    }
  }

  return {
    stop: () => {
      intervals.forEach(clearInterval);
      nodes.forEach((n) => {
        try { (n as AudioScheduledSourceNode).stop?.(); } catch {}
      });
      try { ctx.close(); } catch {}
    },
    setVolume: (v) => {
      gain.gain.value = v;
    },
  };
}

// Webkit prefix needed for older iOS Safari
type AnyAudioContext = AudioContext & { state: AudioContextState };
function getAudioContext(): AnyAudioContext {
  const W = window as unknown as { webkitAudioContext?: typeof AudioContext };
  const Ctx = window.AudioContext ?? W.webkitAudioContext;
  if (!Ctx) throw new Error("Web Audio not supported");
  return new Ctx() as AnyAudioContext;
}

// ─── Component ────────────────────────────────────────────────────────────

export default function RelaxationPlayer() {
  const [playing, setPlaying]   = useState<string | null>(null);
  const [volume,  setVolume]    = useState(0.7);
  const [timer,   setTimer]     = useState<number | null>(null);
  const [elapsed, setElapsed]   = useState(0);

  const engineRef = useRef<AudioEngine | null>(null);
  const ctxRef    = useRef<AnyAudioContext | null>(null);
  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  // Pre-create + pre-unlock the AudioContext on first user interaction
  useEffect(() => {
    const unlock = () => {
      if (ctxRef.current) { ctxRef.current.resume().catch(() => {}); return; }
      try {
        const ctx = getAudioContext();
        ctxRef.current = ctx;
        ctx.resume().catch(() => {});
      } catch {}
      document.removeEventListener("touchstart", unlock);
      document.removeEventListener("click",      unlock);
    };
    document.addEventListener("touchstart", unlock, { once: true, passive: true });
    document.addEventListener("click",      unlock, { once: true });
    return () => {
      document.removeEventListener("touchstart", unlock);
      document.removeEventListener("click",      unlock);
    };
  }, []);

  // Cleanup context on unmount
  useEffect(() => () => { ctxRef.current?.close().catch(() => {}); }, []);

  const stopAll = useCallback(() => {
    engineRef.current?.stop();
    engineRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setPlaying(null);
    setElapsed(0);
  }, []);

  const play = useCallback((id: string) => {
    stopAll();
    try {
      // Reuse or create context
      if (!ctxRef.current) ctxRef.current = getAudioContext();
      const ctx = ctxRef.current;
      ctx.resume().catch(() => {});

      // Recreate destination chain on each play
      const master = ctx.createGain();
      master.gain.value = volume;
      master.connect(ctx.destination);

      engineRef.current = buildEngine(ctx, id, master);
      setPlaying(id);
      setElapsed(0);
    } catch (e) {
      console.error("RelaxationPlayer:", e);
    }
  }, [stopAll, volume]);

  const handleTimer = useCallback((minutes: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (timer === minutes) { setTimer(null); setElapsed(0); return; }
    setTimer(minutes);
    setElapsed(0);
    const iv = setInterval(() => {
      setElapsed((e) => {
        const next = e + 1;
        if (next >= minutes * 60) { clearInterval(iv); stopAll(); setTimer(null); }
        return next;
      });
    }, 1000);
    timerRef.current = iv;
  }, [timer, stopAll]);

  const handleVolume = useCallback((v: number) => {
    setVolume(v);
    engineRef.current?.setVolume(v);
  }, []);

  // cleanup on unmount
  useEffect(() => () => { stopAll(); }, [stopAll]);

  const timerLeft = timer ? timer * 60 - elapsed : null;
  const fmtTime = (s: number) => `${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`;

  return (
    <div className="glass p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="label-xs">🎧 Relaxation</p>
        {timerLeft !== null && (
          <span className="text-[11px] font-medium tabular-nums px-2 py-0.5 rounded-full"
            style={{ background: "rgba(167,139,250,0.15)", color: "var(--protein)" }}>
            <Timer size={11} className="inline mr-1" />{fmtTime(timerLeft)}
          </span>
        )}
      </div>

      {/* Sound grid */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        {SOUNDS.map((s) => {
          const active = playing === s.id;
          return (
            <motion.button
              key={s.id}
              onClick={() => active ? stopAll() : play(s.id)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              className="flex items-center gap-2.5 p-2.5 rounded-xl text-left transition-all"
              style={{
                background: active ? `${s.color}18` : "rgba(255,255,255,0.03)",
                border:     `1px solid ${active ? s.color + "55" : "var(--border)"}`,
              }}
            >
              <span className="text-[22px] flex-shrink-0">{s.emoji}</span>
              <div className="min-w-0">
                <p className="text-[12px] font-semibold truncate" style={{ color: active ? s.color : "var(--text-primary)" }}>
                  {s.name}
                </p>
                <p className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>{s.desc}</p>
              </div>
              <div className="ml-auto flex-shrink-0">
                {active
                  ? <Pause size={14} weight="fill" style={{ color: s.color }} />
                  : <Play  size={14} weight="fill" style={{ color: "var(--text-muted)" }} />
                }
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Volume + timer controls */}
      <AnimatePresence>
        {playing && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: "hidden" }}
          >
            <div className="pt-3 space-y-3" style={{ borderTop: "1px solid var(--border)" }}>
              {/* Volume */}
              <div className="flex items-center gap-2.5">
                <SpeakerLow size={14} style={{ color: "var(--text-muted)" }} className="flex-shrink-0" />
                <input
                  type="range" min={0} max={1} step={0.01}
                  value={volume}
                  onChange={(e) => handleVolume(parseFloat(e.target.value))}
                  className="flex-1 accent-violet-400"
                  style={{ height: "4px" }}
                />
                <SpeakerHigh size={14} style={{ color: "var(--text-muted)" }} className="flex-shrink-0" />
              </div>

              {/* Timer chips */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <Timer size={12} style={{ color: "var(--text-muted)" }} className="flex-shrink-0" />
                {TIMERS.map(({ label, value }) => {
                  const active = timer === value;
                  return (
                    <button key={value} onClick={() => handleTimer(value)}
                      className="px-2 py-0.5 rounded-lg text-[10px] font-medium transition-all"
                      style={{
                        background: active ? "rgba(167,139,250,0.18)" : "rgba(255,255,255,0.04)",
                        border: `1px solid ${active ? "rgba(167,139,250,0.4)" : "var(--border)"}`,
                        color: active ? "var(--protein)" : "var(--text-muted)",
                      }}>
                      {label}
                    </button>
                  );
                })}
                {timer && (
                  <button onClick={() => { setTimer(null); if (timerRef.current) clearInterval(timerRef.current); setElapsed(0); }}
                    className="px-2 py-0.5 rounded-lg text-[10px] transition-all"
                    style={{ color: "var(--text-muted)", border: "1px solid var(--border)" }}>
                    Annuler
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
