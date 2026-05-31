"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { IconX, IconBrain, IconCheck, IconLoader2 } from "@tabler/icons-react";
import type { MentalHealthEntry } from "@/app/api/mental-health/route";

interface Props { date: string }

// ── Mood row: 5 emojis ────────────────────────────────────────────────────────
const MOODS = [
  { val: 1, emoji: "😞", label: "Mal" },
  { val: 2, emoji: "😔", label: "Bof" },
  { val: 3, emoji: "😐", label: "OK" },
  { val: 4, emoji: "🙂", label: "Bien" },
  { val: 5, emoji: "😄", label: "Super" },
];

// ── 3-state quick pills ───────────────────────────────────────────────────────
const STRESS_OPTS  = [{ val: 1, label: "Calme" }, { val: 3, label: "Modéré" }, { val: 5, label: "Stressé" }];
const ENERGY_OPTS  = [{ val: 1, label: "À plat" }, { val: 3, label: "Correct" }, { val: 5, label: "Chargé" }];
const SLEEP_OPTS   = [{ val: 1, label: "Mauvais" }, { val: 3, label: "Correct" }, { val: 5, label: "Reposant" }];

function moodColor(v: number) {
  if (v >= 5) return "#34d399";
  if (v >= 4) return "#86efac";
  if (v >= 3) return "#fbbf24";
  if (v >= 2) return "#f97316";
  return "#f87171";
}

