"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import { format, addDays, subDays, isToday, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import {
  CaretLeft, CaretRight, Plus, X, Heartbeat, Thermometer,
  Drop, Spinner, Trash, PencilSimple, Heart, Note,
  Lightning, Moon, Warning, CheckCircle, ArrowDown, ArrowUp, Minus,
} from "@phosphor-icons/react";
import {
  LineChart, Line, AreaChart, Area,
  XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid,
} from "recharts";
import type { BloodPressureReading, BPMoment, HealthEntry } from "@/app/lib/types";
import type { CardioPoint } from "@/app/api/cardio/route";
import MentalHealthWidget from "@/app/components/MentalHealthWidget";

type HealthData = Omit<HealthEntry, "updatedAt">;
type HealthTab = "vitaux" | "cardiaque" | "bienetre";

interface Props {
  date:          string;
  initialEntry:  HealthData | null;
  trend:         HealthData[];
  cardioPoints:  CardioPoint[];
  age?:          number;
}

// ─── BP Category ────────────────────────────────────────────────────────────

function bpCategory(sys: number, dia: number) {
  if (sys < 90 || dia < 60)    return { label: "Hypotension",   color: "#7986CB", bg: "rgba(121,134,203,0.12)" };
  if (sys < 120 && dia < 80)   return { label: "Optimal",       color: "#34A853", bg: "rgba(52,168,83,0.12)" };
  if (sys < 130 && dia < 85)   return { label: "Normal",        color: "#4285F4", bg: "rgba(66,133,244,0.12)" };
  if (sys < 140 && dia < 90)   return { label: "Normal Haute",  color: "#FBBC04", bg: "rgba(251,188,4,0.12)" };
  if (sys < 160 && dia < 100)  return { label: "HTA Grade 1",   color: "#f97316", bg: "rgba(249,115,22,0.12)" };
  if (sys < 180 && dia < 110)  return { label: "HTA Grade 2",   color: "#f43f5e", bg: "rgba(244,63,94,0.12)" };
  return                               { label: "HTA Sévère",   color: "#EA4335", bg: "rgba(234,67,53,0.18)" };
}

// ─── Vital reference helpers ─────────────────────────────────────────────────

function hrStatus(bpm: number) {
  if (bpm < 50)  return { label: "Bradycardie",  color: "#7986CB" };
  if (bpm <= 60) return { label: "Bas-normal",   color: "#4285F4" };
  if (bpm <= 100)return { label: "Normal",       color: "#34A853" };
  if (bpm <= 120)return { label: "Élevé",        color: "#FBBC04" };
  return               { label: "Tachycardie",  color: "#EA4335" };
}

function spO2Status(pct: number) {
  if (pct >= 97)  return { label: "Excellent",   color: "#34A853" };
  if (pct >= 95)  return { label: "Normal",      color: "#4285F4" };
  if (pct >= 90)  return { label: "Limite",      color: "#FBBC04" };
  return                 { label: "Alarme",      color: "#EA4335" };
}

function glucoseStatus(mmol: number) {
  if (mmol < 3.9)  return { label: "Hypoglycémie", color: "#7986CB" };
  if (mmol <= 5.5) return { label: "Normal",       color: "#34A853" };
  if (mmol <= 6.9) return { label: "Pré-diabète",  color: "#FBBC04" };
  return                  { label: "Élevée",       color: "#EA4335" };
}

function tempStatus(c: number) {
  if (c < 36.0)  return { label: "Hypothermie", color: "#7986CB" };
  if (c <= 37.2) return { label: "Normal",      color: "#34A853" };
  if (c <= 38.4) return { label: "Subfébrile",  color: "#FBBC04" };
  return                { label: "Fièvre",      color: "#EA4335" };
}

// ─── Cardio helpers ─────────────────────────────────────────────────────────

function hrZone(bpm: number, maxHr: number): { label: string; color: string; desc: string } {
  const pct = bpm / maxHr;
  if (pct < 0.50) return { label: "Repos",        color: "var(--fit-indigo)", desc: "Récupération active" };
  if (pct < 0.60) return { label: "Échauffement", color: "#4285F4",           desc: "Zone 1 · 50–60%" };
  if (pct < 0.70) return { label: "Aérobie",      color: "var(--fit-green)",  desc: "Zone 2 · 60–70%" };
  if (pct < 0.85) return { label: "Seuil",        color: "#FBBC04",           desc: "Zone 3 · 70–85%" };
  return                 { label: "Maximal",      color: "var(--fit-red)",    desc: "Zone 4 · >85%" };
}

function fmtSleep(min: number | null): string {
  if (!min) return "—";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}

const MOMENT_LABELS: Record<BPMoment, string> = {
  morning: "🌅 Matin",
  evening: "🌇 Soir",
  other:   "🕐 Autre",
};

function nowHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const ease = [0.16, 1, 0.3, 1] as [number, number, number, number];
const fade = (delay = 0) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, ease, delay },
});

// ─── Component ────────────────────────────────────────────────────────────────

