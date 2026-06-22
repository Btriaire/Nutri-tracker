"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import type { ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format, addDays, subDays, isToday, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import {
  IconPlus, IconTrash, IconClock, IconBolt, IconHeart, IconMoon, IconShoe, IconFlame,
  IconBookmark, IconX, IconCheck, IconLoader2, IconCamera, IconPencil, IconChevronDown,
  IconMaximize, IconChevronLeft, IconChevronRight, IconMap, IconRuler, IconGauge, IconMicrophone, IconBarbell,
} from "@tabler/icons-react";
import type { FitnessDay, ManualActivity, NutritionGoals, GoogleFitSession } from "@/app/lib/types";
import RouteMap from "@/app/components/RouteMap";

// GPS activity types (outdoor — may have location data)
const GPS_ACTIVITY_TYPES = new Set([3, 7, 10, 19, 25, 29, 37, 39, 41, 46, 48, 49, 51, 53, 57, 63, 68, 75]);
function isGpsActivity(type: number): boolean { return GPS_ACTIVITY_TYPES.has(type); }
import AIInsightBox from "@/app/components/AIInsightBox";
import type { WorkoutTemplate } from "@/app/api/workout-templates/route";
import SportSearchModal from "@/app/components/SportSearchModal";
import VoiceActivityModal from "@/app/components/VoiceActivityModal";
import GymSessionModal from "@/app/components/GymSessionModal";
import ActivityCategoryPicker from "@/app/components/ActivityCategoryPicker";
import ActivityDetailSheet from "@/app/components/ActivityDetailSheet";
import type { ActivitySaveData } from "@/app/components/ActivityDetailSheet";
import type { ExerciseEntry } from "@/app/lib/exercise-catalog";
import type { ActivityHistoryPoint } from "./page";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from "recharts";
import { format as dateFmt } from "date-fns";

const ACTIVITY_OPTIONS = [
  { type: 0,   emoji: "🏅", label: "Activité libre" },
  { type: 1,   emoji: "🏃", label: "Course à pied" },
  { type: 7,   emoji: "🚴", label: "Vélo" },
  { type: 17,  emoji: "🏋️", label: "Musculation" },
  { type: 46,  emoji: "🚶", label: "Marche" },
  { type: 93,  emoji: "🏊", label: "Natation" },
  { type: 82,  emoji: "🧘", label: "Yoga" },
  { type: 9,   emoji: "💪", label: "Aérobic / HIIT" },
  { type: 83,  emoji: "💃", label: "Danse" },
  { type: 45,  emoji: "⚽", label: "Football" },
  { type: 54,  emoji: "🎾", label: "Tennis" },
  { type: 104, emoji: "🥊", label: "Boxe" },
];

const MET: Record<number, number> = {
  0: 5, 1: 9, 7: 7, 17: 6, 46: 3.5, 93: 8, 82: 3, 9: 8, 83: 5, 45: 7, 54: 6, 104: 9,
};

const MUSCU_TYPES = new Set([17, 60]);
function isMuscu(type: number) { return MUSCU_TYPES.has(type); }

function estimateCalories(type: number, durationMin: number, weightKg = 75): number {
  const met = MET[type] ?? 5;
  return Math.round((met * weightKg * durationMin) / 60);
}

function estimateMusculationCalories(sets: string, reps: string, weightKg: string): number {
  const s = parseInt(sets) || 3;
  const r = parseInt(reps) || 10;
  const w = parseFloat(weightKg) || 10;
  return Math.round(s * r * w * 0.04 + s * 2.5 * 4);
}

function musculationDuration(sets: string): number {
  return Math.max(5, (parseInt(sets) || 3) * 2.5);
}

function activityEmoji(type: number): string {
  return ACTIVITY_OPTIONS.find((a) => a.type === type)?.emoji ?? "🏅";
}

// ─── Activity color palette ───────────────────────────────────────────────────
function getActivityColor(type: number): string {
  const m: Record<number, string> = {
    1: "#f97316", 8: "#f97316",    // Running — orange
    7: "#3b82f6", 2: "#3b82f6",    // Cycling — blue
    17: "#a855f7", 60: "#a855f7",  // Weights — purple
    46: "#22c55e", 79: "#22c55e",  // Walking — green
    93: "#06b6d4",                  // Swimming — cyan
    82: "#ec4899",                  // Yoga — pink
    9:  "#ef4444",                  // HIIT — red
    83: "#8b5cf6",                  // Dance — violet
    45: "#16a34a",                  // Football — dark green
    54: "#eab308",                  // Tennis — yellow
    104: "#dc2626",                 // Boxing — crimson
  };
  return m[type] ?? "#fbbf24";
}

// ─── Activity SVG icons ───────────────────────────────────────────────────────
function ActivitySVGIcon({ type, color: c, size = 28 }: { type: number; color: string; size?: number }) {
  const sw = 1.7;
  const lc = "round" as const;
  const lj = "round" as const;
  const p = { stroke: c, strokeWidth: sw, strokeLinecap: lc, strokeLinejoin: lj, fill: "none" as const };

  let icon: ReactNode;
  switch (true) {
    case type === 1 || type === 8: // Running
      icon = <>
        <circle cx="14.5" cy="3.8" r="1.8" fill={c}/>
        <path d="M13.5 5.8L11 13" {...p}/>
        <path d="M13 8l4.5 2.5" {...p}/>
        <path d="M12.5 8.5L9 7.5" {...p}/>
        <path d="M11 13l4 5 3.5 1" {...p}/>
        <path d="M11 13L8 18 5 17.5" {...p}/>
      </>;
      break;
    case type === 7 || type === 2: // Cycling
      icon = <>
        <circle cx="6.5" cy="17" r="4" {...p}/>
        <circle cx="17.5" cy="17" r="4" {...p}/>
        <path d="M6.5 17l5.5-9h3l4 9" {...p}/>
        <path d="M12 8l-1.5-3" {...p}/>
        <path d="M10.5 5h3" {...p}/>
      </>;
      break;
    case type === 17 || type === 60: // Weights
      icon = <>
        <rect x="2" y="9" width="4" height="6" rx="1.5" fill={c} opacity="0.55"/>
        <rect x="18" y="9" width="4" height="6" rx="1.5" fill={c} opacity="0.55"/>
        <rect x="5.5" y="10.5" width="2.5" height="3" rx="0.5" fill={c} opacity="0.35"/>
        <rect x="16" y="10.5" width="2.5" height="3" rx="0.5" fill={c} opacity="0.35"/>
        <line x1="8" y1="12" x2="16" y2="12" stroke={c} strokeWidth="2" strokeLinecap="round"/>
      </>;
      break;
    case type === 46 || type === 79: // Walking
      icon = <>
        <circle cx="13" cy="4" r="1.8" fill={c}/>
        <path d="M12.5 5.8L11.5 12" {...p}/>
        <path d="M12.5 7l3.5 2.5" {...p}/>
        <path d="M12 8L9 10" {...p}/>
        <path d="M11.5 12L13 17 15 19" {...p}/>
        <path d="M11.5 12L9.5 16.5 7 17.5" {...p}/>
      </>;
      break;
    case type === 93: // Swimming
      icon = <>
        <path d="M3 10c1.5-2 3 2 5 0s3-2 5 0 3 2 5-.5" {...p}/>
        <path d="M3 15c1.5-2 3 2 5 0s3-2 5 0 3 2 5-.5" {...p}/>
        <circle cx="17" cy="5" r="1.5" fill={c}/>
        <path d="M17 6.5L15 10 12 9" {...p}/>
        <path d="M15.5 10.5l3 .5" {...p}/>
      </>;
      break;
    case type === 82: // Yoga
      icon = <>
        <circle cx="12" cy="4" r="2" fill={c}/>
        <path d="M12 6v4" {...p}/>
        <path d="M12 10L7 14M12 10L17 14" {...p}/>
        <path d="M7 14L5 16.5" {...p}/>
        <path d="M17 14L19 16.5" {...p}/>
        <path d="M8 16l4 5 4-5" {...p}/>
      </>;
      break;
    case type === 9: // HIIT / Flame
      icon = <>
        <path d="M12 2c0 0-7 7-7 12a7 7 0 0 0 14 0c0-3.5-2.5-6-2.5-6-1 2.5-2.5 4-5.5 4 3-4 3-8 1-10z"
          fill={c} opacity="0.22" stroke={c} strokeWidth="1.4" strokeLinejoin={lj}/>
        <path d="M12 9c0 0-3 3.5-3 6a3 3 0 0 0 6 0c0-2.5-3-6-3-6z" fill={c} opacity="0.55"/>
      </>;
      break;
    case type === 45: // Football
      icon = <>
        <circle cx="12" cy="12" r="8" {...p}/>
        <path d="M12 4l3 3-1.5 4h-3L9 7z" fill={c} opacity="0.35" stroke={c} strokeWidth="1.2"/>
        <path d="M4.7 9.5l2.8 1-.5 4-2.5 2.5" stroke={c} strokeWidth="1.2" strokeLinecap={lc} fill="none"/>
        <path d="M19.3 9.5l-2.8 1 .5 4 2.5 2.5" stroke={c} strokeWidth="1.2" strokeLinecap={lc} fill="none"/>
        <path d="M7.5 19.5l2-2.5h5l2 2.5" stroke={c} strokeWidth="1.2" strokeLinecap={lc} fill="none"/>
      </>;
      break;
    case type === 54: // Tennis
      icon = <>
        <circle cx="10" cy="10" r="7.5" {...p}/>
        <line x1="15.5" y1="15.5" x2="20" y2="20" stroke={c} strokeWidth="2.8" strokeLinecap="round"/>
        <path d="M10 2.5c0 4-3.5 7 0 7.5" stroke={c} strokeWidth="1.1" fill="none"/>
        <path d="M10 2.5c0 4 3.5 7 0 7.5" stroke={c} strokeWidth="1.1" fill="none"/>
        <path d="M2.5 10c4 0 7 3.5 7.5 0" stroke={c} strokeWidth="1.1" fill="none"/>
        <path d="M2.5 10c4 0 7-3.5 7.5 0" stroke={c} strokeWidth="1.1" fill="none"/>
      </>;
      break;
    case type === 104: // Boxing
      icon = <>
        <path d="M8 18c-1.5-.5-3-2-3-5V9c0-2.5 1.5-4 4-4h6c2 0 3.5 1.5 3.5 4v4c0 3-1.5 4.5-3.5 5z"
          fill={c} opacity="0.2" stroke={c} strokeWidth="1.4" strokeLinejoin={lj}/>
        <path d="M8 10h3V7" stroke={c} strokeWidth="1.4" strokeLinecap={lc}/>
        <path d="M11 10v4" stroke={c} strokeWidth="1.4" strokeLinecap={lc}/>
        <path d="M11 10h3c1.5 0 3 1 3 2.5V15" stroke={c} strokeWidth="1.4" strokeLinecap={lc}/>
      </>;
      break;
    case type === 83: // Dance
      icon = <>
        <circle cx="14" cy="4" r="1.8" fill={c}/>
        <path d="M13 6l-2 5 3 3-1.5 5" {...p}/>
        <path d="M11 11L7 12.5" {...p}/>
        <path d="M14 8.5l4.5-.5" {...p}/>
        <path d="M14.5 14l2.5 3.5" {...p}/>
      </>;
      break;
    default: // Star / general
      icon = <path d="M12 2l2.5 7.5H22l-6.5 4.7 2.5 7.5L12 17.3 6 21.7l2.5-7.5L2 9.5h7.5z"
        fill={c} opacity="0.25" stroke={c} strokeWidth="1.4" strokeLinejoin={lj}/>;
  }

  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none">{icon}</svg>;
}

