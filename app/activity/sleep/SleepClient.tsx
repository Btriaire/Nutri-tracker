"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import {
  IconChevronLeft, IconMoon, IconCircleCheck, IconTrophy, IconArrowUp, IconArrowDown, IconMinus,
  IconPlus, IconX, IconPencil, IconTrash, IconLoader2,
} from "@tabler/icons-react";
import {
  ResponsiveContainer, BarChart, Bar,
  XAxis, YAxis, Tooltip, ReferenceLine, Cell,
} from "recharts";
import { levelBarBg, levelBarClip, levelColor } from "@/app/lib/colors";
import type { SleepPoint } from "./page";

interface Props { points: SleepPoint[]; sleepGoalMin: number }

// ─── Sleep Cycle Ring ─────────────────────────────────────────────────────────

const STAGES = [
  { key: "light", label: "Léger",     emoji: "🌙", color: "#7986CB", desc: "Endormissement · rêverie" },
  { key: "deep",  label: "Profond",   emoji: "💤", color: "#3B82F6", desc: "Récupération physique" },
  { key: "rem",   label: "Paradoxal", emoji: "✨", color: "#8B5CF6", desc: "Mémoire · créativité" },
] as const;

function fmtH(min: number) {
  const h = Math.floor(min / 60), m = min % 60;
  return h > 0 ? (m > 0 ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`) : `${m}min`;
}

function sleepQualityColor(min: number, goal: number) {
  const r = min / goal;
  if (r >= 1)    return "#34A853";
  if (r >= 0.85) return "#7986CB";
  if (r >= 0.65) return "#FBBC04";
  return "#EA4335";
}

const SOURCE_LABEL: Record<string, string> = {
  withings:    "Withings",
  applehealth: "Apple Health",
  googlefit:   "Google Fit",
  manual:      "Manuel",
};

function SleepCycleRing({ light, deep, rem, totalMin, inBedMin, goalMin = 420, source, sleepScore }: {
  light: number; deep: number; rem: number;
  totalMin?: number; inBedMin?: number; goalMin?: number;
  source?: string; sleepScore?: number | null;
}) {
  const phaseTotal = light + deep + rem;
  const displayMin = totalMin ?? phaseTotal;
  if (displayMin === 0) return null;

  const hasPhases = phaseTotal > 0;

  // SVG arc geometry
  const SIZE = 180, CX = SIZE / 2, CY = SIZE / 2, R = 68, SW = 14;
  const GAP  = 0.05;
  const START = -Math.PI / 2;

  function describeArc(a0: number, a1: number) {
    const x1 = CX + R * Math.cos(a0), y1 = CY + R * Math.sin(a0);
    const x2 = CX + R * Math.cos(a1), y2 = CY + R * Math.sin(a1);
    return `M ${x1} ${y1} A ${R} ${R} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x2} ${y2}`;
  }

  // Build arc segments
  type ArcSeg = { path: string; color: string; label: string; min: number; pct: number; desc: string; emoji: string };
  const arcs: ArcSeg[] = [];

  // Total arc span based on sleep vs goal (never exceeds full circle)
  const totalSpan = Math.min(displayMin / goalMin, 1) * 2 * Math.PI;

  if (hasPhases) {
    const values = [light, deep, rem];
    let cursor = START;
    values.forEach((v, i) => {
      if (v <= 0) { cursor += (v / phaseTotal) * totalSpan; return; }
      const segSpan = (v / phaseTotal) * totalSpan;
      const span  = segSpan - GAP;
      const a0    = cursor + GAP / 2;
      const a1    = a0 + Math.max(span, 0.01);
      cursor     += segSpan;
      arcs.push({
        path:  describeArc(a0, a1),
        color: STAGES[i].color,
        label: STAGES[i].label,
        desc:  STAGES[i].desc,
        emoji: STAGES[i].emoji,
        min:   v,
        pct:   Math.round(v / phaseTotal * 100),
      });
    });
  } else {
    // Single arc proportional to goal completion
    const color = sleepQualityColor(displayMin, goalMin);
    arcs.push({
      path:  describeArc(START, START + Math.max(totalSpan - 0.01, 0.05)),
      color, label: "Sommeil", desc: "Total enregistré", emoji: "🌙",
      min: displayMin, pct: Math.round(Math.min(displayMin / goalMin, 1) * 100),
    });
  }

  const effPct = inBedMin && inBedMin > 0 ? Math.round(displayMin / inBedMin * 100) : null;
  const qualColor = sleepQualityColor(displayMin, goalMin);

  // Hypnogram wave (only when phases available)
  const W = 260, H = 34;
  let wavePath = "";
  if (hasPhases) {
    const deepR = deep / phaseTotal, remR = rem / phaseTotal;
    const cycles = 4;
    const pts: string[] = [];
    for (let i = 0; i <= cycles * 4; i++) {
      const x = (i / (cycles * 4)) * W;
      const ph = i % 4;
      const y = ph === 1 ? H * (0.35 + deepR * 0.5)
              : ph === 3 ? H * (0.08 + remR  * 0.5)
              : H * 0.2;
      pts.push(`${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`);
    }
    wavePath = pts.join(" ");
  }

  return (
    <div className="space-y-4">
      <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
        {hasPhases ? "Cycle de sommeil" : "Nuit analysée"}
      </p>

      {/* Ring + cards */}
      <div className="flex items-center gap-4">

        {/* SVG Ring */}
        <div className="relative flex-shrink-0" style={{ width: SIZE, height: SIZE }}>
          {/* Track */}
          <svg width={SIZE} height={SIZE} style={{ position: "absolute", inset: 0 }}>
            <circle cx={CX} cy={CY} r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={SW} />
          </svg>
          {/* Glow */}
          <svg width={SIZE} height={SIZE} style={{ position: "absolute", inset: 0, filter: "blur(7px)" }}>
            {arcs.map((a, i) => (
              <path key={i} d={a.path} fill="none" stroke={a.color} strokeWidth={SW + 4}
                strokeLinecap="round" opacity={0.3} />
            ))}
          </svg>
          {/* Arcs */}
          <svg width={SIZE} height={SIZE} style={{ position: "absolute", inset: 0 }}>
            {arcs.map((a, i) => (
              <motion.path key={i} d={a.path} fill="none"
                stroke={a.color} strokeWidth={SW} strokeLinecap="round"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 1.1, delay: 0.15 + i * 0.12, ease: [0.16, 1, 0.3, 1] }}
              />
            ))}
          </svg>
          {/* Center */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
            <span style={{ fontSize: 26 }}>😴</span>
            <p className="text-[20px] font-bold tabular-nums leading-none" style={{ color: qualColor }}>
              {fmtH(displayMin)}
            </p>
            <p className="text-[9px] uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
              {effPct ? `${effPct}% eff.` : `/${fmtH(goalMin)}`}
            </p>
          </div>
        </div>

        {/* Phase / quality cards */}
        <div className="flex flex-col gap-2 flex-1 min-w-0">
          {hasPhases ? arcs.map((a, i) => (
            <motion.div key={i}
              initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.35, delay: 0.35 + i * 0.08 }}
              className="px-2.5 py-2 rounded-xl"
              style={{ background: `${a.color}0e`, border: `1px solid ${a.color}25` }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: a.color, boxShadow: `0 0 4px ${a.color}` }} />
                  <span className="text-[11px] font-semibold" style={{ color: a.color }}>{a.label}</span>
                </div>
                <span className="text-[13px] font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>
                  {fmtH(a.min)}
                </span>
              </div>
              <div className="flex items-center justify-between mt-0.5">
                <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>{a.desc}</span>
                <span className="text-[10px] font-medium" style={{ color: a.color }}>{a.pct}%</span>
              </div>
              <div className="mt-1.5 h-0.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                <motion.div className="h-full rounded-full" style={{ background: a.color }}
                  initial={{ width: 0 }} animate={{ width: `${a.pct}%` }}
                  transition={{ duration: 0.8, delay: 0.5 + i * 0.08, ease: [0.16, 1, 0.3, 1] }} />
              </div>
            </motion.div>
          )) : (
            /* No phase data — show quality metrics instead */
            <>
              {[
                { label: "Durée", val: fmtH(displayMin), color: qualColor },
                { label: "Au lit", val: inBedMin ? fmtH(inBedMin) : "—", color: "rgba(255,255,255,0.5)" },
                { label: "Objectif", val: fmtH(goalMin), color: "var(--text-muted)" },
              ].map(({ label, val, color }) => (
                <motion.div key={label}
                  initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.35, delay: 0.3 }}
                  className="px-2.5 py-2.5 rounded-xl"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <p className="text-[9px] mb-0.5" style={{ color: "var(--text-muted)" }}>{label}</p>
                  <p className="text-[16px] font-bold leading-none tabular-nums" style={{ color }}>{val}</p>
                </motion.div>
              ))}
              <p className="text-[9px] leading-relaxed px-1" style={{ color: "var(--text-muted)" }}>
                {source === "withings"
                  ? "Phases non disponibles · ScanWatch ou Sleep Analyzer requis"
                  : source === "applehealth"
                    ? "Phases non disponibles · active la détection dans Santé"
                    : "Phases non disponibles · ton tracker ne les remonte pas dans Google Fit"}
              </p>
            </>
          )}
        </div>
      </div>

      {/* Hypnogram (only when phases exist) */}
      {hasPhases && wavePath && (
        <div className="rounded-xl px-3 py-2.5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[9px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Hypnogramme · cycles estimés</p>
            <div className="flex items-center gap-2.5">
              {STAGES.map(s => (
                <div key={s.key} className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />
                  <span className="text-[8px]" style={{ color: "var(--text-muted)" }}>{s.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <div className="flex flex-col justify-between text-right flex-shrink-0" style={{ width: 32 }}>
              <span className="text-[7px]" style={{ color: "rgba(121,134,203,0.55)" }}>Léger</span>
              <span className="text-[7px]" style={{ color: "rgba(59,130,246,0.55)" }}>Profond</span>
            </div>
            <svg width="100%" height={H + 6} viewBox={`0 0 ${W} ${H + 6}`} preserveAspectRatio="none">
              <defs>
                <linearGradient id="waveGrad2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"  stopColor="#7986CB" stopOpacity="0.2" />
                  <stop offset="60%" stopColor="#8B5CF6" stopOpacity="0.1" />
                  <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.04" />
                </linearGradient>
                <linearGradient id="waveStroke2" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%"   stopColor="#7986CB" />
                  <stop offset="45%"  stopColor="#3B82F6" />
                  <stop offset="75%"  stopColor="#8B5CF6" />
                  <stop offset="100%" stopColor="#7986CB" />
                </linearGradient>
              </defs>
              <rect x={0} y={0}         width={W} height={H * 0.26} fill="rgba(121,134,203,0.04)" />
              <rect x={0} y={H * 0.26}  width={W} height={H * 0.42} fill="rgba(139,92,246,0.04)" />
              <rect x={0} y={H * 0.68}  width={W} height={H * 0.32} fill="rgba(59,130,246,0.05)" />
              <motion.path d={`${wavePath} L ${W} ${H + 6} L 0 ${H + 6} Z`}
                fill="url(#waveGrad2)"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.9 }} />
              <motion.path d={wavePath} fill="none"
                stroke="url(#waveStroke2)" strokeWidth="1.5" strokeLinejoin="round"
                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                transition={{ duration: 1.4, delay: 0.7, ease: "easeInOut" }} />
            </svg>
          </div>
          <p className="text-[8px] text-center mt-1" style={{ color: "var(--text-muted)" }}>
            Cycles NREM / REM simulés à partir des proportions
          </p>
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        {source && (
          <span className="text-[9px] px-1.5 py-0.5 rounded-full"
            style={{ background: source === "withings" ? "rgba(52,211,153,0.08)" : "rgba(255,255,255,0.05)", color: source === "withings" ? "#34d399" : "var(--text-muted)", border: `1px solid ${source === "withings" ? "rgba(52,211,153,0.2)" : "var(--border)"}` }}>
            {source === "withings" ? "🛏" : source === "applehealth" ? "🍎" : source === "googlefit" ? "💚" : "✏️"} {SOURCE_LABEL[source] ?? source}
          </span>
        )}
        {sleepScore != null && (
          <span className="text-[9px] px-1.5 py-0.5 rounded-full"
            style={{ background: "rgba(99,102,241,0.08)", color: "#818cf8", border: "1px solid rgba(99,102,241,0.2)" }}>
            Score {sleepScore}/100
          </span>
        )}
        {hasPhases && (
          <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>Total phases {fmtH(phaseTotal)}</span>
        )}
        {inBedMin != null && (
          <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>Au lit {fmtH(inBedMin)}</span>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

const RANGES = [
  { label: "7J",  days: 7  },
  { label: "14J", days: 14 },
  { label: "30J", days: 30 },
] as const;

const ease = [0.16, 1, 0.3, 1] as [number, number, number, number];
const fade = (delay = 0) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, ease, delay },
});

function sleepColor(min: number | null, goal: number): string {
  if (!min) return "rgba(255,255,255,0.12)";
  return levelColor(min / goal);
}

function fmtSleep(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

// ─── Manual entry modal ───────────────────────────────────────────────────────

interface ModalProps {
  date: string;
  current: number | null;
  onClose: () => void;
  onSaved: (date: string, min: number | null) => void;
}

function SleepEntryModal({ date, current, onClose, onSaved }: ModalProps) {
  const initH = current != null ? Math.floor(current / 60) : 7;
  const initM = current != null ? current % 60 : 0;
  const initTotal = initH * 60 + initM;

  const [hours,    setHours]    = useState(initH);
  const [minutes,  setMinutes]  = useState(initM);
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);
  const [deleting, setDeleting] = useState(false);

  const totalMin       = hours * 60 + minutes;
  // "changed" = user has moved away from the initial value
  const changed        = totalMin !== initTotal;
  const debounceRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track what's actually saved in Firestore (undefined = nothing saved yet this session)
  const lastSavedRef   = useRef<number | undefined>(current ?? undefined);
  // Only start debouncing after the user's first interaction
  const interactedRef  = useRef(false);
  // Always-current ref so the unmount effect can read latest value
  const totalMinRef    = useRef(totalMin);
  useEffect(() => { totalMinRef.current = totalMin; });

  // Auto-save helper — robust: only marks saved AFTER successful fetch
  async function doSave(min: number) {
    if (min < 1) return;
    if (min === lastSavedRef.current) return;   // already persisted
    try {
      setSaving(true);
      const res = await fetch("/api/sleep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, sleepMinutes: min }),
      });
      if (res.ok) {
        lastSavedRef.current = min;             // only on success
        setSaved(true);
        onSaved(date, min);
      }
    } catch { /* network error — will retry on next close */ }
    finally { setSaving(false); }
  }

  // Debounce auto-save on every H/M change (700ms) — only after first interaction
  useEffect(() => {
    if (!interactedRef.current || totalMin < 1) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { doSave(totalMin); }, 700);
    return () => { if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null; } };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hours, minutes]);

  // Fire-and-forget save on unmount (handles navigation away without closing the modal)
  useEffect(() => {
    return () => {
      const min = totalMinRef.current;
      if (interactedRef.current && min >= 1 && min !== lastSavedRef.current) {
        fetch("/api/sleep", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date, sleepMinutes: min }),
        }).catch(() => {});
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Called when user touches H or M
  function markInteracted() { interactedRef.current = true; }

  // Preset click → cancel debounce, save immediately, close
  async function handlePreset(min: number) {
    if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null; }
    interactedRef.current = true;
    setHours(Math.floor(min / 60));
    setMinutes(min % 60);
    await doSave(min);
    onClose();
  }

  // Close (X button or backdrop) → always save if changed
  async function handleClose() {
    if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null; }
    if (changed && totalMin >= 1) await doSave(totalMin);
    onClose();
  }

  async function remove() {
    setDeleting(true);
    await fetch(`/api/sleep?date=${date}`, { method: "DELETE" });
    setDeleting(false);
    onSaved(date, null);
    onClose();
  }

  const label = format(parseISO(date), "EEEE dd MMM", { locale: fr });

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-end justify-center"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={handleClose}
        style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      >
        <motion.div
          className="w-full max-w-md rounded-t-2xl p-6"
          initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 34 }}
          onClick={e => e.stopPropagation()}
          style={{ background: "var(--surface-elevated, #1a1a24)", border: "1px solid var(--border)" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-[15px] font-semibold capitalize">{label}</p>
              <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                {saved ? "✓ Enregistré" : saving ? "Enregistrement…" : current ? "Modifier · sauvegarde auto" : "Sauvegarde automatique"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {current && (
                <button onClick={remove} disabled={deleting}
                  className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
                  style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>
                  {deleting ? <IconLoader2 size={13} className="animate-spin" /> : <IconTrash size={13} />}
                </button>
              )}
              <button onClick={handleClose}
                className="w-8 h-8 flex items-center justify-center rounded-lg"
                style={{ background: "var(--surface)", color: "var(--text-muted)" }}>
                {saving ? <IconLoader2 size={14} className="animate-spin" /> : <IconX size={16} />}
              </button>
            </div>
          </div>

          {/* Time pickers */}
          <div className="flex items-center justify-center gap-4 mb-6">
            {/* Hours */}
            <div className="flex flex-col items-center gap-2">
              <button onClick={() => { markInteracted(); setHours(h => Math.min(h + 1, 14)); }}
                className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold transition-colors"
                style={{ background: "var(--surface)", color: "var(--text-primary)" }}>▲</button>
              <div className="w-20 h-14 rounded-2xl flex flex-col items-center justify-center"
                style={{ background: "rgba(121,134,203,0.12)", border: "1px solid rgba(121,134,203,0.3)" }}>
                <span className="text-[28px] font-bold tabular-nums" style={{ color: "#7986CB" }}>{hours}</span>
                <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>heures</span>
              </div>
              <button onClick={() => { markInteracted(); setHours(h => Math.max(h - 1, 0)); }}
                className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold transition-colors"
                style={{ background: "var(--surface)", color: "var(--text-primary)" }}>▼</button>
            </div>

            <span className="text-[32px] font-bold mb-4" style={{ color: "var(--text-muted)" }}>:</span>

            {/* Minutes */}
            <div className="flex flex-col items-center gap-2">
              <button onClick={() => { markInteracted(); setMinutes(m => m >= 45 ? 0 : m + 15); }}
                className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold transition-colors"
                style={{ background: "var(--surface)", color: "var(--text-primary)" }}>▲</button>
              <div className="w-20 h-14 rounded-2xl flex flex-col items-center justify-center"
                style={{ background: "rgba(121,134,203,0.12)", border: "1px solid rgba(121,134,203,0.3)" }}>
                <span className="text-[28px] font-bold tabular-nums" style={{ color: "#7986CB" }}>{String(minutes).padStart(2, "0")}</span>
                <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>min</span>
              </div>
              <button onClick={() => { markInteracted(); setMinutes(m => m === 0 ? 45 : m - 15); }}
                className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold transition-colors"
                style={{ background: "var(--surface)", color: "var(--text-primary)" }}>▼</button>
            </div>
          </div>

          {/* Quick presets — tap to save instantly */}
          <p className="text-[10px] text-center mb-2" style={{ color: "var(--text-muted)" }}>
            Sélectionne une durée → sauvegarde instantanée
          </p>
          <div className="flex gap-2 mb-5 flex-wrap justify-center">
            {[360, 390, 420, 450, 480, 510].map(min => (
              <button key={min}
                onClick={() => handlePreset(min)}
                className="px-3 py-1.5 rounded-full text-[11px] font-medium transition-all"
                style={{
                  background: totalMin === min ? "rgba(121,134,203,0.25)" : "var(--surface)",
                  color:      totalMin === min ? "#7986CB" : "var(--text-muted)",
                  border:     totalMin === min ? "1px solid rgba(121,134,203,0.5)" : "1px solid transparent",
                }}>
                {fmtSleep(min)}
              </button>
            ))}
          </div>

          {/* Confirm strip — only shown when H/M changed and not a preset */}
          {changed && totalMin >= 1 && (
            <motion.div
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{ background: "rgba(121,134,203,0.1)", border: "1px solid rgba(121,134,203,0.25)" }}>
              <IconMoon size={14} style={{ color: "#7986CB" }} />
              <span className="flex-1 text-[12px]" style={{ color: "#7986CB" }}>
                {fmtSleep(totalMin)} · {saving ? "enregistrement…" : saved ? "✓ enregistré" : "sauvegarde auto"}
              </span>
              {saving && <IconLoader2 size={13} className="animate-spin" style={{ color: "#7986CB" }} />}
            </motion.div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SleepClient({ points: initialPoints, sleepGoalMin }: Props) {
  const [points,    setPoints]    = useState(initialPoints);
  const [rangeDays, setRangeDays] = useState<7 | 14 | 30>(30);
  const [modal,     setModal]     = useState<{ date: string; current: number | null } | null>(null);

  // Update a point locally after save
  const handleSaved = useCallback((date: string, min: number | null) => {
    setPoints(prev => prev.map(p => p.date === date ? { ...p, sleepMinutes: min } : p));
  }, []);

  const visible  = points.slice(-rangeDays);
  const withData = visible.filter(p => p.sleepMinutes != null && p.sleepMinutes > 0);
  const goalH    = Math.round(sleepGoalMin / 60 * 10) / 10;

  // Stats
  const avgMin   = withData.length ? Math.round(withData.reduce((s, p) => s + p.sleepMinutes!, 0) / withData.length) : 0;
  const maxPoint = withData.length ? withData.reduce((a, b) => b.sleepMinutes! > a.sleepMinutes! ? b : a) : null;
  const goalDays = withData.filter(p => p.sleepMinutes! >= sleepGoalMin).length;

  // Streak
  let streak = 0;
  for (let i = points.length - 1; i >= 0; i--) {
    const p = points[i];
    if (p.sleepMinutes != null && p.sleepMinutes >= sleepGoalMin) streak++;
    else if (p.sleepMinutes != null) break;
  }

  // Weekly trend
  const last7  = points.slice(-7).filter(p => p.sleepMinutes != null && p.sleepMinutes > 0);
  const prev7  = points.slice(-14, -7).filter(p => p.sleepMinutes != null && p.sleepMinutes > 0);
  const avg7   = last7.length ? Math.round(last7.reduce((s, p) => s + p.sleepMinutes!, 0) / last7.length) : 0;
  const avgP7  = prev7.length ? Math.round(prev7.reduce((s, p) => s + p.sleepMinutes!, 0) / prev7.length) : 0;
  const trendDiff = avg7 - avgP7;

  // Chart data
  const chartData = visible.map(p => ({
    label:    format(parseISO(p.date), "dd/MM"),
    sleepH:   p.sleepMinutes != null && p.sleepMinutes > 0 ? Math.round(p.sleepMinutes / 60 * 100) / 100 : null,
    sleepMin: p.sleepMinutes,
    date:     p.date,
  }));

  // Most recent sleep for hypnogram
  // Most recent night with sleep data — ring shows phases if available, single arc if not
  const lastSleep = [...points].reverse().find(p => p.sleepMinutes != null && p.sleepMinutes > 0);

  // Today's date string
  const today = format(new Date(), "yyyy-MM-dd");

  return (
    <div className="min-h-screen" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 80px)" }}>
      {/* Header */}
      <div className="sticky top-0 z-20 flex items-center gap-3 px-4 py-3"
        style={{ background: "var(--nav-bg)", borderBottom: "1px solid var(--nav-border)", backdropFilter: "blur(16px)" }}>
        <Link href="/dashboard" className="flex items-center justify-center w-8 h-8 rounded-lg"
          style={{ background: "var(--surface)" }}>
          <IconChevronLeft size={16} style={{ color: "var(--text-secondary)" }} />
        </Link>
        <div className="flex items-center gap-2 flex-1">
          <IconMoon size={18} style={{ color: "#7986CB" }} />
          <span className="text-[15px] font-semibold">Sommeil</span>
        </div>
        {/* Add today */}
        <button
          onClick={() => setModal({ date: today, current: points.find(p => p.date === today)?.sleepMinutes ?? null })}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all"
          style={{ background: "rgba(121,134,203,0.15)", color: "#7986CB", border: "1px solid rgba(121,134,203,0.3)" }}>
          <IconPlus size={13} />
          Saisir
        </button>
      </div>

      <div className="px-4 pt-4 space-y-4 md:ml-[220px]">

        {/* Hero card */}
        <motion.div {...fade(0)} className="glass p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-[11px] font-medium mb-1" style={{ color: "var(--text-muted)" }}>Moyenne sur {rangeDays} jours</p>
              <div className="flex items-end gap-2 leading-none">
                <span className="text-[38px] font-bold tracking-tight"
                  style={{ color: avgMin ? "var(--text-primary)" : "var(--text-muted)" }}>
                  {avgMin ? fmtSleep(avgMin) : "—"}
                </span>
                <span className="text-[13px] mb-1.5" style={{ color: "var(--text-muted)" }}>/ {goalH}h objectif</span>
              </div>
            </div>
            {avgP7 > 0 && (
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium"
                style={{ background: trendDiff >= 0 ? "rgba(52,168,83,0.1)" : "rgba(239,68,68,0.1)", color: trendDiff >= 0 ? "#34A853" : "#ef4444" }}>
                {trendDiff >= 0 ? <IconArrowUp size={11} /> : <IconArrowDown size={11} />}
                {fmtSleep(Math.abs(trendDiff))} vs sem. préc.
              </div>
            )}
          </div>
          <div className="w-full h-2.5 rounded-full overflow-hidden mb-2" style={{ background: "rgba(255,255,255,0.06)" }}>
            <motion.div className="h-full rounded-full w-full"
              style={{ background: avgMin ? levelBarBg(avgMin / sleepGoalMin) : "rgba(255,255,255,0.06)" }}
              initial={{ clipPath: "inset(0 100% 0 0)" }}
              animate={{ clipPath: levelBarClip(avgMin ? avgMin / sleepGoalMin : 0) }}
              transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
          <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
            {avgMin >= sleepGoalMin
              ? `✓ Objectif atteint en moyenne sur ${rangeDays}j`
              : avgMin > 0
                ? `${fmtSleep(sleepGoalMin - avgMin)} de moins que l'objectif`
                : "Aucune donnée — saisis ta première nuit ↗"}
          </p>
        </motion.div>

        {/* Stats grid */}
        <motion.div {...fade(0.05)} className="grid grid-cols-2 gap-3">
          <div className="glass p-4 flex flex-col gap-1">
            <span className="text-[10px] font-medium" style={{ color: "var(--text-muted)" }}>Record</span>
            <div className="flex items-center gap-1.5">
              <IconTrophy size={14} style={{ color: "#FBBC04" }} />
              <span className="text-[18px] font-bold">{maxPoint ? fmtSleep(maxPoint.sleepMinutes!) : "—"}</span>
            </div>
            {maxPoint && (
              <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                {format(parseISO(maxPoint.date), "dd MMM", { locale: fr })}
              </span>
            )}
          </div>
          <div className="glass p-4 flex flex-col gap-1">
            <span className="text-[10px] font-medium" style={{ color: "var(--text-muted)" }}>Objectif atteint</span>
            <div className="flex items-center gap-1.5">
              <IconCircleCheck size={14} style={{ color: "#34A853" }} />
              <span className="text-[18px] font-bold">{goalDays} <span className="text-[12px] font-normal" style={{ color: "var(--text-muted)" }}>/ {withData.length}j</span></span>
            </div>
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
              {withData.length ? `${Math.round(goalDays / withData.length * 100)}% du temps` : "Aucune donnée"}
            </span>
          </div>
          <div className="glass p-4 flex flex-col gap-1">
            <span className="text-[10px] font-medium" style={{ color: "var(--text-muted)" }}>Série en cours</span>
            <span className="text-[18px] font-bold">{streak} <span className="text-[12px] font-normal" style={{ color: "var(--text-muted)" }}>nuits</span></span>
            <span className="text-[10px]" style={{ color: streak >= 3 ? "#34A853" : "var(--text-muted)" }}>
              {streak >= 7 ? "🔥 Excellente semaine !" : streak >= 3 ? "Bonne régularité" : "Continue !"}
            </span>
          </div>
          <div className="glass p-4 flex flex-col gap-1">
            <span className="text-[10px] font-medium" style={{ color: "var(--text-muted)" }}>Tendance 7j</span>
            <div className="flex items-center gap-1.5">
              {avg7 && avgP7 ? (trendDiff > 0 ? <IconArrowUp size={12} style={{ color: "#34A853" }} /> : trendDiff < 0 ? <IconArrowDown size={12} style={{ color: "#ef4444" }} /> : <IconMinus size={12} style={{ color: "var(--text-muted)" }} />) : null}
              <span className="text-[18px] font-bold">{avg7 ? fmtSleep(avg7) : "—"}</span>
            </div>
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
              {avgP7 ? `vs ${fmtSleep(avgP7)} sem. préc.` : "Pas assez de données"}
            </span>
          </div>
        </motion.div>

        {/* Bar chart */}
        <motion.div {...fade(0.1)} className="glass p-4">
          <div className="flex items-center justify-between mb-4">
            <p className="label-xs">Historique</p>
            <div className="flex gap-1">
              {RANGES.map(r => (
                <button key={r.days}
                  onClick={() => setRangeDays(r.days as 7 | 14 | 30)}
                  className="px-2.5 py-1 rounded-md text-[11px] font-medium transition-all"
                  style={{
                    background: rangeDays === r.days ? "rgba(121,134,203,0.2)" : "transparent",
                    color:      rangeDays === r.days ? "#7986CB" : "var(--text-muted)",
                    border:     rangeDays === r.days ? "1px solid rgba(121,134,203,0.4)" : "1px solid transparent",
                  }}>
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barSize={rangeDays === 30 ? 6 : rangeDays === 14 ? 10 : 20}>
              <XAxis dataKey="label" tick={{ fontSize: 8, fill: "var(--text-muted)" }} tickLine={false} axisLine={false}
                interval={rangeDays === 30 ? 4 : rangeDays === 14 ? 1 : 0} />
              <YAxis domain={[0, Math.max(10, goalH + 1)]} tick={{ fontSize: 8, fill: "var(--text-muted)" }} tickLine={false} axisLine={false}
                width={24} tickCount={5} tickFormatter={v => `${v}h`} />
              <ReferenceLine y={goalH} stroke="rgba(121,134,203,0.4)" strokeDasharray="4 4" />
              <Tooltip
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const v = payload[0]?.payload?.sleepMin as number | null;
                  return (
                    <div className="px-2.5 py-2 rounded-lg text-[11px]"
                      style={{ background: "rgba(13,13,17,0.96)", border: "1px solid var(--border)" }}>
                      <p style={{ color: "var(--text-muted)" }}>{label}</p>
                      <p className="font-bold" style={{ color: "#7986CB" }}>{v ? fmtSleep(v) : "—"}</p>
                      {v && <p style={{ color: "var(--text-muted)" }}>{Math.round(v / sleepGoalMin * 100)}% objectif</p>}
                    </div>
                  );
                }}
              />
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <Bar dataKey="sleepH" radius={[3, 3, 0, 0]} onClick={(d: any) => setModal({ date: d.date as string, current: d.sleepMin as number | null })}>
                {chartData.map((d, i) => (
                  <Cell key={i} fill={sleepColor(d.sleepMin, sleepGoalMin)} fillOpacity={d.sleepMin ? 0.85 : 0.3} style={{ cursor: "pointer" }} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          <div className="flex items-center gap-3 mt-2 justify-center">
            {[
              { label: `≥ ${goalH}h`, color: "#34A853" },
              { label: `≥ ${Math.round(goalH * 0.8 * 10)/10}h`, color: "#7986CB" },
              { label: `≥ ${Math.round(goalH * 0.6 * 10)/10}h`, color: "#FBBC04" },
              { label: "Insuffisant", color: "#ef4444" },
            ].map(l => (
              <div key={l.label} className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full" style={{ background: l.color }} />
                <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>{l.label}</span>
              </div>
            ))}
          </div>
          <p className="text-[9px] text-center mt-1.5" style={{ color: "var(--text-muted)" }}>
            Appuie sur une barre pour modifier
          </p>
        </motion.div>

        {/* Dernière nuit — hypnogram + phases */}
        {lastSleep && (
          <motion.div {...fade(0.15)} className="glass p-4 space-y-4">
            <div className="flex items-center justify-between">
              <p className="label-xs">Dernière nuit analysée</p>
              <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                {format(parseISO(lastSleep.date), "dd MMM", { locale: fr })}
              </span>
            </div>

            {/* Key metrics row */}
            <div className="grid grid-cols-3 gap-2">
              {/* Sleep total */}
              <div className="rounded-xl p-2.5 text-center"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <p className="text-[9px] mb-1" style={{ color: "var(--text-muted)" }}>Endormi</p>
                <p className="text-[16px] font-bold leading-none" style={{ color: "#7986CB" }}>
                  {lastSleep.sleepMinutes ? fmtSleep(lastSleep.sleepMinutes) : "—"}
                </p>
              </div>
              {/* Sleep score (Withings) or time in bed (GFit) */}
              {lastSleep.sleepScore != null ? (
                <div className="rounded-xl p-2.5 text-center"
                  style={{ background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.15)" }}>
                  <p className="text-[9px] mb-1" style={{ color: "var(--text-muted)" }}>Score</p>
                  <p className="text-[16px] font-bold leading-none" style={{ color: "#818cf8" }}>
                    {lastSleep.sleepScore}<span className="text-[10px] font-normal">/100</span>
                  </p>
                </div>
              ) : (
                <div className="rounded-xl p-2.5 text-center"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <p className="text-[9px] mb-1" style={{ color: "var(--text-muted)" }}>Au lit</p>
                  <p className="text-[16px] font-bold leading-none" style={{ color: "rgba(255,255,255,0.5)" }}>
                    {lastSleep.timeInBedMinutes ? fmtSleep(lastSleep.timeInBedMinutes) : "—"}
                  </p>
                </div>
              )}
              {/* Efficiency */}
              <div className="rounded-xl p-2.5 text-center"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <p className="text-[9px] mb-1" style={{ color: "var(--text-muted)" }}>Efficacité</p>
                <p className="text-[16px] font-bold leading-none" style={{ color: "#34d399" }}>
                  {lastSleep.timeInBedMinutes && lastSleep.sleepMinutes
                    ? `${Math.round(lastSleep.sleepMinutes / lastSleep.timeInBedMinutes * 100)}%`
                    : "—"}
                </p>
              </div>
            </div>

            {/* Sleep stages — arc ring (always shown when sleep data exists) */}
            <SleepCycleRing
              light={lastSleep.lightSleepMin ?? 0}
              deep={lastSleep.deepSleepMin ?? 0}
              rem={lastSleep.remSleepMin ?? 0}
              totalMin={lastSleep.sleepMinutes ?? undefined}
              inBedMin={lastSleep.timeInBedMinutes ?? undefined}
              goalMin={sleepGoalMin}
              source={lastSleep.source}
              sleepScore={lastSleep.sleepScore}
            />

          </motion.div>
        )}

        {/* Daily log */}
        {visible.length > 0 && (
          <motion.div {...fade(0.2)} className="glass p-4">
            <p className="label-xs mb-3">Détail quotidien</p>
            <div className="space-y-0">
              {[...visible].reverse().map(p => {
                const min   = p.sleepMinutes;
                const color = sleepColor(min, sleepGoalMin);
                const pct   = min ? Math.round(min / sleepGoalMin * 100) : 0;
                return (
                  <button key={p.date}
                    onClick={() => setModal({ date: p.date, current: min ?? null })}
                    className="w-full flex items-center gap-3 py-2 transition-opacity active:opacity-60"
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <span className="text-[11px] w-[52px] flex-shrink-0 text-left" style={{ color: "var(--text-muted)" }}>
                      {format(parseISO(p.date), "dd MMM", { locale: fr })}
                    </span>
                    <div className="flex items-center gap-1.5 w-[72px]">
                      {min
                        ? <><IconMoon size={11} style={{ color }} /><span className="text-[13px] font-semibold" style={{ color }}>{fmtSleep(min)}</span></>
                        : <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>— saisir</span>
                      }
                    </div>
                    <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                      {min ? <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, background: color }} /> : null}
                    </div>
                    <div className="flex items-center gap-1.5 w-[56px] justify-end flex-shrink-0">
                      {(p.lightSleepMin || p.deepSleepMin || p.remSleepMin) ? (
                        <div className="flex items-center gap-0.5">
                          {p.lightSleepMin  && <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#7986CB" }} />}
                          {p.deepSleepMin   && <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#3B82F6" }} />}
                          {p.remSleepMin    && <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#8B5CF6" }} />}
                        </div>
                      ) : min
                        ? <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{pct}%</span>
                        : <IconPencil size={11} style={{ color: "var(--text-muted)" }} />
                      }
                    </div>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Empty state */}
        {withData.length === 0 && (
          <motion.div {...fade(0.1)} className="glass p-8 flex flex-col items-center gap-4 text-center">
            <IconMoon size={36} style={{ color: "var(--text-muted)" }} />
            <div>
              <p className="text-[14px] font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>Aucune donnée de sommeil</p>
              <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                Withings se synchronise automatiquement,<br />ou saisis ta durée manuellement.
              </p>
            </div>
            <button
              onClick={() => setModal({ date: today, current: null })}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-[13px] transition-all"
              style={{ background: "rgba(121,134,203,0.2)", color: "#7986CB", border: "1px solid rgba(121,134,203,0.4)" }}>
              <IconPlus size={15} />
              Saisir la nuit dernière
            </button>
          </motion.div>
        )}

      </div>

      {/* Modal */}
      {modal && (
        <SleepEntryModal
          date={modal.date}
          current={modal.current}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
