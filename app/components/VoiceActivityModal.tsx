"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { IconX, IconSparkles, IconCheck, IconPlus, IconMinus, IconMicrophone, IconPlayerStopFilled, IconFlame, IconClock } from "@tabler/icons-react";

// ─── Types ──────────────────────────────────────────────────────────────────

interface VoiceActivity {
  name:           string;
  activityType:   number;
  durationMin:    number;
  caloriesBurned: number | null;
  selected:       boolean;
}

interface Props {
  date:    string;
  onAdded: () => void;
  onClose: () => void;
}

// Minimal Web Speech API typings (not in lib.dom for all targets)
interface SpeechResultAlt { transcript: string }
interface SpeechResult { 0: SpeechResultAlt; isFinal: boolean; length: number }
interface SpeechEvent { resultIndex: number; results: { length: number; [i: number]: SpeechResult } }
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: SpeechEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}

const ACCENT = "#38bdf8"; // Activity sky-blue

// Emoji by Google Fit activity code (fallback 🏅)
const TYPE_EMOJI: Record<number, string> = {
  1: "🏃", 7: "🚴", 9: "🤸", 10: "🎿", 17: "🏋️", 37: "🚣",
  45: "⚽", 46: "🚶", 49: "🏂", 54: "🎾", 55: "🪜", 72: "🏓",
  74: "🏐", 82: "🧘", 83: "💃", 93: "🏊", 104: "🥊", 108: "🧘",
  109: "🏉", 0: "🏅",
};

// ─── Pulsing mic orb ────────────────────────────────────────────────────────