// ─── Metric chip ──────────────────────────────────────────────────────────────
function MetricChip({ value, unit, color, icon }: {
  value: string | number;
  unit:  string;
  color: string;
  icon:  ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-0.5 py-2.5 rounded-xl"
      style={{ background: `${color}12`, border: `1px solid ${color}22` }}>
      <span style={{ color, opacity: 0.75, display: "flex" }}>{icon}</span>
      <span className="text-[13px] font-bold tabular-nums leading-none" style={{ color }}>{value}</span>
      <span className="text-[9px] leading-none mt-0.5" style={{ color: "var(--text-muted)" }}>{unit}</span>
    </div>
  );
}

interface Props {
  date:                    string;   // today's date (server-rendered)
  fitnessDay:              FitnessDay | null;
  initialManualActivities: unknown[];
  goals?:                  NutritionGoals;
  history?:                ActivityHistoryPoint[];
}

// ─── Shared activity form state ───────────────────────────────────────────────

interface FormState {
  actType:        number;
  duration:       string;
  customName:     string;
  calories:       string;
  // Musculation-specific
  sets:           string;
  reps:           string;
  weightKg:       string;
  variableWeight: boolean;
  weightPerSet:   string[];
}

const EMPTY_FORM: FormState = {
  actType:        0,
  duration:       "30",
  customName:     "",
  calories:       "",
  sets:           "3",
  reps:           "10",
  weightKg:       "",
  variableWeight: false,
  weightPerSet:   [],
};

// ─── Activity History Component ───────────────────────────────────────────────

