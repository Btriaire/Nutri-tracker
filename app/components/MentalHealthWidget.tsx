"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { IconX, IconCheck, IconLoader2 } from "@tabler/icons-react";
import type { MentalHealthEntry } from "@/app/api/mental-health/route";
import MoodCircle, { moodValueFromPosition } from "@/app/components/MoodCircle";

interface Props { date: string }

// ── Mood color ────────────────────────────────────────────────────────────────
function moodColor(v: number) {
  if (v >= 5) return "#34d399";
  if (v >= 4) return "#86efac";
  if (v >= 3) return "#fbbf24";
  if (v >= 2) return "#f97316";
  return "#f87171";
}

// ── SVG Mood Face ─────────────────────────────────────────────────────────────
function MoodFace({ val, size = 38, active = false }: { val: number; size?: number; active?: boolean }) {
  const c   = moodColor(val);
  const cx  = size / 2;
  const r   = size / 2 - 1.5;
  const eyeY   = size * 0.385;
  const eyeR   = size * 0.058;
  const eyeOff = size * 0.205;
  const mouthY = size * 0.64;
  const mw     = size * 0.215;

  const mouthPath = (() => {
    if (val === 1) return `M ${cx - mw} ${mouthY - 3} Q ${cx} ${mouthY + mw * 0.85} ${cx + mw} ${mouthY - 3}`;
    if (val === 2) return `M ${cx - mw * 0.8} ${mouthY} Q ${cx} ${mouthY + mw * 0.5} ${cx + mw * 0.8} ${mouthY}`;
    if (val === 3) return `M ${cx - mw * 0.7} ${mouthY} L ${cx + mw * 0.7} ${mouthY}`;
    if (val === 4) return `M ${cx - mw * 0.8} ${mouthY} Q ${cx} ${mouthY - mw * 0.5} ${cx + mw * 0.8} ${mouthY}`;
    return `M ${cx - mw} ${mouthY + 3} Q ${cx} ${mouthY - mw * 0.85} ${cx + mw} ${mouthY + 3}`;
  })();

  const strokeColor = active ? c : "rgba(250,250,250,0.4)";
  const fillColor   = active ? c : "rgba(250,250,250,0.45)";
  const browY  = eyeY - size * 0.145;
  const browX  = size * 0.205;
  const browHW = size * 0.095;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none">
      {/* Head circle */}
      <circle cx={cx} cy={cx} r={r}
        fill={active ? `${c}18` : "rgba(255,255,255,0.04)"}
        stroke={active ? c : "rgba(255,255,255,0.13)"}
        strokeWidth={active ? 1.5 : 1}
      />

      {/* Eyebrows (moods 1-2 = worried, mood 5 = raised) */}
      {val <= 2 && (
        <>
          <line
            x1={cx - browX - browHW} y1={browY}
            x2={cx - browX + browHW} y2={browY + size * 0.04}
            stroke={strokeColor} strokeWidth={1.3} strokeLinecap="round"
          />
          <line
            x1={cx + browX - browHW} y1={browY + size * 0.04}
            x2={cx + browX + browHW} y2={browY}
            stroke={strokeColor} strokeWidth={1.3} strokeLinecap="round"
          />
        </>
      )}
      {val === 5 && (
        <>
          <path
            d={`M ${cx - browX - browHW} ${browY + size * 0.03} Q ${cx - browX} ${browY - size * 0.04} ${cx - browX + browHW} ${browY + size * 0.03}`}
            stroke={strokeColor} strokeWidth={1.3} strokeLinecap="round"
          />
          <path
            d={`M ${cx + browX - browHW} ${browY + size * 0.03} Q ${cx + browX} ${browY - size * 0.04} ${cx + browX + browHW} ${browY + size * 0.03}`}
            stroke={strokeColor} strokeWidth={1.3} strokeLinecap="round"
          />
        </>
      )}

      {/* Eyes */}
      <circle cx={cx - eyeOff} cy={eyeY} r={eyeR} fill={fillColor} />
      <circle cx={cx + eyeOff} cy={eyeY} r={eyeR} fill={fillColor} />

      {/* Tears for mood 1 */}
      {val === 1 && (
        <>
          <path d={`M ${cx - eyeOff} ${eyeY + eyeR} Q ${cx - eyeOff - 1} ${eyeY + eyeR + size * 0.07} ${cx - eyeOff} ${eyeY + eyeR + size * 0.1}`}
            stroke={strokeColor} strokeWidth={1.2} strokeLinecap="round"
          />
        </>
      )}

      {/* Mouth */}
      <path d={mouthPath} stroke={strokeColor} strokeWidth={1.6} strokeLinecap="round" />

      {/* Rosy cheeks for mood 5 */}
      {val === 5 && (
        <>
          <ellipse cx={size * 0.225} cy={mouthY - size * 0.02} rx={size * 0.065} ry={size * 0.038} fill={`${c}3a`} />
          <ellipse cx={size * 0.775} cy={mouthY - size * 0.02} rx={size * 0.065} ry={size * 0.038} fill={`${c}3a`} />
        </>
      )}
    </svg>
  );
}

