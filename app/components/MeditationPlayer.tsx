"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  IconPlayerPlay, IconPlayerPause, IconPlayerStop, IconCircleCheck,
  IconChevronLeft, IconVolume, IconVolumeOff, IconMusic, IconRefresh,
} from "@tabler/icons-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

// ─── Types ───────────────────────────────────────────────────────────────────

type ProgramId = "court" | "moyen" | "long";
type SoundCategory = "bowl" | "nature" | "binaural";

interface Track {
  id:      string;
  label:   string;
  emoji:   string;
  videoId: string; // YouTube video ID
}

// ─── Curated ambient tracks ───────────────────────────────────────────────────
// Free ambient / meditation content from YouTube

const TRACKS: Record<SoundCategory, Track[]> = {
  bowl: [
    { id: "tibetan3h",  label: "Bols tibétains", emoji: "🔔", videoId: "77ZozI0rw7w" },
    { id: "hz432",      label: "432 Hz heal",    emoji: "✨", videoId: "74yd7bQi3TU" },
    { id: "crystal",    label: "Bols cristal",   emoji: "💎", videoId: "09eFOwSoNM0" },
  ],
  nature: [
    { id: "rain",       label: "Pluie douce",    emoji: "🌧", videoId: "yMSDzSf_UMg" },
    { id: "ocean",      label: "Vagues océan",   emoji: "🌊", videoId: "V1RPi2MYptM" },
    { id: "forest",     label: "Forêt & oiseaux",emoji: "🌲", videoId: "xNN7iTA57jM" },
  ],
  binaural: [
    { id: "lofi",       label: "Lofi hip hop",   emoji: "🎵", videoId: "jfKfPfyJRdk" },
    { id: "theta",      label: "Ondes Thêta 4Hz",emoji: "🧠", videoId: "tybOi4hjZFQ" },
    { id: "ambient",    label: "Ambient spatial", emoji: "🌌", videoId: "WHPEKLQID4U" },
  ],
};

// Default track per sound category
const DEFAULT_TRACK: Record<SoundCategory, string> = {
  bowl:     "tibetan3h",
  nature:   "rain",
  binaural: "lofi",
};

// ─── Programs ─────────────────────────────────────────────────────────────────

interface Program {
  id:          ProgramId;
  label:       string;
  durationMin: number;
  emoji:       string;
  description: string;
  color:       string;
  soundCat:    SoundCategory;
  steps:       { label: string; durationSec: number; instruction: string }[];
}

