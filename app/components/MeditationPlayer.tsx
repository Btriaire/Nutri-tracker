"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  IconPlayerPlay, IconPlayerPause, IconPlayerStop, IconCircleCheck,
  IconChevronLeft, IconVolume, IconVolumeOff, IconMusic, IconRefresh,
  IconSparkles, IconSearch, IconX, IconFlame, IconClock, IconChevronDown, IconChevronUp,
} from "@tabler/icons-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

// ─── Types ───────────────────────────────────────────────────────────────────

type ProgramId = "express" | "court" | "moyen" | "long";
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
    { id: "tibetan3h",  label: "Bols tibétains", emoji: "🔔", videoId: "77ZozI0rw7w" },  // Jason Stephenson 3h
    { id: "hz432",      label: "432 Hz heal",    emoji: "✨", videoId: "I0GnHkFgSIQ" },  // 432 Hz Miracle Tone
    { id: "crystal",    label: "Bols cristal",   emoji: "💎", videoId: "puX7S3cOlKE" },  // Crystal bowls 8h
  ],
  nature: [
    { id: "rain",       label: "Pluie douce",    emoji: "🌧", videoId: "q76bMs-NwRk" },  // Rain 3h Relaxing White Noise
    { id: "ocean",      label: "Vagues océan",   emoji: "🌊", videoId: "nMfPqeZjc2c" },  // Ocean waves 8h
    { id: "forest",     label: "Forêt & oiseaux",emoji: "🌲", videoId: "xNN7iTA57jM" },  // Forest birds
  ],
  binaural: [
    { id: "lofi",       label: "Lofi hip hop",   emoji: "🎵", videoId: "jfKfPfyJRdk" },  // Lofi Girl — très stable
    { id: "theta",      label: "Ondes Thêta 4Hz",emoji: "🧠", videoId: "DWcJFNfaw9c" },  // Theta binaural 8h
    { id: "ambient",    label: "Ambient spatial", emoji: "🌌", videoId: "5qap5aO4i9A" }, // Peaceful lofi ambient
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
    id: "express", label: "Pause éclair", durationMin: 3, emoji: "⚡",
    description: "Micro-pause · 3 respirations · retour au calme immédiat",
    color: "#fbbf24", soundCat: "bowl",
    steps: [
      { label: "Lâcher prise", durationSec: 90,  instruction: "Fermez les yeux. Déposez tout. Sentez le poids de votre corps." },
      { label: "3 souffles",   durationSec: 90,  instruction: "3 grandes inspirations lentes. À chaque expiration, relâchez une tension. Épaules, mâchoire, front." },
    ],
  },
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

// ─── AI Themes ────────────────────────────────────────────────────────────────

const AI_THEMES = [
  { label: "Stress",      emoji: "😮‍💨" },
  { label: "Sommeil",     emoji: "🌙" },
  { label: "Énergie",     emoji: "⚡" },
  { label: "Focus",       emoji: "🎯" },
  { label: "Chakras",     emoji: "🌈" },
  { label: "Guérison",    emoji: "💚" },
  { label: "Anxiété",     emoji: "🌊" },
  { label: "Confiance",   emoji: "✨" },
  { label: "Gratitude",   emoji: "🙏" },
  { label: "432 Hz",      emoji: "🔮" },
  { label: "528 Hz",      emoji: "💎" },
  { label: "Pleine lune", emoji: "🌕" },
];

// ─── YouTube URL builder ──────────────────────────────────────────────────────
// No mute by default — user tap inside the iframe starts with sound directly.
// enablejsapi=1 lets us postMessage mute/unmute after playback starts.

function buildYTUrl(videoId: string) {
  const p = new URLSearchParams({
    autoplay: "1", loop: "1", playlist: videoId,
    controls: "0", rel: "0", modestbranding: "1",
    mute: "0", enablejsapi: "1",
  });
  return `https://www.youtube.com/embed/${videoId}?${p}`;
}

// ─── NowPlaying ────────────────────────────────────────────────────────────────
// Key insight: setting iframe.src directly inside the click handler is synchronous
// and preserves the user-gesture context → allows autoplay with sound on mobile.
// React setState → re-render → new src loses the gesture because of async gap.