// ── Mood config ───────────────────────────────────────────────────────────────
const MOODS = [
  { val: 1, label: "Mal" },
  { val: 2, label: "Bof" },
  { val: 3, label: "OK" },
  { val: 4, label: "Bien" },
  { val: 5, label: "Super" },
];

// ── Sliders ───────────────────────────────────────────────────────────────────
const SLIDERS = [
  { key: "stressLevel",  label: "Stress",         emoji: "😤", color: "#a855f7", lowLabel: "Calme",    highLabel: "Stressé"   },
  { key: "anxiety",      label: "Anxiété",         emoji: "😰", color: "#818cf8", lowLabel: "Serein",   highLabel: "Anxieux"   },
  { key: "energy",       label: "Énergie",         emoji: "⚡", color: "#fbbf24", lowLabel: "À plat",  highLabel: "Chargé"    },
  { key: "focus",        label: "Concentration",   emoji: "🎯", color: "#06b6d4", lowLabel: "Dispersé", highLabel: "Focalisé" },
  { key: "social",       label: "Social",          emoji: "👥", color: "#22c55e", lowLabel: "Isolé",    highLabel: "Connecté"  },
  { key: "sleepQuality", label: "Sommeil",         emoji: "🌙", color: "#60a5fa", lowLabel: "Mauvais",  highLabel: "Reposant"  },
] as const;

type SliderKey = typeof SLIDERS[number]["key"];
type SliderValues = Record<SliderKey, number>;

// ── Emotion tags ──────────────────────────────────────────────────────────────
const EMOTION_TAGS = [
  "Calme",      "Heureux",      "Motivé",     "Reconnaissant",
  "Confiant",   "Serein",       "Anxieux",    "Stressé",
  "Fatigué",    "Irrité",       "Triste",     "Dépassé",
];

const DEFAULT_SLIDERS: SliderValues = {
  stressLevel: 5, anxiety: 5, energy: 5, focus: 5, social: 5, sleepQuality: 5,
};

// ── Mini score sparkline for summary card ─────────────────────────────────────
function ScoreSparkline({ entry }: { entry: Partial<MentalHealthEntry> }) {
  const e = entry as unknown as Record<string, number>;
  return (
    <div className="flex items-end gap-[3px]" style={{ height: 22 }}>
      {SLIDERS.map((s) => {
        const v = e[s.key] ?? 5;
        const pct = Math.max(15, (v / 10) * 100);
        return (
          <div key={s.key} className="w-[5px] rounded-sm flex-shrink-0"
            style={{ height: `${pct}%`, background: s.color, opacity: 0.75 }} />
        );
      })}
    </div>
  );
}

