"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Brain, Check, Spinner } from "@phosphor-icons/react";
import { format } from "date-fns";
import type { MentalHealthEntry } from "@/app/api/mental-health/route";

interface Props { date: string }

const CRITERIA: { key: keyof Omit<MentalHealthEntry, "date" | "notes" | "loggedAt">; label: string; low: string; high: string; emoji: string }[] = [
  { key: "stressLevel",  label: "Stress",          low: "Très calme",  high: "Très stressé",  emoji: "😤" },
  { key: "anxiety",      label: "Anxiété",          low: "Serein",      high: "Anxieux",        emoji: "😰" },
  { key: "mood",         label: "Humeur",            low: "Déprimé",     high: "Excellent",      emoji: "😊" },
  { key: "energy",       label: "Énergie",           low: "Épuisé",      high: "Plein d'énergie",emoji: "⚡" },
  { key: "focus",        label: "Concentration",     low: "Dispersé",    high: "Focalisé",       emoji: "🎯" },
  { key: "sleepQuality", label: "Qualité du sommeil",low: "Très mauvais",high: "Excellent",      emoji: "🌙" },
  { key: "social",       label: "Connexion sociale", low: "Isolé",       high: "Connecté",       emoji: "🤝" },
];

// For stress & anxiety, low score = good. For rest, high = good.
const INVERTED = new Set(["stressLevel", "anxiety"]);

function overallScore(entry: Partial<MentalHealthEntry>): number {
  const vals = CRITERIA.map(({ key }) => {
    const v = (entry as Record<string, number>)[key as string] ?? 3;
    return INVERTED.has(key) ? 6 - v : v; // invert so 5 = best
  });
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
}

function scoreEmoji(score: number): string {
  if (score >= 4.5) return "😄";
  if (score >= 3.5) return "🙂";
  if (score >= 2.5) return "😐";
  if (score >= 1.5) return "😔";
  return "😞";
}

function scoreColor(score: number): string {
  if (score >= 4.0) return "#34d399";
  if (score >= 3.0) return "#fbbf24";
  if (score >= 2.0) return "#f97316";
  return "#f87171";
}

const DEFAULT_VALS: Record<string, number> = Object.fromEntries(CRITERIA.map((c) => [c.key, 3]));

