"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  IconX, IconPlus, IconMinus, IconCheck, IconTrash, IconChevronLeft,
  IconBarbell, IconSearch, IconCamera, IconClock, IconPlayerSkipForward,
} from "@tabler/icons-react";
import MuscleBodyMap from "./MuscleBodyMap";
import {
  EXERCISES, EXERCISE_BY_ID, GROUP_ORDER, GROUP_LABELS, MUSCLE_LABELS,
  EQUIPMENT_LABELS, exercisesByGroup, type Muscle, type MuscleGroup, type Exercise,
} from "@/app/lib/exercises";

const ACCENT = "#38bdf8";

interface DraftSet { reps: number; weightKg: number; done: boolean }
interface DraftExercise {
  exerciseId:    string;
  name:          string;
  primaryMuscle: Muscle;
  secondary:     Muscle[];
  sets:          DraftSet[];
  machinePhoto?: string;
}

interface Props {
  date:    string;
  onSaved: () => void;
  onClose: () => void;
}

const NAME_PRESETS = ["Push", "Pull", "Jambes", "Haut du corps", "Full body"];
const REST_SECONDS = 90;

// Redimensionne une photo en JPEG base64 (max 480px) pour stockage léger
function resizeImage(file: File, max = 480): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("no ctx")); return; }
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.7));
    };
    img.onerror = reject;
    img.src = url;
  });
}

