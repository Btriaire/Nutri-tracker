"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { format, subDays, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { IconX, IconTrophy, IconTrendingUp } from "@tabler/icons-react";
import MuscleBodyMap from "./MuscleBodyMap";
import { EXERCISE_BY_ID, MUSCLE_LABELS, type Muscle } from "@/app/lib/exercises";
import type { GymSession } from "@/app/lib/types";

const ACCENT = "#38bdf8";

interface Props { onClose: () => void }

export default function GymProgressModal({ onClose }: Props) {
  const [sessions, setSessions] = useState<GymSession[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [exId,     setExId]     = useState<string | null>(null);

  useEffect(() => {
    const to   = format(new Date(), "yyyy-MM-dd");
    const from = format(subDays(new Date(), 90), "yyyy-MM-dd");
    fetch(`/api/gym?from=${from}&to=${to}`)
      .then((r) => r.json())
      .then((d: { sessions?: GymSession[] }) => setSessions(d.sessions ?? []))
      .catch(() => setSessions([]))
      .finally(() => setLoading(false));
  }, []);

  // ── Volume par muscle (heatmap) ────────────────────────────────────────────
  const { hotMuscles, warmMuscles } = useMemo(() => {
    const vol: Record<string, number> = {};
    for (const s of sessions) {
      for (const ex of s.exercises) {
        const meta = EXERCISE_BY_ID[ex.exerciseId];
        if (!meta) continue;
        const exVol = ex.sets.reduce((a, st) => a + (st.done ? st.reps * st.weightKg : 0), 0)
          || ex.sets.reduce((a, st) => a + st.reps, 0); // poids du corps → compte les reps
        vol[meta.primary] = (vol[meta.primary] ?? 0) + exVol;
        meta.secondary.forEach((m) => { vol[m] = (vol[m] ?? 0) + exVol * 0.4; });
      }
    }
    const entries = Object.entries(vol).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    const cut = Math.ceil(entries.length / 2);
    return {
      hotMuscles:  entries.slice(0, cut).map(([m]) => m as Muscle),
      warmMuscles: entries.slice(cut).map(([m]) => m as Muscle),
    };
  }, [sessions]);

  // ── Exercices présents (triés par fréquence) ────────────────────────────────
  const exerciseList = useMemo(() => {
    const count: Record<string, { id: string; name: string; n: number }> = {};
    for (const s of sessions) {
      for (const ex of s.exercises) {
        if (!count[ex.exerciseId]) count[ex.exerciseId] = { id: ex.exerciseId, name: ex.name, n: 0 };
        count[ex.exerciseId].n += 1;
      }
    }
    return Object.values(count).sort((a, b) => b.n - a.n);
  }, [sessions]);

  // sélection par défaut
  useEffect(() => {
    if (!exId && exerciseList.length) setExId(exerciseList[0].id);
  }, [exerciseList, exId]);

  // ── Courbe de progression de l'exercice choisi ──────────────────────────────
  const chartData = useMemo(() => {
    if (!exId) return [] as { date: string; label: string; maxKg: number; volume: number }[];
    const byDate: Record<string, { maxKg: number; volume: number }> = {};
    for (const s of sessions) {
      for (const ex of s.exercises) {
        if (ex.exerciseId !== exId) continue;
        const maxKg  = Math.max(0, ...ex.sets.map((st) => st.weightKg));
        const volume = ex.sets.reduce((a, st) => a + (st.done ? st.reps * st.weightKg : 0), 0);
        const cur = byDate[s.date] ?? { maxKg: 0, volume: 0 };
        byDate[s.date] = { maxKg: Math.max(cur.maxKg, maxKg), volume: cur.volume + volume };
      }
    }
    return Object.entries(byDate)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, v]) => ({ date, label: format(parseISO(date), "dd/MM", { locale: fr }), ...v }));
  }, [sessions, exId]);

  const pr = chartData.length ? Math.max(...chartData.map((d) => d.maxKg)) : 0;
  const totalSessions = sessions.length;
  const totalVolume   = sessions.reduce((a, s) => a + (s.totalVolumeKg ?? 0), 0);

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-40" style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(6px)" }} onClick={onClose} />

      <motion.div initial={{ opacity: 0, y: 44 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 44 }}
        transition={{ type: "spring", damping: 28, stiffness: 300 }}
        className="fixed bottom-0 inset-x-0 z-50 rounded-t-2xl flex flex-col mx-auto"
        style={{ background: "rgba(11,11,17,0.98)", border: "1px solid rgba(255,255,255,0.08)", borderBottom: "none", backdropFilter: "blur(28px)", maxHeight: "92vh", maxWidth: "34rem" }}>

        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.15)" }} />
        </div>

        <div className="flex items-center gap-3 px-5 pb-3 flex-shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${ACCENT}22` }}>
            <IconTrendingUp size={16} style={{ color: ACCENT }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>Progression salle</p>
            <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>90 derniers jours</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-muted)" }}><IconX size={15} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <p className="text-center text-[13px] py-12" style={{ color: "var(--text-muted)" }}>Chargement…</p>
          ) : totalSessions === 0 ? (
            <div className="text-center py-12">
              <p className="text-[13px]" style={{ color: "var(--text-primary)" }}>Aucune séance enregistrée</p>
              <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>Enregistre une séance pour voir ta progression ici.</p>
            </div>
          ) : (
            <>
              {/* Stats */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <p className="text-[20px] font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>{totalSessions}</p>
                  <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>séances</p>
                </div>
                <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <p className="text-[20px] font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>{Math.round(totalVolume / 1000)}t</p>
                  <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>volume total soulevé</p>
                </div>
              </div>

              {/* Muscle heatmap */}
              <div className="rounded-2xl py-4 mb-4" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <p className="text-center text-[11px] mb-1" style={{ color: "var(--text-muted)" }}>Muscles les plus travaillés</p>
                <MuscleBodyMap primary={hotMuscles} secondary={warmMuscles} accent={ACCENT} size={180} />
              </div>

              {/* Exercise selector */}
              <div className="flex gap-1.5 overflow-x-auto pb-2 mb-1" style={{ scrollbarWidth: "none" }}>
                {exerciseList.map((e) => (
                  <button key={e.id} onClick={() => setExId(e.id)}
                    className="px-3 py-1.5 rounded-lg text-[12px] font-medium whitespace-nowrap transition-all"
                    style={{ background: exId === e.id ? ACCENT : "rgba(255,255,255,0.05)", color: exId === e.id ? "#fff" : "var(--text-muted)" }}>
                    {e.name}
                  </button>
                ))}
              </div>

              {exId && (
                <div className="rounded-2xl p-3 pt-4" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div className="flex items-center justify-between mb-2 px-1">
                    <p className="text-[12px]" style={{ color: "var(--text-secondary)" }}>{EXERCISE_BY_ID[exId] ? MUSCLE_LABELS[EXERCISE_BY_ID[exId].primary] : ""}</p>
                    {pr > 0 && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md" style={{ background: "rgba(250,204,21,0.12)", color: "#facc15" }}>
                        <IconTrophy size={12} /> Record {pr} kg
                      </span>
                    )}
                  </div>
                  {chartData.length >= 2 ? (
                    <ResponsiveContainer width="100%" height={180}>
                      <LineChart data={chartData} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} width={36} />
                        <Tooltip
                          contentStyle={{ background: "rgba(20,20,28,0.96)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, fontSize: 12 }}
                          labelStyle={{ color: "var(--text-muted)" }}
                          formatter={(v) => [`${v} kg`, "Charge max"]} />
                        <Line type="linear" dataKey="maxKg" stroke={ACCENT} strokeWidth={2.5}
                          dot={{ r: 3, fill: ACCENT, strokeWidth: 0 }} activeDot={{ r: 5 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-center text-[11px] py-8" style={{ color: "var(--text-muted)" }}>
                      Encore une séance avec cet exercice pour tracer la courbe.
                    </p>
                  )}
                </div>
              )}
              <div style={{ height: 24 }} />
            </>
          )}
        </div>
      </motion.div>
    </>
  );
}
