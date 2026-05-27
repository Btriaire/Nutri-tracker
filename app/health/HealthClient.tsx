"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import { format, addDays, subDays, isToday, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import {
  CaretLeft, CaretRight, Plus, X, Heartbeat, Thermometer,
  Drop, Spinner, Trash, PencilSimple, Heart, Note,
} from "@phosphor-icons/react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import type { BloodPressureReading, BPMoment, HealthEntry } from "@/app/lib/types";

type HealthData = Omit<HealthEntry, "updatedAt">;

interface Props {
  date:         string;
  initialEntry: HealthData | null;
  trend:        HealthData[];
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

export default function HealthClient({ date: initialDate, initialEntry, trend }: Props) {
  const [date,    setDate]    = useState(initialDate);
  const [entry,   setEntry]   = useState<HealthData | null>(initialEntry);
  const [loading, setLoading] = useState(false);

  // BP modal
  const [bpOpen,   setBpOpen]   = useState(false);
  const [bpSys,    setBpSys]    = useState("120");
  const [bpDia,    setBpDia]    = useState("80");
  const [bpPulse,  setBpPulse]  = useState("");
  const [bpTime,   setBpTime]   = useState(nowHHMM);
  const [bpMoment, setBpMoment] = useState<BPMoment>("morning");
  const [bpSaving, setBpSaving] = useState(false);

  // Vital inline edit
  const [editVital,  setEditVital]  = useState<string | null>(null);
  const [vitalVal,   setVitalVal]   = useState("");
  const [vitalSaving, setVitalSaving] = useState(false);

  // Notes
  const [notes,      setNotes]      = useState(initialEntry?.notes ?? "");
  const [notesDirty, setNotesDirty] = useState(false);
  const [notesSaving, setNotesSaving] = useState(false);

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

  // Chart: one point per trend day (average BP of that day)
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

  const today = isToday(parseISO(date + "T12:00:00"));
  const dateLabel = today
    ? "Aujourd'hui"
    : format(parseISO(date + "T12:00:00"), "EEEE d MMM", { locale: fr });

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

        {/* ── Tension artérielle ── */}
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

          {/* Average display */}
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

          {/* Readings list */}
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

          {/* BP trend chart */}
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

        {/* ── Other vitals grid ── */}
        <motion.div {...fade(0.09)} className="grid grid-cols-2 gap-3 mb-4">

          {/* FC repos */}
          <VitalCard
            icon={<Heartbeat size={15} weight="fill" style={{ color: "#EA4335" }} />}
            label="FC repos"
            unit="bpm"
            value={entry?.restingHR}
            editKey="restingHR"
            editing={editVital === "restingHR"}
            editVal={vitalVal}
            saving={vitalSaving}
            step="1"
            min={30} max={220}
            statusFn={v => hrStatus(v)}
            refRange="60 – 100 bpm"
            onStartEdit={() => startEditVital("restingHR", entry?.restingHR)}
            onValChange={setVitalVal}
            onSave={() => handleSaveVital("restingHR")}
            onClear={() => handleClearVital("restingHR")}
            onCancel={() => setEditVital(null)}
          />

          {/* SpO2 */}
          <VitalCard
            icon={<Drop size={15} weight="fill" style={{ color: "#4285F4" }} />}
            label="SpO₂"
            unit="%"
            value={entry?.spO2}
            editKey="spO2"
            editing={editVital === "spO2"}
            editVal={vitalVal}
            saving={vitalSaving}
            step="0.1"
            min={70} max={100}
            statusFn={v => spO2Status(v)}
            refRange="≥ 95 %"
            onStartEdit={() => startEditVital("spO2", entry?.spO2)}
            onValChange={setVitalVal}
            onSave={() => handleSaveVital("spO2")}
            onClear={() => handleClearVital("spO2")}
            onCancel={() => setEditVital(null)}
          />

          {/* Glycémie */}
          <VitalCard
            icon={<Drop size={15} weight="fill" style={{ color: "#FBBC04" }} />}
            label="Glycémie"
            unit="mmol/L"
            value={entry?.bloodGlucose}
            editKey="bloodGlucose"
            editing={editVital === "bloodGlucose"}
            editVal={vitalVal}
            saving={vitalSaving}
            step="0.1"
            min={1} max={30}
            decimals={1}
            statusFn={v => glucoseStatus(v)}
            refRange="3.9 – 5.5 à jeun"
            onStartEdit={() => startEditVital("bloodGlucose", entry?.bloodGlucose)}
            onValChange={setVitalVal}
            onSave={() => handleSaveVital("bloodGlucose")}
            onClear={() => handleClearVital("bloodGlucose")}
            onCancel={() => setEditVital(null)}
          />

          {/* Température */}
          <VitalCard
            icon={<Thermometer size={15} weight="fill" style={{ color: "#f97316" }} />}
            label="Température"
            unit="°C"
            value={entry?.temperatureC}
            editKey="temperatureC"
            editing={editVital === "temperatureC"}
            editVal={vitalVal}
            saving={vitalSaving}
            step="0.1"
            min={34} max={43}
            decimals={1}
            statusFn={v => tempStatus(v)}
            refRange="36.0 – 37.2 °C"
            onStartEdit={() => startEditVital("temperatureC", entry?.temperatureC)}
            onValChange={setVitalVal}
            onSave={() => handleSaveVital("temperatureC")}
            onClear={() => handleClearVital("temperatureC")}
            onCancel={() => setEditVital(null)}
          />
        </motion.div>

        {/* ── Notes ── */}
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
              {/* Modal header */}
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

              {/* Big BP inputs */}
              <div className="flex items-center justify-center gap-4 mb-6">
                <div className="flex flex-col items-center gap-1">
                  <input
                    type="number"
                    value={bpSys}
                    onChange={e => setBpSys(e.target.value)}
                    className="w-28 text-center text-[40px] font-bold tabular-nums rounded-2xl outline-none"
                    style={{
                      background: "rgba(234,67,53,0.08)",
                      border: "2px solid rgba(234,67,53,0.35)",
                      color: "#EA4335",
                      padding: "12px 8px",
                    }}
                    min={50} max={300}
                  />
                  <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>Systolique</span>
                </div>

                <span className="text-[36px] font-light mb-5" style={{ color: "var(--text-muted)" }}>/</span>

                <div className="flex flex-col items-center gap-1">
                  <input
                    type="number"
                    value={bpDia}
                    onChange={e => setBpDia(e.target.value)}
                    className="w-28 text-center text-[40px] font-bold tabular-nums rounded-2xl outline-none"
                    style={{
                      background: "rgba(121,134,203,0.08)",
                      border: "2px solid rgba(121,134,203,0.35)",
                      color: "#7986CB",
                      padding: "12px 8px",
                    }}
                    min={30} max={200}
                  />
                  <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>Diastolique</span>
                </div>
              </div>

              {/* Live category preview */}
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

              {/* Secondary fields */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <p className="text-[11px] mb-1.5" style={{ color: "var(--text-muted)" }}>
                    Pouls (optionnel)
                  </p>
                  <div className="relative">
                    <input
                      type="number"
                      value={bpPulse}
                      onChange={e => setBpPulse(e.target.value)}
                      placeholder="72"
                      className="input pr-10"
                      min={30} max={250}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px]"
                      style={{ color: "var(--text-muted)" }}>bpm</span>
                  </div>
                </div>
                <div>
                  <p className="text-[11px] mb-1.5" style={{ color: "var(--text-muted)" }}>Heure</p>
                  <input
                    type="time"
                    value={bpTime}
                    onChange={e => setBpTime(e.target.value)}
                    className="input"
                  />
                </div>
              </div>

              {/* Moment selector */}
              <p className="text-[11px] mb-2" style={{ color: "var(--text-muted)" }}>Moment</p>
              <div className="flex gap-2 mb-6">
                {(["morning", "evening", "other"] as BPMoment[]).map(m => (
                  <button key={m} onClick={() => setBpMoment(m)}
                    className="flex-1 py-2 rounded-xl text-[12px] font-medium transition-all"
                    style={{
                      background: bpMoment === m ? "rgba(234,67,53,0.1)" : "rgba(255,255,255,0.04)",
                      border:     `1px solid ${bpMoment === m ? "rgba(234,67,53,0.4)" : "var(--border)"}`,
                      color:      bpMoment === m ? "#EA4335" : "var(--text-secondary)",
                    }}>
                    {m === "morning" ? "🌅 Matin" : m === "evening" ? "🌇 Soir" : "🕐 Autre"}
                  </button>
                ))}
              </div>

              <button
                onClick={handleAddBP}
                disabled={bpSaving || !bpSys || !bpDia}
                className="btn btn-primary w-full gap-2 text-[13.5px]"
                style={{ height: "44px" }}>
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
  icon:       React.ReactNode;
  label:      string;
  unit:       string;
  value:      number | undefined | null;
  editKey:    string;
  editing:    boolean;
  editVal:    string;
  saving:     boolean;
  step:       string;
  min:        number;
  max:        number;
  decimals?:  number;
  refRange:   string;
  statusFn:   (v: number) => { label: string; color: string };
  onStartEdit: () => void;
  onValChange: (v: string) => void;
  onSave:     () => void;
  onClear:    () => void;
  onCancel:   () => void;
}

function VitalCard({
  icon, label, unit, value, editing, editVal, saving,
  step, min, max, decimals, refRange, statusFn,
  onStartEdit, onValChange, onSave, onClear, onCancel,
}: VitalCardProps) {
  const status = value != null ? statusFn(value) : null;
  const displayVal = value != null
    ? (decimals ? value.toFixed(decimals) : Math.round(value).toString())
    : null;

  return (
    <div className="card flex flex-col gap-2.5" style={{ minHeight: "120px" }}>
      {/* Top row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {icon}
          <span className="label-xs">{label}</span>
        </div>
        {value != null && !editing && (
          <button
            onClick={onStartEdit}
            className="p-1 rounded-md transition-colors"
            style={{ color: "var(--text-muted)" }}>
            <PencilSimple size={12} />
          </button>
        )}
      </div>

      {/* Value area */}
      {editing ? (
        <div className="flex flex-col gap-2">
          <div className="relative">
            <input
              autoFocus
              type="number"
              value={editVal}
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

      {/* Reference range */}
      {!editing && (
        <p className="text-[9px] mt-auto" style={{ color: "var(--text-muted)" }}>{refRange}</p>
      )}
    </div>
  );
}
