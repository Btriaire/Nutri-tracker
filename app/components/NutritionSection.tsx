"use client";

import { motion } from "framer-motion";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { IconChartBar, IconChartLine, IconFlame, IconRun } from "@tabler/icons-react";
import type { DayTrendPoint, NutritionGoals } from "@/app/lib/types";

type Range    = "1j" | "7d" | "30d" | "3m" | "6m" | "1y" | "all";
type CalChart = "area" | "bar";

interface Props {
  chartData:   (DayTrendPoint & { label: string })[];
  goals:       NutritionGoals;
  range:       Range;
  loading:     boolean;
  calChart:    CalChart;
  setCalChart: (c: CalChart) => void;
}

const Tt = ({ bg, label, value, unit, color }: { bg?: string; label: string; value: string | number | undefined; unit?: string; color?: string }) => (
  <div className="px-3 py-2 rounded-xl text-[12px]"
    style={{ background: bg ?? "rgba(13,13,17,0.96)", border: "1px solid var(--border)" }}>
    <p style={{ color: "var(--text-muted)" }}>{label}</p>
    <p className="font-bold" style={{ color: color ?? "var(--text-primary)" }}>{value}{unit ? ` ${unit}` : ""}</p>
  </div>
);

// Section "Nutrition" (calories + macros, plage courante) de la vue
// Tendances de Progres — extrait de ProgressClient.tsx.
export default function NutritionSection({ chartData, goals, range, loading, calChart, setCalChart }: Props) {
  const caloriePoints  = chartData.filter((p) => p.calories > 0);
  const activityPoints = chartData.filter((p) => (p.activeMinutes ?? 0) > 0 || (p.steps ?? 0) > 0);
  const avgSteps = activityPoints.filter((p) => (p.steps ?? 0) > 0).length
    ? Math.round(activityPoints.filter((p) => (p.steps ?? 0) > 0).reduce((s, p) => s + (p.steps ?? 0), 0)
        / activityPoints.filter((p) => (p.steps ?? 0) > 0).length) : 0;
  const avgActiveMins = activityPoints.filter((p) => (p.activeMinutes ?? 0) > 0).length
    ? Math.round(activityPoints.filter((p) => (p.activeMinutes ?? 0) > 0).reduce((s, p) => s + (p.activeMinutes ?? 0), 0)
        / activityPoints.filter((p) => (p.activeMinutes ?? 0) > 0).length) : 0;

  return (
            <motion.div id="nutrition" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.08 }}
              className="glass-strong p-5 mb-4">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <IconFlame size={14} stroke={1.5} style={{ color: "var(--calories)" }} />
                  <p className="label-xs">Calories &amp; Activité</p>
                </div>
                <div className="flex gap-1.5">
                  {(["area", "bar"] as CalChart[]).map((t) => (
                    <button key={t} onClick={() => setCalChart(t)} className="btn-icon w-7 h-7"
                      style={{ color: calChart === t ? "var(--calories)" : "var(--text-muted)" }}>
                      {t === "area" ? <IconChartLine size={13} stroke={1.5} /> : <IconChartBar size={13} stroke={1.5} />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Calorie chart */}
              <p className="text-[11px] mb-1.5 font-medium" style={{ color: "var(--text-muted)" }}>Calories consommées</p>
              {loading ? (
                <div className="h-32 flex items-center justify-center">
                  <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>Chargement…</span>
                </div>
              ) : caloriePoints.length === 0 ? (
                <div className="h-32 flex items-center justify-center">
                  <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>Aucune donnée</span>
                </div>
              ) : (
                <ResponsiveContainer key={`${range}-${calChart}`} width="100%" height={140}>
                  {calChart === "area" ? (
                    <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="calGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--calories)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="var(--calories)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} />
                      <Tooltip content={({ active, payload, label: lbl }) => active && payload?.length ? <Tt label={String(lbl ?? "")} value={payload[0].value as number} unit="kcal" color="var(--calories)" /> : null} />
                      <ReferenceLine y={goals.dailyCalories} stroke="rgba(249,115,22,0.4)" strokeDasharray="4 4" />
                      <Area type="monotone" dataKey="calories" stroke="var(--calories)" strokeWidth={2} fill="url(#calGrad)" dot={false} />
                    </AreaChart>
                  ) : (
                    <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} />
                      <Tooltip content={({ active, payload, label: lbl }) => active && payload?.length ? <Tt label={String(lbl ?? "")} value={payload[0].value as number} unit="kcal" color="var(--calories)" /> : null} />
                      <ReferenceLine y={goals.dailyCalories} stroke="rgba(249,115,22,0.4)" strokeDasharray="4 4" />
                      <Bar dataKey="calories" fill="var(--calories)" fillOpacity={0.8} radius={[3, 3, 0, 0]} />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              )}

              {/* Activity section — inside the same card */}
              {activityPoints.length > 0 && (
                <>
                  <div className="h-px my-4" style={{ background: "var(--border)" }} />
                  <div className="flex items-center gap-2 mb-3">
                    <IconRun size={13} stroke={1.5} style={{ color: "var(--steps)" }} />
                    <p className="text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>Activité sportive</p>
                    {avgSteps > 0 && (
                      <span className="ml-auto text-[11px] tabular-nums" style={{ color: "var(--steps)" }}>
                        ~{avgSteps.toLocaleString("fr-FR")} pas/j
                      </span>
                    )}
                  </div>
                  {/* Steps */}
                  {avgSteps > 0 && (
                    <>
                      <p className="text-[11px] mb-1" style={{ color: "var(--text-muted)" }}>Pas journaliers</p>
                      <ResponsiveContainer width="100%" height={90}>
                        <AreaChart data={chartData.filter((p) => (p.steps ?? 0) > 0)} margin={{ top: 2, right: 4, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="stepsGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="var(--steps)" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="var(--steps)" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                          <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} />
                          <Tooltip content={({ active, payload, label: lbl }) => active && payload?.length ? <Tt label={String(lbl ?? "")} value={(payload[0].value as number).toLocaleString("fr-FR")} unit="pas" color="var(--steps)" /> : null} />
                          <ReferenceLine y={10000} stroke="rgba(56,189,248,0.3)" strokeDasharray="4 4" />
                          <Area type="monotone" dataKey="steps" stroke="var(--steps)" strokeWidth={1.5} fill="url(#stepsGrad)" dot={false} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </>
                  )}
                  {/* Active minutes */}
                  {avgActiveMins > 0 && (
                    <>
                      <div className="h-px my-3" style={{ background: "var(--border)" }} />
                      <p className="text-[11px] mb-1" style={{ color: "var(--text-muted)" }}>Minutes actives · moy. {avgActiveMins} min/j</p>
                      <ResponsiveContainer width="100%" height={80}>
                        <BarChart data={chartData.filter((p) => (p.activeMinutes ?? 0) > 0)} margin={{ top: 2, right: 4, left: -20, bottom: 0 }}>
                          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                          <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} />
                          <Tooltip content={({ active, payload, label: lbl }) => active && payload?.length ? <Tt label={String(lbl ?? "")} value={payload[0].value as number} unit="min" color="var(--fit-green)" /> : null} />
                          <ReferenceLine y={30} stroke="rgba(52,168,83,0.3)" strokeDasharray="4 4" />
                          <Bar dataKey="activeMinutes" fill="var(--fit-green)" fillOpacity={0.75} radius={[3, 3, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </>
                  )}
                </>
              )}
            </motion.div>

  );
}