const PROGRAMS: Program[] = [
  {
    id: "court", label: "Pleine présence", durationMin: 5, emoji: "🌸",
    description: "Ancrage rapide · respiration · calme l'esprit en 5 minutes",
    color: "#a3e4a3", soundCat: "bowl",
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
    color: "#86d4a6", soundCat: "nature",
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
    color: "#6dd6b5", soundCat: "binaural",
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

// ─── YouTube embed helpers ────────────────────────────────────────────────────

function buildYTUrl(videoId: string, muted: boolean) {
  const params = new URLSearchParams({
    autoplay:       "1",
    loop:           "1",
    playlist:       videoId,
    controls:       "1",   // show controls so user can adjust volume
    rel:            "0",
    modestbranding: "1",
    mute:           muted ? "1" : "0",
  });
  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
}

// ─── Now Playing card — visible YouTube player ────────────────────────────────

// ─── NowPlaying — iframe visible 1 tap puis masquée ─────────────────────────
// Stratégie : iframe dans un wrapper overflow:hidden.
// Avant activation → wrapper height=80px visible (pour l'autoplay grant).
// Après activation → wrapper height=1px, iframe 200px → audio continue.
// session terminée → src vide pour stopper YouTube.

function NowPlaying({
  track, iframeKey, active, onChangeTrack, tracks,
}: {
  track:         Track;
  iframeKey:     number;
  active:        boolean;      // false = session terminée → stopper audio
  onChangeTrack: (t: Track) => void;
  tracks:        Track[];
}) {
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [localKey, setLocalKey] = useState(iframeKey);

  // Reset when track changes
  useEffect(() => {
    setAudioEnabled(false);
    setLocalKey(k => k + 1);
  }, [track.id]);

  // Stop audio when session ends
  const iframeSrc = !active
    ? "about:blank"
    : buildYTUrl(track.videoId, !audioEnabled);

  const handleActivate = () => {
    setAudioEnabled(true);
    setLocalKey(k => k + 1); // reload without mute=1
  };

  return (
    <div className="rounded-xl overflow-hidden"
      style={{ background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.2)" }}>

      {/* iframe zone — visible avant activation, 1px après */}
      <div style={{
        height: audioEnabled ? 1 : 80,
        overflow: "hidden",
        transition: "height 0.3s ease",
        position: "relative",
        background: "#000",
      }}>
        <iframe
          key={`${track.videoId}-${localKey}`}
          src={iframeSrc}
          allow="autoplay; encrypted-media"
          style={{ width: "100%", height: 200, border: "none", display: "block" }}
          title={track.label}
        />
        {/* Overlay activation — visible tant que audioEnabled=false */}
        {!audioEnabled && (
          <button
            onClick={handleActivate}
            className="absolute inset-0 flex items-center justify-center gap-3"
            style={{ background: "rgba(0,0,0,0.72)" }}
          >
            <span className="text-3xl">🔊</span>
            <span style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>
              Appuyez pour lancer la musique
            </span>
          </button>
        )}
      </div>

      {/* Compact now-playing row */}
      <div className="flex items-center gap-2 px-3 py-2">
        <span className="text-[15px]">{track.emoji}</span>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold" style={{ color: audioEnabled ? "#34d399" : "var(--text-muted)" }}>
            {audioEnabled ? "♪ En cours" : "Son inactif — appuyez ▲"}
          </p>
          <p className="text-[11px] truncate" style={{ color: "var(--text-secondary)" }}>{track.label}</p>
        </div>
      </div>

      {/* Track switcher */}
      <div className="flex gap-1.5 px-3 pb-2.5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
        {tracks.map((t) => (
          <button key={t.id}
            onClick={() => onChangeTrack(t)}
            className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all"
            style={{
              background: t.id === track.id ? "rgba(52,211,153,0.18)" : "rgba(255,255,255,0.05)",
              border:     `1px solid ${t.id === track.id ? "rgba(52,211,153,0.5)" : "var(--border)"}`,
              color:      t.id === track.id ? "#34d399" : "var(--text-muted)",
            }}
          >
            <span>{t.emoji}</span> {t.label}
          </button>
        ))}
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
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [iframeKey,    setIframeKey]    = useState(0);

  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const pausedRef = useRef(false);

  // Load sessions from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("meditation_sessions");
      if (saved) setSessions(JSON.parse(saved));
    } catch {}
  }, []);

  const startProgram = useCallback((program: Program) => {
    const defaultTrackId = DEFAULT_TRACK[program.soundCat];
    const track = TRACKS[program.soundCat].find(t => t.id === defaultTrackId) ?? TRACKS[program.soundCat][0];

    setSelected(program);
    setCurrentTrack(track);
    setRunning(true);
    setPaused(false);
    setStepIdx(0);
    setStepElapsed(0);
    setTotalElapsed(0);
    setIframeKey(k => k + 1);
    pausedRef.current = false;
  }, []);

  const stopSession = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setRunning(false);
    setPaused(false);
    setStepIdx(0);
    setStepElapsed(0);
    // NowPlaying reçoit active=false → src=about:blank → stoppe YouTube
  }, []);

  const togglePause = useCallback(() => {
    if (!running) return;
    pausedRef.current = !pausedRef.current;
    setPaused(p => !p);
  }, [running]);

  const handleChangeTrack = useCallback((track: Track) => {
    setCurrentTrack(track);
    setIframeKey(k => k + 1);
  }, []);

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
                try { localStorage.setItem("meditation_sessions", JSON.stringify(updated)); } catch {}
                return updated;
              });
              // Save to Firestore (fire-and-forget)
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

  const currentStep  = selected?.steps[stepIdx];
  const totalDuration = selected ? selected.steps.reduce((a, s) => a + s.durationSec, 0) : 0;
  const progressPct  = totalDuration > 0 ? Math.min((totalElapsed / totalDuration) * 100, 100) : 0;

  // Weekly stats
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weekSessions = sessions.filter(s => new Date(s.completedAt) >= weekStart);
  const weekMinutes  = weekSessions.reduce((a, s) => {
    const p = PROGRAMS.find(pr => pr.id === s.programId);
    return a + (p?.durationMin ?? 0);
  }, 0);

  // ── Running state ──────────────────────────────────────────────────────────

  if (running && selected && currentTrack) {
    return (
      <div className="rounded-2xl overflow-hidden"
        style={{ background: "linear-gradient(160deg, rgba(16,185,129,0.06) 0%, rgba(52,211,153,0.03) 100%)", border: "1px solid rgba(52,211,153,0.2)" }}>

        {/* Progress bar */}
        <div className="h-1 w-full" style={{ background: "rgba(52,211,153,0.1)" }}>
          <motion.div className="h-full rounded-full" animate={{ width: `${progressPct}%` }}
            transition={{ duration: 1, ease: "linear" }}
            style={{ background: "linear-gradient(90deg, #34d399, #6ee7b7)" }} />
        </div>

        <div className="p-4 space-y-3">
          {/* Header controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[24px]">{selected.emoji}</span>
              <div>
                <p className="text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>{selected.label}</p>
                <p className="text-[11px]" style={{ color: "#34d399" }}>{fmtTime(totalElapsed)} / {fmtTime(totalDuration)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={togglePause}
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: "rgba(52,211,153,0.12)" }}>
                {paused
                  ? <IconPlayerPlay size={14} stroke={1.5} style={{ color: "#34d399" }} />
                  : <IconPlayerPause size={14} stroke={1.5} style={{ color: "#34d399" }} />}
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
                animate={{ background: i < stepIdx ? "#34d399" : i === stepIdx ? selected.color : "rgba(255,255,255,0.08)" }}
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

          {/* Breathing orb */}
          <div className="flex justify-center py-1">
            <motion.div className="rounded-full"
              style={{ width: 56, height: 56, background: `radial-gradient(circle, ${selected.color}30 0%, ${selected.color}10 60%, transparent 100%)`, border: `1px solid ${selected.color}40` }}
              animate={{ scale: paused ? 1 : [1, 1.25, 1], opacity: paused ? 0.3 : [0.6, 1, 0.6] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            />
          </div>

              {paused && (
            <p className="text-center text-[11px]" style={{ color: "var(--text-muted)" }}>En pause · appuyez ▶ pour reprendre</p>
          )}

          {/* Now Playing */}
          <NowPlaying
            track={currentTrack}
            iframeKey={iframeKey}
            active={running}
            onChangeTrack={handleChangeTrack}
            tracks={TRACKS[selected.soundCat]}
          />
        </div>
      </div>
    );
  }

  // ── Completed ──────────────────────────────────────────────────────────────

  if (completed.includes(selected?.id ?? "" as ProgramId) && !running) {
    const prog = selected!;
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="p-6 rounded-2xl text-center"
        style={{ background: "linear-gradient(135deg, rgba(52,211,153,0.08) 0%, rgba(16,185,129,0.05) 100%)", border: "1px solid rgba(52,211,153,0.25)" }}>
        <div className="text-[40px] mb-2">{prog.emoji}</div>
        <div className="flex justify-center mb-3">
          <IconCircleCheck size={32} stroke={1.5} style={{ color: "#34d399" }} />
        </div>
        <p className="text-[16px] font-semibold mb-1" style={{ color: "#34d399" }}>Séance complète ✨</p>
        <p className="text-[13px] mb-1" style={{ color: "var(--text-secondary)" }}>{prog.label} · {prog.durationMin} min</p>
        <p className="text-[11px] mb-4" style={{ color: "var(--text-muted)" }}>
          Prenez un moment pour ressentir les bénéfices de cette pratique.
        </p>
        <button onClick={() => { setSelected(null); setCompleted([]); }}
          className="flex items-center gap-2 mx-auto px-4 py-2 rounded-xl text-[13px]"
          style={{ background: "rgba(52,211,153,0.12)", color: "#34d399", border: "1px solid rgba(52,211,153,0.3)" }}>
          <IconChevronLeft size={13} stroke={2} /> Retour aux programmes
        </button>
      </motion.div>
    );
  }

  // ── Program selection ──────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[18px]">☸️</span>
        <div>
          <p className="text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>Méditation guidée</p>
          <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>3 programmes · musique ambiante YouTube</p>
        </div>
      </div>

      {/* Weekly stats */}
      {weekSessions.length > 0 && (
        <div className="flex gap-3">
          {[
            { v: weekSessions.length, l: "séances cette semaine" },
            { v: `${weekMinutes} min`, l: "de pratique" },
            { v: sessions.length, l: "séances au total" },
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
        const lastDate     = sessions.filter(s => s.programId === program.id).sort((a, b) => b.completedAt - a.completedAt)[0]?.date;
        const tracks       = TRACKS[program.soundCat];
        const defaultTrack = tracks.find(t => t.id === DEFAULT_TRACK[program.soundCat]) ?? tracks[0];

        return (
          <motion.div key={program.id}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl overflow-hidden"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)" }}
          >
            <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${program.color}60, ${program.color}20)` }} />
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
                        {defaultTrack.emoji} {defaultTrack.label}
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

              <p className="text-[12px] mb-3 leading-relaxed" style={{ color: "var(--text-muted)" }}>{program.description}</p>

              {/* Steps preview */}
              <div className="flex gap-1 mb-3">
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

              {/* Sound track chips */}
              <div className="flex gap-1 mb-3 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
                {tracks.map((t) => (
                  <span key={t.id}
                    className="flex-shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px]"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
                    {t.emoji} {t.label}
                  </span>
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
                <IconPlayerPlay size={14} stroke={2} />
                Commencer · {program.durationMin} min
              </button>
            </div>
          </motion.div>
        );
      })}

      <p className="text-[10px] text-center" style={{ color: "var(--text-muted)" }}>
        🎵 Musique ambiante via YouTube · Nécessite une connexion internet
      </p>
    </div>
  );
}