function ActivityHistory({ history, stepsGoal }: { history: ActivityHistoryPoint[]; stepsGoal: number }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const chartData = history.map(p => ({
    label:     dateFmt(parseISO(p.date), "dd/MM"),
    date:      p.date,
    steps:     p.steps,
    sportMin:  p.sportMin,
    sportKcal: p.sportKcal || null,
  }));

  const maxSteps = Math.max(...history.map(p => p.steps), stepsGoal);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.15 }}
      className="space-y-4 mt-2"
    >
      {/* ── Chart ── */}
      <div className="glass p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="label-xs">Activité · 14 derniers jours</p>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ background: "rgba(99,179,237,0.7)" }} />
              <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>Pas</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#f97316" }} />
              <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>Sport (min)</span>
            </div>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={130}>
          <ComposedChart data={chartData} margin={{ top: 4, right: 4, left: -30, bottom: 0 }} barGap={2}>
            <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="label" tick={{ fontSize: 9, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} />
            <YAxis yAxisId="steps" orientation="left" tick={{ fontSize: 9, fill: "var(--text-muted)" }} tickLine={false} axisLine={false}
              tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} domain={[0, maxSteps * 1.1]} />
            <YAxis yAxisId="sport" orientation="right" tick={{ fontSize: 9, fill: "rgba(249,115,22,0.6)" }} tickLine={false} axisLine={false} />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const steps = (payload.find(p => p.dataKey === "steps")?.value as number) ?? 0;
                const sport = (payload.find(p => p.dataKey === "sportMin")?.value as number) ?? 0;
                return (
                  <div className="px-3 py-2 rounded-xl text-[11px] space-y-1"
                    style={{ background: "rgba(13,13,17,0.96)", border: "1px solid var(--border)" }}>
                    <p style={{ color: "var(--text-muted)" }}>{label}</p>
                    {steps > 0 && <p style={{ color: "#63b3ed" }}>👟 {steps.toLocaleString("fr-FR")} pas</p>}
                    {sport > 0 && <p style={{ color: "#f97316" }}>🏅 {sport} min sport</p>}
                  </div>
                );
              }}
            />
            {/* Steps goal reference line */}
            <Bar yAxisId="steps" dataKey="steps" radius={[3, 3, 0, 0]} maxBarSize={18}
              fill="rgba(99,179,237,0.55)" />
            <Line yAxisId="sport" dataKey="sportMin" type="monotone"
              stroke="#f97316" strokeWidth={2} dot={{ fill: "#f97316", r: 3, strokeWidth: 0 }}
              connectNulls={false} />
          </ComposedChart>
        </ResponsiveContainer>

        {/* Summary stats */}
        {(() => {
          const totalSport  = history.reduce((a, p) => a + p.sportMin, 0);
          const activeDays  = history.filter(p => p.sportMin > 0 || p.steps >= stepsGoal * 0.7).length;
          const avgSteps    = history.length > 0 ? Math.round(history.reduce((a, p) => a + p.steps, 0) / history.length) : 0;
          return (
            <div className="flex gap-3 mt-3 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
              {[
                { v: `${activeDays}j`, l: "jours actifs" },
                { v: `${totalSport}min`, l: "sport total" },
                { v: avgSteps >= 1000 ? `${(avgSteps / 1000).toFixed(1)}k` : String(avgSteps), l: "pas moy." },
              ].map(({ v, l }) => (
                <div key={l} className="flex-1 text-center">
                  <p className="text-[15px] font-bold" style={{ color: "var(--text-primary)" }}>{v}</p>
                  <p className="text-[9px]" style={{ color: "var(--text-muted)" }}>{l}</p>
                </div>
              ))}
            </div>
          );
        })()}
      </div>

      {/* ── Day list ── */}
      <div className="glass p-4">
        <p className="label-xs mb-3">Journal des 13 derniers jours</p>
        <div className="space-y-0">
          {[...history].reverse().map(p => {
            const hasActivity = p.sportMin > 0 || p.steps > 0;
            const stepsOk     = p.steps >= stepsGoal * 0.7;
            const isOpen      = expanded === p.date;
            return (
              <div key={p.date} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <button
                  className="w-full flex items-center gap-3 py-2.5 transition-opacity active:opacity-60"
                  onClick={() => setExpanded(isOpen ? null : p.date)}
                >
                  {/* Date */}
                  <span className="text-[11px] w-[44px] flex-shrink-0 text-left tabular-nums"
                    style={{ color: "var(--text-muted)" }}>
                    {dateFmt(parseISO(p.date), "dd MMM", { locale: fr })}
                  </span>

                  {/* Steps pill */}
                  <div className="flex items-center gap-1 w-[60px] flex-shrink-0">
                    {p.steps > 0 ? (
                      <>
                        <span className="text-[10px]">👟</span>
                        <span className="text-[11px] font-semibold tabular-nums"
                          style={{ color: stepsOk ? "#34A853" : "var(--text-secondary)" }}>
                          {p.steps >= 1000 ? `${(p.steps / 1000).toFixed(1)}k` : String(p.steps)}
                        </span>
                      </>
                    ) : (
                      <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>—</span>
                    )}
                  </div>

                  {/* Sport badges */}
                  <div className="flex-1 flex items-center gap-1 flex-wrap min-w-0">
                    {p.sessions.slice(0, 3).map((s, i) => (
                      <span key={i} className="text-[11px] px-1.5 py-0.5 rounded-md flex-shrink-0"
                        style={{ background: "rgba(249,115,22,0.1)", color: "var(--calories)", fontSize: 10 }}>
                        {s.emoji} {s.durationMin}min
                      </span>
                    ))}
                    {p.sessions.length === 0 && (
                      <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>Repos</span>
                    )}
                  </div>

                  {/* Kcal */}
                  {(p.activeKcal > 0 || p.sportKcal > 0) && (
                    <span className="text-[11px] font-medium flex-shrink-0 tabular-nums"
                      style={{ color: "rgba(52,211,153,0.8)" }}>
                      {Math.round(Math.max(p.activeKcal, p.sportKcal))} kcal
                    </span>
                  )}

                  {/* Expand chevron */}
                  {p.sessions.length > 0 && (
                    <motion.span animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}
                      style={{ color: "var(--text-muted)", flexShrink: 0 }}>
                      <IconChevronDown size={12} />
                    </motion.span>
                  )}
                </button>

                {/* Expanded session detail */}
                <AnimatePresence>
                  {isOpen && p.sessions.length > 0 && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      style={{ overflow: "hidden" }}
                    >
                      <div className="pb-2 pl-[56px] space-y-1.5">
                        {p.sessions.map((s, i) => (
                          <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg"
                            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                            <span className="text-[14px] flex-shrink-0">{s.emoji}</span>
                            <span className="flex-1 text-[12px] font-medium truncate"
                              style={{ color: "var(--text-secondary)" }}>{s.name}</span>
                            <span className="text-[11px] tabular-nums flex-shrink-0"
                              style={{ color: "var(--text-muted)" }}>{s.durationMin} min</span>
                            {s.calories && (
                              <span className="text-[11px] tabular-nums flex-shrink-0"
                                style={{ color: "rgba(52,211,153,0.75)" }}>{Math.round(s.calories)} kcal</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Horizontal steps bar */}
                {!hasActivity ? null : (
                  <div className="pb-1 pl-[44px] pr-2">
                    <div className="h-0.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min((p.steps / stepsGoal) * 100, 100)}%`,
                          background: stepsOk ? "rgba(52,168,83,0.5)" : "rgba(99,179,237,0.35)",
                        }} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function ActivityClient({ date: initialDate, fitnessDay: initialFitnessDay, initialManualActivities, goals, history = [] }: Props) {
  // ── Date navigation state ─────────────────────────────────────────────────
  const [date,       setDate]       = useState(initialDate);
  const [fitnessDay, setFitnessDay] = useState<FitnessDay | null>(initialFitnessDay);
  const [navLoading, setNavLoading] = useState(false);

  const isOnToday = isToday(parseISO(date + "T12:00:00"));
  const dateLabel = isOnToday
    ? "Aujourd'hui"
    : format(parseISO(date + "T12:00:00"), "EEEE d MMM", { locale: fr });

  const navigate = async (newDate: string) => {
    if (newDate > initialDate) return;
    setNavLoading(true);
    setDate(newDate);
    try {
      const res  = await fetch(`/api/activity-day?date=${newDate}`);
      const data = await res.json() as { fitnessDay: FitnessDay | null; manualActivities: ManualActivity[] };
      setFitnessDay(data.fitnessDay);
      setActivities(data.manualActivities);
      setSessionEdits(
        (data.fitnessDay?.sessionEdits as Record<string, { name?: string; calories?: number | null; durationMin?: number }>) ?? {}
      );
    } catch {
      setFitnessDay(null);
      setActivities([]);
    } finally {
      setNavLoading(false);
    }
  };

  const gf = fitnessDay?.googleFit;

  // Weight for MET calculations — prefer Withings measurement, fallback to goals, then 75kg
  const userWeightKg = fitnessDay?.withings?.weightKg ?? goals?.currentWeightKg ?? 75;

  const [activities,  setActivities]  = useState<ManualActivity[]>(initialManualActivities as ManualActivity[]);
  const [templates,   setTemplates]   = useState<WorkoutTemplate[]>([]);
  const [loadingTpl,  setLoadingTpl]  = useState(true);

  // ── Log form
  const [showForm,  setShowForm]  = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [saveErrDetail, setSaveErrDetail] = useState("");
  // Global toast for background saves (NutriTrack-Sport direct, launchTemplate)
  const [toast,    setToast]    = useState<{ msg: string; ok: boolean } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = (msg: string, ok: boolean) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, ok });
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  };
  const [form,      setForm]      = useState<FormState>(EMPTY_FORM);

  // ── Template creation form
  const [showTplForm,     setShowTplForm]     = useState(false);
  const [savingTpl,       setSavingTpl]       = useState(false);
  const [savedTpl,        setSavedTpl]        = useState(false);
  const [tplForm,         setTplForm]         = useState<FormState & { notes: string }>(
    { ...EMPTY_FORM, notes: "" }
  );
  const [tplPhotoDataUrl, setTplPhotoDataUrl] = useState<string | undefined>(undefined);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // ── Séances types collapsed by default
  const [showTemplates,  setShowTemplates]  = useState(false);

  // ── Sport search modal
  const [showSportSearch, setShowSportSearch] = useState(false);
  const [showVoice,       setShowVoice]       = useState(false);
  const [showGym,         setShowGym]         = useState(false);

  // ── Category picker favorites (localStorage)
  const [actFavorites, setActFavorites] = useState<string[]>([]);
  useEffect(() => {
    try {
      const saved = localStorage.getItem("actCatFavorites");
      if (saved) setActFavorites(JSON.parse(saved) as string[]);
    } catch { /* ignore */ }
  }, []);
  const toggleFav = (id: string) => {
    setActFavorites(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      localStorage.setItem("actCatFavorites", JSON.stringify(next));
      return next;
    });
  };

  // ── Activity detail sheet (from category picker)
  const [detailExercise, setDetailExercise] = useState<ExerciseEntry | null>(null);
  const [detailColor,    setDetailColor]    = useState("#38bdf8");
  const [detailColor2,   setDetailColor2]   = useState("#6366f1");
  const [detailSaving,   setDetailSaving]   = useState(false);

  const handleCategorySelect = (exercise: ExerciseEntry, c1: string, c2: string) => {
    setDetailExercise(exercise);
    setDetailColor(c1);
    setDetailColor2(c2);
  };

  const handleDetailSave = async (data: ActivitySaveData) => {
    setDetailSaving(true);
    try {
      const res = await fetch("/api/activity", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ date, ...data }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        showToast(`Erreur ${res.status}${text ? " — " + text.slice(0, 60) : ""}`, false);
        return;
      }
      const json = await res.json() as { activity?: ManualActivity };
      if (json.activity) {
        setActivities(prev => [json.activity!, ...prev]);
        showToast(`✓ ${data.name} ajouté · ${Math.round(data.durationMin)} min · ${data.caloriesBurned ?? 0} kcal`, true);
        setDetailExercise(null);
      } else {
        showToast("Réponse inattendue du serveur", false);
      }
    } catch (err) {
      showToast(`Erreur réseau — ${String(err).slice(0, 50)}`, false);
    } finally {
      setDetailSaving(false);
    }
  };

  // ── Template photo editing
  const tplPhotoEditRef  = useRef<HTMLInputElement>(null);
  const [editingTplId,   setEditingTplId]   = useState<string | null>(null);

  // ── Activity editing + photo
  const [editingActivityId,  setEditingActivityId]  = useState<string | null>(null);
  const [editForm,           setEditForm]           = useState<FormState>(EMPTY_FORM);
  const [editSaving,         setEditSaving]         = useState(false);
  const actPhotoInputRef = useRef<HTMLInputElement>(null);
  const [photoForActivityId, setPhotoForActivityId] = useState<string | null>(null);
  const [photoZoom, setPhotoZoom] = useState<{ url: string; activityId: string } | null>(null);

  // ── Google Fit session editing
  // sessionEdits: local copy of edits (seeded from fitnessDay.sessionEdits)
  const [sessionEdits,        setSessionEdits]       = useState<Record<string, { name?: string; calories?: number | null; durationMin?: number }>>(
    (fitnessDay?.sessionEdits as Record<string, { name?: string; calories?: number | null; durationMin?: number }>) ?? {}
  );
  const [editingGFitId,      setEditingGFitId]      = useState<string | null>(null);
  const [gfitEditForm,       setGfitEditForm]       = useState({ name: "", calories: "", durationMin: "" });
  const [gfitEditSaving,     setGfitEditSaving]     = useState(false);
  const [openRouteId,        setOpenRouteId]        = useState<string | null>(null);

  // Load templates on mount
  useEffect(() => {
    fetch("/api/workout-templates")
      .then((r) => r.json())
      .then((d: { templates: WorkoutTemplate[] }) => setTemplates(d.templates ?? []))
      .catch(() => {})
      .finally(() => setLoadingTpl(false));
  }, []);

  // ── Form helpers
  const updateFormDuration = (val: string, f: FormState, setF: (v: FormState) => void) => {
    const d = parseInt(val, 10);
    setF({ ...f, duration: val, calories: d > 0 ? String(estimateCalories(f.actType, d, userWeightKg)) : f.calories });
  };
  const updateFormType = (type: number, f: FormState, setF: (v: FormState) => void) => {
    const d = parseInt(f.duration, 10);
    if (isMuscu(type)) {
      const kcal = estimateMusculationCalories(f.sets, f.reps, f.weightKg);
      setF({ ...f, actType: type, calories: String(kcal) });
    } else {
      setF({ ...f, actType: type, calories: d > 0 ? String(estimateCalories(type, d, userWeightKg)) : f.calories });
    }
  };

  // ── Musculation field helpers
  const updateMusculationCalories = (f: FormState): FormState => {
    if (!isMuscu(f.actType)) return f;
    return { ...f, calories: String(estimateMusculationCalories(f.sets, f.reps, f.weightKg)) };
  };

  // ── Photo upload for template
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const src = ev.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width  = 72;
        canvas.height = 72;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        // Crop to square then draw at 72x72
        const minDim = Math.min(img.width, img.height);
        const sx = (img.width  - minDim) / 2;
        const sy = (img.height - minDim) / 2;
        ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, 72, 72);
        setTplPhotoDataUrl(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  };

  // ── Log activity
  const handleSave = async () => {
    const muscu = isMuscu(form.actType);
    if (!muscu && (!form.duration || parseInt(form.duration, 10) < 1)) return;
    if (muscu && (!form.sets || parseInt(form.sets) < 1)) return;

    setSaving(true);
    setSaveError(false);
    try {
      const durationMin = muscu
        ? musculationDuration(form.sets)
        : parseInt(form.duration, 10);

      const body: Record<string, unknown> = {
        date,
        name:           form.customName.trim() || undefined,
        activityType:   form.actType,
        durationMin,
        caloriesBurned: form.calories ? parseInt(form.calories, 10) : null,
      };

      if (muscu) {
        body.sets  = parseInt(form.sets)  || 3;
        body.reps  = parseInt(form.reps)  || 10;
        body.weightKg = parseFloat(form.weightKg) || null;
        if (form.variableWeight && form.weightPerSet.length > 0) {
          body.weightPerSet = form.weightPerSet.map((v) => parseFloat(v) || 0);
        }
      }

      const res  = await fetch("/api/activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.error("[activity save] HTTP", res.status, text);
        setSaveErrDetail(`Erreur ${res.status}${text ? ` — ${text.slice(0, 80)}` : ""}`);
        setSaveError(true);
        return;
      }
      const json = await res.json() as { activity?: ManualActivity };
      if (json.activity) {
        setActivities((prev) => [json.activity!, ...prev]);
        setShowForm(false);
        setForm(EMPTY_FORM);
        setSaveErrDetail("");
        setShowTemplates(false);
      } else {
        setSaveErrDetail("Réponse inattendue du serveur");
        setSaveError(true);
      }
    } catch (err) {
      console.error("[activity save] catch", err);
      setSaveErrDetail(String(err));
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  };

  // ── Delete activity
  const handleDelete = async (id: string) => {
    await fetch(`/api/activity/${id}`, { method: "DELETE" });
    setActivities((prev) => prev.filter((a) => a.id !== id));
  };

  // ── Save template
  const handleSaveTemplate = async () => {
    if (!tplForm.customName.trim()) return;
    const muscu = isMuscu(tplForm.actType);
    if (!muscu && !tplForm.duration) return;

    setSavingTpl(true);
    try {
      const durationMin = muscu
        ? musculationDuration(tplForm.sets)
        : parseInt(tplForm.duration, 10);

      const res  = await fetch("/api/workout-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:               tplForm.customName.trim(),
          activityType:       tplForm.actType,
          defaultDurationMin: durationMin,
          defaultCalories:    tplForm.calories ? parseInt(tplForm.calories, 10) : null,
          notes:              tplForm.notes.trim() || undefined,
          photoDataUrl:       tplPhotoDataUrl,
        }),
      });
      const json = await res.json() as { template?: WorkoutTemplate };
      if (json.template) setTemplates((prev) => [json.template!, ...prev]);
      setSavedTpl(true);
      setTimeout(() => {
        setSavedTpl(false);
        setShowTplForm(false);
        setTplForm({ ...EMPTY_FORM, notes: "" });
        setTplPhotoDataUrl(undefined);
      }, 900);
    } catch { /* ignore */ }
    finally { setSavingTpl(false); }
  };

  // ── Delete template
  const handleDeleteTemplate = async (id: string) => {
    await fetch(`/api/workout-templates/${id}`, { method: "DELETE" });
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  };

  // ── Launch template → save directly (no extra click needed)
  const launchTemplate = async (tpl: WorkoutTemplate) => {
    setSaving(true);
    try {
      const res = await fetch("/api/activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          name:           tpl.name,
          activityType:   tpl.activityType,
          durationMin:    tpl.defaultDurationMin,
          caloriesBurned: tpl.defaultCalories ?? null,
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.error("[launchTemplate] HTTP", res.status, text);
        showToast(`Erreur ${res.status} — ${text.slice(0, 60) || "sauvegarde échouée"}`, false);
        return;
      }
      const json = await res.json() as { activity?: ManualActivity };
      if (json.activity) {
        setActivities((prev) => [json.activity!, ...prev]);
        showToast(`✓ ${tpl.name} enregistré`, true);
        setShowTemplates(false);
      } else {
        showToast("Réponse inattendue du serveur", false);
      }
    } catch (err) {
      console.error("[launchTemplate] catch", err);
      showToast(`Erreur réseau`, false);
    } finally {
      setSaving(false);
    }
  };

  // ── Sport search: select exercise — direct save for standard activities,
  //    form pre-fill for musculation (needs sets/reps/weight)
  const handleSportSelect = async (exercise: ExerciseEntry) => {
    if (isMuscu(exercise.activityType)) {
      // Musculation → pre-fill form so user can enter sets/reps/weight
      const kcal = estimateMusculationCalories(EMPTY_FORM.sets, EMPTY_FORM.reps, "");
      setForm((prev) => ({
        ...prev,
        actType:    exercise.activityType,
        customName: exercise.name,
        calories:   String(kcal),
      }));
      setShowForm(true);
      return;
    }
    // Non-musculation → save directly with 30 min default
    const durationMin = 30;
    const caloriesBurned = Math.round(exercise.met * userWeightKg * durationMin / 60);
    setSaving(true);
    try {
      const res = await fetch("/api/activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          name:           exercise.name,
          activityType:   exercise.activityType,
          durationMin,
          caloriesBurned,
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.error("[sport save] HTTP", res.status, text);
        showToast(`Erreur ${res.status} — ${text.slice(0, 60) || "sauvegarde échouée"}`, false);
        return;
      }
      const json = await res.json() as { activity?: ManualActivity };
      if (json.activity) {
        setActivities((prev) => [json.activity!, ...prev]);
        showToast(`✓ ${exercise.name} ajouté (30 min · ${caloriesBurned} kcal)`, true);
      } else {
        showToast("Réponse inattendue du serveur", false);
      }
    } catch (err) {
      console.error("[sport save] catch", err);
      showToast(`Erreur réseau — ${String(err).slice(0, 60)}`, false);
    } finally {
      setSaving(false);
    }
  };

  // ── Sport search: "customize" — always pre-fills the form
  const handleSportCustomize = (exercise: ExerciseEntry) => {
    const durationMin = parseInt(form.duration) || 30;
    const kcal = isMuscu(exercise.activityType)
      ? estimateMusculationCalories(EMPTY_FORM.sets, EMPTY_FORM.reps, "")
      : Math.round(exercise.met * userWeightKg * durationMin / 60);
    setForm((prev) => ({
      ...prev,
      actType:    exercise.activityType,
      customName: exercise.name,
      calories:   String(kcal),
    }));
    setShowForm(true);
  };

  // ── Template photo editing
  const handleTplPhotoEdit = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingTplId) return;
    e.target.value = "";
    const reader = new FileReader();
    reader.onload = (ev) => {
      const src = ev.target?.result as string;
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 72;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const minDim = Math.min(img.width, img.height);
        const sx = (img.width  - minDim) / 2;
        const sy = (img.height - minDim) / 2;
        ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, 72, 72);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
        // PATCH template
        await fetch(`/api/workout-templates/${editingTplId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ photoDataUrl: dataUrl }),
        });
        setTemplates((prev) => prev.map((t) =>
          t.id === editingTplId ? { ...t, photoDataUrl: dataUrl } : t
        ));
        setEditingTplId(null);
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  };

  // ── Sport search: save as template
  const handleSportSave = async (exercise: ExerciseEntry) => {
    try {
      const res = await fetch("/api/workout-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:               exercise.name,
          activityType:       exercise.activityType,
          defaultDurationMin: 30,
          defaultCalories:    exercise.kcalPer30min75kg,
          notes:              exercise.muscles?.join(", ") || undefined,
        }),
      });
      const json = await res.json() as { template?: WorkoutTemplate };
      if (json.template) setTemplates((prev) => [json.template!, ...prev]);
    } catch { /* ignore */ }
  };

  // ── Save edit to existing activity
  const handleEditSave = async (actId: string) => {
    setEditSaving(true);
    try {
      const muscu = isMuscu(editForm.actType);
      const body: Record<string, unknown> = {
        name:           editForm.customName.trim() || undefined,
        caloriesBurned: editForm.calories ? parseInt(editForm.calories, 10) : null,
        durationMin:    muscu ? musculationDuration(editForm.sets) : parseInt(editForm.duration, 10),
      };
      if (muscu) {
        body.sets     = parseInt(editForm.sets)  || 3;
        body.reps     = parseInt(editForm.reps)  || 10;
        body.weightKg = parseFloat(editForm.weightKg) || null;
      }
      const res = await fetch(`/api/activity/${actId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) return;
      setActivities((prev) => prev.map((a) => a.id !== actId ? a : {
        ...a,
        name:           (body.name as string) || a.name,
        caloriesBurned: body.caloriesBurned as number | null,
        durationMin:    body.durationMin as number,
        ...(muscu ? { sets: body.sets as number, reps: body.reps as number, weightKg: body.weightKg as number } : {}),
      }));
      setEditingActivityId(null);
    } catch { /* ignore */ }
    finally { setEditSaving(false); }
  };

  // ── Upload + save photo for an activity
  const handleActivityPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !photoForActivityId) return;
    e.target.value = "";
    const actId = photoForActivityId;
    setPhotoForActivityId(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const src = ev.target?.result as string;
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 72;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const minDim = Math.min(img.width, img.height);
        const sx = (img.width  - minDim) / 2;
        const sy = (img.height - minDim) / 2;
        ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, 72, 72);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
        await fetch(`/api/activity/${actId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ photoDataUrl: dataUrl }),
        });
        setActivities((prev) => prev.map((a) => a.id === actId ? { ...a, photoDataUrl: dataUrl } : a));
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  };

  // ── Save GFit session edit
  const handleGFitEditSave = async (sessionId: string) => {
    setGfitEditSaving(true);
    try {
      const body: Record<string, unknown> = { date, sessionId };
      if (gfitEditForm.name.trim())         body.name        = gfitEditForm.name.trim();
      if (gfitEditForm.durationMin.trim())  body.durationMin = parseInt(gfitEditForm.durationMin, 10);
      if (gfitEditForm.calories.trim())     body.calories    = parseInt(gfitEditForm.calories, 10);

      const res = await fetch("/api/gfit-session", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) return;

      setSessionEdits((prev) => ({
        ...prev,
        [sessionId]: {
          ...(prev[sessionId] ?? {}),
          ...(body.name        !== undefined ? { name:        body.name as string }  : {}),
          ...(body.durationMin !== undefined ? { durationMin: body.durationMin as number } : {}),
          ...(body.calories    !== undefined ? { calories:    body.calories as number }    : {}),
        },
      }));
      setEditingGFitId(null);
    } catch { /* ignore */ }
    finally { setGfitEditSaving(false); }
  };

  const totalBurned = [
    gf?.activeCaloriesBurned ?? 0,
    ...activities.map((a) => a.caloriesBurned ?? 0),
  ].reduce((s, v) => s + v, 0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const activityInsightData = useMemo(() => ({
    sessions: (fitnessDay?.googleFit?.sessions ?? []).map((s) => ({
      name:        s.name,
      durationMin: s.durationMin,
      calories:    s.calories,
    })),
    manualActivities: activities.map((a) => ({
      name:           a.name,
      durationMin:    a.durationMin,
      caloriesBurned: a.caloriesBurned,
    })),
    steps:         fitnessDay?.googleFit?.steps        ?? null,
    activeMinutes: fitnessDay?.googleFit?.activeMinutes ?? null,
    burned:        totalBurned || null,
    stepsGoal:     goals?.stepsGoal ?? 10000,
    activityPlan:  goals?.activityPlan
      ? { sessionsPerWeek: goals.activityPlan.sessionsPerWeek, weeklyKcalBurned: goals.activityPlan.weeklyKcalBurned }
      : undefined,
  }), [activities.length, totalBurned, fitnessDay]);

  return (
    <div className="relative min-h-screen" style={{ paddingBottom: "80px" }}>
      <div className="bg-orbs" />
      <div className="relative z-10 max-w-md mx-auto px-4 py-6 md:ml-[220px]">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
          className="flex items-start justify-between mb-3"
        >
          <div>
            <h1 className="text-[22px] font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
              Activité sportive
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowVoice(true)}
              aria-label="Dicter mon activité"
              className="flex items-center justify-center rounded-xl transition-all active:scale-95"
              style={{
                width: 38, height: 38,
                background: "rgba(56,189,248,0.12)",
                border: "1px solid rgba(56,189,248,0.4)",
                color: "#38bdf8",
              }}
            >
              <IconMicrophone size={17} />
            </button>
            <button
              onClick={() => setShowGym(true)}
              aria-label="Séance salle de sport"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-medium transition-all active:scale-95"
              style={{
                background: "rgba(56,189,248,0.12)",
                border: "1px solid rgba(56,189,248,0.4)",
                color: "#38bdf8",
              }}
            >
              <IconBarbell size={15} /> Salle
            </button>
            <button
              onClick={() => setShowSportSearch(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-medium transition-all"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid var(--border)",
                color: "var(--text-secondary)",
              }}
            >
              🔍 Sport
            </button>
            <button onClick={() => setShowForm((x) => !x)} className="btn btn-primary gap-2 px-3 py-2 text-[13px]">
              <IconPlus size={14} /> Ajouter
            </button>
          </div>
        </motion.div>

        {/* Date nav */}
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.03 }}
          className="flex items-center justify-between mb-5 glass px-4 py-2.5"
        >
          <button
            onClick={() => navigate(format(subDays(parseISO(date + "T12:00:00"), 1), "yyyy-MM-dd"))}
            className="btn-icon flex-shrink-0"
          >
            <IconChevronLeft size={14} />
          </button>
          <span className="text-[13px] font-medium capitalize" style={{ color: "var(--text-primary)" }}>
            {navLoading
              ? <IconLoader2 size={14} className="animate-spin" />
              : dateLabel}
          </span>
          <button
            onClick={() => navigate(format(addDays(parseISO(date + "T12:00:00"), 1), "yyyy-MM-dd"))}
            disabled={isOnToday}
            className="btn-icon flex-shrink-0"
            style={{ opacity: isOnToday ? 0.3 : 1 }}
          >
            <IconChevronRight size={14} />
          </button>
        </motion.div>

        {/* Summary row */}
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.05 }}
          className="grid grid-cols-4 gap-2 mb-5"
        >
          {[
            { icon: IconShoe,   label: "Pas",         value: gf?.steps ? gf.steps.toLocaleString("fr-FR") : "—", color: "var(--steps)" },
            { icon: IconFlame,  label: "Kcal brûlées", value: totalBurned || "—",                                   color: "var(--fit-red)" },
            { icon: IconBolt,   label: "Min. actives", value: gf?.activeMinutes ?? "—",                              color: "var(--fit-green)" },
            { icon: IconHeart,  label: "FC moy.",       value: gf?.heartRateAvg ? `${gf.heartRateAvg} bpm` : "—",  color: "var(--fit-red)" },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="card flex flex-col gap-1 items-center text-center p-2">
              <Icon size={18} style={{ color }} />
              <span className="text-[14px] font-bold tabular-nums" style={{ color }}>{value}</span>
              <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>{label}</span>
            </div>
          ))}
        </motion.div>

        {/* ── Category picker ── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.07 }}
        >
          <ActivityCategoryPicker
            actFavorites={actFavorites}
            onToggleFav={toggleFav}
            onSelectExercise={handleCategorySelect}
            userWeightKg={userWeightKg}
          />
        </motion.div>

        {/* ── AI Insight ── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.08 }}
          className="mb-5"
        >
          <AIInsightBox type="activity" data={activityInsightData} delay={800} />
        </motion.div>

        {/* ── Log form ────────────────────────────────────────────────────────── */}
        <AnimatePresence>
          {showForm && (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.22 }}
              className="glass p-5 mb-5"
            >
              <div className="flex items-center justify-between mb-4">
                <p className="label-xs">Nouvelle activité</p>
                <button onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }}
                  className="p-1.5 rounded-lg" style={{ background: "rgba(255,255,255,0.06)" }}>
                  <IconX size={13} style={{ color: "var(--text-muted)" }} />
                </button>
              </div>

              <ActivityFormBody
                form={form}
                onChange={setForm}
                onDurationChange={(v) => updateFormDuration(v, form, setForm)}
                onTypeChange={(t) => updateFormType(t, form, setForm)}
                onMusculationChange={(f) => setForm(updateMusculationCalories(f))}
                onSportSearch={() => setShowSportSearch(true)}
              />

              {saveError && (
                <p className="text-[12px] mt-2 text-center" style={{ color: "#f87171" }}>
                  {saveErrDetail || "Erreur lors de la sauvegarde — réessaye"}
                </p>
              )}
              <div className="flex gap-3 mt-3">
                <button onClick={() => { setShowForm(false); setForm(EMPTY_FORM); setSaveError(false); }} className="flex-1 btn btn-ghost">Annuler</button>
                <button
                  onClick={handleSave}
                  disabled={saving || (!isMuscu(form.actType) && !form.duration)}
                  className="flex-1 btn btn-primary gap-2"
                >
                  {saving ? <><IconLoader2 size={13} className="animate-spin" /> Sauvegarde…</> : <><IconCheck size={13} />Ajouter</>}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Séances types ───────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.07 }}
          className="glass p-4 mb-4"
        >
          <div className="flex items-center justify-between mb-3">
            {/* Clickable header to expand/collapse */}
            <button
              onClick={() => setShowTemplates((x) => !x)}
              className="flex items-center gap-2 flex-1 min-w-0"
              type="button"
            >
              <IconBookmark size={15} style={{ color: "var(--protein)" }} />
              <p className="label-xs">Séances types</p>
              {templates.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full ml-0.5"
                  style={{ background: "rgba(167,139,250,0.15)", color: "var(--protein)" }}>
                  {templates.length}
                </span>
              )}
              <motion.span
                animate={{ rotate: showTemplates ? 180 : 0 }}
                transition={{ duration: 0.2 }}
                style={{ display: "inline-flex", marginLeft: "auto", color: "var(--text-muted)" }}
              >
                <IconChevronDown size={13} />
              </motion.span>
            </button>
            <button
              onClick={() => setShowTplForm((x) => !x)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ml-2"
              style={{
                background: showTplForm ? "rgba(167,139,250,0.12)" : "rgba(255,255,255,0.05)",
                border:     `1px solid ${showTplForm ? "rgba(167,139,250,0.4)" : "var(--border)"}`,
                color:      showTplForm ? "var(--protein)" : "var(--text-secondary)",
              }}>
              <IconPlus size={11} />
              Créer
            </button>
          </div>

          {/* Template creation form */}
          <AnimatePresence>
            {showTplForm && (
              <motion.div
                key="tpl-form"
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.22 }}
                style={{ overflow: "hidden" }}
              >
                <div className="pt-2 pb-4 space-y-3" style={{ borderBottom: "1px solid var(--border)" }}>
                  <p className="text-[11px] font-semibold" style={{ color: "var(--protein)" }}>
                    Nouvelle séance type
                  </p>

                  <ActivityFormBody
                    form={tplForm}
                    onChange={(v) => setTplForm((p) => ({ ...p, ...v }))}
                    onDurationChange={(v) => updateFormDuration(v, tplForm, (f) => setTplForm({ ...tplForm, ...f }))}
                    onTypeChange={(t) => updateFormType(t, tplForm, (f) => setTplForm({ ...tplForm, ...f }))}
                    onMusculationChange={(f) => setTplForm((p) => ({ ...p, ...updateMusculationCalories(f) }))}
                    namePlaceholder="Nom de la séance (requis)"
                    nameRequired
                    onSportSearch={() => setShowSportSearch(true)}
                  />

                  {/* Name + Photo row */}
                  <div className="flex items-center gap-2">
                    <input
                      value={tplForm.notes}
                      onChange={(e) => setTplForm((p) => ({ ...p, notes: e.target.value }))}
                      placeholder="Notes (optionnel)"
                      className="input text-[12px] flex-1"
                    />
                    {/* Photo button */}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      ref={photoInputRef}
                      className="hidden"
                    />
                    <button
                      onClick={() => photoInputRef.current?.click()}
                      className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all overflow-hidden"
                      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--border)" }}
                      type="button"
                      title="Ajouter une photo"
                    >
                      {tplPhotoDataUrl ? (
                        <img src={tplPhotoDataUrl} className="w-8 h-8 rounded-full object-cover" alt="" />
                      ) : (
                        <IconCamera size={16} style={{ color: "var(--text-muted)" }} />
                      )}
                    </button>
                  </div>

                  <div className="flex gap-2">
                    <button onClick={() => { setShowTplForm(false); setTplForm({ ...EMPTY_FORM, notes: "" }); setTplPhotoDataUrl(undefined); }}
                      className="flex-1 btn btn-ghost text-[12px]">Annuler</button>
                    <button
                      onClick={handleSaveTemplate}
                      disabled={savingTpl || savedTpl || !tplForm.customName.trim()}
                      className="flex-1 btn btn-primary gap-1.5 text-[12px]"
                    >
                      {savedTpl   ? <><IconCheck size={12} /> Sauvegardé !</>
                       : savingTpl ? <><IconLoader2 size={12} className="animate-spin" /> …</>
                       : <><IconBookmark size={12} /> Sauvegarder</>}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Template list — collapsible */}
          <AnimatePresence initial={false}>
            {showTemplates && (
              <motion.div
                key="tpl-list"
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.22 }}
                style={{ overflow: "hidden" }}
              >
                {loadingTpl ? (
                  <div className="flex justify-center py-4">
                    <IconLoader2 size={16} className="animate-spin" style={{ color: "var(--text-muted)" }} />
                  </div>
                ) : templates.length === 0 ? (
                  <p className="text-[12px] py-3 text-center" style={{ color: "var(--text-muted)" }}>
                    Aucune séance type — créez-en une pour accélérer vos saisies
                  </p>
                ) : (
                  <div className="space-y-2">
                    {templates.map((tpl) => (
                      <div key={tpl.id} className="flex items-center gap-3 py-2"
                        style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        {/* Photo thumbnail — clickable to change photo */}
                        <button
                          type="button"
                          onClick={() => { setEditingTplId(tpl.id); tplPhotoEditRef.current?.click(); }}
                          className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0 overflow-hidden relative group"
                          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)" }}
                          title="Changer la photo"
                        >
                          {tpl.photoDataUrl
                            ? <img src={tpl.photoDataUrl} className="w-9 h-9 object-cover" alt="" />
                            : activityEmoji(tpl.activityType)
                          }
                          <div className="absolute inset-0 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            style={{ background: "rgba(0,0,0,0.5)" }}>
                            <IconCamera size={12} style={{ color: "white" }} />
                          </div>
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium truncate" style={{ color: "var(--text-primary)" }}>
                            {tpl.name}
                          </p>
                          <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                            {tpl.defaultDurationMin} min
                            {tpl.defaultCalories ? ` · ${tpl.defaultCalories} kcal` : ""}
                            {tpl.notes ? ` · ${tpl.notes}` : ""}
                          </p>
                        </div>
                        <button
                          onClick={() => launchTemplate(tpl)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold flex-shrink-0 transition-all active:scale-95"
                          style={{ background: "rgba(167,139,250,0.15)", border: "1px solid rgba(167,139,250,0.4)", color: "var(--protein)" }}
                          disabled={saving}>
                          {saving ? <IconLoader2 size={11} className="animate-spin" /> : <IconCheck size={12} />}
                          Enregistrer
                        </button>
                        <button onClick={() => handleDeleteTemplate(tpl.id)}
                          className="btn-icon w-7 h-7 flex-shrink-0" style={{ color: "var(--text-muted)" }}>
                          <IconTrash size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* ── Activités du jour (Google Fit + Manuelles fusionnées) ─────────── */}
        {(() => {
          type UnifiedItem =
            | { kind: "gfit";   session:  GoogleFitSession; sortMs: number }
            | { kind: "manual"; activity: ManualActivity;   sortMs: number };

          const unified: UnifiedItem[] = [
            ...(gf?.sessions ?? []).map((s): UnifiedItem => ({
              kind: "gfit", session: s, sortMs: s.startMs,
            })),
            ...activities.map((a): UnifiedItem => ({
              kind: "manual", activity: a,
              sortMs: (a.loggedAt as { seconds?: number })?.seconds
                ? (a.loggedAt as { seconds: number }).seconds * 1000
                : Date.now(),
            })),
          ].sort((a, b) => a.sortMs - b.sortMs);

          if (unified.length === 0) return null;

          return (
            <motion.div
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.08 }}
              className="glass p-4 mb-4"
            >
              <p className="label-xs mb-3">Activités du jour</p>
              <div className="space-y-3">
                <AnimatePresence>
                  {unified.map((item) => {

                    /* ── Google Fit session ── */
                    if (item.kind === "gfit") {
                      const s        = item.session;
                      const edit     = sessionEdits[s.id] ?? {};
                      const dispName = edit.name        ?? s.name;
                      const dispDur  = edit.durationMin ?? s.durationMin;
                      const dispCal  = edit.calories !== undefined ? edit.calories : s.calories;
                      const isEditing = editingGFitId === s.id;
                      const hasGps   = isGpsActivity(s.activityType);
                      const showRoute = openRouteId === s.id;
                      const actColor = getActivityColor(s.activityType);

                      const gfMetrics: { value: string; unit: string; color: string; icon: ReactNode }[] = [
                        { value: String(dispDur), unit: "min", color: actColor, icon: <IconClock size={13} stroke={1.8}/> },
                      ];
                      if (dispCal != null && dispCal > 0)
                        gfMetrics.push({ value: String(Math.round(dispCal)), unit: "kcal", color: "#f87171", icon: <IconFlame size={13} stroke={1.8}/> });
                      if (s.distanceM != null)
                        gfMetrics.push({
                          value: s.distanceM >= 1000 ? (s.distanceM / 1000).toFixed(2) : String(s.distanceM),
                          unit: s.distanceM >= 1000 ? "km" : "m",
                          color: "#34d399", icon: <IconRuler size={13} stroke={1.8}/>,
                        });
                      if (s.avgSpeedKmh != null)
                        gfMetrics.push({ value: String(s.avgSpeedKmh), unit: "km/h", color: "#60a5fa", icon: <IconGauge size={13} stroke={1.8}/> });
                      if (s.heartRateAvg != null)
                        gfMetrics.push({ value: String(s.heartRateAvg), unit: "bpm", color: "#f87171", icon: <IconHeart size={13} stroke={1.8}/> });

                      return (
                        <motion.div key={`gfit-${s.id}`}
                          initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}
                          className="flex flex-col gap-2"
                        >
                          {/* Card */}
                          <div className="rounded-2xl overflow-hidden" style={{
                            background: `linear-gradient(135deg, ${actColor}18 0%, ${actColor}06 70%)`,
                            border: `1px solid ${actColor}30`,
                          }}>
                            <div className="p-3.5">
                              {/* Header */}
                              <div className="flex items-start gap-3 mb-3">
                                <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                                  style={{ background: `${actColor}22`, border: `1px solid ${actColor}38` }}>
                                  <ActivitySVGIcon type={s.activityType} color={actColor} size={26}/>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[14px] font-bold leading-tight mb-1" style={{ color: "var(--text-primary)" }}>
                                    {dispName}
                                    {edit.name && <span className="text-[10px] ml-1.5" style={{ color: "var(--protein)" }}>✎</span>}
                                  </p>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                                      style={{ background: "rgba(251,191,36,0.15)", color: "#fbbf24" }}>GFIT</span>
                                    <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                                      {new Date(s.startMs).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-0.5 flex-shrink-0">
                                  {hasGps && (
                                    <button onClick={() => setOpenRouteId(showRoute ? null : s.id)}
                                      className="btn-icon w-8 h-8" title="Carte GPS"
                                      style={{ color: showRoute ? "#f97316" : "var(--text-muted)" }}>
                                      <IconMap size={14}/>
                                    </button>
                                  )}
                                  <button
                                    onClick={() => {
                                      if (isEditing) { setEditingGFitId(null); return; }
                                      setEditingGFitId(s.id);
                                      setGfitEditForm({
                                        name:        edit.name        ?? s.name,
                                        durationMin: String(edit.durationMin ?? s.durationMin),
                                        calories:    String(edit.calories !== undefined ? (edit.calories ?? "") : (s.calories ?? "")),
                                      });
                                    }}
                                    className="btn-icon w-8 h-8"
                                    style={{ color: isEditing ? "var(--protein)" : "var(--text-muted)" }}>
                                    <IconPencil size={13}/>
                                  </button>
                                </div>
                              </div>

                              {/* Metrics grid */}
                              <div className="grid gap-2"
                                style={{ gridTemplateColumns: `repeat(${Math.min(gfMetrics.length, 5)}, 1fr)` }}>
                                {gfMetrics.map((m, i) => <MetricChip key={i} {...m}/>)}
                              </div>
                            </div>
                          </div>

                          {/* Route map */}
                          <AnimatePresence>
                            {showRoute && (
                              <motion.div key={`route-${s.id}`}
                                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25 }}
                                style={{ overflow: "hidden" }}>
                                <RouteMap startMs={s.startMs} endMs={s.endMs} height={180}/>
                              </motion.div>
                            )}
                          </AnimatePresence>

                          {/* GFit inline edit */}
                          <AnimatePresence>
                            {isEditing && (
                              <motion.div key={`gfit-edit-${s.id}`}
                                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }}
                                style={{ overflow: "hidden" }}>
                                <div className="pt-1 pb-2 space-y-2">
                                  <input value={gfitEditForm.name}
                                    onChange={(e) => setGfitEditForm((f) => ({ ...f, name: e.target.value }))}
                                    placeholder="Nom de la séance" className="input text-[12px] w-full"/>
                                  <div className="flex gap-2">
                                    <div className="flex-1 flex items-center gap-1.5 input px-2 py-1.5">
                                      <IconClock size={12} style={{ color: "var(--text-muted)", flexShrink: 0 }}/>
                                      <input type="number" min="1" value={gfitEditForm.durationMin}
                                        onChange={(e) => setGfitEditForm((f) => ({ ...f, durationMin: e.target.value }))}
                                        className="w-full bg-transparent text-[12px] outline-none" placeholder="min"/>
                                    </div>
                                    <div className="flex-1 flex items-center gap-1.5 input px-2 py-1.5">
                                      <IconFlame size={12} style={{ color: "var(--fit-red)", flexShrink: 0 }}/>
                                      <input type="number" min="0" value={gfitEditForm.calories}
                                        onChange={(e) => setGfitEditForm((f) => ({ ...f, calories: e.target.value }))}
                                        className="w-full bg-transparent text-[12px] outline-none" placeholder="kcal"/>
                                    </div>
                                  </div>
                                  <div className="flex gap-2">
                                    <button onClick={() => setEditingGFitId(null)} className="flex-1 btn btn-ghost text-[11px]">Annuler</button>
                                    <button onClick={() => handleGFitEditSave(s.id)} disabled={gfitEditSaving}
                                      className="flex-1 btn btn-primary gap-1.5 text-[11px]">
                                      {gfitEditSaving ? <><IconLoader2 size={11} className="animate-spin"/>…</> : <><IconCheck size={11}/>Enregistrer</>}
                                    </button>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      );
                    }

                    /* ── Activité manuelle ── */
                    const a = item.activity;
                    const actColor = getActivityColor(a.activityType);

                    const mMetrics: { value: string; unit: string; color: string; icon: ReactNode }[] = [];
                    if (a.sets) {
                      mMetrics.push({ value: `${a.sets}×${a.reps ?? "?"}`, unit: "reps", color: actColor, icon: <IconBolt size={13} stroke={1.8}/> });
                      if (a.weightKg) mMetrics.push({ value: String(a.weightKg), unit: "kg", color: actColor, icon: <IconRuler size={13} stroke={1.8}/> });
                    } else {
                      mMetrics.push({ value: String(a.durationMin), unit: "min", color: actColor, icon: <IconClock size={13} stroke={1.8}/> });
                    }
                    if (a.caloriesBurned)
                      mMetrics.push({ value: String(a.caloriesBurned), unit: "kcal", color: "#f87171", icon: <IconFlame size={13} stroke={1.8}/> });

                    return (
                      <motion.div key={`manual-${a.id}`}
                        initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}
                        className="flex flex-col gap-2"
                      >
                        {/* Card */}
                        <div className="rounded-2xl overflow-hidden" style={{
                          background: `linear-gradient(135deg, ${actColor}18 0%, ${actColor}06 70%)`,
                          border: `1px solid ${actColor}30`,
                        }}>
                          <div className="p-3.5">
                            {/* Header */}
                            <div className="flex items-start gap-3 mb-3">
                              <button type="button"
                                onClick={() => {
                                  if (a.photoDataUrl) { setPhotoZoom({ url: a.photoDataUrl, activityId: a.id }); }
                                  else { setPhotoForActivityId(a.id); actPhotoInputRef.current?.click(); }
                                }}
                                className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 overflow-hidden relative group"
                                style={{ background: `${actColor}22`, border: `1px solid ${actColor}38` }}
                                title={a.photoDataUrl ? "Agrandir" : "Ajouter photo"}>
                                {a.photoDataUrl
                                  ? <img src={a.photoDataUrl} className="w-12 h-12 object-cover" alt=""/>
                                  : <ActivitySVGIcon type={a.activityType} color={actColor} size={26}/>
                                }
                                <div className="absolute inset-0 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                  style={{ background: "rgba(0,0,0,0.5)" }}>
                                  {a.photoDataUrl
                                    ? <IconMaximize size={13} style={{ color: "white" }}/>
                                    : <IconCamera size={13} style={{ color: "white" }}/>}
                                </div>
                              </button>
                              <div className="flex-1 min-w-0">
                                <p className="text-[14px] font-bold leading-tight mb-1" style={{ color: "var(--text-primary)" }}>
                                  {a.name}
                                </p>
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                                  style={{ background: "rgba(99,179,237,0.15)", color: "#60a5fa" }}>MANUEL</span>
                              </div>
                              <div className="flex items-center gap-0.5 flex-shrink-0">
                                <button
                                  onClick={() => {
                                    if (editingActivityId === a.id) { setEditingActivityId(null); return; }
                                    setEditingActivityId(a.id);
                                    setEditForm({
                                      actType: a.activityType, duration: String(a.durationMin), customName: a.name,
                                      calories: String(a.caloriesBurned ?? ""), sets: String(a.sets ?? "3"),
                                      reps: String(a.reps ?? "10"), weightKg: String(a.weightKg ?? ""),
                                      variableWeight: false, weightPerSet: [],
                                    });
                                  }}
                                  className="btn-icon w-8 h-8"
                                  style={{ color: editingActivityId === a.id ? "var(--protein)" : "var(--text-muted)" }}>
                                  <IconPencil size={13}/>
                                </button>
                                <button onClick={() => handleDelete(a.id)} className="btn-icon w-8 h-8" style={{ color: "#f87171" }}>
                                  <IconTrash size={13}/>
                                </button>
                              </div>
                            </div>

                            {/* Metrics grid */}
                            <div className="grid gap-2"
                              style={{ gridTemplateColumns: `repeat(${Math.min(mMetrics.length, 4)}, 1fr)` }}>
                              {mMetrics.map((m, i) => <MetricChip key={i} {...m}/>)}
                            </div>
                          </div>
                        </div>

                        {/* Manual inline edit */}
                        <AnimatePresence>
                          {editingActivityId === a.id && (
                            <motion.div key={`edit-${a.id}`}
                              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }}
                              style={{ overflow: "hidden" }}>
                              <div className="pt-1 pb-2 space-y-2">
                                <input value={editForm.customName}
                                  onChange={(e) => setEditForm((f) => ({ ...f, customName: e.target.value }))}
                                  placeholder="Nom de l'activité" className="input text-[12px] w-full"/>
                                {isMuscu(editForm.actType) ? (
                                  <div className="flex gap-2">
                                    <div className="flex-1 flex flex-col gap-1">
                                      <p className="text-[9px] uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Séries</p>
                                      <input type="number" min="1" value={editForm.sets}
                                        onChange={(e) => setEditForm((f) => updateMusculationCalories({ ...f, sets: e.target.value }))}
                                        className="input text-[12px] text-center"/>
                                    </div>
                                    <div className="flex-1 flex flex-col gap-1">
                                      <p className="text-[9px] uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Reps</p>
                                      <input type="number" min="1" value={editForm.reps}
                                        onChange={(e) => setEditForm((f) => updateMusculationCalories({ ...f, reps: e.target.value }))}
                                        className="input text-[12px] text-center"/>
                                    </div>
                                    <div className="flex-1 flex flex-col gap-1">
                                      <p className="text-[9px] uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Poids kg</p>
                                      <input type="number" min="0" step="0.5" value={editForm.weightKg}
                                        onChange={(e) => setEditForm((f) => updateMusculationCalories({ ...f, weightKg: e.target.value }))}
                                        className="input text-[12px] text-center" placeholder="—"/>
                                    </div>
                                    <div className="flex-1 flex flex-col gap-1">
                                      <p className="text-[9px] uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Kcal</p>
                                      <input type="number" min="0" value={editForm.calories}
                                        onChange={(e) => setEditForm((f) => ({ ...f, calories: e.target.value }))}
                                        className="input text-[12px] text-center"/>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex gap-2">
                                    <div className="flex-1 flex items-center gap-1.5 input px-2 py-1.5">
                                      <IconClock size={12} style={{ color: "var(--text-muted)", flexShrink: 0 }}/>
                                      <input type="number" min="1" value={editForm.duration}
                                        onChange={(e) => setEditForm((f) => ({ ...f, duration: e.target.value }))}
                                        className="w-full bg-transparent text-[12px] outline-none" placeholder="min"/>
                                    </div>
                                    <div className="flex-1 flex items-center gap-1.5 input px-2 py-1.5">
                                      <IconFlame size={12} style={{ color: "var(--fit-red)", flexShrink: 0 }}/>
                                      <input type="number" min="0" value={editForm.calories}
                                        onChange={(e) => setEditForm((f) => ({ ...f, calories: e.target.value }))}
                                        className="w-full bg-transparent text-[12px] outline-none" placeholder="kcal"/>
                                    </div>
                                  </div>
                                )}
                                <div className="flex gap-2">
                                  <button onClick={() => setEditingActivityId(null)} className="flex-1 btn btn-ghost text-[11px]">Annuler</button>
                                  <button onClick={() => handleEditSave(a.id)} disabled={editSaving}
                                    className="flex-1 btn btn-primary gap-1.5 text-[11px]">
                                    {editSaving ? <><IconLoader2 size={11} className="animate-spin"/>…</> : <><IconCheck size={11}/>Enregistrer</>}
                                  </button>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </motion.div>
          );
        })()}

        {/* Sleep */}
        {gf?.sleepMinutes && (
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.12 }}
            className="card flex items-center gap-3 mb-4"
          >
            <IconMoon size={16} style={{ color: "#818cf8" }} />
            <div>
              <p className="text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>
                {Math.floor(gf.sleepMinutes / 60)}h{String(gf.sleepMinutes % 60).padStart(2, "0")} de sommeil
              </p>
              <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                {gf.sleepMinutes >= 420 ? "✓ Bonne récupération" : "⚠ Sommeil insuffisant"}
              </p>
            </div>
          </motion.div>
        )}

        {(gf?.sessions?.length ?? 0) === 0 && activities.length === 0 && !showForm && (
          <div className="flex flex-col items-center gap-3 py-12">
            <span className="text-5xl">🏃</span>
            <p className="text-[14px] font-medium" style={{ color: "var(--text-secondary)" }}>
              {isOnToday ? "Aucune activité aujourd'hui" : "Aucune activité ce jour"}
            </p>
            <p className="text-[12px] text-center" style={{ color: "var(--text-muted)" }}>
              {isOnToday ? "Lancez une séance type ou ajoutez manuellement." : "Naviguez vers un autre jour ou revenez à aujourd'hui."}
            </p>
          </div>
        )}

        {/* ── Historique 14 jours ─────────────────────────────────────────────── */}
        {history.length > 0 && <ActivityHistory history={history} stepsGoal={goals?.stepsGoal ?? 10000} />}

      </div>

      {/* ── Toast ── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key="toast"
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="fixed bottom-24 left-1/2 z-50 max-w-xs w-[90vw] px-4 py-3 rounded-2xl text-[13px] font-medium text-center"
            style={{
              transform: "translateX(-50%)",
              background: toast.ok ? "rgba(52,211,153,0.18)" : "rgba(239,68,68,0.18)",
              border: `1px solid ${toast.ok ? "rgba(52,211,153,0.4)" : "rgba(239,68,68,0.4)"}`,
              color: toast.ok ? "rgba(52,211,153,0.95)" : "#f87171",
              backdropFilter: "blur(12px)",
            }}
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Activity detail sheet (from category picker) */}
      <ActivityDetailSheet
        exercise={detailExercise}
        catColor={detailColor}
        catColor2={detailColor2}
        weightKg={userWeightKg}
        saving={detailSaving}
        onSave={handleDetailSave}
        onClose={() => setDetailExercise(null)}
      />

      {/* Sport Search Modal */}
      <SportSearchModal
        open={showSportSearch}
        onClose={() => setShowSportSearch(false)}
        onSelect={handleSportSelect}
        onCustomize={handleSportCustomize}
        onSave={handleSportSave}
      />

      {/* Voice Activity Modal (Nutri-IA) */}
      <AnimatePresence>
        {showVoice && (
          <VoiceActivityModal
            date={date}
            onClose={() => setShowVoice(false)}
            onAdded={() => {
              setShowVoice(false);
              navigate(date);
              showToast("✓ Activité(s) ajoutée(s) par Nutri-IA", true);
            }}
          />
        )}
      </AnimatePresence>

      {/* Gym Session Modal (Salle de sport) */}
      <AnimatePresence>
        {showGym && (
          <GymSessionModal
            date={date}
            onClose={() => setShowGym(false)}
            onSaved={() => {
              setShowGym(false);
              navigate(date);
              showToast("✓ Séance enregistrée", true);
            }}
          />
        )}
      </AnimatePresence>

      {/* Hidden input for template photo editing */}
      <input
        type="file"
        accept="image/*"
        ref={tplPhotoEditRef}
        className="hidden"
        onChange={handleTplPhotoEdit}
      />

      {/* Hidden input for activity photo */}
      <input
        type="file"
        accept="image/*"
        ref={actPhotoInputRef}
        className="hidden"
        onChange={handleActivityPhotoUpload}
      />

      {/* ── Photo lightbox ── */}
      <AnimatePresence>
        {photoZoom && (
          <motion.div
            key="photo-lightbox"
            className="fixed inset-0 z-50 flex flex-col items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ background: "rgba(0,0,0,0.88)", backdropFilter: "blur(8px)" }}
            onClick={() => setPhotoZoom(null)}
          >
            {/* Image */}
            <motion.img
              src={photoZoom.url}
              alt=""
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1,    opacity: 1 }}
              exit={{ scale: 0.85,    opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              onClick={e => e.stopPropagation()}
              className="rounded-2xl object-contain shadow-2xl"
              style={{ maxWidth: "min(90vw, 480px)", maxHeight: "70vh" }}
            />

            {/* Action row */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1,  y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.2, delay: 0.05 }}
              className="flex items-center gap-3 mt-5"
              onClick={e => e.stopPropagation()}
            >
              {/* Replace photo */}
              <button
                onClick={() => {
                  setPhotoForActivityId(photoZoom.activityId);
                  setPhotoZoom(null);
                  setTimeout(() => actPhotoInputRef.current?.click(), 50);
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-medium transition-all"
                style={{ background: "rgba(255,255,255,0.1)", color: "white", border: "1px solid rgba(255,255,255,0.2)" }}>
                <IconCamera size={14} />
                Remplacer
              </button>
              {/* Close */}
              <button
                onClick={() => setPhotoZoom(null)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-medium transition-all"
                style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.12)" }}>
                <IconX size={14} />
                Fermer
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Shared form body ─────────────────────────────────────────────────────────

function ActivityFormBody({
  form, onChange, onDurationChange, onTypeChange, onMusculationChange,
  namePlaceholder, nameRequired, onSportSearch,
}: {
  form:                 FormState;
  onChange:             (v: FormState) => void;
  onDurationChange:     (v: string) => void;
  onTypeChange:         (t: number) => void;
  onMusculationChange?: (f: FormState) => void;
  namePlaceholder?:     string;
  nameRequired?:        boolean;
  onSportSearch?:       () => void;
}) {
  const selectedOpt = ACTIVITY_OPTIONS.find((a) => a.type === form.actType) ?? ACTIVITY_OPTIONS[0];
  const muscu = isMuscu(form.actType);

  // Sync weightPerSet array length to sets count
  const setsCount = Math.min(20, Math.max(1, parseInt(form.sets) || 3));

  const handleSetsStep = (delta: number) => {
    const next = Math.min(20, Math.max(1, (parseInt(form.sets) || 3) + delta));
    const nextStr = String(next);
    // Update weightPerSet array size
    const newWPS = Array.from({ length: next }, (_, i) => form.weightPerSet[i] ?? form.weightKg ?? "");
    const updated = { ...form, sets: nextStr, weightPerSet: newWPS };
    onMusculationChange ? onMusculationChange(updated) : onChange(updated);
  };

  const handleRepsStep = (delta: number) => {
    const next = Math.min(50, Math.max(1, (parseInt(form.reps) || 10) + delta));
    const updated = { ...form, reps: String(next) };
    onMusculationChange ? onMusculationChange(updated) : onChange(updated);
  };

  const handleWeightChange = (val: string) => {
    const updated = { ...form, weightKg: val };
    onMusculationChange ? onMusculationChange(updated) : onChange(updated);
  };

  const handleWeightPerSetChange = (idx: number, val: string) => {
    const newWPS = [...form.weightPerSet];
    newWPS[idx] = val;
    const updated = { ...form, weightPerSet: newWPS };
    onMusculationChange ? onMusculationChange(updated) : onChange(updated);
  };

  const toggleVariableWeight = () => {
    const next = !form.variableWeight;
    let newWPS = form.weightPerSet;
    if (next && newWPS.length !== setsCount) {
      newWPS = Array.from({ length: setsCount }, (_, i) => form.weightPerSet[i] ?? form.weightKg ?? "");
    }
    const updated = { ...form, variableWeight: next, weightPerSet: newWPS };
    onChange(updated);
  };

  return (
    <>
      {/* NutriTrack-Sport button */}
      {onSportSearch && (
        <button
          type="button"
          onClick={onSportSearch}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-medium mb-3 transition-all"
          style={{
            background: "rgba(167,139,250,0.10)",
            border: "1px solid rgba(167,139,250,0.35)",
            color: "var(--protein)",
          }}
        >
          🔍 NutriTrack-Sport — parcourir les exercices
        </button>
      )}

      {/* Activity grid */}
      <div className="grid grid-cols-4 gap-2 mb-3">
        {ACTIVITY_OPTIONS.map((opt) => (
          <button key={opt.type} onClick={() => onTypeChange(opt.type)}
            className="flex flex-col items-center gap-1 p-2 rounded-xl text-center transition-all"
            style={{
              background: form.actType === opt.type ? "rgba(167,139,250,0.12)" : "rgba(255,255,255,0.03)",
              border: `1px solid ${form.actType === opt.type ? "rgba(167,139,250,0.5)" : "var(--border)"}`,
            }}>
            <span className="text-[18px]">{opt.emoji}</span>
            <span className="text-[9px] leading-tight" style={{ color: form.actType === opt.type ? "var(--protein)" : "var(--text-muted)" }}>
              {opt.label.split(" ")[0]}
            </span>
          </button>
        ))}
      </div>

      {/* Name */}
      <input
        value={form.customName}
        onChange={(e) => onChange({ ...form, customName: e.target.value })}
        placeholder={namePlaceholder ?? `Nom (optionnel, ex: "${selectedOpt.label}")`}
        className="input text-[13px] mb-3"
      />

      {/* Musculation fields OR duration + calories */}
      {muscu ? (
        <div className="space-y-3">
          {/* Séries + Reps */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-xs block mb-1.5">Séries</label>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => handleSetsStep(-1)}
                  className="btn-icon w-8 h-8 text-base">−</button>
                <input
                  type="number"
                  value={form.sets}
                  onChange={(e) => {
                    const n = Math.min(20, Math.max(1, parseInt(e.target.value) || 1));
                    const newWPS = Array.from({ length: n }, (_, i) => form.weightPerSet[i] ?? form.weightKg ?? "");
                    const updated = { ...form, sets: String(n), weightPerSet: newWPS };
                    onMusculationChange ? onMusculationChange(updated) : onChange(updated);
                  }}
                  className="input text-center w-14 tabular-nums" min="1" max="20"
                />
                <button type="button" onClick={() => handleSetsStep(+1)}
                  className="btn-icon w-8 h-8 text-base">+</button>
              </div>
            </div>
            <div>
              <label className="label-xs block mb-1.5">Reps</label>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => handleRepsStep(-1)}
                  className="btn-icon w-8 h-8 text-base">−</button>
                <input
                  type="number"
                  value={form.reps}
                  onChange={(e) => {
                    const n = Math.min(50, Math.max(1, parseInt(e.target.value) || 1));
                    const updated = { ...form, reps: String(n) };
                    onMusculationChange ? onMusculationChange(updated) : onChange(updated);
                  }}
                  className="input text-center w-14 tabular-nums" min="1" max="50"
                />
                <button type="button" onClick={() => handleRepsStep(+1)}
                  className="btn-icon w-8 h-8 text-base">+</button>
              </div>
            </div>
          </div>

          {/* Poids + variable toggle + Kcal */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-xs block mb-1.5">Poids (kg)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={form.weightKg}
                  onChange={(e) => handleWeightChange(e.target.value)}
                  placeholder="Poids corps"
                  className="input flex-1 text-center tabular-nums"
                  min="0"
                  step="0.5"
                />
                <button
                  type="button"
                  onClick={toggleVariableWeight}
                  className="flex-shrink-0 px-2 py-1.5 rounded-lg text-[10px] font-semibold transition-all"
                  title="Poids variable par série"
                  style={{
                    background: form.variableWeight ? "rgba(251,191,36,0.15)" : "rgba(255,255,255,0.06)",
                    border: `1px solid ${form.variableWeight ? "rgba(251,191,36,0.5)" : "var(--border)"}`,
                    color: form.variableWeight ? "#fbbf24" : "var(--text-muted)",
                  }}
                >
                  Var.
                </button>
              </div>
            </div>
            <div>
              <label className="label-xs block mb-1.5">Kcal brûlées</label>
              <input
                type="number"
                value={form.calories}
                onChange={(e) => onChange({ ...form, calories: e.target.value })}
                placeholder="Auto"
                className="input text-center tabular-nums"
                min="0"
              />
            </div>
          </div>

          {/* Per-set weight inputs when variable */}
          {form.variableWeight && setsCount > 0 && (
            <div>
              <label className="label-xs block mb-1.5">Poids par série (kg)</label>
              <div className="flex gap-1.5 flex-wrap">
                {Array.from({ length: setsCount }, (_, i) => (
                  <div key={i} className="flex flex-col items-center gap-0.5">
                    <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>S{i + 1}</span>
                    <input
                      type="number"
                      value={form.weightPerSet[i] ?? ""}
                      onChange={(e) => handleWeightPerSetChange(i, e.target.value)}
                      className="input text-center tabular-nums text-[12px]"
                      style={{ width: "48px", padding: "4px 6px" }}
                      min="0"
                      step="0.5"
                      placeholder="kg"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Duration + calories */
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label-xs block mb-1.5">Durée (min)</label>
            <div className="flex items-center gap-2">
              <button onClick={() => onDurationChange(String(Math.max(5, (parseInt(form.duration) || 30) - 5)))}
                className="btn-icon w-8 h-8 text-base">−</button>
              <input type="number" value={form.duration} onChange={(e) => onDurationChange(e.target.value)}
                className="input text-center w-16 tabular-nums" min="1" />
              <button onClick={() => onDurationChange(String((parseInt(form.duration) || 30) + 5))}
                className="btn-icon w-8 h-8 text-base">+</button>
            </div>
          </div>
          <div>
            <label className="label-xs block mb-1.5">Kcal brûlées</label>
            <input type="number" value={form.calories} onChange={(e) => onChange({ ...form, calories: e.target.value })}
              placeholder="Auto" className="input text-center tabular-nums" min="0" />
          </div>
        </div>
      )}
    </>
  );
}
