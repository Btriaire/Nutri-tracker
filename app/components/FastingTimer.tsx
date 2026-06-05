"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { IntermittentFasting } from "@/app/lib/types";
import type { FastingSession } from "@/app/api/fasting/route";

interface Props {
  date:           string;
  fastingConfig?: IntermittentFasting;
}

// ── Time helpers ──────────────────────────────────────────────────────────────
function pad(n: number) { return String(n).padStart(2, "0"); }

function fmtMs(ms: number): string {
  const totalS = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalS / 3600);
  const m = Math.floor((totalS % 3600) / 60);
  const s = totalS % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

/** Current local time as "HH:MM" */
function nowHHMM(): string {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Timestamp → "HH:MM" */
function msToHHMM(ms: number): string {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Convert "HH:MM" on a given date string (YYYY-MM-DD) to a Unix ms timestamp.
 * If the resulting time is in the future by > 1 min, assume it was yesterday
 * (e.g. user started a 16h fast the evening before).
 */
function hhmmToMs(dateStr: string, time: string): number {
  const [h, m] = time.split(":").map(Number);
  const d = new Date(dateStr + "T00:00:00");
  d.setHours(h, m, 0, 0);
  let ms = d.getTime();
  // If the time is more than 1 minute in the future, shift back one day
  if (ms > Date.now() + 60_000) ms -= 86_400_000;
  return ms;
}

function ringColor(pct: number): string {
  if (pct >= 0.9) return "#22c55e";
  if (pct >= 0.6) return "#fbbf24";
  if (pct >= 0.3) return "#f97316";
  return "#818cf8";
}

// ── Inline time editor (used both before start and while active) ──────────────
function TimeEditor({
  value,
  onChange,
  onConfirm,
  onCancel,
  label,
  saving,
}: {
  value:     string;
  onChange:  (v: string) => void;
  onConfirm: () => void;
  onCancel?: () => void;
  label:     string;
  saving:    boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] uppercase tracking-widest flex-shrink-0" style={{ color: "var(--text-muted)" }}>
        {label}
      </span>
      <input
        type="time"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="rounded-lg px-2 py-1 text-[13px] font-semibold tabular-nums outline-none"
        style={{
          background:  "rgba(129,140,248,0.12)",
          border:      "1px solid rgba(129,140,248,0.35)",
          color:       "#818cf8",
          fontFamily:  "monospace",
          minWidth:    0,
        }}
      />
      <button
        onClick={onConfirm}
        disabled={saving}
        className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-[13px]"
        style={{ background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)" }}
        title="Confirmer"
      >
        {saving ? "…" : "✓"}
      </button>
      {onCancel && (
        <button
          onClick={onCancel}
          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-[12px]"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)" }}
          title="Annuler"
        >
          ✕
        </button>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function FastingTimer({ date, fastingConfig }: Props) {
  const [session,    setSession]   = useState<FastingSession | null | "loading">("loading");
  const [now,        setNow]       = useState(() => Date.now());
  const [starting,   setStarting]  = useState(false);
  const [stopping,   setStopping]  = useState(false);
  const [updating,   setUpdating]  = useState(false);

  // Time picker states
  const [startTime,  setStartTime] = useState<string>(nowHHMM);
  const [editingStart, setEditingStart] = useState(false);
  const [editTime,   setEditTime]  = useState<string>("");

  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Is today a fasting day?
  const todayDow    = new Date(date + "T12:00:00").getDay();
  const isFastingDay = !!(fastingConfig?.enabled && fastingConfig.days.includes(todayDow));

  // Load session
  useEffect(() => {
    if (!isFastingDay) return;
    fetch(`/api/fasting?date=${date}`)
      .then(r => r.json())
      .then((d: { session: FastingSession | null }) => setSession(d.session))
      .catch(() => setSession(null));
  }, [date, isFastingDay]);

  // Tick every second while active
  useEffect(() => {
    if (session && session !== "loading" && session.active && session.startedAtMs) {
      tickRef.current = setInterval(() => setNow(Date.now()), 1000);
    } else {
      if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
    }
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [session]);

  const handleStart = useCallback(async () => {
    if (!fastingConfig) return;
    setStarting(true);
    try {
      const startedAtMs = hhmmToMs(date, startTime);
      const res = await fetch("/api/fasting", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          date, action: "start",
          durationH:   fastingConfig.durationH,
          startedAtMs,
        }),
      });
      const data = await res.json() as { ok: boolean; session: FastingSession };
      if (data.ok) setSession(data.session);
    } finally { setStarting(false); }
  }, [date, fastingConfig, startTime]);

  const handleStop = useCallback(async () => {
    setStopping(true);
    try {
      const res = await fetch("/api/fasting", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ date, action: "stop" }),
      });
      const data = await res.json() as { ok: boolean; session: FastingSession };
      if (data.ok) setSession(data.session);
    } finally { setStopping(false); }
  }, [date]);

  const handleUpdateStart = useCallback(async () => {
    setUpdating(true);
    try {
      const startedAtMs = hhmmToMs(date, editTime);
      const res = await fetch("/api/fasting", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ date, action: "update", startedAtMs }),
      });
      const data = await res.json() as { ok: boolean; session: FastingSession };
      if (data.ok) { setSession(data.session); setEditingStart(false); }
    } finally { setUpdating(false); }
  }, [date, editTime]);

  if (!isFastingDay || session === "loading") return null;

  const durationH   = session?.durationH ?? fastingConfig!.durationH;
  const targetMs    = durationH * 3600 * 1000;
  const isActive    = !!(session?.active && session.startedAtMs);
  const isCompleted = !!(session && !session.active && session.completedAtMs != null);

  const elapsedMs = isActive && session?.startedAtMs
    ? Math.min(now - session.startedAtMs, targetMs)
    : isCompleted && session?.startedAtMs && session.completedAtMs
      ? Math.min(session.completedAtMs - session.startedAtMs, targetMs)
      : 0;
  const remainMs = Math.max(0, targetMs - elapsedMs);
  const pct      = Math.min(elapsedMs / targetMs, 1);
  const rc       = ringColor(pct);

  const SIZE = 136, R = 52, SW = 8;
  const circ = 2 * Math.PI * R;
  const dash = pct * circ;

  // ── Not started ──────────────────────────────────────────────────────────────
  if (!session) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="glass px-4 py-4 mb-4"
        style={{ borderColor: "rgba(129,140,248,0.25)" }}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-lg"
            style={{ background: "rgba(129,140,248,0.12)", border: "1px solid rgba(129,140,248,0.25)" }}>
            🌿
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold leading-tight" style={{ color: "var(--text-primary)" }}>
              Jeûne {durationH}h prévu aujourd&apos;hui
            </p>
          </div>
        </div>

        {/* Time picker + start button on second row */}
        <div className="flex items-center gap-3 mt-3 pl-[52px]">
          <TimeEditor
            label="Début"
            value={startTime}
            onChange={setStartTime}
            onConfirm={handleStart}
            saving={starting}
          />
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleStart}
            disabled={starting}
            className="px-4 py-2 rounded-xl text-[12px] font-semibold flex-shrink-0"
            style={{
              background: "rgba(129,140,248,0.15)",
              border:     "1px solid rgba(129,140,248,0.35)",
              color:      "#818cf8",
            }}
          >
            {starting ? "…" : "Démarrer →"}
          </motion.button>
        </div>
      </motion.div>
    );
  }

  // ── Completed ────────────────────────────────────────────────────────────────
  if (isCompleted) {
    const actualMs = session.completedAtMs! - (session.startedAtMs ?? 0);
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="glass px-4 py-4 mb-4 flex items-center gap-3"
        style={{ borderColor: "rgba(34,197,94,0.3)", background: "rgba(34,197,94,0.04)" }}
      >
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-xl"
          style={{ background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.25)" }}>
          ✅
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold" style={{ color: "#22c55e" }}>
            Jeûne {durationH}h accompli !
          </p>
          <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
            Durée réelle : {fmtMs(actualMs)}
          </p>
        </div>
      </motion.div>
    );
  }

  // ── Active timer ─────────────────────────────────────────────────────────────
  return (
    <AnimatePresence>
      <motion.div
        key="fasting-active"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="glass px-4 pt-4 pb-5 mb-4"
        style={{ borderColor: `${rc}30` }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 15 }}>🌿</span>
            <p className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
              Jeûne Intermittent · {durationH}h
            </p>
            <span className="w-2 h-2 rounded-full animate-pulse"
              style={{ background: rc, boxShadow: `0 0 6px ${rc}` }} />
          </div>
          <motion.button whileTap={{ scale: 0.93 }} onClick={handleStop} disabled={stopping}
            className="px-3 py-1.5 rounded-lg text-[11px] font-semibold"
            style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)", color: "#f87171" }}>
            {stopping ? "…" : "Arrêter"}
          </motion.button>
        </div>

        {/* Ring + stats */}
        <div className="flex items-center gap-5">
          {/* SVG ring */}
          <div className="flex-shrink-0">
            <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
              <circle cx={SIZE/2} cy={SIZE/2} r={R}
                fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={SW} />
              <circle cx={SIZE/2} cy={SIZE/2} r={R}
                fill="none" stroke={rc} strokeWidth={SW}
                strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
                transform={`rotate(-90 ${SIZE/2} ${SIZE/2})`}
                style={{ transition: "stroke-dasharray 0.8s ease, stroke 1s ease" }}
              />
              <text x={SIZE/2} y={SIZE/2 - 9} textAnchor="middle"
                fontSize="17" fontWeight="700" fill={rc} fontFamily="monospace">
                {fmtMs(elapsedMs)}
              </text>
              <text x={SIZE/2} y={SIZE/2 + 8} textAnchor="middle"
                fontSize="9" fill="rgba(250,250,250,0.35)" fontFamily="inherit">
                écoulé
              </text>
              <text x={SIZE/2} y={SIZE/2 + 22} textAnchor="middle"
                fontSize="11" fontWeight="600" fill={rc} fontFamily="inherit">
                {Math.round(pct * 100)}%
              </text>
            </svg>
          </div>

          {/* Stats */}
          <div className="flex-1 space-y-3">
            {/* Remaining */}
            <div>
              <p className="text-[9px] uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>Restant</p>
              <p className="text-[18px] font-bold tabular-nums leading-none font-mono" style={{ color: "var(--text-primary)" }}>
                {fmtMs(remainMs)}
              </p>
            </div>

            {/* Progress bar */}
            <div className="h-[5px] rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
              <div className="h-full rounded-full"
                style={{
                  width: `${pct * 100}%`,
                  background: `linear-gradient(to right, #818cf8, ${rc})`,
                  transition: "width 0.8s ease",
                }} />
            </div>

            {/* Start time — editable */}
            <div>
              <AnimatePresence mode="wait">
                {editingStart ? (
                  <motion.div key="editing"
                    initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                    <TimeEditor
                      label="Début"
                      value={editTime}
                      onChange={setEditTime}
                      onConfirm={handleUpdateStart}
                      onCancel={() => setEditingStart(false)}
                      saving={updating}
                    />
                  </motion.div>
                ) : (
                  <motion.div key="display"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="flex items-center gap-2">
                    <p className="text-[9px] uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Début</p>
                    <p className="text-[12px] font-medium" style={{ color: "var(--text-secondary)" }}>
                      {session.startedAtMs ? msToHHMM(session.startedAtMs) : "—"}
                    </p>
                    <button
                      onClick={() => {
                        setEditTime(session.startedAtMs ? msToHHMM(session.startedAtMs) : nowHHMM());
                        setEditingStart(true);
                      }}
                      className="w-6 h-6 rounded-md flex items-center justify-center text-[11px] transition-all"
                      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--border)" }}
                      title="Modifier l'heure de début"
                    >
                      ✏️
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* End estimate */}
            {session.startedAtMs && !editingStart && (
              <div>
                <p className="text-[9px] uppercase tracking-widest mb-0.5" style={{ color: "var(--text-muted)" }}>Fin prévue</p>
                <p className="text-[12px] font-medium" style={{ color: rc }}>
                  {new Date(session.startedAtMs + targetMs).toLocaleTimeString("fr-FR", {
                    hour: "2-digit", minute: "2-digit",
                  })}
                </p>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
