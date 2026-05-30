"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import { format, addDays, subDays, isToday, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import {
  CaretLeft, CaretRight, CaretUp, CaretDown, Plus, X, Heartbeat, Thermometer,
  Drop, Spinner, Trash, PencilSimple, Heart, Note,
  Lightning, Moon, Warning, CheckCircle, ArrowDown, ArrowUp, Minus, ArrowsClockwise,
  Pill, Check,
} from "@phosphor-icons/react";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, ComposedChart,
  XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid,
} from "recharts";
import type { BloodPressureReading, BPMoment, HealthEntry, MedicationEntry, SymptomEntry, SymptomSeverity, AISynthesisResult } from "@/app/lib/types";
import type { CardioPoint, WithingsPoint } from "@/app/api/cardio/route";
import MentalHealthWidget from "@/app/components/MentalHealthWidget";
import BreathingGuide from "@/app/components/BreathingGuide";
import SleepHypnogram from "@/app/components/SleepHypnogram";
import MoodTrendChart from "@/app/components/MoodTrendChart";
import PixelWall from "@/app/components/PixelWall";
import type { MoodPoint } from "@/app/components/MoodTrendChart";

type HealthData = Omit<HealthEntry, "updatedAt">;
type HealthTab = "synthese" | "cardiaque" | "medical" | "bienetre";

// ─── Symptom categories ──────────────────────────────────────────────────────

const SYMPTOM_CATEGORIES = [
  {
    key: "douleur", label: "Douleur", icon: "🤕", color: "#f87171",
    symptoms: ["Maux de tête", "Migraine", "Douleur musculaire", "Douleur articulaire", "Douleur abdominale", "Douleur thoracique", "Douleur de dos", "Douleur cervicale"],
  },
  {
    key: "digestif", label: "Digestif", icon: "🫃", color: "#fb923c",
    symptoms: ["Nausée", "Vomissement", "Diarrhée", "Constipation", "Ballonnements", "Reflux gastrique", "Perte d'appétit", "Crampes abdominales"],
  },
  {
    key: "respiratoire", label: "Respiratoire", icon: "🫁", color: "#60a5fa",
    symptoms: ["Toux sèche", "Toux grasse", "Essoufflement", "Congestion nasale", "Maux de gorge", "Sifflements respiratoires", "Éternuements"],
  },
  {
    key: "general", label: "Général", icon: "🌡️", color: "#fbbf24",
    symptoms: ["Fatigue", "Fièvre", "Frissons", "Sueurs nocturnes", "Vertiges", "Malaise général", "Palpitations", "Perte de poids involontaire"],
  },
  {
    key: "neurologique", label: "Neurologique", icon: "🧠", color: "#a78bfa",
    symptoms: ["Insomnie", "Trouble de concentration", "Engourdissement", "Picotements", "Vision trouble", "Acouphènes", "Perte de mémoire"],
  },
  {
    key: "cutane", label: "Cutané", icon: "🩹", color: "#34d399",
    symptoms: ["Éruption cutanée", "Démangeaisons", "Urticaire", "Rougeur localisée", "Sécheresse cutanée", "Ecchymoses"],
  },
] as const;

