"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { IconX, IconCheck, IconLoader2, IconFlame, IconClock, IconMinus, IconPlus } from "@tabler/icons-react";
import type { ExerciseEntry } from "@/app/lib/exercise-catalog";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ActivitySaveData {
  name:           string;
  activityType:   number;
  durationMin:    number;
  caloriesBurned: number | null;
  sets?:          number;
  reps?:          number;
  weightKg?:      number | null;
}

interface Props {
  exercise:    ExerciseEntry | null;
  catColor:    string;
  catColor2:   string;
  weightKg:    number;   // user body weight for MET calc
  saving:      boolean;
  onSave:      (data: ActivitySaveData) => void;
  onClose:     () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isMuscu(category: string) { return category === "musculation"; }

function calcKcalCardio(met: number, bodyKg: number, durationMin: number) {
  return Math.round(met * bodyKg * durationMin / 60);
}

function calcKcalMuscu(sets: number, reps: number, loadKg: number) {
  return Math.round(sets * reps * (loadKg || 10) * 0.04 + sets * 2.5 * 4);
}

const DURATION_PRESETS = [10, 15, 20, 30, 45, 60, 90];

// ─── Stepper ─────────────────────────────────────────────────────────────────

function Stepper({
  label, value, unit, onChange, min = 1, step = 1, color,
}: {
  label: string; value: number; unit?: string;
  onChange: (n: number) => void; min?: number; step?: number; color: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-[10px] font-semibold uppercase tracking-widest"
        style={{ color: "rgba(255,255,255,0.4)" }}>
        {label}
      </p>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - step))}
          className="w-9 h-9 rounded-2xl flex items-center justify-center transition-all active:scale-90"
          style={{ background: `${color}20`, border: `1px solid ${color}35` }}
        >
          <IconMinus size={14} style={{ color }} />
        </button>
        <div className="flex items-baseline gap-1 min-w-[52px] justify-center">
          <span className="text-[32px] font-extralight tabular-nums leading-none"
            style={{ color: "var(--text-primary)" }}>
            {value}
          </span>
          {unit && (
            <span className="text-[12px]" style={{ color: "rgba(255,255,255,0.45)" }}>{unit}</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => onChange(value + step)}
          className="w-9 h-9 rounded-2xl flex items-center justify-center transition-all active:scale-90"
          style={{ background: `${color}20`, border: `1px solid ${color}35` }}
        >
          <IconPlus size={14} style={{ color }} />
        </button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ActivityDetailSheet({
  exercise, catColor, catColor2, weightKg, saving, onSave, onClose,
}: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // ── Form state ─────────────────────────────────────────────────────────────
  const [duration,   setDuration]   = useState(30);
  const [sets,       setSets]       = useState(3);
  const [reps,       setReps]       = useState(10);
  const [loadKg,     setLoadKg]     = useState(0);
  const [kcalEdit,   setKcalEdit]   = useState<string>("");
  const [kcalCustom, setKcalCustom] = useState(false);

  const muscu = exercise ? isMuscu(exercise.category) : false;

  // Reset form when exercise changes
  useEffect(() => {
    if (!exercise) return;
    setDuration(30);
    setSets(3);
    setReps(10);
    setLoadKg(0);
    setKcalEdit("");
    setKcalCustom(false);
  }, [exercise?.id]);

  // ── Kcal estimate ─────────────────────────────────────────────────────────
  const kcalEst = exercise
    ? muscu
      ? calcKcalMuscu(sets, reps, loadKg)
      : calcKcalCardio(exercise.met, weightKg, duration)
    : 0;

  const kcalFinal = kcalCustom && kcalEdit !== ""
    ? parseInt(kcalEdit, 10) || null
    : kcalEst;

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = useCallback(() => {
    if (!exercise) return;
    const durationMin = muscu ? Math.max(5, sets * 2.5) : duration;
    onSave({
      name:           exercise.name,
      activityType:   exercise.activityType,
      durationMin:    Math.round(durationMin),
      caloriesBurned: kcalFinal,
      ...(muscu ? { sets, reps, weightKg: loadKg > 0 ? loadKg : null } : {}),
    });
  }, [exercise, muscu, duration, sets, reps, loadKg, kcalFinal, onSave]);

  return mounted ? createPortal(
    <AnimatePresence>
      {exercise && (
        <motion.div
          key="detail-backdrop"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(6px)" }}
          onClick={onClose}
        >
          <motion.div
            key="detail-sheet"
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 290 }}
            className="w-full max-w-md rounded-t-3xl overflow-hidden"
            style={{ background: "rgba(8,8,12,0.98)" }}
            onClick={e => e.stopPropagation()}
          >
            {/* ── Hero header ─────────────────────────────────────── */}
            <div className="relative overflow-hidden"
              style={{
                background: `linear-gradient(155deg, ${catColor}22 0%, ${catColor2}14 100%)`,
                borderBottom: `1px solid ${catColor}20`,
              }}
            >
              {/* Decorative glow blobs */}
              <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full pointer-events-none"
                style={{ background: `${catColor}18`, filter: "blur(24px)" }} />
              <div className="absolute -bottom-6 -left-6 w-24 h-24 rounded-full pointer-events-none"
                style={{ background: `${catColor2}14`, filter: "blur(20px)" }} />

              {/* Drag handle */}
              <div className="flex justify-center pt-3">
                <div className="w-9 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.15)" }} />
              </div>

              {/* Close button */}
              <button onClick={onClose}
                className="absolute top-4 right-4 btn-icon z-10">
                <IconX size={14} />
              </button>

              {/* Emoji + exercise info */}
              <div className="flex items-center gap-4 px-6 pt-4 pb-6">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-4xl flex-shrink-0"
                  style={{
                    background: `${catColor}18`,
                    border: `1.5px solid ${catColor}30`,
                    boxShadow: `0 0 20px ${catColor}20`,
                  }}>
                  {exercise.emoji}
                </div>
                <div className="min-w-0">
                  <p className="text-[19px] font-bold leading-tight"
                    style={{ color: "var(--text-primary)" }}>
                    {exercise.name}
                  </p>
                  {exercise.muscles && exercise.muscles.length > 0 && (
                    <p className="text-[11px] mt-0.5 truncate"
                      style={{ color: "rgba(255,255,255,0.4)" }}>
                      {exercise.muscles.slice(0, 3).join(" · ")}
                    </p>
                  )}
                  {/* Kcal badge */}
                  <div className="flex items-center gap-1.5 mt-2">
                    <IconFlame size={13} style={{ color: catColor }} />
                    <span className="text-[13px] font-semibold tabular-nums"
                      style={{ color: catColor }}>
                      ~{kcalFinal ?? kcalEst} kcal
                    </span>
                    <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>
                      estimées
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Form body ──────────────────────────────────────── */}
            <div className="px-6 pt-6 pb-2">

              {muscu ? (
                /* ── Musculation: sets × reps × weight ── */
                <>
                  <div className="flex items-start justify-around mb-6">
                    <Stepper label="Séries"    value={sets}   onChange={setSets}   min={1}   color={catColor} />
                    <div className="w-px self-stretch mt-8" style={{ background: "rgba(255,255,255,0.06)" }} />
                    <Stepper label="Répétitions" value={reps} onChange={setReps}   min={1}   color={catColor} />
                    <div className="w-px self-stretch mt-8" style={{ background: "rgba(255,255,255,0.06)" }} />
                    <Stepper label="Poids (kg)"  value={loadKg} onChange={setLoadKg} min={0} step={2.5} unit="kg" color={catColor} />
                  </div>

                  {/* Kcal override */}
                  <div className="flex items-center gap-3 mb-5 p-3 rounded-2xl"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                    <IconFlame size={15} style={{ color: catColor }} />
                    <span className="text-[12px] flex-1" style={{ color: "rgba(255,255,255,0.5)" }}>
                      Kcal brûlées
                    </span>
                    <input
                      type="number"
                      value={kcalCustom ? kcalEdit : String(kcalEst)}
                      onFocus={() => { setKcalCustom(true); setKcalEdit(String(kcalEst)); }}
                      onChange={e => setKcalEdit(e.target.value)}
                      className="w-20 text-right bg-transparent text-[14px] font-semibold tabular-nums outline-none"
                      style={{ color: catColor }}
                    />
                  </div>
                </>
              ) : (
                /* ── Cardio / Sport / Détente : duration ── */
                <>
                  {/* Steppers row */}
                  <div className="flex justify-center mb-5">
                    <Stepper
                      label="Durée"
                      value={duration}
                      unit="min"
                      onChange={setDuration}
                      min={1}
                      step={5}
                      color={catColor}
                    />
                  </div>

                  {/* Quick-select pills */}
                  <div className="flex gap-2 flex-wrap justify-center mb-5">
                    {DURATION_PRESETS.map(p => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setDuration(p)}
                        className="px-3 py-1.5 rounded-xl text-[12px] font-medium transition-all"
                        style={{
                          background:  duration === p ? `${catColor}20` : "rgba(255,255,255,0.05)",
                          border:      `1px solid ${duration === p ? catColor + "45" : "rgba(255,255,255,0.08)"}`,
                          color:       duration === p ? catColor : "rgba(255,255,255,0.45)",
                        }}
                      >
                        {p}&thinsp;min
                      </button>
                    ))}
                  </div>

                  {/* Kcal override row */}
                  <div className="flex items-center gap-3 mb-5 p-3 rounded-2xl"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                    <IconFlame size={15} style={{ color: catColor }} />
                    <span className="text-[12px] flex-1" style={{ color: "rgba(255,255,255,0.5)" }}>
                      Kcal brûlées
                    </span>
                    <input
                      type="number"
                      value={kcalCustom ? kcalEdit : String(kcalEst)}
                      onFocus={() => { setKcalCustom(true); setKcalEdit(String(kcalEst)); }}
                      onChange={e => setKcalEdit(e.target.value)}
                      className="w-20 text-right bg-transparent text-[14px] font-semibold tabular-nums outline-none"
                      style={{ color: catColor }}
                    />
                    <IconClock size={13} style={{ color: "rgba(255,255,255,0.3)" }} />
                  </div>
                </>
              )}
            </div>

            {/* ── Save button ─────────────────────────────────────── */}
            <div className="px-6 pb-10">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2.5 rounded-2xl font-semibold text-[14px] transition-all active:scale-[0.98]"
                style={{
                  height: "52px",
                  background: saving
                    ? "rgba(255,255,255,0.06)"
                    : `linear-gradient(135deg, ${catColor} 0%, ${catColor2} 100%)`,
                  color:  saving ? "rgba(255,255,255,0.4)" : "#fff",
                  boxShadow: saving ? "none" : `0 4px 24px ${catColor}40`,
                }}
              >
                {saving
                  ? <><IconLoader2 size={16} className="animate-spin" /> Enregistrement…</>
                  : <><IconCheck size={16} /> Ajouter l&apos;activité</>
                }
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  ) : null;
}
