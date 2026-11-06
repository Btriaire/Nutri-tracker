"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { IconDroplet, IconMinus, IconCheck, IconGlassFull, IconBottle } from "@tabler/icons-react";
import { queueWater } from "@/app/lib/offline-meals";

interface Props {
  date:     string;
  waterMl:  number;
  goalMl:   number;
  onUpdate: (newMl: number) => void;
}

const QUICK = [
  { ml: 250, label: "Verre",     Icon: IconGlassFull },
  { ml: 500, label: "Bouteille", Icon: IconBottle },
  { ml: 750, label: "Grande",    Icon: IconBottle },
] as const;

const GLASS_ML = 250;

const fmt = (ml: number) =>
  ml >= 1000 ? `${String(+(ml / 1000).toFixed(2)).replace(".", ",")} L` : `${ml} ml`;

export default function WaterTracker({ date, waterMl, goalMl, onUpdate }: Props) {
  const [pending, setPending] = useState(false);
  const [lastDelta, setLastDelta] = useState<number | null>(null);
  const [queued, setQueued] = useState(false);
  const [error, setError] = useState(false);
  const saveSeq = useRef(0);

  const goal      = goalMl > 0 ? goalMl : 2000;
  const ratio     = Math.min(waterMl / goal, 1);
  const pct       = Math.round((waterMl / goal) * 100);
  const remaining = Math.max(goal - waterMl, 0);
  const reached   = waterMl >= goal;
  const glasses   = Math.max(1, Math.round(goal / GLASS_ML));
  const filled    = Math.min(Math.floor(waterMl / GLASS_ML), glasses);

  useEffect(() => {
    if (lastDelta === null) return;
    const t = setTimeout(() => setLastDelta(null), 1400);
    return () => clearTimeout(t);
  }, [lastDelta]);

  const adjust = async (deltaMl: number) => {
    const prev   = waterMl;
    const newVal = Math.max(0, waterMl + deltaMl);
    if (newVal === prev) return;
    onUpdate(newVal);               // optimistic
    setLastDelta(newVal - prev);
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(10);
    const seq = ++saveSeq.current;
    setError(false);
    // Hors ligne : gardee sur le telephone, envoyee au retour du reseau.
    const keepOffline = () => { queueWater(date, newVal); setQueued(true); };
    if (!navigator.onLine) { keepOffline(); return; }
    setPending(true);
    try {
      const res = await fetch("/api/log/water", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, waterMl: newVal }),
      });
      if (!res.ok) throw new Error();
      if (seq === saveSeq.current) setQueued(false);
    } catch (e) {
      if (e instanceof TypeError) keepOffline();          // reseau coupe pendant l'envoi
      else if (seq === saveSeq.current) { onUpdate(prev); setError(true); }
    } finally {
      if (seq === saveSeq.current) setPending(false);
    }
  };

  // Water level inside the glass (SVG coords: glass interior spans y=8 → y=92)
  const levelY = 92 - ratio * 84;

  return (
    <div
      className="relative rounded-2xl p-4 overflow-hidden"
      style={{
        background: "linear-gradient(135deg, rgba(31,203,255,0.10) 0%, var(--surface) 55%)",
        border: "1px solid rgba(31,203,255,0.25)",
      }}
    >
      <div className="flex items-center gap-4">
        {/* Animated glass */}
        <div className="relative flex-shrink-0" style={{ width: 64, height: 84 }}>
          <svg viewBox="0 0 80 100" width="64" height="84" aria-hidden>
            <defs>
              <clipPath id={`wt-glass-${date}`}>
                <path d="M10 6 L70 6 L63 92 Q62 96 58 96 L22 96 Q18 96 17 92 Z" />
              </clipPath>
              <linearGradient id={`wt-water-${date}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#5BDCFF" />
                <stop offset="100%" stopColor="#1A8CFF" />
              </linearGradient>
            </defs>
            <g clipPath={`url(#wt-glass-${date})`}>
              <rect x="0" y="0" width="80" height="100" fill="var(--layer-2)" />
              <motion.g
                initial={false}
                animate={{ y: levelY }}
                transition={{ type: "spring", stiffness: 90, damping: 16 }}
              >
                <motion.path
                  d="M-80 0 Q-60 -5 -40 0 T0 0 T40 0 T80 0 T120 0 T160 0 V120 H-80 Z"
                  fill={`url(#wt-water-${date})`}
                  animate={{ x: [0, 80] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                />
                <motion.path
                  d="M-80 2 Q-60 -2 -40 2 T0 2 T40 2 T80 2 T120 2 T160 2 V120 H-80 Z"
                  fill="rgba(255,255,255,0.18)"
                  animate={{ x: [80, 0] }}
                  transition={{ duration: 4.5, repeat: Infinity, ease: "linear" }}
                />
              </motion.g>
            </g>
            <path
              d="M10 6 L70 6 L63 92 Q62 96 58 96 L22 96 Q18 96 17 92 Z"
              fill="none"
              stroke="rgba(31,203,255,0.55)"
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
            <path d="M18 14 L22 80" stroke="rgba(255,255,255,0.35)" strokeWidth="3" strokeLinecap="round" />
          </svg>
          <span
            className="absolute inset-x-0 bottom-2 text-center text-[11px] font-bold tabular-nums"
            style={{ color: ratio > 0.25 ? "#fff" : "var(--steps)", textShadow: ratio > 0.25 ? "0 1px 2px rgba(0,0,0,0.25)" : "none" }}
          >
            {pct}%
          </span>
        </div>

        {/* Values */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <IconDroplet size={13} stroke={2} style={{ color: "var(--steps)" }} />
            <p className="label-xs">Hydratation</p>
            {pending && (
              <span className="ml-auto w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "var(--steps)" }} />
            )}
          </div>
          <div className="relative flex items-baseline gap-1.5">
            <span className="text-[26px] font-bold leading-none tabular-nums" style={{ color: "var(--text-primary)" }}>
              {fmt(waterMl)}
            </span>
            <span className="text-[13px] tabular-nums" style={{ color: "var(--text-muted)" }}>
              / {fmt(goal)}
            </span>
            <AnimatePresence>
              {lastDelta !== null && (
                <motion.span
                  key={`${lastDelta}-${waterMl}`}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: -6 }}
                  exit={{ opacity: 0, y: -14 }}
                  transition={{ duration: 0.35 }}
                  className="text-[12px] font-semibold tabular-nums"
                  style={{ color: lastDelta > 0 ? "var(--steps)" : "var(--text-muted)" }}
                >
                  {lastDelta > 0 ? "+" : "−"}{Math.abs(lastDelta)} ml
                </motion.span>
              )}
            </AnimatePresence>
          </div>
          <p className="text-[12px] mt-1 flex items-center gap-1" style={{ color: reached ? "var(--ok)" : "var(--text-secondary)" }}>
            {reached ? (
              <><IconCheck size={13} stroke={2.5} /> Objectif atteint, bravo !</>
            ) : (
              <>Encore <span className="font-semibold tabular-nums">{fmt(remaining)}</span> · ≈ {Math.ceil(remaining / GLASS_ML)} verre{Math.ceil(remaining / GLASS_ML) > 1 ? "s" : ""}</>
            )}
          </p>

          {/* Glass dots */}
          {glasses <= 16 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {Array.from({ length: glasses }).map((_, i) => (
                <motion.span
                  key={i}
                  className="h-1.5 rounded-full"
                  style={{ width: 12 }}
                  initial={false}
                  animate={{ background: i < filled ? "var(--steps)" : "var(--layer-2)" }}
                  transition={{ duration: 0.25, delay: i < filled ? i * 0.02 : 0 }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick add */}
      <div className="flex gap-2 mt-4">
        {QUICK.map(({ ml, label, Icon }) => (
          <motion.button
            key={ml}
            type="button"
            whileTap={{ scale: 0.94 }}
            onClick={() => adjust(ml)}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 rounded-xl"
            style={{
              background: "rgba(31,203,255,0.12)",
              border: "1px solid rgba(31,203,255,0.30)",
              color: "var(--steps)",
            }}
            aria-label={`Ajouter ${ml} ml`}
          >
            <span className="flex items-center gap-1 text-[14px] font-semibold tabular-nums">
              <Icon size={15} stroke={1.8} />+{ml}
            </span>
            <span className="text-[10px] uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>{label}</span>
          </motion.button>
        ))}
        <motion.button
          type="button"
          whileTap={{ scale: 0.94 }}
          onClick={() => adjust(-GLASS_ML)}
          disabled={waterMl === 0}
          className="flex flex-col items-center justify-center gap-0.5 px-3 py-2.5 rounded-xl disabled:opacity-30"
          style={{
            background: "var(--layer-1)",
            border: "1px solid var(--border)",
            color: "var(--text-muted)",
          }}
          aria-label="Retirer 250 ml"
        >
          <IconMinus size={16} stroke={2} />
          <span className="text-[10px] tabular-nums">250</span>
        </motion.button>
      </div>

      {queued && (
        <p role="status" className="text-[12px] mt-2" style={{ color: "var(--text-muted)" }}>
          Pas de réseau : gardé sur le téléphone, envoyé au retour du réseau.
        </p>
      )}
      {error && (
        <p role="alert" className="text-[12px] mt-2" style={{ color: "var(--danger)" }}>
          Impossible d&apos;enregistrer l&apos;eau, réessaie.
        </p>
      )}
    </div>
  );
}