function MicOrb({ active }: { active: boolean }) {
  return (
    <div className="relative flex items-center justify-center" style={{ width: 96, height: 96 }}>
      {active && [0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="absolute rounded-full"
          style={{ width: 96, height: 96, border: `2px solid ${ACCENT}` }}
          initial={{ scale: 0.6, opacity: 0.5 }}
          animate={{ scale: 1.5, opacity: 0 }}
          transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.6, ease: "easeOut" }}
        />
      ))}
      <motion.div
        className="rounded-full flex items-center justify-center"
        style={{ width: 72, height: 72, background: active ? ACCENT : `${ACCENT}22`, boxShadow: active ? `0 0 28px ${ACCENT}66` : "none" }}
        animate={active ? { scale: [1, 1.08, 1] } : { scale: 1 }}
        transition={{ duration: 1.2, repeat: active ? Infinity : 0, ease: "easeInOut" }}
      >
        {active
          ? <IconPlayerStopFilled size={28} style={{ color: "#fff" }} />
          : <IconMicrophone size={30} style={{ color: ACCENT }} />}
      </motion.div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function VoiceActivityModal({ date, onAdded, onClose }: Props) {
  type Phase = "idle" | "analyzing" | "results" | "saving";

  const [phase,      setPhase]      = useState<Phase>("idle");
  const [transcript, setTranscript] = useState("");
  const [listening,  setListening]  = useState(false);
  const [supported,  setSupported]  = useState(true);
  const [items,      setItems]      = useState<VoiceActivity[]>([]);
  const [error,      setError]      = useState<string | null>(null);

  const recogRef      = useRef<SpeechRecognitionLike | null>(null);
  const transcriptRef = useRef("");

  // ── Init speech recognition ──────────────────────────────────────────────
  useEffect(() => {
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) { setSupported(false); return; }

    const recog = new Ctor();
    recog.lang = "fr-FR";
    recog.continuous = true;
    recog.interimResults = true;

    recog.onresult = (e: SpeechEvent) => {
      let full = "";
      for (let i = 0; i < e.results.length; i++) {
        full += e.results[i][0].transcript;
      }
      const text = full.trim();
      transcriptRef.current = text;
      setTranscript(text);
    };
    recog.onerror = (e) => {
      if (e.error !== "no-speech" && e.error !== "aborted") {
        setError("Micro indisponible — vous pouvez taper votre activité ci-dessous");
      }
      setListening(false);
    };
    recog.onend = () => setListening(false);

    recogRef.current = recog;
    return () => { try { recog.stop(); } catch {} };
  }, []);

  const startListening = useCallback(() => {
    setError(null);
    const recog = recogRef.current;
    if (!recog) { setSupported(false); return; }
    try {
      recog.start();
      setListening(true);
    } catch { /* already started */ }
  }, []);

  const stopListening = useCallback(() => {
    try { recogRef.current?.stop(); } catch {}
    setListening(false);
  }, []);

  // ── Analyze transcript ─────────────────────────────────────────────────────
  const analyze = async () => {
    const text = (transcriptRef.current || transcript).trim();
    if (!text) { setError("Dites ou écrivez d'abord votre activité"); return; }
    stopListening();
    setPhase("analyzing");
    setError(null);
    try {
      const res = await fetch("/api/activity/voice", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error("api");
      const data = await res.json() as {
        results: { name: string; activityType: number; durationMin: number; caloriesBurned: number | null }[];
      };
      const detected = data.results ?? [];
      if (detected.length === 0) {
        setError("Aucune activité reconnue — reformulez (ex: « 30 min de course »)");
        setPhase("idle");
        return;
      }
      setItems(detected.map((d) => ({ ...d, selected: true })));
      setPhase("results");
    } catch {
      setError("Erreur d'analyse — vérifiez votre connexion");
      setPhase("idle");
    }
  };

  // ── Item edits ──────────────────────────────────────────────────────────────
  const adjustDuration = (idx: number, delta: number) =>
    setItems((prev) => prev.map((it, i) => i !== idx ? it : { ...it, durationMin: Math.max(1, it.durationMin + delta) }));
  const setDuration = (idx: number, m: number) =>
    setItems((prev) => prev.map((it, i) => i !== idx ? it : { ...it, durationMin: Math.max(1, Math.min(600, m || 1)) }));
  const toggleSelect = (idx: number) =>
    setItems((prev) => prev.map((it, i) => i !== idx ? it : { ...it, selected: !it.selected }));

  const selected   = items.filter((it) => it.selected);
  const totalKcal  = selected.reduce((acc, it) => acc + (it.caloriesBurned ?? 0), 0);
  const totalMin   = selected.reduce((acc, it) => acc + it.durationMin, 0);

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleAdd = async () => {
    setPhase("saving");
    try {
      for (const item of selected) {
        await fetch("/api/activity", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            date,
            name:           item.name,
            activityType:   item.activityType,
            durationMin:    item.durationMin,
            caloriesBurned: item.caloriesBurned,
          }),
        });
      }
      onAdded();
    } catch {
      setError("Erreur lors de l'ajout");
      setPhase("results");
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      <motion.div
        key="va-backdrop"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-40"
        style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(6px)" }}
        onClick={onClose}
      />

      <motion.div
        key="va-sheet"
        initial={{ opacity: 0, y: 44 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 44 }}
        transition={{ type: "spring", damping: 28, stiffness: 300 }}
        className="fixed bottom-0 inset-x-0 z-50 rounded-t-2xl flex flex-col mx-auto"
        style={{
          background: "rgba(11,11,17,0.98)", border: "1px solid rgba(255,255,255,0.08)",
          borderBottom: "none", backdropFilter: "blur(28px)", maxHeight: "88vh", maxWidth: "32rem",
        }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.15)" }} />
        </div>

        {/* Header */}
        <div className="flex items-center gap-3 px-5 pb-3 flex-shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${ACCENT}22` }}>
            <IconSparkles size={16} style={{ color: ACCENT }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>Dicter mon activité</p>
            <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Nutri-IA · reconnaissance vocale</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-muted)" }}>
            <IconX size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">

          {/* ── IDLE: capture ── */}
          {phase === "idle" && (
            <div className="flex flex-col items-center">
              <AnimatePresence>
                {error && (
                  <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="mb-4 w-full px-4 py-3 rounded-xl text-[13px]"
                    style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171" }}>
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              {supported && (
                <button onClick={listening ? stopListening : startListening} className="mt-2 mb-1 active:scale-95 transition-transform">
                  <MicOrb active={listening} />
                </button>
              )}
              <p className="text-[13px] font-medium text-center mt-2" style={{ color: "var(--text-primary)" }}>
                {listening ? "À l'écoute… parlez" : supported ? "Touchez le micro et décrivez votre séance" : "Tapez votre activité ci-dessous"}
              </p>
              <p className="text-[11px] text-center mt-1 px-4" style={{ color: "var(--text-muted)" }}>
                Ex : « J'ai couru 30 minutes puis 20 min de musculation »
              </p>

              {/* Editable transcript */}
              <textarea
                value={transcript}
                onChange={(e) => { setTranscript(e.target.value); transcriptRef.current = e.target.value; }}
                placeholder="Votre activité apparaît ici — vous pouvez corriger le texte…"
                rows={3}
                className="w-full mt-4 px-3 py-2.5 rounded-xl text-[13px] outline-none resize-none"
                style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${listening ? ACCENT + "55" : "var(--border)"}`, color: "var(--text-primary)" }}
              />

              <button
                onClick={analyze}
                disabled={!transcript.trim()}
                className="w-full mt-3 flex items-center justify-center gap-2 py-3 rounded-xl text-[14px] font-semibold transition-all active:scale-[0.98] disabled:opacity-40"
                style={{ background: ACCENT, color: "#fff", boxShadow: transcript.trim() ? `0 4px 20px ${ACCENT}35` : "none" }}>
                <IconSparkles size={16} /> Analyser avec Nutri-IA
              </button>
            </div>
          )}

          {/* ── ANALYZING ── */}
          {phase === "analyzing" && (
            <div className="flex flex-col items-center py-8 gap-5">
              <MicOrb active />
              <div className="text-center">
                <p className="text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>Analyse en cours…</p>
                <p className="text-[12px] mt-1 px-6" style={{ color: "var(--text-muted)" }}>Nutri-IA identifie vos activités</p>
              </div>
              <div className="w-full space-y-2">
                {[100, 85, 70].map((w, i) => (
                  <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: [0.4, 0.7, 0.4] }}
                    transition={{ delay: i * 0.12, duration: 1.4, repeat: Infinity }}
                    className="h-[58px] rounded-xl" style={{ background: "rgba(255,255,255,0.04)", width: `${w}%` }} />
                ))}
              </div>
            </div>
          )}

          {/* ── RESULTS / SAVING ── */}
          {(phase === "results" || phase === "saving") && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                  ✨ {items.length} activité{items.length > 1 ? "s" : ""} reconnue{items.length > 1 ? "s" : ""}
                </span>
                <button onClick={() => { setPhase("idle"); setItems([]); }}
                  className="text-[10px] px-2 py-0.5 rounded-md" style={{ background: "rgba(255,255,255,0.08)", color: "var(--text-muted)" }}>
                  Recommencer
                </button>
              </div>

              <AnimatePresence>
                {error && (
                  <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="mb-3 px-4 py-3 rounded-xl text-[13px]"
                    style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171" }}>
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="space-y-2 mb-4">
                {items.map((item, idx) => {
                  const isSaving = phase === "saving";
                  const emoji = TYPE_EMOJI[item.activityType] ?? "🏅";
                  return (
                    <motion.div key={idx} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.06, duration: 0.25 }}
                      className="rounded-xl p-3"
                      style={{
                        background: item.selected ? `${ACCENT}0D` : "rgba(255,255,255,0.025)",
                        border: `1px solid ${item.selected ? ACCENT + "35" : "rgba(255,255,255,0.07)"}`,
                        opacity: isSaving ? 0.65 : 1,
                      }}>
                      <div className="flex items-start gap-3">
                        {/* Checkbox */}
                        <button onClick={() => !isSaving && toggleSelect(idx)}
                          className="mt-0.5 w-5 h-5 rounded-md flex-shrink-0 flex items-center justify-center transition-all"
                          style={{ background: item.selected ? ACCENT : "rgba(255,255,255,0.07)", border: `1.5px solid ${item.selected ? ACCENT : "rgba(255,255,255,0.18)"}` }}>
                          {item.selected && <IconCheck size={11} style={{ color: "#fff" }} />}
                        </button>

                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium leading-snug truncate" style={{ color: "var(--text-primary)" }}>
                            <span className="mr-1">{emoji}</span>{item.name}
                          </p>
                          {item.caloriesBurned != null && (
                            <p className="inline-flex items-center gap-1 mt-1 text-[11px] font-semibold" style={{ color: "var(--fit-red, #f87171)" }}>
                              <IconFlame size={12} /> {item.caloriesBurned} kcal brûlées
                            </p>
                          )}
                        </div>

                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          <div className="flex items-center gap-1">
                            <button onClick={() => !isSaving && adjustDuration(idx, -5)} className="w-5 h-5 rounded-md flex items-center justify-center"
                              style={{ background: "rgba(255,255,255,0.07)", color: "var(--text-muted)" }}><IconMinus size={9} /></button>
                            <input type="number" value={item.durationMin}
                              onChange={(e) => !isSaving && setDuration(idx, parseInt(e.target.value))}
                              className="w-11 text-center text-[11px] rounded-md tabular-nums outline-none"
                              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text-secondary)", padding: "2px 3px" }}
                              disabled={isSaving} />
                            <button onClick={() => !isSaving && adjustDuration(idx, 5)} className="w-5 h-5 rounded-md flex items-center justify-center"
                              style={{ background: "rgba(255,255,255,0.07)", color: "var(--text-muted)" }}><IconPlus size={9} /></button>
                          </div>
                          <span className="inline-flex items-center gap-0.5 text-[9px]" style={{ color: "var(--text-muted)" }}>
                            <IconClock size={9} /> min
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Bottom action bar */}
        <AnimatePresence>
          {(phase === "results" || phase === "saving") && selected.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }}
              className="flex-shrink-0 px-5 pt-3 pb-8" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
              <button onClick={handleAdd} disabled={phase === "saving"}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-[14px] font-semibold transition-all active:scale-[0.98]"
                style={{ background: phase === "saving" ? `${ACCENT}70` : ACCENT, color: "#fff", boxShadow: phase !== "saving" ? `0 4px 20px ${ACCENT}35` : "none" }}>
                {phase === "saving" ? (
                  <><motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>⏳</motion.span> Ajout en cours…</>
                ) : (
                  <><IconCheck size={16} stroke={2.5} /> Ajouter {selected.length} activité{selected.length > 1 ? "s" : ""} · {totalMin} min · {totalKcal} kcal</>
                )}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {(phase === "idle" || phase === "analyzing") && <div className="flex-shrink-0" style={{ height: 24 }} />}
      </motion.div>
    </>
  );
}