export default function GymSessionModal({ date, onSaved, onClose }: Props) {
  const [view,        setView]        = useState<"builder" | "picker">("builder");
  const [name,        setName]        = useState("Séance muscu");
  const [durationMin, setDurationMin] = useState(45);
  const [exercises,   setExercises]   = useState<DraftExercise[]>([]);
  const [pickerGroup, setPickerGroup] = useState<MuscleGroup>("pectoraux");
  const [query,       setQuery]       = useState("");
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [restSec,     setRestSec]     = useState<number | null>(null);

  const fileRef        = useRef<HTMLInputElement | null>(null);
  const photoTargetRef = useRef<number | null>(null);

  // ── Rest timer countdown ────────────────────────────────────────────────────
  useEffect(() => {
    if (restSec === null) return;
    if (restSec <= 0) { setRestSec(null); return; }
    const t = setTimeout(() => setRestSec((s) => (s === null ? null : s - 1)), 1000);
    return () => clearTimeout(t);
  }, [restSec]);

  // ── Aggregate worked muscles for the live body map ──────────────────────────
  const { primaryMuscles, secondaryMuscles } = useMemo(() => {
    const prim = new Set<Muscle>();
    const sec  = new Set<Muscle>();
    for (const ex of exercises) {
      prim.add(ex.primaryMuscle);
      ex.secondary.forEach((m) => sec.add(m));
    }
    // ne pas mettre en secondaire un muscle déjà primaire
    prim.forEach((m) => sec.delete(m));
    return { primaryMuscles: [...prim], secondaryMuscles: [...sec] };
  }, [exercises]);

  const totalVolume = useMemo(
    () => exercises.reduce((acc, ex) =>
      acc + ex.sets.reduce((a, s) => a + (s.done ? s.reps * s.weightKg : 0), 0), 0),
    [exercises],
  );
  const totalSets = exercises.reduce((a, ex) => a + ex.sets.length, 0);

  // ── Exercise list edits ─────────────────────────────────────────────────────
  const addExercise = (ex: Exercise) => {
    setExercises((prev) => [...prev, {
      exerciseId:    ex.id,
      name:          ex.name,
      primaryMuscle: ex.primary,
      secondary:     ex.secondary,
      sets:          [{ reps: 10, weightKg: 20, done: true }],
    }]);
    setView("builder");
  };
  const removeExercise = (i: number) => setExercises((p) => p.filter((_, idx) => idx !== i));
  const addSet = (i: number) => setExercises((p) => p.map((ex, idx) => {
    if (idx !== i) return ex;
    const last = ex.sets[ex.sets.length - 1] ?? { reps: 10, weightKg: 20, done: true };
    return { ...ex, sets: [...ex.sets, { ...last, done: true }] };
  }));
  const removeSet = (i: number, si: number) => setExercises((p) => p.map((ex, idx) =>
    idx !== i ? ex : { ...ex, sets: ex.sets.filter((_, j) => j !== si) }).filter((ex) => ex.sets.length > 0));
  const updateSet = (i: number, si: number, field: "reps" | "weightKg", val: number) =>
    setExercises((p) => p.map((ex, idx) => idx !== i ? ex : {
      ...ex, sets: ex.sets.map((s, j) => j !== si ? s : { ...s, [field]: Math.max(0, val) }),
    }));
  const toggleSetDone = (i: number, si: number) => {
    let nowDone = false;
    setExercises((p) => p.map((ex, idx) => idx !== i ? ex : {
      ...ex, sets: ex.sets.map((s, j) => {
        if (j !== si) return s;
        nowDone = !s.done;
        return { ...s, done: nowDone };
      }),
    }));
    // Démarre le minuteur de repos quand on valide une série
    setTimeout(() => { if (nowDone) setRestSec(REST_SECONDS); }, 0);
  };

  // ── Machine photo ─────────────────────────────────────────────────────────────
  const openCamera = (i: number) => { photoTargetRef.current = i; fileRef.current?.click(); };
  const onPhotoPicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const i = photoTargetRef.current;
    e.target.value = "";
    if (!file || i === null) return;
    try {
      const dataUrl = await resizeImage(file);
      setExercises((p) => p.map((ex, idx) => idx !== i ? ex : { ...ex, machinePhoto: dataUrl }));
    } catch { /* ignore */ }
  };

  // ── Save ────────────────────────────────────────────────────────────────────
  const save = async () => {
    if (exercises.length === 0) { setError("Ajoutez au moins un exercice"); return; }
    setSaving(true); setError(null);
    try {
      const res = await fetch("/api/gym", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          name: name.trim() || "Séance muscu",
          durationMin,
          exercises: exercises.map((ex) => ({
            exerciseId:    ex.exerciseId,
            name:          ex.name,
            primaryMuscle: ex.primaryMuscle,
            sets:          ex.sets.map((s) => ({ reps: s.reps, weightKg: s.weightKg, done: s.done })),
            ...(ex.machinePhoto ? { machinePhoto: ex.machinePhoto } : {}),
          })),
        }),
      });
      if (!res.ok) throw new Error("api");
      onSaved();
    } catch {
      setError("Erreur lors de l'enregistrement");
      setSaving(false);
    }
  };

  // ── Picker filtered list ──────────────────────────────────────────────────────
  const pickerList = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q) return EXERCISES.filter((e) => e.name.toLowerCase().includes(q));
    return exercisesByGroup(pickerGroup);
  }, [query, pickerGroup]);

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-40"
        style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(6px)" }}
        onClick={onClose}
      />

      <motion.div
        initial={{ opacity: 0, y: 44 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 44 }}
        transition={{ type: "spring", damping: 28, stiffness: 300 }}
        className="fixed bottom-0 inset-x-0 z-50 rounded-t-2xl flex flex-col mx-auto"
        style={{
          background: "rgba(11,11,17,0.98)", border: "1px solid rgba(255,255,255,0.08)",
          borderBottom: "none", backdropFilter: "blur(28px)", maxHeight: "92vh", maxWidth: "34rem",
        }}
      >
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.15)" }} />
        </div>

        {/* Header */}
        <div className="flex items-center gap-3 px-5 pb-3 flex-shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          {view === "picker" ? (
            <button onClick={() => { setView("builder"); setQuery(""); }} className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-muted)" }}>
              <IconChevronLeft size={16} />
            </button>
          ) : (
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${ACCENT}22` }}>
              <IconBarbell size={16} style={{ color: ACCENT }} />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>
              {view === "picker" ? "Choisir un exercice" : "Nouvelle séance"}
            </p>
            <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
              {view === "picker" ? `${EXERCISES.length} exercices` : "Salle de sport"}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-muted)" }}>
            <IconX size={15} />
          </button>
        </div>

        {/* ─── PICKER VIEW ─── */}
        {view === "picker" && (
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {/* search */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl mb-3"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)" }}>
              <IconSearch size={15} style={{ color: "var(--text-muted)" }} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher un exercice…"
                className="flex-1 bg-transparent outline-none text-[13px]" style={{ color: "var(--text-primary)" }} />
            </div>

            {/* group tabs */}
            {!query && (
              <div className="flex gap-1.5 overflow-x-auto pb-2 mb-2" style={{ scrollbarWidth: "none" }}>
                {GROUP_ORDER.map((g) => (
                  <button key={g} onClick={() => setPickerGroup(g)}
                    className="px-3 py-1.5 rounded-lg text-[12px] font-medium whitespace-nowrap transition-all"
                    style={{
                      background: pickerGroup === g ? ACCENT : "rgba(255,255,255,0.05)",
                      color: pickerGroup === g ? "#fff" : "var(--text-muted)",
                    }}>
                    {GROUP_LABELS[g]}
                  </button>
                ))}
              </div>
            )}

            {/* exercise list */}
            <div className="space-y-1.5">
              {pickerList.map((ex) => (
                <button key={ex.id} onClick={() => addExercise(ex)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all active:scale-[0.99]"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium truncate" style={{ color: "var(--text-primary)" }}>{ex.name}</p>
                    <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                      {MUSCLE_LABELS[ex.primary]} · {EQUIPMENT_LABELS[ex.equipment]}
                    </p>
                  </div>
                  <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `${ACCENT}22` }}>
                    <IconPlus size={14} style={{ color: ACCENT }} />
                  </div>
                </button>
              ))}
              {pickerList.length === 0 && (
                <p className="text-center text-[12px] py-8" style={{ color: "var(--text-muted)" }}>Aucun exercice trouvé</p>
              )}
            </div>
          </div>
        )}

        {/* ─── BUILDER VIEW ─── */}
        {view === "builder" && (
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {/* name + duration */}
            <div className="flex gap-2 mb-3">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom de la séance"
                className="flex-1 px-3 py-2.5 rounded-xl text-[14px] font-semibold outline-none"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
              <div className="flex items-center gap-1 px-2 rounded-xl" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)" }}>
                <button onClick={() => setDurationMin((d) => Math.max(5, d - 5))} className="w-6 h-6 flex items-center justify-center" style={{ color: "var(--text-muted)" }}><IconMinus size={12} /></button>
                <span className="text-[13px] tabular-nums w-12 text-center" style={{ color: "var(--text-primary)" }}>{durationMin}m</span>
                <button onClick={() => setDurationMin((d) => Math.min(300, d + 5))} className="w-6 h-6 flex items-center justify-center" style={{ color: "var(--text-muted)" }}><IconPlus size={12} /></button>
              </div>
            </div>

            {/* name presets */}
            <div className="flex gap-1.5 overflow-x-auto pb-3" style={{ scrollbarWidth: "none" }}>
              {NAME_PRESETS.map((p) => (
                <button key={p} onClick={() => setName(p)}
                  className="px-2.5 py-1 rounded-lg text-[11px] whitespace-nowrap"
                  style={{ background: name === p ? `${ACCENT}22` : "rgba(255,255,255,0.04)", color: name === p ? ACCENT : "var(--text-muted)" }}>
                  {p}
                </button>
              ))}
            </div>

            {/* live body map */}
            {exercises.length > 0 && (
              <div className="rounded-2xl py-4 mb-4" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <MuscleBodyMap primary={primaryMuscles} secondary={secondaryMuscles} accent={ACCENT} size={180} />
                <div className="flex justify-center gap-4 mt-2 text-[10px]" style={{ color: "var(--text-muted)" }}>
                  <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ background: ACCENT }} /> Principal</span>
                  <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ background: `${ACCENT}66` }} /> Secondaire</span>
                </div>
              </div>
            )}

            {/* exercises */}
            <div className="space-y-3">
              {exercises.map((ex, i) => (
                <motion.div key={`${ex.exerciseId}-${i}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <div className="flex items-center justify-between mb-2 gap-2">
                    {ex.machinePhoto && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={ex.machinePhoto} alt="appareil" className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                        style={{ border: "1px solid rgba(255,255,255,0.1)" }} />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold truncate" style={{ color: "var(--text-primary)" }}>{ex.name}</p>
                      <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{MUSCLE_LABELS[ex.primaryMuscle]}</p>
                    </div>
                    <button onClick={() => openCamera(i)} aria-label="Photo de l'appareil"
                      className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: `${ACCENT}1A`, color: ACCENT }}><IconCamera size={13} /></button>
                    <button onClick={() => removeExercise(i)} className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: "rgba(239,68,68,0.1)", color: "#f87171" }}><IconTrash size={13} /></button>
                  </div>

                  {/* sets */}
                  <div className="space-y-1.5">
                    {ex.sets.map((s, si) => (
                      <div key={si} className="flex items-center gap-2">
                        <button onClick={() => toggleSetDone(i, si)} aria-label="Valider la série"
                          className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all"
                          style={{
                            background: s.done ? ACCENT : "rgba(255,255,255,0.06)",
                            border: `1.5px solid ${s.done ? ACCENT : "rgba(255,255,255,0.18)"}`,
                            color: s.done ? "#fff" : "var(--text-muted)",
                          }}>
                          {s.done ? <IconCheck size={12} stroke={3} /> : <span className="text-[10px] tabular-nums">{si + 1}</span>}
                        </button>
                        {/* reps */}
                        <div className="flex items-center gap-1 flex-1">
                          <button onClick={() => updateSet(i, si, "reps", s.reps - 1)} className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-muted)" }}><IconMinus size={10} /></button>
                          <input type="number" value={s.reps} onChange={(e) => updateSet(i, si, "reps", parseInt(e.target.value) || 0)}
                            className="w-full text-center text-[12px] rounded-md tabular-nums outline-none py-1" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text-primary)" }} />
                          <button onClick={() => updateSet(i, si, "reps", s.reps + 1)} className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-muted)" }}><IconPlus size={10} /></button>
                        </div>
                        <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>reps</span>
                        {/* weight */}
                        <div className="flex items-center gap-1 flex-1">
                          <button onClick={() => updateSet(i, si, "weightKg", s.weightKg - 2.5)} className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-muted)" }}><IconMinus size={10} /></button>
                          <input type="number" value={s.weightKg} onChange={(e) => updateSet(i, si, "weightKg", parseFloat(e.target.value) || 0)}
                            className="w-full text-center text-[12px] rounded-md tabular-nums outline-none py-1" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text-primary)" }} />
                          <button onClick={() => updateSet(i, si, "weightKg", s.weightKg + 2.5)} className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-muted)" }}><IconPlus size={10} /></button>
                        </div>
                        <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>kg</span>
                        <button onClick={() => removeSet(i, si)} className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0" style={{ color: "var(--text-muted)" }}><IconX size={11} /></button>
                      </div>
                    ))}
                  </div>

                  <button onClick={() => addSet(i)} className="mt-2 w-full py-1.5 rounded-lg text-[11px] font-medium flex items-center justify-center gap-1"
                    style={{ background: "rgba(255,255,255,0.04)", color: ACCENT }}>
                    <IconPlus size={12} /> Ajouter une série
                  </button>
                </motion.div>
              ))}
            </div>

            {/* add exercise */}
            <button onClick={() => setView("picker")}
              className="w-full mt-3 py-3 rounded-xl text-[13px] font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
              style={{ background: `${ACCENT}14`, border: `1px dashed ${ACCENT}55`, color: ACCENT }}>
              <IconPlus size={16} /> Ajouter un exercice
            </button>

            {error && (
              <p className="mt-3 text-center text-[12px]" style={{ color: "#f87171" }}>{error}</p>
            )}
          </div>
        )}

        {/* Hidden camera input */}
        <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPhotoPicked} />

        {/* Rest timer */}
        <AnimatePresence>
          {restSec !== null && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}
              className="flex-shrink-0 mx-5 mb-2 px-4 py-2.5 rounded-xl flex items-center gap-3"
              style={{ background: `${ACCENT}1A`, border: `1px solid ${ACCENT}44` }}>
              <IconClock size={16} style={{ color: ACCENT }} />
              <span className="text-[13px] font-semibold tabular-nums" style={{ color: ACCENT }}>
                Repos {Math.floor(restSec / 60)}:{String(restSec % 60).padStart(2, "0")}
              </span>
              <div className="flex-1" />
              <button onClick={() => setRestSec((s) => (s ?? 0) + 15)} className="text-[11px] px-2 py-1 rounded-md" style={{ background: "rgba(255,255,255,0.08)", color: "var(--text-secondary)" }}>+15s</button>
              <button onClick={() => setRestSec(null)} className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-md" style={{ background: "rgba(255,255,255,0.08)", color: "var(--text-secondary)" }}>
                <IconPlayerSkipForward size={11} /> Passer
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom save bar (builder only) */}
        {view === "builder" && (
          <div className="flex-shrink-0 px-5 pt-3 pb-8" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
            <button onClick={save} disabled={saving || exercises.length === 0}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-[14px] font-semibold transition-all active:scale-[0.98] disabled:opacity-40"
              style={{ background: ACCENT, color: "#fff", boxShadow: exercises.length > 0 ? `0 4px 20px ${ACCENT}35` : "none" }}>
              {saving ? (
                <><motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>⏳</motion.span> Enregistrement…</>
              ) : (
                <><IconCheck size={16} stroke={2.5} /> Enregistrer · {totalSets} séries · {Math.round(totalVolume)} kg</>
              )}
            </button>
          </div>
        )}
      </motion.div>
    </>
  );
}