export default function MentalHealthWidget({ date }: Props) {
  const [entry,   setEntry]   = useState<Partial<MentalHealthEntry> | null>(null);
  const [open,    setOpen]    = useState(false);
  const [mounted, setMounted] = useState(false);

  // Form state
  const [mood,   setMood]   = useState(3);
  const [stress, setStress] = useState(3);
  const [energy, setEnergy] = useState(3);
  const [sleep,  setSleep]  = useState(3);
  const [note,   setNote]   = useState("");

  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);

  // Track if user has interacted
  const dirtyRef = useRef(false);

  useEffect(() => { setMounted(true); }, []);

  // Load entry for date
  useEffect(() => {
    dirtyRef.current = false;
    fetch(`/api/mental-health?date=${date}`)
      .then((r) => r.json())
      .then((d: { entry: MentalHealthEntry | null }) => {
        if (d.entry) {
          setEntry(d.entry);
          setMood(  (d.entry as unknown as Record<string, number>).mood         ?? 3);
          setStress((d.entry as unknown as Record<string, number>).stressLevel  ?? 3);
          setEnergy((d.entry as unknown as Record<string, number>).energy       ?? 3);
          setSleep( (d.entry as unknown as Record<string, number>).sleepQuality ?? 3);
          setNote(d.entry.notes ?? "");
        } else {
          setEntry(null);
          setMood(3); setStress(3); setEnergy(3); setSleep(3); setNote("");
        }
      })
      .catch(() => {});
  }, [date]);

  const handleSave = useCallback(async () => {
    if (!dirtyRef.current) { setOpen(false); return; }
    setSaving(true);
    try {
      const body = {
        date,
        mood, stressLevel: stress, energy, sleepQuality: sleep,
        // keep unused fields at neutral 3
        anxiety: 3, focus: 3, social: 3,
        notes: note.trim() || undefined,
      };
      const res = await fetch("/api/mental-health", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setEntry(body);
        setSaved(true);
        dirtyRef.current = false;
        setTimeout(() => { setSaved(false); setOpen(false); }, 700);
      }
    } finally { setSaving(false); }
  }, [date, mood, stress, energy, sleep, note]);

  // Close handler — auto-save if dirty
  const handleClose = useCallback(() => {
    if (dirtyRef.current) { handleSave(); }
    else setOpen(false);
  }, [handleSave]);

  function mark(setter: (v: number) => void) {
    return (v: number) => { dirtyRef.current = true; setter(v); };
  }

  // Summary text for the card
  const moodEntry = entry ? (entry as unknown as Record<string, number>).mood ?? 3 : null;
  const moodObj   = moodEntry ? MOODS.find(m => m.val === moodEntry) : null;

  const modal = open && mounted && createPortal(
    <AnimatePresence>
      <motion.div
        key="mh-backdrop"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] flex items-end justify-center"
        style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
        onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
      >
        <motion.div
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          transition={{ type: "spring", damping: 28, stiffness: 280 }}
          className="w-full max-w-md mx-auto rounded-t-3xl overflow-hidden"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          {/* Handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.15)" }} />
          </div>

          <div className="px-5 pb-6 space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <IconBrain size={16} stroke={1.5} style={{ color: "#818cf8" }} />
                <p className="font-semibold text-[14px]" style={{ color: "var(--text-primary)" }}>Comment tu vas ?</p>
              </div>
              <button onClick={handleClose} className="p-1.5 rounded-lg"
                style={{ background: "rgba(255,255,255,0.06)" }}>
                <IconX size={13} stroke={2} style={{ color: "var(--text-muted)" }} />
              </button>
            </div>

            {/* ── Humeur: 5 emoji ── */}
            <div>
              <p className="text-[11px] mb-2.5 font-medium" style={{ color: "var(--text-muted)" }}>Humeur</p>
              <div className="flex justify-between gap-1">
                {MOODS.map(({ val, emoji, label }) => (
                  <button key={val} onClick={() => mark(setMood)(val)}
                    className="flex-1 flex flex-col items-center gap-1 py-2 rounded-2xl transition-all"
                    style={{
                      background: mood === val ? `${moodColor(val)}22` : "rgba(255,255,255,0.04)",
                      border:     `1.5px solid ${mood === val ? moodColor(val) : "transparent"}`,
                    }}>
                    <span style={{ fontSize: 22 }}>{emoji}</span>
                    <span style={{ fontSize: 9, color: mood === val ? moodColor(val) : "var(--text-muted)", fontWeight: 600 }}>{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* ── Stress + Énergie side by side ── */}
            <div className="grid grid-cols-2 gap-3">
              {/* Stress */}
              <div>
                <p className="text-[11px] mb-2 font-medium" style={{ color: "var(--text-muted)" }}>😤 Stress</p>
                <div className="flex flex-col gap-1.5">
                  {STRESS_OPTS.map(({ val, label }) => (
                    <button key={val} onClick={() => mark(setStress)(val)}
                      className="py-2 rounded-xl text-[12px] font-medium transition-all"
                      style={{
                        background: stress === val ? "rgba(129,140,248,0.18)" : "rgba(255,255,255,0.04)",
                        color:      stress === val ? "#818cf8" : "var(--text-muted)",
                        border:     `1px solid ${stress === val ? "rgba(129,140,248,0.4)" : "transparent"}`,
                      }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Énergie */}
              <div>
                <p className="text-[11px] mb-2 font-medium" style={{ color: "var(--text-muted)" }}>⚡ Énergie</p>
                <div className="flex flex-col gap-1.5">
                  {ENERGY_OPTS.map(({ val, label }) => (
                    <button key={val} onClick={() => mark(setEnergy)(val)}
                      className="py-2 rounded-xl text-[12px] font-medium transition-all"
                      style={{
                        background: energy === val ? "rgba(251,191,36,0.15)" : "rgba(255,255,255,0.04)",
                        color:      energy === val ? "#fbbf24" : "var(--text-muted)",
                        border:     `1px solid ${energy === val ? "rgba(251,191,36,0.35)" : "transparent"}`,
                      }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Sommeil ── */}
            <div>
              <p className="text-[11px] mb-2 font-medium" style={{ color: "var(--text-muted)" }}>🌙 Sommeil</p>
              <div className="flex gap-2">
                {SLEEP_OPTS.map(({ val, label }) => (
                  <button key={val} onClick={() => mark(setSleep)(val)}
                    className="flex-1 py-2.5 rounded-xl text-[12px] font-medium transition-all"
                    style={{
                      background: sleep === val ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.04)",
                      color:      sleep === val ? "#818cf8" : "var(--text-muted)",
                      border:     `1px solid ${sleep === val ? "rgba(99,102,241,0.35)" : "transparent"}`,
                    }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Note optionnelle ── */}
            <input
              type="text"
              value={note}
              onChange={(e) => { dirtyRef.current = true; setNote(e.target.value); }}
              placeholder="Note rapide… (optionnel)"
              className="w-full px-3 py-2.5 rounded-xl text-[13px] outline-none"
              style={{
                background: "rgba(255,255,255,0.05)",
                border:     "1px solid var(--border)",
                color:      "var(--text-primary)",
              }}
            />

            {/* Save */}
            <button onClick={handleSave} disabled={saving || saved}
              className="btn btn-primary w-full gap-2"
              style={{ height: "42px" }}>
              {saved   ? <><IconCheck size={15} stroke={2} /> Enregistré !</>
               : saving ? <><IconLoader2 size={13} stroke={2} className="animate-spin" /> Sauvegarde…</>
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
      <button onClick={() => setOpen(true)}
        className="card flex items-center gap-3 w-full text-left transition-opacity active:opacity-70"
        style={{ padding: "14px 16px" }}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(129,140,248,0.12)", border: "1px solid rgba(129,140,248,0.2)", fontSize: 18 }}>
          {moodObj ? moodObj.emoji : "🧠"}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>Santé mentale</p>
          {moodObj
            ? <p className="text-[11px]" style={{ color: moodColor(moodObj.val) }}>Humeur : {moodObj.label}</p>
            : <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Comment tu te sens ?</p>
          }
        </div>
        <IconBrain size={17} stroke={entry ? 2 : 1.5} style={{ color: "#818cf8", flexShrink: 0 }} />
      </button>
    </>
  );
}