interface Props {
  date:           string;
  initialEntry:   HealthData | null;
  trend:          HealthData[];
  cardioPoints:   CardioPoint[];
  withingsPoints: WithingsPoint[];
  age?:           number;
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

export default function HealthClient({ date: initialDate, initialEntry, trend, cardioPoints, withingsPoints, age }: Props) {
  const [date,       setDate]       = useState(initialDate);
  const [entry,      setEntry]      = useState<HealthData | null>(initialEntry);
  const [loading,    setLoading]    = useState(false);
  const [activeTab,  setActiveTab]  = useState<HealthTab>("synthese");

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

  // Medications
  const [meds,       setMeds]       = useState<MedicationEntry[]>(initialEntry?.medications ?? []);
  const [medOpen,    setMedOpen]    = useState(false);
  const [medName,    setMedName]    = useState("");
  const [medDose,    setMedDose]    = useState("");
  const [medTime,    setMedTime]    = useState(nowHHMM);
  const [medSaving,  setMedSaving]  = useState(false);
  // Nutri-AI-Med
  const [medAiLoading, setMedAiLoading] = useState(false);
  const [medAiInfo,    setMedAiInfo]    = useState<{ dose: string; indication: string; description: string; warning: string | null; class: string } | null>(null);

  // Symptoms
  const [symptoms,      setSymptoms]      = useState<SymptomEntry[]>(initialEntry?.symptoms ?? []);
  const [symptomOpen,   setSymptomOpen]   = useState(false);
  const [symCatOpen,    setSymCatOpen]    = useState<string | null>(null);
  const [symSaving,     setSymSaving]     = useState(false);

  // AI Synthesis
  const [synthesis,          setSynthesis]          = useState<AISynthesisResult | null>(initialEntry?.aiSynthesis ?? null);
  const [synthesisLoading,   setSynthesisLoading]   = useState(false);
  const [synthesisError,     setSynthesisError]     = useState(false);
  const [synthesisExpanded,  setSynthesisExpanded]  = useState(false);

  // Cardio range
  const [rangeDays, setRangeDays] = useState<7 | 14 | 30>(30);

  useEffect(() => {
    setNotes(entry?.notes ?? "");
    setNotesDirty(false);
    setMeds(entry?.medications ?? []);
    setSymptoms(entry?.symptoms ?? []);
    setSynthesis(entry?.aiSynthesis ?? null);
    setSynthesisError(false);
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

  // Medications ─────────────────────────────────────────────────────────────────

  const saveMeds = async (list: MedicationEntry[]) => {
    setMeds(list);
    await patch({ medications: list } as Partial<HealthData>);
  };

  const handleAddMed = async () => {
    if (!medName.trim()) return;
    setMedSaving(true);
    try {
      const newMed: MedicationEntry = {
        id:    Date.now().toString(36),
        name:  medName.trim(),
        dose:  medDose.trim() || undefined,
        time:  medTime || undefined,
        taken: false,
      };
      await saveMeds([...meds, newMed]);
      setMedOpen(false);
      setMedName(""); setMedDose(""); setMedTime(nowHHMM());
      setMedAiInfo(null);
    } finally { setMedSaving(false); }
  };

  const handleAiMedLookup = async () => {
    if (!medName.trim()) return;
    setMedAiLoading(true);
    setMedAiInfo(null);
    try {
      const res = await fetch("/api/health/med-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: medName.trim() }),
      });
      if (res.ok) {
        const data = await res.json() as { ok: boolean; dose: string; indication: string; description: string; warning: string | null; class: string };
        setMedAiInfo(data);
        if (data.dose && !medDose.trim()) setMedDose(data.dose);
      }
    } catch { /* noop */ }
    finally { setMedAiLoading(false); }
  };

  const handleToggleMed = async (id: string) => {
    const updated = meds.map(m => m.id === id ? { ...m, taken: !m.taken } : m);
    await saveMeds(updated);
  };

  const handleDeleteMed = async (id: string) => {
    await saveMeds(meds.filter(m => m.id !== id));
  };

  // Symptoms ────────────────────────────────────────────────────────────────────

  const saveSymptoms = async (list: SymptomEntry[]) => {
    setSymptoms(list);
    await patch({ symptoms: list } as Partial<HealthData>);
  };

  const handleAddSymptom = async (category: string, name: string) => {
    // Toggle off if already present
    const existing = symptoms.find(s => s.name === name && s.category === category);
    if (existing) {
      await saveSymptoms(symptoms.filter(s => s.id !== existing.id));
      return;
    }
    setSymSaving(true);
    try {
      const entry: SymptomEntry = {
        id:       Date.now().toString(36),
        category,
        name,
        severity: "modéré",
        time:     nowHHMM(),
      };
      await saveSymptoms([...symptoms, entry]);
      setSymCatOpen(null); // ferme le bandeau après sélection
    } finally { setSymSaving(false); }
  };

  const handleSetSeverity = async (id: string, severity: SymptomSeverity) => {
    await saveSymptoms(symptoms.map(s => s.id === id ? { ...s, severity } : s));
  };

  const handleDeleteSymptom = async (id: string) => {
    await saveSymptoms(symptoms.filter(s => s.id !== id));
  };

  // AI Synthesis ────────────────────────────────────────────────────────────────

  const handleSynthesis = async () => {
    setSynthesisLoading(true);
    setSynthesisError(false);
    setSynthesis(null);
    try {
      const res = await fetch("/api/health/ai-synthesis", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ date }),
      });
      if (!res.ok) { setSynthesisError(true); return; }
      const data = await res.json() as AISynthesisResult & { ok?: boolean };
      setSynthesis(data);
    } catch { setSynthesisError(true); }
    finally  { setSynthesisLoading(false); }
  };

  // Derived data ────────────────────────────────────────────────────────────────

  const readings = entry?.bloodPressure ?? [];
  const avgSys = readings.length ? Math.round(readings.reduce((s, r) => s + r.systolic,  0) / readings.length) : null;
  const avgDia = readings.length ? Math.round(readings.reduce((s, r) => s + r.diastolic, 0) / readings.length) : null;
  const bpCat  = avgSys && avgDia ? bpCategory(avgSys, avgDia) : null;

  // Merge static trend with live entry so new readings appear immediately in the chart
  const trendWithLive = [
    ...trend.filter(e => e.date !== date),
    ...(entry ? [{ ...entry, date }] : []),
  ].sort((a, b) => a.date.localeCompare(b.date));

  const chartData = trendWithLive
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

  // Withings derived — most recent non-null values (not re-used from Google Fit)
  const latestW  = [...withingsPoints].reverse().find(p => p.weightKg     !== null);
  const latestF  = [...withingsPoints].reverse().find(p => p.bodyFatPct   !== null);
  const latestM  = [...withingsPoints].reverse().find(p => p.muscleMassKg !== null);
  const latestFm = [...withingsPoints].reverse().find(p => p.fatMassKg    !== null);
  const weightChartData = withingsPoints
    .filter(p => p.weightKg !== null)
    .map(p => ({ label: format(parseISO(p.date), "dd/MM"), kg: p.weightKg! }));
  const [wSyncing, setWSyncing] = useState(false);
  const [wSyncMsg, setWSyncMsg] = useState("");
  const handleWithingsSync = async () => {
    setWSyncing(true); setWSyncMsg("");
    try {
      const res = await fetch("/api/withings/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ days: 90 }) });
      const j = await res.json() as { ok: boolean; days?: number };
      setWSyncMsg(j.ok ? `${j.days ?? 0} mesure(s) importée(s)` : "Aucune mesure");
    } catch { setWSyncMsg("Erreur réseau"); }
    finally { setWSyncing(false); }
  };

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
            { id: "synthese",     label: "🩺 Synthèse" },
            { id: "cardiaque",    label: "❤️ Cardiaque" },
            { id: "medical",      label: "🏥 Médical" },
            { id: "bienetre",     label: "🧠 Bien-être" },
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
        {activeTab === "synthese" && (
          <>
            {/* ── Composition corporelle (Withings) ── */}
            <motion.div {...fade(0.03)} className="glass p-5 mb-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: "linear-gradient(135deg,rgba(0,150,255,0.15),rgba(0,200,180,0.15))" }}>
                    ⚖️
                  </div>
                  <div>
                    <p className="text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>Composition corporelle</p>
                    <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Withings · balance connectée</p>
                  </div>
                </div>
                <button onClick={handleWithingsSync} disabled={wSyncing}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] transition-all"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
                  {wSyncing ? <Spinner size={11} className="animate-spin" /> : <ArrowsClockwise size={11} />}
                  Sync
                </button>
              </div>

              {wSyncMsg && (
                <p className="text-[11px] mb-3" style={{ color: "var(--text-muted)" }}>{wSyncMsg}</p>
              )}

              {!latestW && !latestF && !latestM ? (
                <p className="text-[12px] text-center py-4" style={{ color: "var(--text-muted)" }}>
                  Aucune mesure Withings — connecte ta balance dans les Réglages
                </p>
              ) : (
                <>
                  {/* Stats grid */}
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    {[
                      { label: "Poids",          value: latestW?.weightKg     ?? null, unit: "kg",  color: "#60a5fa", fmt: (v: number) => v.toFixed(1) },
                      { label: "% Graisse",       value: latestF?.bodyFatPct   ?? null, unit: "%",   color: "#fb923c", fmt: (v: number) => v.toFixed(1) },
                      { label: "Masse musculaire",value: latestM?.muscleMassKg ?? null, unit: "kg",  color: "#34d399", fmt: (v: number) => v.toFixed(1) },
                      { label: "Masse grasse",    value: latestFm?.fatMassKg   ?? null, unit: "kg",  color: "#f87171", fmt: (v: number) => v.toFixed(1) },
                    ].map(({ label, value, unit, color, fmt }) => (
                      <div key={label} className="rounded-xl p-3"
                        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)" }}>
                        <p className="text-[10px] mb-1" style={{ color: "var(--text-muted)" }}>{label}</p>
                        {value !== null
                          ? <p className="text-[20px] font-bold tabular-nums leading-none" style={{ color }}>
                              {fmt(value)}<span className="text-[11px] font-normal ml-0.5" style={{ color: "var(--text-muted)" }}>{unit}</span>
                            </p>
                          : <p className="text-[16px]" style={{ color: "var(--text-muted)" }}>—</p>
                        }
                      </div>
                    ))}
                  </div>

                  {/* Weight trend mini chart */}
                  {weightChartData.length > 1 && (
                    <div>
                      <p className="text-[10px] mb-2" style={{ color: "var(--text-muted)" }}>Évolution du poids · {weightChartData.length} mesures</p>
                      <ResponsiveContainer width="100%" height={80}>
                        <LineChart data={weightChartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                          <XAxis dataKey="label" hide />
                          <YAxis domain={["auto", "auto"]} hide />
                          <Tooltip
                            content={({ active, payload, label: lbl }) => {
                              if (!active || !payload?.length) return null;
                              return (
                                <div className="px-2.5 py-1.5 rounded-lg text-[11px]"
                                  style={{ background: "rgba(13,13,17,0.96)", border: "1px solid var(--border)" }}>
                                  <p style={{ color: "var(--text-muted)" }}>{lbl}</p>
                                  <p className="font-bold" style={{ color: "#60a5fa" }}>{(payload[0].value as number).toFixed(1)} kg</p>
                                </div>
                              );
                            }}
                          />
                          <Line type="monotone" dataKey="kg" stroke="#60a5fa" strokeWidth={2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {latestW && (
                    <p className="text-[10px] mt-2" style={{ color: "var(--text-muted)" }}>
                      Dernière mesure : {format(parseISO(latestW.date + "T12:00:00"), "d MMM yyyy", { locale: fr })}
                    </p>
                  )}
                </>
              )}
            </motion.div>

            {/* Date nav */}
            <motion.div {...fade(0.06)} className="flex items-center justify-between mb-5 glass px-4 py-2.5">
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
            <motion.div {...fade(0.09)} className="glass p-5 mb-4">
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
            <motion.div {...fade(0.12)} className="grid grid-cols-2 gap-3 mb-4">
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

            {/* Sommeil */}
            {(() => {
              const lastSleep = [...cardioPoints].reverse().find(p => p.sleepMinutes != null && p.sleepMinutes > 0);
              const sleepGoalMin = 420; // default 7h; TODO: pass from props if available
              const sleepOk = lastSleep && lastSleep.sleepMinutes! >= sleepGoalMin;
              const sleepH  = lastSleep ? Math.round(lastSleep.sleepMinutes! / 60 * 10) / 10 : null;
              return (
                <motion.div {...fade(0.13)} className="glass p-4 mb-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: "rgba(121,134,203,0.15)" }}>
                        <Moon size={15} weight="fill" style={{ color: "#7986CB" }} />
                      </div>
                      <div>
                        <p className="text-[14px] font-semibold">Sommeil</p>
                        <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                          {lastSleep ? format(parseISO(lastSleep.date + "T12:00:00"), "dd MMM", { locale: fr }) : "Aucune donnée"}
                        </p>
                      </div>
                    </div>
                    <Link href="/activity/sleep"
                      className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg transition-colors"
                      style={{ background: "rgba(121,134,203,0.1)", color: "#7986CB", border: "1px solid rgba(121,134,203,0.2)" }}>
                      Détail
                      <ArrowUp size={10} style={{ transform: "rotate(45deg)" }} />
                    </Link>
                  </div>
                  {lastSleep ? (
                    <>
                      <div className="flex items-baseline gap-2 mb-3">
                        <span className="text-[36px] font-bold tabular-nums leading-none"
                          style={{ color: sleepOk ? "#34A853" : "#7986CB" }}>
                          {sleepH}h
                        </span>
                        <span className="text-[13px]" style={{ color: "var(--text-muted)" }}>/ 7h objectif</span>
                        {sleepOk && <span className="text-[11px] font-medium ml-1" style={{ color: "#34A853" }}>✓ Objectif atteint</span>}
                      </div>
                      <SleepHypnogram sleepMinutes={lastSleep.sleepMinutes!} bedtimeHour={23} />
                    </>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-[12px] mb-2" style={{ color: "var(--text-muted)" }}>Aucune donnée de sommeil</p>
                      <Link href="/activity/sleep"
                        className="text-[11px] font-medium"
                        style={{ color: "#7986CB" }}>
                        Saisir manuellement →
                      </Link>
                    </div>
                  )}
                </motion.div>
              );
            })()}

            {/* Notes */}
            <motion.div {...fade(0.15)} className="glass p-4 mb-4">
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

        {/* ── TAB: MÉDICAL ── */}
        {activeTab === "medical" && (
          <motion.div {...fade(0.05)} className="space-y-4">

            {/* ── Nutri-IA-Med ── compact ── */}
            {(() => {
              const ALERT_CFG = {
                vert:   { color: "#34d399", bg: "rgba(52,211,153,0.08)", border: "rgba(52,211,153,0.25)", dot: "🟢" },
                orange: { color: "#fbbf24", bg: "rgba(251,191,36,0.08)", border: "rgba(251,191,36,0.25)", dot: "🟡" },
                rouge:  { color: "#f87171", bg: "rgba(248,113,113,0.08)", border: "rgba(248,113,113,0.25)", dot: "🔴" },
              };
              const cfg = synthesis ? ALERT_CFG[synthesis.alertLevel] : null;
              return (
                <div className="glass px-3 py-2.5">
                  {/* ── Header row ── */}
                  <div className="flex items-center gap-2">
                    <span className="text-[12px]">🤖</span>
                    <span className="text-[12px] font-semibold" style={{ color: "var(--text-primary)" }}>Nutri-IA-Med</span>
                    {/* Alert pill */}
                    {synthesis && cfg && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0"
                        style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
                        {cfg.dot} {synthesis.alertLabel}
                      </span>
                    )}
                    <div className="flex-1" />
                    {/* Relancer / Analyser */}
                    <button onClick={handleSynthesis} disabled={synthesisLoading}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition-all flex-shrink-0"
                      style={{
                        background: "rgba(167,139,250,0.1)",
                        border: "1px solid rgba(167,139,250,0.3)",
                        color: "#a78bfa",
                        opacity: synthesisLoading ? 0.6 : 1,
                      }}>
                      {synthesisLoading
                        ? <><Spinner size={10} className="animate-spin" /> Analyse…</>
                        : synthesis ? <><ArrowsClockwise size={10} /> Refaire</> : <>Analyser</>}
                    </button>
                    {/* Expand toggle */}
                    {synthesis && !synthesisLoading && (
                      <button onClick={() => setSynthesisExpanded(v => !v)}
                        className="w-6 h-6 flex items-center justify-center rounded-lg flex-shrink-0"
                        style={{ background: "rgba(255,255,255,0.05)", color: "var(--text-muted)" }}>
                        {synthesisExpanded ? <CaretUp size={11} /> : <CaretDown size={11} />}
                      </button>
                    )}
                  </div>

                  {/* Loading bar */}
                  {synthesisLoading && (
                    <div className="mt-2 space-y-1.5">
                      {[90, 70, 80].map((w, i) => (
                        <div key={i} className="h-2 rounded-full animate-pulse"
                          style={{ width: `${w}%`, background: "rgba(167,139,250,0.1)" }} />
                      ))}
                    </div>
                  )}

                  {/* Error inline */}
                  {synthesisError && !synthesisLoading && (
                    <p className="text-[10px] mt-1.5" style={{ color: "#f87171" }}>
                      Erreur d'analyse · réessaye
                    </p>
                  )}

                  {/* Summary — always visible when synthesis */}
                  {synthesis && !synthesisLoading && (
                    <p className="text-[11px] mt-1.5 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                      {synthesis.summary}
                    </p>
                  )}

                  {/* Empty state minimal */}
                  {!synthesis && !synthesisLoading && !synthesisError && (
                    <button onClick={handleSynthesis}
                      className="w-full mt-2 py-2 rounded-lg text-[11px] font-medium transition-all"
                      style={{ border: "1px dashed rgba(167,139,250,0.25)", color: "#a78bfa" }}>
                      Lancer l'analyse
                    </button>
                  )}

                  {/* Expanded details */}
                  <AnimatePresence initial={false}>
                    {synthesis && synthesisExpanded && !synthesisLoading && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }}
                        style={{ overflow: "hidden" }}>
                        <div className="mt-3 space-y-1.5">
                          {[
                            { icon: "❤️", label: "Constantes", text: synthesis.vitaux,    show: true },
                            { icon: "🩺", label: "Symptômes",  text: synthesis.symptomes, show: !!synthesis.symptomes },
                            { icon: "🥗", label: "Nutrition",  text: synthesis.nutrition,  show: true },
                            { icon: "🏃", label: "Activité",   text: synthesis.activite,   show: !!synthesis.activite },
                          ].filter(s => s.show).map(({ icon, label, text }) => (
                            <p key={label} className="text-[11px] leading-relaxed">
                              <span className="mr-1">{icon}</span>
                              <span className="font-medium" style={{ color: "var(--text-muted)" }}>{label} · </span>
                              <span style={{ color: "var(--text-secondary)" }}>{text}</span>
                            </p>
                          ))}
                        </div>

                        {synthesis.recommandations?.length > 0 && (
                          <div className="mt-3">
                            <p className="text-[9px] uppercase tracking-wide mb-1.5 font-semibold" style={{ color: "var(--text-muted)" }}>
                              💡 Recommandations
                            </p>
                            <div className="space-y-1">
                              {synthesis.recommandations.map((r, i) => (
                                <p key={i} className="text-[11px] leading-relaxed">
                                  <span className="font-bold mr-1" style={{ color: "#a78bfa" }}>{i + 1}.</span>
                                  <span style={{ color: "var(--text-secondary)" }}>{r}</span>
                                </p>
                              ))}
                            </div>
                          </div>
                        )}

                        {synthesis.consulter && (
                          <p className="text-[11px] mt-2 leading-relaxed" style={{ color: "#f87171" }}>
                            ⚠️ {synthesis.consulter}
                          </p>
                        )}

                        <p className="text-[8px] mt-2" style={{ color: "var(--text-muted)" }}>
                          Indicatif · ne remplace pas un avis médical
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })()}

            {/* ── Médicaments ── */}
            <div className={`glass ${meds.length === 0 ? "p-3" : "p-4"}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Pill size={14} weight="fill" style={{ color: "#c084fc" }} />
                  <p className="label-xs">Médicaments du jour</p>
                </div>
                <div className="flex items-center gap-1.5">
                  {meds.length > 0 && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full"
                      style={{ background: "rgba(192,132,252,0.12)", color: "#c084fc", border: "1px solid rgba(192,132,252,0.3)" }}>
                      {meds.filter(m => m.taken).length}/{meds.length} pris
                    </span>
                  )}
                  <button onClick={() => { setMedTime(nowHHMM()); setMedOpen(true); }}
                    className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
                    style={{ background: "rgba(192,132,252,0.1)", border: "1px solid rgba(192,132,252,0.3)", color: "#c084fc" }}>
                    <Plus size={12} weight="bold" />
                  </button>
                </div>
              </div>

              {meds.length === 0 ? (
                <button onClick={() => { setMedTime(nowHHMM()); setMedOpen(true); }}
                  className="w-full py-2 px-3 rounded-lg flex items-center gap-2 transition-colors"
                  style={{ border: "1px dashed var(--border)" }}>
                  <Pill size={13} style={{ color: "var(--text-muted)" }} />
                  <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>Ajouter un médicament</span>
                </button>
              ) : (
                <div className="space-y-2">
                  {meds.map(m => (
                    <div key={m.id}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all"
                      style={{ background: m.taken ? "rgba(192,132,252,0.08)" : "rgba(255,255,255,0.04)", border: `1px solid ${m.taken ? "rgba(192,132,252,0.3)" : "var(--border)"}` }}>
                      <button onClick={() => handleToggleMed(m.id)}
                        className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all"
                        style={{ background: m.taken ? "#c084fc" : "rgba(255,255,255,0.06)", border: `1.5px solid ${m.taken ? "#c084fc" : "var(--border)"}` }}>
                        {m.taken && <Check size={11} weight="bold" color="#fff" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium leading-tight"
                          style={{ color: m.taken ? "var(--text-muted)" : "var(--text-primary)", textDecoration: m.taken ? "line-through" : "none" }}>
                          {m.name}
                        </p>
                        {(m.dose || m.time) && (
                          <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                            {[m.dose, m.time].filter(Boolean).join(" · ")}
                          </p>
                        )}
                      </div>
                      <button onClick={() => handleDeleteMed(m.id)}
                        className="p-1 rounded-md flex-shrink-0 transition-colors"
                        style={{ color: "var(--text-muted)" }}
                        onMouseEnter={e => (e.currentTarget.style.color = "#f87171")}
                        onMouseLeave={e => (e.currentTarget.style.color = "var(--text-muted)")}>
                        <Trash size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Symptômes ── */}
            <div className={`glass ${symptoms.length === 0 && !symptomOpen ? "p-3" : "p-4"}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-[14px]">🩺</span>
                  <p className="label-xs">Symptômes du jour</p>
                </div>
                <div className="flex items-center gap-1.5">
                  {symptoms.length > 0 && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full"
                      style={{ background: "rgba(251,146,60,0.12)", color: "#fb923c", border: "1px solid rgba(251,146,60,0.3)" }}>
                      {symptoms.length} symptôme{symptoms.length > 1 ? "s" : ""}
                    </span>
                  )}
                  <button onClick={() => setSymptomOpen(v => !v)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
                    style={{ background: "rgba(251,146,60,0.1)", border: "1px solid rgba(251,146,60,0.3)", color: "#fb923c" }}>
                    <Plus size={12} weight="bold" />
                  </button>
                </div>
              </div>

              {/* Empty state */}
              {symptoms.length === 0 && !symptomOpen && (
                <button onClick={() => setSymptomOpen(true)}
                  className="w-full py-2 px-3 rounded-lg flex items-center gap-2 transition-colors"
                  style={{ border: "1px dashed var(--border)" }}>
                  <span className="text-[13px]">🩺</span>
                  <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>Ajouter un symptôme</span>
                </button>
              )}

              {/* Recorded symptoms */}
              {symptoms.length > 0 && (
                <div className="space-y-2 mb-3">
                  {symptoms.map(s => {
                    const cat = SYMPTOM_CATEGORIES.find(c => c.key === s.category);
                    const sev: SymptomSeverity[] = ["léger", "modéré", "sévère"];
                    const sevColor: Record<SymptomSeverity, string> = {
                      "léger": "#34d399",
                      "modéré": "#fbbf24",
                      "sévère": "#f87171",
                    };
                    return (
                      <div key={s.id}
                        className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl"
                        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)" }}>
                        <span className="text-[14px] flex-shrink-0 mt-0.5">{cat?.icon ?? "🩺"}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium leading-tight" style={{ color: "var(--text-primary)" }}>
                            {s.name}
                          </p>
                          <div className="flex items-center gap-1 mt-1.5">
                            {sev.map(sv => (
                              <button key={sv}
                                onClick={() => handleSetSeverity(s.id, sv)}
                                className="px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wide transition-all"
                                style={{
                                  background: s.severity === sv ? `${sevColor[sv]}22` : "rgba(255,255,255,0.04)",
                                  border: `1px solid ${s.severity === sv ? sevColor[sv] : "var(--border)"}`,
                                  color: s.severity === sv ? sevColor[sv] : "var(--text-muted)",
                                }}>
                                {sv}
                              </button>
                            ))}
                          </div>
                        </div>
                        {s.time && (
                          <span className="text-[10px] flex-shrink-0" style={{ color: "var(--text-muted)" }}>{s.time}</span>
                        )}
                        <button onClick={() => handleDeleteSymptom(s.id)}
                          className="p-1 rounded-md flex-shrink-0 transition-colors self-start"
                          style={{ color: "var(--text-muted)" }}
                          onMouseEnter={e => (e.currentTarget.style.color = "#f87171")}
                          onMouseLeave={e => (e.currentTarget.style.color = "var(--text-muted)")}>
                          <Trash size={13} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Category picker (collapsible) */}
              <AnimatePresence>
                {symptomOpen && (
                  <motion.div
                    key="sym-picker"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    style={{ overflow: "hidden" }}
                  >
                    <div className="space-y-2 pt-2">
                      {SYMPTOM_CATEGORIES.map(cat => {
                        const isOpen = symCatOpen === cat.key;
                        return (
                          <div key={cat.key} className="rounded-xl overflow-hidden"
                            style={{ border: `1px solid ${isOpen ? cat.color + "55" : "var(--border)"}`, background: isOpen ? `${cat.color}08` : "transparent" }}>
                            {/* Category header */}
                            <button
                              onClick={() => setSymCatOpen(v => v === cat.key ? null : cat.key)}
                              className="w-full flex items-center gap-2.5 px-3 py-2.5"
                            >
                              <span className="text-[15px]">{cat.icon}</span>
                              <span className="flex-1 text-left text-[12px] font-semibold" style={{ color: isOpen ? cat.color : "var(--text-secondary)" }}>
                                {cat.label}
                              </span>
                              {/* Count badge if any selected */}
                              {(() => {
                                const n = symptoms.filter(s => s.category === cat.key).length;
                                return n > 0 ? (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                                    style={{ background: `${cat.color}22`, color: cat.color, border: `1px solid ${cat.color}55` }}>
                                    {n}
                                  </span>
                                ) : null;
                              })()}
                              <span className="text-[10px]" style={{ color: "var(--text-muted)", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", display: "inline-block", transition: "transform 0.2s" }}>▼</span>
                            </button>
                            {/* Symptom chips */}
                            <AnimatePresence>
                              {isOpen && (
                                <motion.div
                                  initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
                                  transition={{ duration: 0.2 }}
                                  style={{ overflow: "hidden" }}
                                >
                                  <div className="flex flex-wrap gap-2 px-3 pb-3">
                                    {cat.symptoms.map(sym => {
                                      const active = symptoms.some(s => s.name === sym && s.category === cat.key);
                                      return (
                                        <button key={sym}
                                          onClick={() => handleAddSymptom(cat.key, sym)}
                                          disabled={symSaving}
                                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-medium transition-all"
                                          style={{
                                            background: active ? `${cat.color}20` : "rgba(255,255,255,0.05)",
                                            border: `1px solid ${active ? cat.color : "var(--border)"}`,
                                            color: active ? cat.color : "var(--text-secondary)",
                                          }}>
                                          {active && <Check size={10} weight="bold" />}
                                          {sym}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Empty state */}
              {symptoms.length === 0 && !symptomOpen && (
                <button onClick={() => setSymptomOpen(true)}
                  className="w-full py-4 rounded-xl flex flex-col items-center gap-1.5 transition-colors"
                  style={{ border: "1.5px dashed var(--border)" }}>
                  <span className="text-[18px]">🩺</span>
                  <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>Ajouter un symptôme</span>
                </button>
              )}
            </div>

            {/* ── Historique des symptômes ── */}
            {(() => {
              const history = [...trend, ...(entry ? [{ ...entry, date }] : [])]
                .filter(e => e.date !== date && (e.symptoms ?? []).length > 0)
                .sort((a, b) => b.date.localeCompare(a.date))
                .slice(0, 30);
              if (history.length === 0) return null;
              const SCAT = Object.fromEntries(SYMPTOM_CATEGORIES.map(c => [c.key, c]));
              const SEV_COLOR: Record<string, string> = { "léger": "#34d399", "modéré": "#fbbf24", "sévère": "#f87171" };
              return (
                <div className="glass p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[14px]">📋</span>
                    <p className="label-xs">Historique des symptômes</p>
                    <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full"
                      style={{ background: "rgba(251,146,60,0.1)", color: "#fb923c", border: "1px solid rgba(251,146,60,0.25)" }}>
                      {history.length} jour{history.length > 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {history.map(e => (
                      <div key={e.date}>
                        {/* Date row */}
                        <div className="flex items-center gap-2 mb-1.5">
                          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "#fb923c" }} />
                          <p className="text-[11px] font-semibold" style={{ color: "var(--text-secondary)" }}>
                            {format(parseISO(e.date + "T12:00:00"), "EEEE d MMMM", { locale: fr })}
                          </p>
                          <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
                          <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                            {(e.symptoms ?? []).length} symptôme{(e.symptoms ?? []).length > 1 ? "s" : ""}
                          </span>
                        </div>
                        {/* Symptom chips */}
                        <div className="flex flex-wrap gap-1.5 pl-3.5">
                          {(e.symptoms ?? []).map(s => {
                            const cat = SCAT[s.category];
                            const sevColor = s.severity ? (SEV_COLOR[s.severity] ?? "#fb923c") : "#fb923c";
                            return (
                              <span key={s.id}
                                className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
                                style={{
                                  background: `${sevColor}12`,
                                  border: `1px solid ${sevColor}44`,
                                  color: sevColor,
                                }}>
                                <span>{cat?.icon ?? "🩺"}</span>
                                {s.name}
                                {s.severity && <span style={{ opacity: 0.7 }}>· {s.severity}</span>}
                                {s.time && <span style={{ opacity: 0.5 }}>· {s.time}</span>}
                              </span>
                            );
                          })}
                        </div>
                        {/* AI synthesis badge if exists for that day */}
                        {e.aiSynthesis && (
                          <div className="flex items-center gap-1.5 mt-1.5 pl-3.5">
                            <span className="text-[10px]">
                              {e.aiSynthesis.alertLevel === "vert" ? "🟢" : e.aiSynthesis.alertLevel === "orange" ? "🟡" : "🔴"}
                            </span>
                            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                              Nutri-IA-Med · {e.aiSynthesis.alertLabel}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

          </motion.div>
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

            {/* ── Vue synthèse combinée ── */}
            <motion.div {...fade(0.14)} className="glass p-4 mb-4">
              {/* Legend */}
              <div className="flex items-center justify-between mb-3">
                <p className="label-xs">Vue synthèse</p>
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  {[
                    { label: "BPM",       color: "#EA4335" },
                    { label: "Calories",  color: "#06b6d4" },
                    { label: "Activité",  color: "#34A853" },
                    { label: "Sommeil",   color: "#7986CB" },
                  ].map(({ label, color }) => (
                    <div key={label} className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                      <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>{label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* BPM — line */}
              <div className="mb-0.5">
                <p className="text-[8px] font-medium mb-0.5" style={{ color: "#EA4335" }}>BPM</p>
                <ResponsiveContainer width="100%" height={68}>
                  <AreaChart syncId="hs" data={cardioChartData} margin={{ top: 2, right: 2, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="g-hr" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#EA4335" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#EA4335" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="label" hide />
                    <YAxis domain={["auto","auto"]} tick={{ fontSize: 8, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} width={22} tickCount={3} />
                    <ReferenceLine y={60}  stroke="rgba(129,140,248,0.2)" strokeDasharray="3 3" />
                    <ReferenceLine y={100} stroke="rgba(248,113,113,0.2)" strokeDasharray="3 3" />
                    <Tooltip content={({ active, payload, label: lbl }) => {
                      if (!active || !payload?.length) return null;
                      const v = payload[0]?.value as number | null;
                      if (!v) return null;
                      const z = hrZone(v, fcMax);
                      return (
                        <div className="px-2 py-1.5 rounded-lg text-[10px]" style={{ background: "rgba(13,13,17,0.96)", border: "1px solid var(--border)" }}>
                          <p style={{ color: "var(--text-muted)" }}>{lbl}</p>
                          <p className="font-bold" style={{ color: z.color }}>{v} bpm · {z.label}</p>
                        </div>
                      );
                    }} />
                    <Area type="monotone" dataKey="hrAvg" stroke="#EA4335" strokeWidth={1.5} fill="url(#g-hr)" dot={false} connectNulls />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="mb-0.5" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                {/* Calories — bar */}
                <p className="text-[8px] font-medium mt-1 mb-0.5" style={{ color: "#06b6d4" }}>Calories actives (kcal)</p>
                <ResponsiveContainer width="100%" height={52}>
                  <BarChart syncId="hs" data={cardioChartData} margin={{ top: 2, right: 2, left: 0, bottom: 0 }} barSize={4}>
                    <XAxis dataKey="label" hide />
                    <YAxis tick={{ fontSize: 8, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} width={22} tickCount={3} />
                    <Tooltip content={({ active, payload, label: lbl }) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div className="px-2 py-1.5 rounded-lg text-[10px]" style={{ background: "rgba(13,13,17,0.96)", border: "1px solid var(--border)" }}>
                          <p style={{ color: "var(--text-muted)" }}>{lbl}</p>
                          <p className="font-bold" style={{ color: "#06b6d4" }}>{payload[0]?.value} kcal</p>
                        </div>
                      );
                    }} />
                    <Bar dataKey="activeCalories" fill="#06b6d4" fillOpacity={0.7} radius={[2,2,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="mb-0.5" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                {/* Activité — bar */}
                <p className="text-[8px] font-medium mt-1 mb-0.5" style={{ color: "#34A853" }}>Activité (min)</p>
                <ResponsiveContainer width="100%" height={52}>
                  <BarChart syncId="hs" data={cardioChartData} margin={{ top: 2, right: 2, left: 0, bottom: 0 }} barSize={4}>
                    <XAxis dataKey="label" hide />
                    <YAxis tick={{ fontSize: 8, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} width={22} tickCount={3} />
                    <ReferenceLine y={30} stroke="rgba(52,168,83,0.3)" strokeDasharray="3 3" />
                    <Tooltip content={({ active, payload, label: lbl }) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div className="px-2 py-1.5 rounded-lg text-[10px]" style={{ background: "rgba(13,13,17,0.96)", border: "1px solid var(--border)" }}>
                          <p style={{ color: "var(--text-muted)" }}>{lbl}</p>
                          <p className="font-bold" style={{ color: "#34A853" }}>{payload[0]?.value} min</p>
                        </div>
                      );
                    }} />
                    <Bar dataKey="activeMin" fill="#34A853" fillOpacity={0.7} radius={[2,2,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                {/* Sommeil — bar avec X axis */}
                <p className="text-[8px] font-medium mt-1 mb-0.5" style={{ color: "#7986CB" }}>Sommeil (h) · — objectif 7h</p>
                <ResponsiveContainer width="100%" height={65}>
                  <BarChart syncId="hs"
                    data={cardioChartData.map(p => ({ ...p, sleepH: p.sleepMinutes != null ? Math.round(p.sleepMinutes / 60 * 10) / 10 : null }))}
                    margin={{ top: 2, right: 2, left: 0, bottom: 0 }}
                    barSize={4}
                  >
                    <XAxis dataKey="label" tick={{ fontSize: 8, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                    <YAxis domain={[0, 10]} tick={{ fontSize: 8, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} width={22} tickCount={4} />
                    <ReferenceLine y={7} stroke="rgba(121,134,203,0.4)" strokeDasharray="3 3" />
                    <Tooltip content={({ active, payload, label: lbl }) => {
                      if (!active || !payload?.length) return null;
                      const v = payload[0]?.value as number | null;
                      return (
                        <div className="px-2 py-1.5 rounded-lg text-[10px]" style={{ background: "rgba(13,13,17,0.96)", border: "1px solid var(--border)" }}>
                          <p style={{ color: "var(--text-muted)" }}>{lbl}</p>
                          <p className="font-bold" style={{ color: "#7986CB" }}>{v != null ? `${v}h` : "—"}</p>
                        </div>
                      );
                    }} />
                    <Bar dataKey="sleepH" fill="#7986CB" fillOpacity={0.7} radius={[2,2,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            {/* Sleep Hypnogram */}
            {(() => {
              const lastSleep = [...visible].reverse().find(p => p.sleepMinutes != null && p.sleepMinutes > 0);
              if (!lastSleep) return null;
              return (
                <motion.div {...fade(0.25)} className="glass p-4">
                  <SleepHypnogram sleepMinutes={lastSleep.sleepMinutes!} bedtimeHour={23} />
                </motion.div>
              );
            })()}

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
          <BienEtreTab date={date} />
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
      {/* ── Medication Add Modal ── */}
      {medOpen && typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          <motion.div
            key="med-overlay"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center"
            style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
            onClick={e => { if (e.target === e.currentTarget) setMedOpen(false); }}
          >
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="w-full max-w-md glass-strong rounded-t-2xl p-6 pb-10"
            >
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <Pill size={16} weight="fill" style={{ color: "#c084fc" }} />
                  <p className="font-semibold text-[15px]" style={{ color: "var(--text-primary)" }}>
                    Nouveau médicament
                  </p>
                </div>
                <button onClick={() => setMedOpen(false)} className="btn-icon"><X size={14} /></button>
              </div>

              <div className="space-y-3 mb-5">
                {/* Nom + Nutri-AI-Med button */}
                <div>
                  <p className="text-[11px] mb-1.5" style={{ color: "var(--text-muted)" }}>Nom *</p>
                  <div className="flex gap-2">
                    <input
                      autoFocus type="text" value={medName}
                      onChange={e => { setMedName(e.target.value); setMedAiInfo(null); }}
                      onKeyDown={e => e.key === "Enter" && handleAddMed()}
                      placeholder="Paracétamol, Doliprane…"
                      className="input text-[14px] flex-1"
                    />
                    <button
                      onClick={handleAiMedLookup}
                      disabled={medAiLoading || !medName.trim()}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-medium flex-shrink-0 transition-all"
                      style={{
                        background: medAiLoading ? "rgba(192,132,252,0.15)" : "rgba(192,132,252,0.1)",
                        border: "1px solid rgba(192,132,252,0.35)",
                        color: "#c084fc",
                        opacity: medName.trim() ? 1 : 0.4,
                      }}>
                      {medAiLoading
                        ? <Spinner size={11} className="animate-spin" />
                        : <span>🤖</span>
                      }
                      <span>Nutri-AI-Med</span>
                    </button>
                  </div>
                </div>

                {/* AI Info Card */}
                <AnimatePresence>
                  {medAiInfo && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="rounded-xl p-3 space-y-1.5 overflow-hidden"
                      style={{ background: "rgba(192,132,252,0.08)", border: "1px solid rgba(192,132,252,0.25)" }}>
                      <div className="flex items-start gap-2">
                        <span className="text-[13px]">🤖</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-semibold" style={{ color: "#c084fc" }}>
                            {medAiInfo.class}
                          </p>
                          <p className="text-[12px] mt-0.5" style={{ color: "var(--text-secondary)" }}>
                            {medAiInfo.description}
                          </p>
                          <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
                            <span className="font-medium" style={{ color: "var(--text-secondary)" }}>Indication :</span> {medAiInfo.indication}
                          </p>
                          <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                            <span className="font-medium" style={{ color: "var(--text-secondary)" }}>Dose :</span> {medAiInfo.dose}
                          </p>
                          {medAiInfo.warning && (
                            <p className="text-[10px] mt-1.5 flex items-start gap-1" style={{ color: "#fbbf24" }}>
                              <Warning size={11} weight="fill" className="mt-0.5 flex-shrink-0" />
                              {medAiInfo.warning}
                            </p>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[11px] mb-1.5" style={{ color: "var(--text-muted)" }}>Dosage</p>
                    <input type="text" value={medDose}
                      onChange={e => setMedDose(e.target.value)}
                      placeholder="500 mg, 1 cp…"
                      className="input text-[13px]"
                    />
                  </div>
                  <div>
                    <p className="text-[11px] mb-1.5" style={{ color: "var(--text-muted)" }}>Heure</p>
                    <input type="time" value={medTime}
                      onChange={e => setMedTime(e.target.value)}
                      className="input text-[13px]"
                    />
                  </div>
                </div>
              </div>

              <button onClick={handleAddMed} disabled={medSaving || !medName.trim()}
                className="btn btn-primary w-full gap-2 text-[13.5px]" style={{ height: "44px",
                  background: "#c084fc", border: "none" }}>
                {medSaving
                  ? <><Spinner size={13} className="animate-spin" /> Enregistrement…</>
                  : <><Plus size={14} weight="bold" /> Ajouter</>
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

// ─── Bien-être tab with mood history ─────────────────────────────────────────

function BienEtreTab({ date }: { date: string }) {
  const [moodPoints, setMoodPoints] = useState<MoodPoint[]>([]);
  const [loadingMood, setLoadingMood] = useState(true);

  useEffect(() => {
    fetch("/api/mental-health?days=30")
      .then(r => r.json())
      .then((d: { points?: MoodPoint[] }) => {
        setMoodPoints(d.points ?? []);
      })
      .catch(() => {})
      .finally(() => setLoadingMood(false));
  }, []);

  const hasData = moodPoints.some(p => p.mood != null);
  const fade = (delay: number) => ({
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.3, delay },
  });

  return (
    <motion.div {...fade(0.05)} className="space-y-4">
      {/* Daily mood entry */}
      <MentalHealthWidget date={date} />

      {/* Pixel Wall */}
      <div className="glass p-4">
        <PixelWall points={moodPoints} today={date} />
      </div>

      {/* Trend chart */}
      {!loadingMood && hasData && (
        <div className="glass p-4">
          <MoodTrendChart points={moodPoints} />
        </div>
      )}
      {!loadingMood && !hasData && (
        <div className="glass p-4 text-center">
          <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>
            Commence à noter ton humeur pour voir l&apos;évolution sur 30 jours ✨
          </p>
        </div>
      )}

      {/* Breathing */}
      <BreathingGuide />
    </motion.div>
  );
}