const FADE_SECS = 20; // seconds for fade-in / fade-out

function NowPlaying({
  track, iframeKey, active, onChangeTrack, tracks, totalElapsed, totalDuration,
}: {
  track:         Track;
  iframeKey:     number;
  active:        boolean;
  onChangeTrack: (t: Track) => void;
  tracks:        Track[];
  totalElapsed:  number;
  totalDuration: number;
}) {
  const iframeRef              = useRef<HTMLIFrameElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [muted,     setMuted]     = useState(false);
  // Track manual mute so fade doesn't override it
  const mutedRef = useRef(false);

  // postMessage helper
  const sendCmd = useCallback((func: string, args: unknown[] = []) => {
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: "command", func, args }),
      "https://www.youtube.com"
    );
  }, []);

  // Listen for YouTube player state (enablejsapi=1)
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (!String(e.origin).includes("youtube.com")) return;
      try {
        const d = JSON.parse(e.data as string) as { event?: string; info?: number };
        if (d.event === "onStateChange") {
          if (d.info === 1)                  setIsPlaying(true);
          if (d.info === 0 || d.info === 2)  setIsPlaying(false);
        }
      } catch { /* not a YT message */ }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  // Reset on track / session change
  useEffect(() => {
    setIsPlaying(false);
    setMuted(false);
    mutedRef.current = false;
    if (iframeRef.current) {
      iframeRef.current.src = active ? buildYTUrl(track.videoId) : "about:blank";
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track.videoId, iframeKey, active]);

  // Stop on session end
  useEffect(() => {
    if (!active && iframeRef.current) {
      iframeRef.current.src = "about:blank";
      setIsPlaying(false);
    }
  }, [active]);

  // ── Volume fade-in / fade-out ─────────────────────────────────────────────
  useEffect(() => {
    if (!active || !isPlaying || mutedRef.current) return;

    let vol = 100;
    if (totalElapsed <= FADE_SECS) {
      // Fade-in: 0 → 100 over first 20s
      vol = Math.round((totalElapsed / FADE_SECS) * 100);
    } else if (totalDuration > 0 && totalDuration - totalElapsed <= FADE_SECS) {
      // Fade-out: 100 → 0 over last 20s
      const remaining = totalDuration - totalElapsed;
      vol = Math.max(0, Math.round((remaining / FADE_SECS) * 100));
    }

    sendCmd("setVolume", [vol]);
  }, [totalElapsed, totalDuration, active, isPlaying, sendCmd]);

  const toggleMute = () => {
    const next = !mutedRef.current;
    mutedRef.current = next;
    if (next) { sendCmd("mute"); }
    else       { sendCmd("unMute"); }
    setMuted(next);
  };

  return (
    <div className="rounded-xl overflow-hidden"
      style={{ background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.2)" }}>

      {/* Player area — iframe darkened by CSS filter, meditation overlay on top.
          overlay has pointer-events:none so the first tap reaches YouTube directly
          and starts playback with sound (iOS requires direct iframe interaction).  */}
      <div style={{ position: "relative", height: 190 }}>

        {/* iframe — visually hidden but rendered at real size so audio works */}
        <iframe
          ref={iframeRef}
          src={active ? buildYTUrl(track.videoId) : "about:blank"}
          allow="autoplay; encrypted-media"
          style={{
            position: "absolute", inset: 0, width: "100%", height: "100%",
            border: "none", filter: "brightness(0.05)",
          }}
          title={track.label}
        />

        {/* Meditation overlay — full cover, pointer-events:none */}
        <div className="absolute inset-0 flex flex-col items-center justify-center"
          style={{
            pointerEvents: "none", zIndex: 1,
            background: "radial-gradient(ellipse at 50% 35%, rgba(88,28,135,0.55) 0%, rgba(13,13,17,0.9) 72%)",
          }}>

          {/* Pulsing aura behind the figure */}
          {!isPlaying && (
            <motion.div
              animate={{ scale: [1, 1.22, 1], opacity: [0.25, 0.08, 0.25] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              style={{
                position: "absolute",
                width: 100, height: 100, borderRadius: "50%",
                background: "rgba(139,92,246,0.35)",
                border: "1px solid rgba(139,92,246,0.5)",
              }}
            />
          )}

          {/* Central figure */}
          <div style={{ position: "relative", zIndex: 2, textAlign: "center" }}>
            <div style={{ fontSize: 52, lineHeight: 1, marginBottom: 10 }}>🧘</div>
            <p style={{ color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
              {track.label}
            </p>
            <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase" }}>
              {track.emoji} {isPlaying ? "♪ en lecture" : "toucher pour démarrer"}
            </p>
          </div>

          {/* Decorative mandala rings */}
          <div style={{
            position: "absolute", inset: 0, pointerEvents: "none",
            background: "repeating-radial-gradient(circle at 50% 50%, transparent 30px, rgba(139,92,246,0.04) 31px, transparent 32px)",
          }} />
        </div>

        {/* Mute button — only shown when playing, needs pointer-events:auto */}
        {isPlaying && active && (
          <div className="absolute bottom-3 right-3" style={{ zIndex: 2 }}>
            <button onClick={toggleMute}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all"
              style={{
                background: muted ? "rgba(239,68,68,0.15)"  : "rgba(52,211,153,0.12)",
                border:     muted ? "1px solid rgba(239,68,68,0.4)" : "1px solid rgba(52,211,153,0.35)",
                color:      muted ? "#f87171" : "#34d399",
              }}>
              {muted
                ? <><IconVolumeOff size={13} stroke={1.5} /><span style={{ fontSize: 10, fontWeight: 600 }}>Muet</span></>
                : <><IconVolume    size={13} stroke={1.5} /><span style={{ fontSize: 10, fontWeight: 600 }}>Son</span></>
              }
            </button>
          </div>
        )}
      </div>

      {/* Track switcher */}
      <div className="flex gap-1.5 px-3 py-2.5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
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

  // Médit-IA states
  const [aiTheme,      setAiTheme]      = useState("");
  const [aiDuration,   setAiDuration]   = useState(15);
  const [aiLoading,    setAiLoading]    = useState(false);
  const [aiResults,    setAiResults]    = useState<Track[] | null>(null);
  const [aiError,      setAiError]      = useState("");
  const [aiSession,    setAiSession]    = useState(false); // true when playing an AI track

  // Tracking — sessions from API (Firestore), merged with localStorage
  type ApiSession = { id: string; programId: string; programLabel: string; durationMin: number; date: string; completedAt: string };
  const [allSessions,  setAllSessions]  = useState<ApiSession[]>([]);
  const [showHistory,  setShowHistory]  = useState(false);

  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const pausedRef = useRef(false);

  // Load sessions from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("meditation_sessions");
      if (saved) setSessions(JSON.parse(saved));
    } catch {}
  }, []);

  // Fetch full session history from API
  useEffect(() => {
    fetch("/api/meditation")
      .then(r => r.ok ? r.json() : null)
      .then((d: { sessions?: ApiSession[] } | null) => { if (d?.sessions) setAllSessions(d.sessions); })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    setAiSession(false);
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

  const handleAiSearch = useCallback(async (theme: string) => {
    if (!theme.trim() || aiLoading) return;
    setAiLoading(true);
    setAiError("");
    setAiResults(null);
    try {
      const res = await fetch("/api/meditation/ai-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme }),
      });
      const json = await res.json() as { tracks?: { videoId: string; title: string; emoji: string }[]; error?: string };
      if (!res.ok || json.error) {
        setAiError(json.error ?? "Erreur de recherche");
      } else if (!json.tracks || json.tracks.length === 0) {
        setAiError("Aucun résultat trouvé — essayez un autre thème");
      } else {
        setAiResults(json.tracks.map((t, i) => ({
          id:      `ai_${i}_${t.videoId}`,
          label:   t.title,
          emoji:   t.emoji,
          videoId: t.videoId,
        })));
      }
    } catch {
      setAiError("Impossible de contacter le service");
    } finally {
      setAiLoading(false);
    }
  }, [aiLoading]);

  const playAiTrack = useCallback((track: Track, durationMin = 15) => {
    setAiSession(true);
    setSelected({
      id: "court" as ProgramId,
      label: track.label,
      durationMin,
      emoji: track.emoji,
      description: `Séance libre ${durationMin} min · Médit-IA`,
      color: "#a78bfa",
      soundCat: "bowl",
      steps: [
        { label: "Méditation libre", durationSec: durationMin * 60, instruction: "Installez-vous confortablement. Laissez la musique vous guider vers la paix intérieure." },
      ],
    });
    setCurrentTrack(track);
    setRunning(true);
    setPaused(false);
    setStepIdx(0);
    setStepElapsed(0);
    setTotalElapsed(0);
    setIframeKey(k => k + 1);
    pausedRef.current = false;
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

  // Weekly stats — prefer API data, fall back to localStorage
  const today = format(new Date(), "yyyy-MM-dd");
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 6); // last 7 days
  weekStart.setHours(0, 0, 0, 0);

  const useApi = allSessions.length > 0;
  const weekSessions = useApi
    ? allSessions.filter(s => new Date(s.date + "T12:00:00") >= weekStart)
    : sessions.filter(s => new Date(s.completedAt) >= weekStart);
  const weekMinutes = useApi
    ? weekSessions.reduce((a, s) => a + ((s as ApiSession).durationMin ?? 0), 0)
    : (weekSessions as { programId: ProgramId }[]).reduce((a, s) => {
        const p = PROGRAMS.find(pr => pr.id === s.programId);
        return a + (p?.durationMin ?? 0);
      }, 0);

  // Streak (consecutive days with at least one session)
  const streak = (() => {
    if (!useApi || allSessions.length === 0) return 0;
    const days = new Set(allSessions.map(s => s.date));
    let count = 0;
    let d = new Date();
    // If no session today, start from yesterday
    if (!days.has(today)) d.setDate(d.getDate() - 1);
    while (true) {
      const key = format(d, "yyyy-MM-dd");
      if (!days.has(key)) break;
      count++;
      d.setDate(d.getDate() - 1);
    }
    return count;
  })();

  // Last 7 days calendar
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const key = format(d, "yyyy-MM-dd");
    const hasSess = useApi
      ? allSessions.some(s => s.date === key)
      : sessions.some(s => format(new Date(s.completedAt), "yyyy-MM-dd") === key);
    const mins = useApi
      ? allSessions.filter(s => s.date === key).reduce((a, s) => a + s.durationMin, 0)
      : sessions.filter(s => format(new Date(s.completedAt), "yyyy-MM-dd") === key)
          .reduce((a, s) => { const p = PROGRAMS.find(pr => pr.id === s.programId); return a + (p?.durationMin ?? 0); }, 0);
    return { key, label: format(d, "EEE", { locale: fr }).slice(0, 3), isToday: key === today, hasSess, mins };
  });

  const totalMin = useApi
    ? allSessions.reduce((a, s) => a + s.durationMin, 0)
    : sessions.reduce((a, s) => { const p = PROGRAMS.find(pr => pr.id === s.programId); return a + (p?.durationMin ?? 0); }, 0);

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
            tracks={aiSession && aiResults ? aiResults : TRACKS[selected.soundCat]}
            totalElapsed={totalElapsed}
            totalDuration={totalDuration}
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

  const AI_DURATIONS = [3, 5, 15, 30, 60];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="text-[18px]">☸️</span>
          <div>
            <p className="text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>Méditation</p>
            <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>IA · programmes guidés · suivi</p>
          </div>
        </div>
        {streak > 0 && (
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full"
            style={{ background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.3)" }}>
            <IconFlame size={13} stroke={2} style={{ color: "#fbbf24" }} />
            <span className="text-[12px] font-bold" style={{ color: "#fbbf24" }}>{streak}j</span>
          </div>
        )}
      </div>

      {/* ── Médit-IA (PREMIER) ─────────────────────────────────────────── */}
      <div className="rounded-2xl overflow-hidden"
        style={{ background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.2)" }}>

        {/* Header */}
        <div className="px-4 pt-4 pb-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.3)" }}>
            <IconSparkles size={18} stroke={1.5} style={{ color: "#a78bfa" }} />
          </div>
          <div>
            <p className="text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>Médit-IA</p>
            <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Ambiances thématiques · IA + validation</p>
          </div>
        </div>

        <div className="px-4 pb-4 space-y-3">
          {/* Duration chips */}
          <div>
            <p className="text-[10px] font-medium mb-1.5 uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Durée</p>
            <div className="flex gap-1.5">
              {AI_DURATIONS.map((d) => (
                <button key={d} onClick={() => setAiDuration(d)}
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl text-[11px] font-semibold transition-all"
                  style={{
                    background: aiDuration === d ? "rgba(139,92,246,0.22)" : "rgba(255,255,255,0.04)",
                    border: `1px solid ${aiDuration === d ? "rgba(139,92,246,0.5)" : "var(--border)"}`,
                    color: aiDuration === d ? "#a78bfa" : "var(--text-muted)",
                  }}>
                  <IconClock size={10} stroke={2} />
                  {d < 60 ? `${d}m` : "1h"}
                </button>
              ))}
            </div>
          </div>

          {/* Theme chips */}
          <div className="flex flex-wrap gap-1.5">
            {AI_THEMES.map(({ label, emoji }) => (
              <button key={label}
                onClick={() => { setAiTheme(label); handleAiSearch(label); }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all"
                style={{
                  background: aiTheme === label ? "rgba(139,92,246,0.2)" : "rgba(255,255,255,0.05)",
                  border: `1px solid ${aiTheme === label ? "rgba(139,92,246,0.5)" : "var(--border)"}`,
                  color: aiTheme === label ? "#a78bfa" : "var(--text-muted)",
                }}>
                {emoji} {label}
              </button>
            ))}
          </div>

          {/* Custom search input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={aiTheme}
              onChange={(e) => setAiTheme(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAiSearch(aiTheme)}
              placeholder="Thème libre… (ex: chakra sacral, pleine lune)"
              className="flex-1 px-3 py-2 rounded-xl text-[12px] outline-none"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(139,92,246,0.25)",
                color: "var(--text-primary)",
              }}
            />
            <button
              onClick={() => handleAiSearch(aiTheme)}
              disabled={aiLoading || !aiTheme.trim()}
              className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0 transition-all"
              style={{
                background: aiLoading ? "rgba(139,92,246,0.08)" : "rgba(139,92,246,0.2)",
                border: "1px solid rgba(139,92,246,0.4)",
                color: "#a78bfa",
              }}>
              {aiLoading
                ? <IconRefresh size={15} stroke={1.5} className="animate-spin" />
                : <IconSearch size={15} stroke={1.5} />
              }
            </button>
          </div>

          {/* Loading state */}
          {aiLoading && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
              style={{ background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.15)" }}>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="w-4 h-4 rounded-full flex-shrink-0"
                style={{ border: "2px solid rgba(139,92,246,0.3)", borderTopColor: "#a78bfa" }}
              />
              <p className="text-[11px]" style={{ color: "#a78bfa" }}>
                Recherche en cours · validation des ambiances…
              </p>
            </motion.div>
          )}

          {/* Error */}
          {aiError && !aiLoading && (
            <div className="flex items-center justify-between px-3 py-2 rounded-xl"
              style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
              <p className="text-[11px]" style={{ color: "#f87171" }}>{aiError}</p>
              <button onClick={() => setAiError("")}>
                <IconX size={12} stroke={2} style={{ color: "#f87171" }} />
              </button>
            </div>
          )}

          {/* Results */}
          <AnimatePresence>
            {aiResults && !aiLoading && (
              <motion.div
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="space-y-2">
                {aiResults.map((track) => (
                  <div key={track.id}
                    className="flex items-center gap-3 px-3 py-3 rounded-xl"
                    style={{ background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.15)" }}>
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-[18px]"
                      style={{ background: "rgba(139,92,246,0.12)" }}>
                      {track.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium truncate" style={{ color: "var(--text-primary)" }}>
                        {track.label}
                      </p>
                      <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                        {aiDuration} min · {aiTheme}
                      </p>
                    </div>
                    <button
                      onClick={() => playAiTrack(track, aiDuration)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-semibold flex-shrink-0 transition-all"
                      style={{
                        background: "rgba(139,92,246,0.18)",
                        border: "1px solid rgba(139,92,246,0.4)",
                        color: "#a78bfa",
                      }}>
                      <IconPlayerPlay size={11} stroke={2} />
                      {aiDuration} min
                    </button>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Weekly stats strip */}
      <div className="rounded-2xl p-3" style={{ background: "rgba(52,211,153,0.05)", border: "1px solid rgba(52,211,153,0.15)" }}>
        {/* 7-day calendar */}
        <div className="flex justify-between mb-3">
          {last7.map(({ key, label, isToday, hasSess, mins }) => (
            <div key={key} className="flex flex-col items-center gap-1">
              <span className="text-[9px] uppercase" style={{ color: isToday ? "#34d399" : "var(--text-muted)" }}>{label}</span>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{
                  background: hasSess ? "rgba(52,211,153,0.18)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${hasSess ? "rgba(52,211,153,0.4)" : "var(--border)"}`,
                }}>
                {hasSess
                  ? <span className="text-[11px]">🧘</span>
                  : <span className="w-1.5 h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.08)", display: "inline-block" }} />
                }
              </div>
              {hasSess && <span className="text-[8px] font-medium" style={{ color: "#34d399" }}>{mins}m</span>}
            </div>
          ))}
        </div>
        {/* Stats row */}
        <div className="flex justify-between text-center">
          {[
            { v: weekSessions.length, l: "séances / semaine" },
            { v: `${weekMinutes}m`, l: "pratiquées" },
            { v: `${totalMin}m`, l: "au total" },
          ].map(({ v, l }) => (
            <div key={l}>
              <p className="text-[15px] font-bold" style={{ color: "#34d399" }}>{v}</p>
              <p className="text-[9px]" style={{ color: "var(--text-muted)" }}>{l}</p>
            </div>
          ))}
        </div>
      </div>

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

      {/* ── Historique / Tracking ────────────────────────────────────── */}
      {allSessions.length > 0 && (
        <div className="rounded-2xl overflow-hidden"
          style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)" }}>
          <button
            onClick={() => setShowHistory(h => !h)}
            className="w-full flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <IconClock size={14} stroke={1.5} style={{ color: "var(--text-muted)" }} />
              <span className="text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>
                Historique
              </span>
              <span className="text-[11px] px-1.5 py-0.5 rounded-md"
                style={{ background: "rgba(52,211,153,0.1)", color: "#34d399" }}>
                {allSessions.length} séances
              </span>
            </div>
            {showHistory
              ? <IconChevronUp size={14} stroke={2} style={{ color: "var(--text-muted)" }} />
              : <IconChevronDown size={14} stroke={2} style={{ color: "var(--text-muted)" }} />
            }
          </button>
          <AnimatePresence initial={false}>
            {showHistory && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                style={{ overflow: "hidden" }}>
                <div className="px-4 pb-4 space-y-1.5">
                  {allSessions.slice(0, 15).map((s) => (
                    <div key={s.id} className="flex items-center gap-3 px-3 py-2 rounded-xl"
                      style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)" }}>
                      <span className="text-[16px]">
                        {PROGRAMS.find(p => p.id === s.programId)?.emoji ?? "🧘"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-medium truncate" style={{ color: "var(--text-primary)" }}>
                          {s.programLabel}
                        </p>
                        <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                          {format(new Date(s.date + "T12:00:00"), "d MMM yyyy", { locale: fr })}
                        </p>
                      </div>
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-lg"
                        style={{ background: "rgba(52,211,153,0.1)", color: "#34d399" }}>
                        {s.durationMin} min
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      <p className="text-[10px] text-center" style={{ color: "var(--text-muted)" }}>
        🎵 Musique ambiante · Nécessite une connexion internet
      </p>
    </div>
  );
}