export default function MentalHealthWidget({ date }: Props) {
  const [entry,   setEntry]   = useState<Partial<MentalHealthEntry> | null>(null);
  const [open,    setOpen]    = useState(false);
  const [mounted, setMounted] = useState(false);

  const [mood,    setMood]    = useState(3);
  // Position on the mood circle (Halcyon-PaLaMa's "Humeur du jour" model:
  // valence × arousal). Defaults to a neutral-arousal point on the valence
  // axis so entries saved before this field existed (or pushed by the
  // Halcyon-PaLaMa automated path, which only ever sends {mood, tags}) still
  // place the ball somewhere sensible when reopened.
  const [moodPos, setMoodPos] = useState({ x: 0, y: 0 });
  const [sliders, setSliders] = useState<SliderValues>(DEFAULT_SLIDERS);
  const [tags,    setTags]    = useState<string[]>([]);
  const [note,    setNote]    = useState("");

  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const dirtyRef = useRef(false);

  useEffect(() => { setMounted(true); }, []);

  // Load existing entry
  useEffect(() => {
    dirtyRef.current = false;
    fetch(`/api/mental-health?date=${date}`)
      .then((r) => r.json())
      .then((d: { entry: MentalHealthEntry | null }) => {
        if (d.entry) {
          const e = d.entry as unknown as Record<string, number>;
          setEntry(d.entry);
          const loadedMood = e.mood ?? 3;
          setMood(loadedMood);
          setMoodPos(
            typeof e.moodX === "number" && typeof e.moodY === "number"
              ? { x: e.moodX, y: e.moodY }
              : { x: ((loadedMood - 1) / 4) * 2 - 1, y: 0 }
          );
          setSliders({
            stressLevel:  e.stressLevel  ?? 5,
            anxiety:      e.anxiety      ?? 5,
            energy:       e.energy       ?? 5,
            focus:        e.focus        ?? 5,
            social:       e.social       ?? 5,
            sleepQuality: e.sleepQuality ?? 5,
          });
          setNote(d.entry.notes ?? "");
          setTags([]);
        } else {
          setEntry(null);
          setMood(3);
          setMoodPos({ x: 0, y: 0 });
          setSliders(DEFAULT_SLIDERS);
          setTags([]);
          setNote("");
        }
      })
      .catch(() => {});
  }, [date]);

  const handleSave = useCallback(async () => {
    if (!dirtyRef.current) { setOpen(false); return; }
    setSaving(true);
    try {
      const noteParts = [note.trim(), tags.length > 0 ? `[${tags.join(", ")}]` : ""].filter(Boolean);
      const body = {
        date,
        mood,
        moodX: moodPos.x,
        moodY: moodPos.y,
        ...sliders,
        notes: noteParts.join(" ") || undefined,
      };
      const res = await fetch("/api/mental-health", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setEntry(body as Partial<MentalHealthEntry>);
        setSaved(true);
        dirtyRef.current = false;
        setTimeout(() => { setSaved(false); setOpen(false); }, 700);
      }
    } finally { setSaving(false); }
  }, [date, mood, moodPos, sliders, note, tags]);

  const handleClose = useCallback(() => {
    if (dirtyRef.current) handleSave();
    else setOpen(false);
  }, [handleSave]);

  function handleMoodCircleChange(x: number, y: number) {
    dirtyRef.current = true;
    setMoodPos({ x, y });
    setMood(moodValueFromPosition(x));
  }

  function setSlider(key: SliderKey, val: number) {
    dirtyRef.current = true;
    setSliders(prev => ({ ...prev, [key]: val }));
  }

  function toggleTag(tag: string) {
    dirtyRef.current = true;
    setTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  }

  // Summary values
  const moodEntry = entry ? (entry as unknown as Record<string, number>).mood ?? 3 : null;
  const moodObj   = moodEntry ? MOODS.find(m => m.val === moodEntry) : null;

  const modal = open && mounted && createPortal(
    <AnimatePresence>
      <motion.div
        key="mh-backdrop"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] flex items-end justify-center"
        style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(4px)" }}
        onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
      >
        <motion.div
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          transition={{ type: "spring", damping: 28, stiffness: 280 }}
          className="w-full max-w-md mx-auto rounded-t-3xl flex flex-col"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            maxHeight: "92dvh",
            borderBottom: "none",
          }}
        >
          {/* Sticky handle + header */}
          <div
            className="flex-shrink-0 px-5 pt-3 pb-4"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            <div className="flex justify-center mb-3">
              <div className="w-10 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.13)" }} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-[15px]" style={{ color: "var(--text-primary)" }}>Comment tu vas ?</p>
                <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>Bilan de la journée</p>
              </div>
              <button onClick={handleClose} className="p-2 rounded-xl"
                style={{ background: "rgba(255,255,255,0.06)" }}>
                <IconX size={13} stroke={2} style={{ color: "var(--text-muted)" }} />
              </button>
            </div>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">

            {/* ── Humeur: cercle valence × arousal (modèle Halcyon-PaLaMa) ── */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>Humeur</p>
              <div className="flex justify-center py-1">
                <MoodCircle initialX={moodPos.x} initialY={moodPos.y} onChange={handleMoodCircleChange} />
              </div>
            </div>

            {/* ── Sliders ── */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-4" style={{ color: "var(--text-muted)" }}>Indicateurs (1 → 10)</p>
              <div className="space-y-5">
                {SLIDERS.map((sl) => {
                  const val = sliders[sl.key];
                  const pct = (val - 1) / 9 * 100;
                  return (
                    <div key={sl.key}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span style={{ fontSize: 14, lineHeight: 1 }}>{sl.emoji}</span>
                          <span className="text-[12px] font-medium" style={{ color: "var(--text-primary)" }}>
                            {sl.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                            {val <= 3 ? sl.lowLabel : val >= 8 ? sl.highLabel : ""}
                          </span>
                          <span
                            className="text-[13px] font-bold tabular-nums w-5 text-right"
                            style={{ color: sl.color }}
                          >
                            {val}
                          </span>
                        </div>
                      </div>

                      {/* Track + thumb */}
                      <div className="relative h-7 flex items-center">
                        {/* Background track */}
                        <div className="absolute inset-x-0 h-[5px] rounded-full overflow-hidden"
                          style={{ background: "rgba(255,255,255,0.07)" }}>
                          <motion.div
                            className="h-full rounded-full"
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.08 }}
                            style={{ background: `linear-gradient(to right, ${sl.color}55, ${sl.color})` }}
                          />
                        </div>
                        {/* Range input overlay */}
                        <input
                          type="range"
                          min={1} max={10} step={1}
                          value={val}
                          onChange={(e) => setSlider(sl.key, Number(e.target.value))}
                          className="mh-slider"
                          style={{ "--thumb-color": sl.color } as React.CSSProperties}
                        />
                      </div>

                      <div className="flex justify-between mt-0.5">
                        {[1,2,3,4,5,6,7,8,9,10].map(n => (
                          <span key={n} className="text-[8px] tabular-nums"
                            style={{ color: n === val ? sl.color : "rgba(255,255,255,0.12)", fontWeight: n === val ? 700 : 400 }}>
                            {n}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── Emotion tags ── */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>
                Émotions du jour
                {tags.length > 0 && (
                  <span className="ml-2 normal-case font-normal" style={{ color: "#818cf8" }}>
                    {tags.length} sélectionné{tags.length > 1 ? "s" : ""}
                  </span>
                )}
              </p>
              <div className="flex flex-wrap gap-2">
                {EMOTION_TAGS.map((tag) => {
                  const on = tags.includes(tag);
                  return (
                    <motion.button
                      key={tag}
                      whileTap={{ scale: 0.92 }}
                      onClick={() => toggleTag(tag)}
                      className="px-3 py-1.5 rounded-full text-[12px] font-medium transition-all"
                      style={{
                        background: on ? "rgba(129,140,248,0.18)" : "rgba(255,255,255,0.04)",
                        color:      on ? "#818cf8" : "var(--text-secondary)",
                        border:     `1px solid ${on ? "rgba(129,140,248,0.4)" : "rgba(255,255,255,0.06)"}`,
                      }}
                    >
                      {tag}
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* ── Note ── */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>Note (optionnel)</p>
              <input
                type="text"
                value={note}
                onChange={(e) => { dirtyRef.current = true; setNote(e.target.value); }}
                placeholder="Quelque chose à noter…"
                className="w-full px-3 py-2.5 rounded-xl text-[13px] outline-none"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border:     "1px solid var(--border)",
                  color:      "var(--text-primary)",
                }}
              />
            </div>
          </div>

          {/* Sticky footer */}
          <div className="flex-shrink-0 px-5 pb-6 pt-4"
            style={{ borderTop: "1px solid var(--border)" }}>
            <button
              onClick={handleSave}
              disabled={saving || saved}
              className="btn btn-primary w-full gap-2"
              style={{ height: "44px" }}
            >
              {saved
                ? <><IconCheck size={15} stroke={2} /> Enregistré !</>
                : saving
                  ? <><IconLoader2 size={13} stroke={2} className="animate-spin" /> Sauvegarde…</>
                  : "Enregistrer"}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );

  return (
    <>
      {modal}
      <button
        onClick={() => setOpen(true)}
        className="card flex items-center gap-3 w-full text-left transition-opacity active:opacity-70"
        style={{ padding: "14px 16px" }}
      >
        {/* Mood icon */}
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{
            background: moodEntry ? `${moodColor(moodEntry)}14` : "rgba(129,140,248,0.12)",
            border: `1px solid ${moodEntry ? moodColor(moodEntry) + "30" : "rgba(129,140,248,0.2)"}`,
          }}
        >
          {moodEntry
            ? <MoodFace val={moodEntry} size={30} active />
            : (
              <svg width={20} height={20} viewBox="0 0 24 24" fill="none"
                stroke="#818cf8" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                <circle cx="9" cy="9" r="0.8" fill="#818cf8" stroke="none" />
                <circle cx="15" cy="9" r="0.8" fill="#818cf8" stroke="none" />
              </svg>
            )
          }
        </div>

        {/* Label */}
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>Santé mentale</p>
          {moodObj
            ? <p className="text-[11px]" style={{ color: moodColor(moodObj.val) }}>Humeur : {moodObj.label}</p>
            : <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Comment tu te sens ?</p>
          }
        </div>

        {/* Mini sparkline bars when entry exists */}
        {entry && <ScoreSparkline entry={entry} />}
      </button>
    </>
  );
}