export default function HealthClient({ date: initialDate, initialEntry, trend, cardioPoints, age }: Props) {
  const [date,       setDate]       = useState(initialDate);
  const [entry,      setEntry]      = useState<HealthData | null>(initialEntry);
  const [loading,    setLoading]    = useState(false);
  const [activeTab,  setActiveTab]  = useState<HealthTab>("vitaux");

  // BP modal
  const [bpOpen,   setBpOpen]   = useState(false);
  const [bpSys,    setBpSys]    = useState("120");
  const [bpDia,    setBpDia]    = useState("80");
  const [bpPulse,  setBpPulse]  = useState("");
  const [bpTime,   setBpTime]   = useState(nowHHMM);
  const [bpMoment, setBpMoment] = useState<BPMoment>("morning");
  const [bpSaving, setBpSaving] = useState(false);

  // Vital inline edit
  const [editVital,   setEditVital]   = useState<string | null>(null);
  const [vitalVal,    setVitalVal]    = useState("");
  const [vitalSaving, setVitalSaving] = useState(false);

  // Notes
  const [notes,       setNotes]       = useState(initialEntry?.notes ?? "");
  const [notesDirty,  setNotesDirty]  = useState(false);
  const [notesSaving, setNotesSaving] = useState(false);

  // Cardio range
  const [rangeDays, setRangeDays] = useState<7 | 14 | 30>(30);

  useEffect(() => {
    setNotes(entry?.notes ?? "");
    setNotesDirty(false);
  }, [entry]);

  const navigate = async (newDate: string) => {
    if (newDate > initialDate) return;
    setLoading(true);
    setDate(newDate);
    setEditVital(null);
    try {
      const res = await fetch(`/api/health?date=${newDate}`);
      setEntry(await res.json() as HealthData | null);
    } catch { setEntry(null); }
    finally { setLoading(false); }
  };

  const patch = async (updates: Partial<HealthData>) => {
    const res = await fetch("/api/health", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ date, ...updates }),
    });
    return res.json() as Promise<HealthData>;
  };

  // BP ─────────────────────────────────────────────────────────────────────────

  const handleAddBP = async () => {
    const sys = parseInt(bpSys), dia = parseInt(bpDia);
    if (isNaN(sys) || isNaN(dia) || sys < 50 || dia < 30) return;
    setBpSaving(true);
    try {
      const reading: BloodPressureReading = {
        systolic: sys, diastolic: dia,
        pulse: bpPulse ? parseInt(bpPulse) : undefined,
        time: bpTime, moment: bpMoment,
      };
      const newBP = [...(entry?.bloodPressure ?? []), reading];
      const updated = await patch({ bloodPressure: newBP });
      setEntry(updated);
      setBpOpen(false);
      setBpSys("120"); setBpDia("80"); setBpPulse(""); setBpTime(nowHHMM());
    } finally { setBpSaving(false); }
  };

  const handleDeleteBP = async (idx: number) => {
    const newBP = (entry?.bloodPressure ?? []).filter((_, i) => i !== idx);
    setEntry(await patch({ bloodPressure: newBP }));
  };

  // Other vitals ────────────────────────────────────────────────────────────────

  const startEditVital = (key: string, current: number | undefined) => {
    setEditVital(key);
    setVitalVal(current?.toString() ?? "");
  };

  const handleSaveVital = async (key: string) => {
    const v = parseFloat(vitalVal);
    if (isNaN(v)) { setEditVital(null); return; }
    setVitalSaving(true);
    try {
      setEntry(await patch({ [key]: v } as Partial<HealthData>));
      setEditVital(null);
    } finally { setVitalSaving(false); }
  };

  const handleClearVital = async (key: string) => {
    setEntry(await patch({ [key]: null } as unknown as Partial<HealthData>));
    setEditVital(null);
  };

  // Notes ───────────────────────────────────────────────────────────────────────

  const handleSaveNotes = async () => {
    setNotesSaving(true);
    try {
      setEntry(await patch({ notes }));
      setNotesDirty(false);
    } finally { setNotesSaving(false); }
  };

  // Derived data ────────────────────────────────────────────────────────────────

  const readings = entry?.bloodPressure ?? [];
  const avgSys = readings.length ? Math.round(readings.reduce((s, r) => s + r.systolic,  0) / readings.length) : null;
  const avgDia = readings.length ? Math.round(readings.reduce((s, r) => s + r.diastolic, 0) / readings.length) : null;
  const bpCat  = avgSys && avgDia ? bpCategory(avgSys, avgDia) : null;

  const chartData = trend
    .filter(e => (e.bloodPressure?.length ?? 0) > 0)
    .map(e => {
      const rr = e.bloodPressure;
      return {
        label: format(parseISO(e.date + "T12:00:00"), "dd/MM"),
        sys:   Math.round(rr.reduce((s, r) => s + r.systolic,  0) / rr.length),
        dia:   Math.round(rr.reduce((s, r) => s + r.diastolic, 0) / rr.length),
      };
    });

  // Cardio derived ─────────────────────────────────────────────────────────────

  const fcMax = age ? 220 - age : 190;
  const visible = cardioPoints.slice(-rangeDays);
  const hrPoints = visible.filter((p) => p.hrAvg !== null);
  const avgHr  = hrPoints.length ? Math.round(hrPoints.reduce((s, p) => s + p.hrAvg!, 0) / hrPoints.length) : null;
  const minHr  = hrPoints.length ? Math.min(...hrPoints.map((p) => p.hrAvg!)) : null;
  const maxHr  = hrPoints.length ? Math.max(...hrPoints.map((p) => p.hrAvg!)) : null;
  const todayHr = hrPoints[hrPoints.length - 1]?.hrAvg ?? null;
  const prevHr  = hrPoints[hrPoints.length - 2]?.hrAvg ?? null;
  const delta   = todayHr !== null && prevHr !== null ? todayHr - prevHr : null;
  const zone    = todayHr ? hrZone(todayHr, fcMax) : null;

  const last7  = cardioPoints.slice(-7).filter((p) => p.hrAvg).map((p) => p.hrAvg!);
  const prev7  = cardioPoints.slice(-14, -7).filter((p) => p.hrAvg).map((p) => p.hrAvg!);
  const avg7   = last7.length ? Math.round(last7.reduce((a, b) => a + b, 0) / last7.length) : null;
  const avgP7  = prev7.length ? Math.round(prev7.reduce((a, b) => a + b, 0) / prev7.length) : null;
  const weekDelta = avg7 !== null && avgP7 !== null ? avg7 - avgP7 : null;

  const cardioChartData = visible.map((p) => ({
    ...p,
    label: format(parseISO(p.date), "dd/MM"),
  }));

  const today = isToday(parseISO(date + "T12:00:00"));
  const dateLabel = today
    ? "Aujourd'hui"
    : format(parseISO(date + "T12:00:00"), "EEEE d MMM", { locale: fr });

  const HrTooltip = ({ active, payload, label: lbl }: { active?: boolean; payload?: { value: number }[]; label?: string }) => {
    if (!active || !payload?.length || !payload[0]?.value) return null;
    const bpm = payload[0].value;
    const z = hrZone(bpm, fcMax);
    return (
      <div className="px-3 py-2 rounded-xl text-[11px] space-y-0.5"
        style={{ background: "rgba(13,13,17,0.96)", border: "1px solid var(--border)" }}>
        <p style={{ color: "var(--text-muted)" }}>{lbl}</p>
        <p className="font-bold text-[14px]" style={{ color: z.color }}>{bpm} bpm</p>
        <p style={{ color: z.color }}>{z.label}</p>
      </div>
    );
  };

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="relative min-h-screen">
      <div className="bg-orbs" />

      <div className="relative z-10 max-w-md mx-auto px-4 py-6 md:ml-[220px]" style={{ paddingBottom: "80px" }}>

        {/* Header */}
        <motion.div {...fade(0)} className="mb-5">
          <p className="label-xs mb-0.5">Mes données</p>
          <div className="flex items-center justify-between">
            <h1 className="text-[22px] font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
              Santé
            </h1>
            <Heart size={20} weight="fill" style={{ color: "#EA4335" }} />
          </div>
        </motion.div>

        {/* Tab bar */}
        <motion.div {...fade(0.02)} className="flex gap-1 p-1 rounded-xl mb-4"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)" }}>
          {([
            { id: "vitaux",    label: "🩺 Vitaux" },
            { id: "cardiaque", label: "❤️ Cardiaque" },
            { id: "bienetre",  label: "🧠 Bien-être" },
          ] as const).map(({ id, label }) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className="flex-1 py-1.5 rounded-lg text-[12px] font-medium transition-all"
              style={{
                background: activeTab === id ? "var(--surface-active)" : "transparent",
                color:      activeTab === id ? "var(--text-primary)"   : "var(--text-muted)",
                border:     activeTab === id ? "1px solid var(--border-strong)" : "1px solid transparent",
              }}>
              {label}
            </button>
          ))}
        </motion.div>

        {/* ── TAB: VITAUX ── */}
        {activeTab === "vitaux" && (
          <>
            {/* Date nav */}
            <motion.div {...fade(0.03)} className="flex items-center justify-between mb-5 glass px-4 py-2.5">
              <button
                onClick={() => navigate(format(subDays(parseISO(date + "T12:00:00"), 1), "yyyy-MM-dd"))}
                className="btn-icon flex-shrink-0">
                <CaretLeft size={14} />
              </button>
              <span className="text-[13px] font-medium capitalize" style={{ color: "var(--text-primary)" }}>
                {loading ? <Spinner size={14} className="animate-spin" /> : dateLabel}
              </span>
              <button
                onClick={() => navigate(format(addDays(parseISO(date + "T12:00:00"), 1), "yyyy-MM-dd"))}
                disabled={today}
                className="btn-icon flex-shrink-0"
                style={{ opacity: today ? 0.3 : 1 }}>
                <CaretRight size={14} />
              </button>
            </motion.div>

            {/* Tension artérielle */}
            <motion.div {...fade(0.06)} className="glass p-5 mb-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: "rgba(234,67,53,0.12)" }}>
                    <Drop size={16} weight="fill" style={{ color: "#EA4335" }} />
                  </div>
                  <div>
                    <p className="text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>
                      Tension artérielle
                    </p>
                    <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>mmHg · saisie manuelle</p>
                  </div>
                </div>
                {bpCat && (
                  <span className="text-[11px] font-semibold px-2 py-1 rounded-full"
                    style={{ background: bpCat.bg, color: bpCat.color, border: `1px solid ${bpCat.color}40` }}>
                    {bpCat.label}
                  </span>
                )}
              </div>

              {avgSys && avgDia && (
                <div className="flex items-baseline gap-2 mb-4">
                  <span className="text-[42px] font-bold tabular-nums leading-none"
                    style={{ color: bpCat?.color ?? "var(--text-primary)" }}>
                    {avgSys}
                  </span>
                  <span className="text-[28px] font-light" style={{ color: "var(--text-muted)" }}>/</span>
                  <span className="text-[42px] font-bold tabular-nums leading-none"
                    style={{ color: bpCat?.color ?? "var(--text-primary)" }}>
                    {avgDia}
                  </span>
                  <span className="text-[13px] mb-1 self-end" style={{ color: "var(--text-muted)" }}>
                    mmHg{readings.length > 1 ? " moy." : ""}
                  </span>
                </div>
              )}

              {readings.length > 0 && (
                <div className="space-y-2 mb-4">
                  {readings.map((r, i) => (
                    <div key={i}
                      className="flex items-center justify-between px-3 py-2.5 rounded-xl"
                      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)" }}>
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          {r.moment && (
                            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                              {MOMENT_LABELS[r.moment]}
                            </span>
                          )}
                          <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>· {r.time}</span>
                        </div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-[20px] font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>
                            {r.systolic}
                          </span>
                          <span className="text-[14px]" style={{ color: "var(--text-muted)" }}>/</span>
                          <span className="text-[20px] font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>
                            {r.diastolic}
                          </span>
                          <span className="text-[11px] ml-1" style={{ color: "var(--text-muted)" }}>mmHg</span>
                          {r.pulse && (
                            <span className="text-[11px] ml-2 flex items-center gap-0.5" style={{ color: "var(--text-muted)" }}>
                              <Heart size={10} weight="fill" style={{ color: "#EA4335" }} />
                              {r.pulse}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteBP(i)}
                        className="p-1.5 rounded-lg transition-colors"
                        style={{ color: "var(--text-muted)" }}
                        onMouseEnter={e => (e.currentTarget.style.color = "#f87171")}
                        onMouseLeave={e => (e.currentTarget.style.color = "var(--text-muted)")}>
                        <Trash size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {readings.length === 0 && (
                <p className="text-[12px] mb-4 text-center py-3" style={{ color: "var(--text-muted)" }}>
                  Aucune mesure pour ce jour
                </p>
              )}

              <button
                onClick={() => { setBpTime(nowHHMM()); setBpOpen(true); }}
                className="btn btn-ghost w-full gap-2 text-[12.5px]">
                <Plus size={14} weight="bold" />
                Ajouter une mesure
              </button>

              {chartData.length >= 2 && (
                <>
                  <div className="h-px my-4" style={{ background: "var(--border)" }} />
                  <p className="label-xs mb-3">Évolution 30 jours</p>
                  <ResponsiveContainer width="100%" height={110}>
                    <LineChart data={chartData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                      <XAxis dataKey="label" tick={{ fontSize: 9, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 9, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} domain={["auto", "auto"]} />
                      <Tooltip content={({ active, payload, label: lbl }) => {
                        if (!active || !payload?.length) return null;
                        const s = payload.find(p => p.dataKey === "sys")?.value as number;
                        const d = payload.find(p => p.dataKey === "dia")?.value as number;
                        return (
                          <div className="px-2.5 py-1.5 rounded-lg text-[11px]"
                            style={{ background: "rgba(13,13,17,0.96)", border: "1px solid var(--border)" }}>
                            <p style={{ color: "var(--text-muted)" }}>{lbl}</p>
                            {s && d && <p style={{ color: "#EA4335" }} className="font-bold">{s} / {d} mmHg</p>}
                          </div>
                        );
                      }} />
                      <ReferenceLine y={140} stroke="rgba(249,115,22,0.4)" strokeDasharray="4 3" />
                      <ReferenceLine y={90}  stroke="rgba(251,188,4,0.3)"  strokeDasharray="4 3" />
                      <Line type="monotone" dataKey="sys" stroke="#EA4335" strokeWidth={1.5} dot={false} connectNulls />
                      <Line type="monotone" dataKey="dia" stroke="#7986CB" strokeWidth={1.5} dot={false} connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                  <div className="flex items-center gap-4 mt-2">
                    <div className="flex items-center gap-1.5 text-[10px]" style={{ color: "var(--text-muted)" }}>
                      <div className="w-3 h-0.5 rounded" style={{ background: "#EA4335" }} />
                      Systolique
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px]" style={{ color: "var(--text-muted)" }}>
                      <div className="w-3 h-0.5 rounded" style={{ background: "#7986CB" }} />
                      Diastolique
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] ml-auto" style={{ color: "rgba(249,115,22,0.7)" }}>
                      — 140 / 90 seuil
                    </div>
                  </div>
                </>
              )}
            </motion.div>

            {/* Other vitals grid */}
            <motion.div {...fade(0.09)} className="grid grid-cols-2 gap-3 mb-4">
              <VitalCard
                icon={<Heartbeat size={15} weight="fill" style={{ color: "#EA4335" }} />}
                label="FC repos" unit="bpm" value={entry?.restingHR} editKey="restingHR"
                editing={editVital === "restingHR"} editVal={vitalVal} saving={vitalSaving}
                step="1" min={30} max={220} statusFn={hrStatus} refRange="60 – 100 bpm"
                onStartEdit={() => startEditVital("restingHR", entry?.restingHR)}
                onValChange={setVitalVal} onSave={() => handleSaveVital("restingHR")}
                onClear={() => handleClearVital("restingHR")} onCancel={() => setEditVital(null)}
              />
              <VitalCard
                icon={<Drop size={15} weight="fill" style={{ color: "#4285F4" }} />}
                label="SpO₂" unit="%" value={entry?.spO2} editKey="spO2"
                editing={editVital === "spO2"} editVal={vitalVal} saving={vitalSaving}
                step="0.1" min={70} max={100} statusFn={spO2Status} refRange="≥ 95 %"
                onStartEdit={() => startEditVital("spO2", entry?.spO2)}
                onValChange={setVitalVal} onSave={() => handleSaveVital("spO2")}
                onClear={() => handleClearVital("spO2")} onCancel={() => setEditVital(null)}
              />
              <VitalCard
                icon={<Drop size={15} weight="fill" style={{ color: "#FBBC04" }} />}
                label="Glycémie" unit="mmol/L" value={entry?.bloodGlucose} editKey="bloodGlucose"
                editing={editVital === "bloodGlucose"} editVal={vitalVal} saving={vitalSaving}
                step="0.1" min={1} max={30} decimals={1} statusFn={glucoseStatus} refRange="3.9 – 5.5 à jeun"
                onStartEdit={() => startEditVital("bloodGlucose", entry?.bloodGlucose)}
                onValChange={setVitalVal} onSave={() => handleSaveVital("bloodGlucose")}
                onClear={() => handleClearVital("bloodGlucose")} onCancel={() => setEditVital(null)}
              />
              <VitalCard
                icon={<Thermometer size={15} weight="fill" style={{ color: "#f97316" }} />}
                label="Température" unit="°C" value={entry?.temperatureC} editKey="temperatureC"
                editing={editVital === "temperatureC"} editVal={vitalVal} saving={vitalSaving}
                step="0.1" min={34} max={43} decimals={1} statusFn={tempStatus} refRange="36.0 – 37.2 °C"
                onStartEdit={() => startEditVital("temperatureC", entry?.temperatureC)}
                onValChange={setVitalVal} onSave={() => handleSaveVital("temperatureC")}
                onClear={() => handleClearVital("temperatureC")} onCancel={() => setEditVital(null)}
              />
            </motion.div>

            {/* Notes */}
            <motion.div {...fade(0.12)} className="glass p-4 mb-4">
              <div className="flex items-center gap-2 mb-3">
                <Note size={14} style={{ color: "var(--text-muted)" }} />
                <p className="label-xs">Notes de santé</p>
              </div>
              <textarea
                value={notes}
                onChange={e => { setNotes(e.target.value); setNotesDirty(true); }}
                placeholder="Symptômes, médicaments, remarques…"
                rows={3}
                className="input resize-none text-[13px]"
                style={{ lineHeight: "1.5" }}
              />
              <AnimatePresence>
                {notesDirty && (
                  <motion.button
                    initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
                    onClick={handleSaveNotes}
                    disabled={notesSaving}
                    className="btn btn-primary w-full gap-2 text-[12.5px] mt-2.5"
                    style={{ height: "36px" }}>
                    {notesSaving ? <Spinner size={11} className="animate-spin" /> : null}
                    Sauvegarder les notes
                  </motion.button>
                )}
              </AnimatePresence>
            </motion.div>
          </>
        )}

        {/* ── TAB: CARDIAQUE & SOMMEIL ── */}
        {activeTab === "cardiaque" && (
          <>
            {/* Today's summary card */}
            <motion.div {...fade(0.05)} className="glass p-5 mb-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="label-xs mb-1">Aujourd'hui · Google Fit</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-[42px] font-bold leading-none"
                      style={{ color: todayHr ? (zone?.color ?? "var(--text-primary)") : "var(--text-muted)" }}>
                      {todayHr ?? "—"}
                    </span>
                    {todayHr && <span className="text-[16px]" style={{ color: "var(--text-muted)" }}>bpm</span>}
                  </div>
                  {zone && (
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ background: zone.color }} />
                      <span className="text-[12px] font-medium" style={{ color: zone.color }}>{zone.label}</span>
                      <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>· {zone.desc}</span>
                    </div>
                  )}
                  {!todayHr && (
                    <p className="text-[12px] mt-1" style={{ color: "var(--text-muted)" }}>
                      Aucune donnée — synchronisez Google Fit
                    </p>
                  )}
                </div>
                {delta !== null && (
                  <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-1 px-2 py-1 rounded-lg text-[12px] font-medium"
                      style={{
                        background: delta === 0 ? "rgba(255,255,255,0.05)" : delta < 0 ? "rgba(52,168,83,0.1)" : "rgba(234,67,53,0.1)",
                        color: delta === 0 ? "var(--text-muted)" : delta < 0 ? "var(--fit-green)" : "var(--fit-red)",
                      }}>
                      {delta < 0 ? <ArrowDown size={12} weight="bold" /> : delta > 0 ? <ArrowUp size={12} weight="bold" /> : <Minus size={12} weight="bold" />}
                      {Math.abs(delta)} bpm
                    </div>
                    <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>vs hier</span>
                  </div>
                )}
              </div>
            </motion.div>

            {/* Stats strip */}
            <motion.div {...fade(0.08)} className="grid grid-cols-3 gap-3 mb-4">
              {[
                { label: "Moyenne", value: avgHr ? `${avgHr} bpm` : "—", icon: <Heart size={14} weight="fill" style={{ color: "var(--fit-red)" }} /> },
                { label: "Min",     value: minHr ? `${minHr} bpm` : "—", icon: <ArrowDown size={14} weight="bold" style={{ color: "var(--fit-green)" }} /> },
                { label: "Max",     value: maxHr ? `${maxHr} bpm` : "—", icon: <ArrowUp size={14} weight="bold" style={{ color: "#f97316" }} /> },
              ].map(({ label, value, icon }) => (
                <div key={label} className="card flex flex-col gap-1">
                  <div className="flex items-center gap-1">{icon}<span className="label-xs">{label}</span></div>
                  <span className="text-[16px] font-bold" style={{ color: "var(--text-primary)" }}>{value}</span>
                </div>
              ))}
            </motion.div>

            {/* Weekly trend badge */}
            {weekDelta !== null && (
              <motion.div {...fade(0.1)} className="flex items-center gap-2 px-3 py-2 rounded-xl mb-4 text-[12px]"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)" }}>
                {weekDelta === 0
                  ? <><CheckCircle size={15} style={{ color: "var(--fit-green)" }} /><span style={{ color: "var(--text-secondary)" }}>Stable sur 7 jours</span></>
                  : weekDelta < 0
                    ? <><CheckCircle size={15} style={{ color: "var(--fit-green)" }} /><span style={{ color: "var(--text-secondary)" }}>En baisse de <strong style={{ color: "var(--fit-green)" }}>{Math.abs(weekDelta)} bpm</strong> cette semaine</span></>
                    : <><Warning size={15} style={{ color: "#fbbf24" }} /><span style={{ color: "var(--text-secondary)" }}>En hausse de <strong style={{ color: "#fbbf24" }}>{weekDelta} bpm</strong> cette semaine</span></>
                }
              </motion.div>
            )}

            {/* Range selector */}
            <motion.div {...fade(0.12)} className="flex gap-2 mb-4">
              {([{ label: "7J", days: 7 }, { label: "14J", days: 14 }, { label: "30J", days: 30 }] as const).map(({ label, days }) => (
                <button key={days}
                  onClick={() => setRangeDays(days)}
                  className="px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all"
                  style={{
                    background: rangeDays === days ? "var(--surface-active)" : "rgba(255,255,255,0.04)",
                    color:      rangeDays === days ? "var(--text-primary)"   : "var(--text-muted)",
                    border:     rangeDays === days ? "1px solid var(--border-strong)" : "1px solid transparent",
                  }}>
                  {label}
                </button>
              ))}
            </motion.div>

            {/* HR history chart */}
            <motion.div {...fade(0.14)} className="glass p-4 mb-4">
              <p className="label-xs mb-3">Évolution BPM</p>
              {hrPoints.length > 0 ? (
                <ResponsiveContainer width="100%" height={140}>
                  <AreaChart data={cardioChartData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                    <defs>
                      <linearGradient id="hrGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#EA4335" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#EA4335" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 9, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 9, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} domain={["auto", "auto"]} />
                    <Tooltip content={<HrTooltip />} />
                    <ReferenceLine y={60}  stroke="rgba(129,140,248,0.25)" strokeDasharray="4 3" />
                    <ReferenceLine y={100} stroke="rgba(248,113,113,0.25)" strokeDasharray="4 3" />
                    <Area type="monotone" dataKey="hrAvg" stroke="#EA4335" strokeWidth={2} fill="url(#hrGrad)" dot={false} connectNulls activeDot={{ r: 4, fill: "#EA4335" }} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[100px]">
                  <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
                    Pas de données FC — synchronisez Google Fit
                  </p>
                </div>
              )}
              <div className="flex flex-wrap gap-3 mt-3 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
                {[
                  { label: "Repos < 60",    color: "var(--fit-indigo)" },
                  { label: "Normal 60–100", color: "var(--fit-green)" },
                  { label: "Élevé > 100",   color: "var(--fit-red)" },
                ].map(({ label, color }) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                    <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{label}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Active minutes chart */}
            <motion.div {...fade(0.16)} className="glass p-4 mb-4">
              <p className="label-xs mb-3">Minutes actives</p>
              <ResponsiveContainer width="100%" height={90}>
                <AreaChart data={cardioChartData} margin={{ top: 2, right: 4, left: -24, bottom: 0 }}>
                  <defs>
                    <linearGradient id="actGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#34A853" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#34A853" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="label" tick={{ fontSize: 9, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 9, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} />
                  <Tooltip content={({ active, payload, label: lbl }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="px-2.5 py-1.5 rounded-lg text-[11px]"
                        style={{ background: "rgba(13,13,17,0.96)", border: "1px solid var(--border)" }}>
                        <p style={{ color: "var(--text-muted)" }}>{lbl}</p>
                        <p style={{ color: "var(--fit-green)" }} className="font-bold">{payload[0]?.value} min</p>
                      </div>
                    );
                  }} />
                  <ReferenceLine y={30} stroke="rgba(52,168,83,0.3)" strokeDasharray="4 3" />
                  <Area type="monotone" dataKey="activeMin" stroke="#34A853" strokeWidth={1.5} fill="url(#actGrad)" dot={false} connectNulls />
                </AreaChart>
              </ResponsiveContainer>
            </motion.div>

            {/* Sleep chart */}
            <motion.div {...fade(0.18)} className="glass p-4 mb-4">
              <p className="label-xs mb-3">Sommeil</p>
              <ResponsiveContainer width="100%" height={90}>
                <AreaChart data={cardioChartData} margin={{ top: 2, right: 4, left: -24, bottom: 0 }}>
                  <defs>
                    <linearGradient id="sleepGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#7986CB" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#7986CB" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="label" tick={{ fontSize: 9, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 9, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} />
                  <Tooltip content={({ active, payload, label: lbl }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="px-2.5 py-1.5 rounded-lg text-[11px]"
                        style={{ background: "rgba(13,13,17,0.96)", border: "1px solid var(--border)" }}>
                        <p style={{ color: "var(--text-muted)" }}>{lbl}</p>
                        <p style={{ color: "var(--fit-indigo)" }} className="font-bold">{fmtSleep(payload[0]?.value as number)}</p>
                      </div>
                    );
                  }} />
                  <ReferenceLine y={420} stroke="rgba(121,134,203,0.3)" strokeDasharray="4 3" />
                  <Area type="monotone" dataKey="sleepMinutes" stroke="#7986CB" strokeWidth={1.5} fill="url(#sleepGrad)" dot={false} connectNulls />
                </AreaChart>
              </ResponsiveContainer>
              <p className="text-[10px] mt-2" style={{ color: "var(--text-muted)" }}>Trait pointillé = objectif 7h</p>
            </motion.div>

            {/* Daily log table */}
            {visible.length > 0 && (
              <motion.div {...fade(0.2)} className="glass p-4">
                <p className="label-xs mb-3">Détail quotidien</p>
                <div className="space-y-1">
                  {[...visible].reverse().slice(0, 14).map((p) => {
                    const z = p.hrAvg ? hrZone(p.hrAvg, fcMax) : null;
                    return (
                      <div key={p.date} className="flex items-center gap-3 py-1.5"
                        style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        <span className="text-[11px] w-[52px] flex-shrink-0" style={{ color: "var(--text-muted)" }}>
                          {format(parseISO(p.date), "dd MMM", { locale: fr })}
                        </span>
                        <div className="flex items-center gap-1 w-[60px]">
                          <Heart size={11} weight="fill" style={{ color: z?.color ?? "var(--text-muted)" }} />
                          <span className="text-[12px] font-medium" style={{ color: z?.color ?? "var(--text-muted)" }}>
                            {p.hrAvg ? `${p.hrAvg}` : "—"}
                          </span>
                          {p.hrAvg && <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>bpm</span>}
                        </div>
                        <div className="flex items-center gap-1 w-[52px]">
                          <Lightning size={11} style={{ color: "var(--fit-green)" }} />
                          <span className="text-[12px]" style={{ color: "var(--text-secondary)" }}>{p.activeMin}min</span>
                        </div>
                        <div className="flex items-center gap-1 flex-1">
                          <Moon size={11} style={{ color: "var(--fit-indigo)" }} />
                          <span className="text-[12px]" style={{ color: "var(--text-secondary)" }}>{fmtSleep(p.sleepMinutes)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </>
        )}

        {/* ── TAB: BIEN-ÊTRE ── */}
        {activeTab === "bienetre" && (
          <motion.div {...fade(0.05)}>
            <MentalHealthWidget date={date} />
          </motion.div>
        )}

      </div>

      {/* ── BP Add Modal ── */}
      {bpOpen && typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          <motion.div
            key="bp-overlay"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center"
            style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
            onClick={e => { if (e.target === e.currentTarget) setBpOpen(false); }}
          >
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="w-full max-w-md glass-strong rounded-t-2xl p-6 pb-10"
              style={{ maxHeight: "90vh", overflowY: "auto" }}
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <Drop size={16} weight="fill" style={{ color: "#EA4335" }} />
                  <p className="font-semibold text-[15px]" style={{ color: "var(--text-primary)" }}>
                    Nouvelle mesure
                  </p>
                </div>
                <button onClick={() => setBpOpen(false)} className="btn-icon">
                  <X size={14} />
                </button>
              </div>

              <div className="flex items-center justify-center gap-4 mb-6">
                <div className="flex flex-col items-center gap-1">
                  <input
                    type="number" value={bpSys} onChange={e => setBpSys(e.target.value)}
                    className="w-28 text-center text-[40px] font-bold tabular-nums rounded-2xl outline-none"
                    style={{ background: "rgba(234,67,53,0.08)", border: "2px solid rgba(234,67,53,0.35)", color: "#EA4335", padding: "12px 8px" }}
                    min={50} max={300}
                  />
                  <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>Systolique</span>
                </div>
                <span className="text-[36px] font-light mb-5" style={{ color: "var(--text-muted)" }}>/</span>
                <div className="flex flex-col items-center gap-1">
                  <input
                    type="number" value={bpDia} onChange={e => setBpDia(e.target.value)}
                    className="w-28 text-center text-[40px] font-bold tabular-nums rounded-2xl outline-none"
                    style={{ background: "rgba(121,134,203,0.08)", border: "2px solid rgba(121,134,203,0.35)", color: "#7986CB", padding: "12px 8px" }}
                    min={30} max={200}
                  />
                  <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>Diastolique</span>
                </div>
              </div>

              {bpSys && bpDia && !isNaN(parseInt(bpSys)) && !isNaN(parseInt(bpDia)) && (() => {
                const cat = bpCategory(parseInt(bpSys), parseInt(bpDia));
                return (
                  <div className="flex justify-center mb-5">
                    <span className="px-3 py-1 rounded-full text-[12px] font-semibold"
                      style={{ background: cat.bg, color: cat.color, border: `1px solid ${cat.color}40` }}>
                      ● {cat.label}
                    </span>
                  </div>
                );
              })()}

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <p className="text-[11px] mb-1.5" style={{ color: "var(--text-muted)" }}>Pouls (optionnel)</p>
                  <div className="relative">
                    <input type="number" value={bpPulse} onChange={e => setBpPulse(e.target.value)}
                      placeholder="72" className="input pr-10" min={30} max={250} />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px]" style={{ color: "var(--text-muted)" }}>bpm</span>
                  </div>
                </div>
                <div>
                  <p className="text-[11px] mb-1.5" style={{ color: "var(--text-muted)" }}>Heure</p>
                  <input type="time" value={bpTime} onChange={e => setBpTime(e.target.value)} className="input" />
                </div>
              </div>

              <p className="text-[11px] mb-2" style={{ color: "var(--text-muted)" }}>Moment</p>
              <div className="flex gap-2 mb-6">
                {(["morning", "evening", "other"] as BPMoment[]).map(m => (
                  <button key={m} onClick={() => setBpMoment(m)}
                    className="flex-1 py-2 rounded-xl text-[12px] font-medium transition-all"
                    style={{
                      background: bpMoment === m ? "rgba(234,67,53,0.1)" : "rgba(255,255,255,0.04)",
                      border: `1px solid ${bpMoment === m ? "rgba(234,67,53,0.4)" : "var(--border)"}`,
                      color: bpMoment === m ? "#EA4335" : "var(--text-secondary)",
                    }}>
                    {m === "morning" ? "🌅 Matin" : m === "evening" ? "🌇 Soir" : "🕐 Autre"}
                  </button>
                ))}
              </div>

              <button onClick={handleAddBP} disabled={bpSaving || !bpSys || !bpDia}
                className="btn btn-primary w-full gap-2 text-[13.5px]" style={{ height: "44px" }}>
                {bpSaving
                  ? <><Spinner size={13} className="animate-spin" /> Enregistrement…</>
                  : <><Plus size={14} weight="bold" /> Enregistrer la mesure</>
                }
              </button>
            </motion.div>
          </motion.div>
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}

// ─── VitalCard ────────────────────────────────────────────────────────────────

interface VitalCardProps {
  icon:        React.ReactNode;
  label:       string;
  unit:        string;
  value:       number | undefined | null;
  editKey:     string;
  editing:     boolean;
  editVal:     string;
  saving:      boolean;
  step:        string;
  min:         number;
  max:         number;
  decimals?:   number;
  refRange:    string;
  statusFn:    (v: number) => { label: string; color: string };
  onStartEdit: () => void;
  onValChange: (v: string) => void;
  onSave:      () => void;
  onClear:     () => void;
  onCancel:    () => void;
}

function VitalCard({
  icon, label, unit, value, editing, editVal, saving,
  step, min, max, decimals, refRange, statusFn,
  onStartEdit, onValChange, onSave, onClear, onCancel,
}: VitalCardProps) {
  const status     = value != null ? statusFn(value) : null;
  const displayVal = value != null
    ? (decimals ? value.toFixed(decimals) : Math.round(value).toString())
    : null;

  return (
    <div className="card flex flex-col gap-2.5" style={{ minHeight: "120px" }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {icon}
          <span className="label-xs">{label}</span>
        </div>
        {value != null && !editing && (
          <button onClick={onStartEdit} className="p-1 rounded-md transition-colors" style={{ color: "var(--text-muted)" }}>
            <PencilSimple size={12} />
          </button>
        )}
      </div>

      {editing ? (
        <div className="flex flex-col gap-2">
          <div className="relative">
            <input
              autoFocus type="number" value={editVal}
              onChange={e => onValChange(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") onSave(); if (e.key === "Escape") onCancel(); }}
              className="input text-[14px] pr-10"
              step={step} min={min} max={max}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px]"
              style={{ color: "var(--text-muted)" }}>{unit}</span>
          </div>
          <div className="flex gap-1.5">
            <button onClick={onSave} disabled={saving}
              className="flex-1 btn gap-1 text-[11px]"
              style={{ height: "28px", background: "var(--fiber)", color: "#fff", border: "none" }}>
              {saving ? <Spinner size={10} className="animate-spin" /> : "OK"}
            </button>
            <button onClick={onCancel}
              className="btn btn-ghost text-[11px] px-2" style={{ height: "28px" }}>
              <X size={11} />
            </button>
            {value != null && (
              <button onClick={onClear}
                className="btn btn-ghost text-[11px] px-2" style={{ height: "28px", color: "#f87171" }}>
                <Trash size={11} />
              </button>
            )}
          </div>
        </div>
      ) : displayVal != null ? (
        <>
          <div className="flex items-baseline gap-1">
            <span className="text-[26px] font-bold tabular-nums leading-none"
              style={{ color: status?.color ?? "var(--text-primary)" }}>
              {displayVal}
            </span>
            <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{unit}</span>
          </div>
          {status && (
            <span className="text-[10px] font-medium" style={{ color: status.color }}>
              ● {status.label}
            </span>
          )}
        </>
      ) : (
        <button
          onClick={onStartEdit}
          className="flex-1 flex flex-col items-center justify-center gap-1.5 rounded-xl transition-colors"
          style={{ minHeight: "56px", border: "1.5px dashed var(--border)" }}>
          <Plus size={14} style={{ color: "var(--text-muted)" }} />
          <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>Ajouter</span>
        </button>
      )}

      {!editing && (
        <p className="text-[9px] mt-auto" style={{ color: "var(--text-muted)" }}>{refRange}</p>
      )}
    </div>
  );
}
