"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkle, ArrowsClockwise } from "@phosphor-icons/react";

interface Props {
  type:       "journal" | "dashboard" | "activity" | "progress";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data:       Record<string, any>;
  label?:     string;    // optional override for the header label
  delay?:     number;    // ms before auto-loading (default 600)
  autoLoad?:  boolean;   // si false (défaut) : attend un clic utilisateur
}

export default function AIInsightBox({ type, data, label, delay = 600, autoLoad = false }: Props) {
  const [text,    setText]    = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(false);
  const [launched, setLaunched] = useState(false);
  const didLoad = useRef(false);

  const load = useCallback(async () => {
    setLaunched(true);
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/ai/insight", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ type, data: { ...data, _hourOfDay: new Date().getHours() } }),
      });
      if (!res.ok) throw new Error("API error");
      const json = await res.json() as { insight: string };
      setText(json.insight ?? "");
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [type, data]);

  // Auto-load seulement si autoLoad=true
  useEffect(() => {
    if (!autoLoad) return;
    if (didLoad.current) return;
    didLoad.current = true;
    const t = setTimeout(load, delay);
    return () => clearTimeout(t);
  }, [autoLoad, load, delay]);

  // ── Label per type
  const LABELS: Record<Props["type"], string> = {
    journal:   "Analyse nutritionnelle du jour",
    dashboard: "Bilan de la journée",
    activity:  "Analyse de performance",
    progress:  "Mise en perspective",
  };
  const ICONS: Record<Props["type"], string> = {
    journal:   "🥗",
    dashboard: "🌟",
    activity:  "🏅",
    progress:  "📈",
  };

  const displayLabel = label ?? LABELS[type];
  const icon         = ICONS[type];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="relative rounded-2xl overflow-hidden"
      style={{
        background: "linear-gradient(135deg, rgba(139,92,246,0.08) 0%, rgba(59,130,246,0.06) 100%)",
        border: "1px solid transparent",
        backgroundClip: "padding-box",
      }}
    >
      {/* Gradient border trick */}
      <div
        className="absolute inset-0 rounded-2xl pointer-events-none"
        style={{
          padding: "1px",
          background: "linear-gradient(135deg, rgba(139,92,246,0.45), rgba(59,130,246,0.3), rgba(139,92,246,0.15))",
          WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
          borderRadius: "inherit",
        }}
      />

      <div className="relative p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-6 h-6 rounded-lg"
              style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.25), rgba(59,130,246,0.2))" }}>
              <Sparkle size={12} weight="fill" style={{ color: "#a78bfa" }} />
            </div>
            <span className="text-[11px] font-semibold tracking-wide uppercase"
              style={{ color: "#a78bfa", letterSpacing: "0.06em" }}>
              ✨ IA
            </span>
            <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
              · {displayLabel}
            </span>
          </div>

          {/* Refresh button */}
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center justify-center w-6 h-6 rounded-lg transition-all"
            style={{
              background: "rgba(139,92,246,0.1)",
              border: "1px solid rgba(139,92,246,0.2)",
              opacity: loading ? 0.5 : 1,
            }}
            title="Actualiser l'analyse"
          >
            <ArrowsClockwise
              size={11}
              style={{ color: "#a78bfa" }}
              className={loading ? "animate-spin" : ""}
            />
          </button>
        </div>

        {/* Bouton initial si pas encore lancé */}
        {!launched && !autoLoad && (
          <button
            onClick={load}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-[12px] font-medium transition-all"
            style={{
              background: "rgba(139,92,246,0.08)",
              border: "1px solid rgba(139,92,246,0.2)",
              color: "#a78bfa",
            }}
          >
            <Sparkle size={12} weight="fill" />
            Lancer l&apos;analyse IA
          </button>
        )}

        {/* Content */}
        <AnimatePresence mode="wait">
          {loading && !text && (
            <motion.div
              key="skeleton"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-2"
            >
              {[1, 0.75, 0.5].map((w, i) => (
                <div
                  key={i}
                  className="rounded-full animate-pulse"
                  style={{
                    height: 10,
                    width: `${w * 100}%`,
                    background: "rgba(139,92,246,0.12)",
                  }}
                />
              ))}
            </motion.div>
          )}

          {error && !loading && (
            <motion.p
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-[12px]"
              style={{ color: "var(--text-muted)" }}
            >
              Impossible de charger l&apos;analyse. Réessayez.
            </motion.p>
          )}

          {text && (
            <motion.div
              key="text"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              {/* Decorative icon */}
              <span className="float-left text-[22px] mr-2 mt-0.5 leading-none select-none">
                {icon}
              </span>
              <p
                className="text-[13px] leading-relaxed"
                style={{ color: "var(--text-primary)" }}
              >
                {text}
              </p>
              {loading && (
                <span className="inline-block w-2 h-2 rounded-full ml-1 animate-pulse"
                  style={{ background: "#a78bfa", verticalAlign: "middle" }} />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