export default function MentalHealthWidget({ date }: Props) {
  const [entry, setEntry]     = useState<Partial<MentalHealthEntry> | null>(null);
  const [open, setOpen]       = useState(false);
  const [mounted, setMounted] = useState(false);
  const [vals, setVals]       = useState<Record<string, number>>(DEFAULT_VALS);
  const [notes, setNotes]     = useState("");
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    fetch(`/api/mental-health?date=${date}`)
      .then((r) => r.json())
      .then((d: { entry: MentalHealthEntry | null }) => {
        if (d.entry) {
          setEntry(d.entry);
          const newVals: Record<string, number> = {};
          CRITERIA.forEach(({ key }) => { newVals[key] = (d.entry as unknown as Record<string, number>)[key as string] ?? 3; });
          setVals(newVals);
          setNotes(d.entry.notes ?? "");
        }
      })
      .catch(() => {});
  }, [date]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const body = { date, ...vals, notes: notes.trim() || undefined };
      const res = await fetch("/api/mental-health", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setEntry(body);
        setSaved(true);
        setTimeout(() => { setSaved(false); setOpen(false); }, 900);
      }
    } finally { setSaving(false); }
  }, [date, vals, notes]);

  const score = entry ? overallScore(entry) : null;

  const modal = open && mounted && createPortal(
    <AnimatePresence>
      <motion.div
        key="mh-backdrop"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] flex items-end justify-center"
        style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
        onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
      >
        <motion.div
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          transition={{ type: "spring", damping: 28, stiffness: 280 }}
          className="w-full max-w-md mx-auto rounded-t-3xl overflow-hidden"
          style={{ background: "var(--surface)", border: "1px solid var(--border)", maxHeight: "92vh" }}
        >
          {/* Handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.15)" }} />
          </div>

          <div className="overflow-y-auto overscroll-contain" style={{ maxHeight: "calc(92vh - 20px)" }}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3">
              <div className="flex items-center gap-2">
                <Brain size={18} weight="fill" style={{ color: "#818cf8" }} />
                <p className="font-semibold text-[15px]" style={{ color: "var(--text-primary)" }}>
                  Santé mentale — {format(new Date(date + "T12:00:00"), "d MMMM")}
                </p>
              </div>
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg"
                style={{ background: "rgba(255,255,255,0.06)" }}>
                <X size={14} style={{ color: "var(--text-muted)" }} />
              </button>
            </div>

            <div className="px-5 pb-6 space-y-5">
              {/* Live score preview */}
              {(() => {
                const s = overallScore(vals);
                const color = scoreColor(s);
                return (
                  <div className="flex items-center gap-3 px-4 py-3 rounded-2xl"
                    style={{ background: `${color}12`, border: `1px solid ${color}30` }}>
                    <span className="text-3xl">{scoreEmoji(s)}</span>
                    <div>
                      <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>Score global</p>
                      <p className="text-[20px] font-bold leading-none" style={{ color }}>{s.toFixed(1)} / 5</p>
                    </div>
                  </div>
                );
              })()}

              {/* Criteria sliders */}
              {CRITERIA.map(({ key, label, low, high, emoji }) => {
                const v = vals[key] ?? 3;
                return (
                  <div key={key}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[14px]">{emoji}</span>
                        <span className="text-[13px] font-medium" style={{ color: "var(--text-secondary)" }}>{label}</span>
                      </div>
                      <span className="text-[12px] font-bold px-2 py-0.5 rounded-lg"
                        style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-primary)" }}>
                        {v} / 5
                      </span>
                    </div>
                    {/* 5-step pill selector */}
                    <div className="flex gap-1.5">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button key={n} onClick={() => setVals((p) => ({ ...p, [key]: n }))}
                          className="flex-1 py-2.5 rounded-xl text-[11px] font-semibold transition-all"
                          style={{
                            background: v === n ? "#818cf8" : "rgba(255,255,255,0.05)",
                            color:      v === n ? "#fff"    : "var(--text-muted)",
                            border:     `1px solid ${v === n ? "#818cf8" : "transparent"}`,
                          }}>
                          {n}
                        </button>
                      ))}
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{low}</span>
                      <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{high}</span>
                    </div>
                  </div>
                );
              })}

              {/* Notes */}
              <div>
                <p className="text-[12px] mb-1.5 font-medium" style={{ color: "var(--text-secondary)" }}>Notes (optionnel)</p>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Comment tu te sens aujourd'hui ?"
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-xl text-[13px] resize-none outline-none"
                  style={{
                    background:  "rgba(255,255,255,0.05)",
                    border:      "1px solid var(--border)",
                    color:       "var(--text-primary)",
                  }}
                />
              </div>

              <button onClick={handleSave} disabled={saving || saved}
                className="btn btn-primary w-full gap-2"
                style={{ height: "44px" }}>
                {saved   ? <><Check size={16} weight="bold" /> Sauvegardé !</>
                 : saving ? <><Spinner size={14} className="animate-spin" /> Sauvegarde…</>
                 : "Enregistrer mon état"}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );

  return (
    <>
      {modal}
      <button onClick={() => setOpen(true)}
        className="card flex items-center gap-3 w-full text-left transition-opacity active:opacity-70"
        style={{ padding: "14px 16px" }}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-[18px]"
          style={{ background: "rgba(129,140,248,0.12)", border: "1px solid rgba(129,140,248,0.2)" }}>
          {score ? scoreEmoji(score) : "🧠"}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>Santé mentale</p>
          {score
            ? <p className="text-[11px]" style={{ color: scoreColor(score) }}>Score : {score.toFixed(1)} / 5</p>
            : <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Évaluer mon état du jour</p>
          }
        </div>
        <Brain size={18} weight={score ? "fill" : "regular"} style={{ color: "#818cf8", flexShrink: 0 }} />
      </button>
    </>
  );
}
