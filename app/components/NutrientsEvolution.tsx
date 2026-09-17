"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { IconChevronUp, IconChevronDown } from "@tabler/icons-react";
import {
  ComposedChart, Area, AreaChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import type { DayTrendPoint, NutritionGoals, TrackedNutrients } from "@/app/lib/types";

type Range = "1j" | "7d" | "30d" | "3m" | "6m" | "1y" | "all";

interface Props {
  caloriePoints:     (DayTrendPoint & { label: string })[];
  goals:             NutritionGoals;
  trackedNutrients?: TrackedNutrients;
  range:             Range;
}

// Widget "Evolution des nutriments" (macros + micronutriments dans le temps),
// section Poids de la vue Tendances — extrait de ProgressClient.tsx. Bloc en
// realite independant de "Poids" malgre son emplacement visuel juste en
// dessous (verifie : aucune fermeture partagee au-dela de caloriePoints/
// goals/trackedNutrients). L'ouverture/fermeture et l'onglet macro/micro
// sont un etat purement local a ce widget.
export default function NutrientsEvolution({ caloriePoints, goals, trackedNutrients, range }: Props) {
  const [nutrientsOpen, setNutrientsOpen] = useState(false);
  const [nutriTab,      setNutriTab]      = useState<"macros" | "micros">("macros");

              // ── shared data ─────────────────────────────────────────────────
              const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length) : 0;
              const macroChartData = caloriePoints.map(p => ({
                label:    format(parseISO(p.date), caloriePoints.length > 14 ? "d/M" : "d MMM", { locale: fr }),
                proteinG: p.proteinG,
                carbsG:   p.carbsG,
                fatG:     p.fatG,
              }));
              const avgProteinV = avg(caloriePoints.map(p => p.proteinG));
              const avgCarbsV   = avg(caloriePoints.map(p => p.carbsG));
              const avgFatV     = avg(caloriePoints.map(p => p.fatG));

              const REF = {
                fiberG:        { refLine: 25,   unit: "g",  label: "Fibres",        color: "var(--ok)", note: "≥ 25 g/j"    },
                sugarG:        { refLine: 25,   unit: "g",  label: "Sucres libres", color: "var(--weight)", note: "< 25 g/j"    },
                sodiumMg:      { refLine: 2000, unit: "mg", label: "Sodium",        color: "var(--calories)", note: "< 2000 mg/j" },
                saturatedFatG: { refLine: 22,   unit: "g",  label: "Lipides sat.",  color: "var(--calories)", note: "< 22 g/j"    },
              } as const;
              type MicroKey = keyof typeof REF;
              const activeMicros: MicroKey[] = (["fiberG", "sugarG", "sodiumMg", "saturatedFatG"] as MicroKey[]).filter(k => {
                if (k === "fiberG")        return true;
                if (k === "sugarG")        return trackedNutrients?.sugar ?? false;
                if (k === "sodiumMg")      return trackedNutrients?.sodium ?? false;
                if (k === "saturatedFatG") return trackedNutrients?.saturatedFat ?? false;
                return false;
              }).filter(k => caloriePoints.some(p => (p[k] ?? 0) > 0));

              return (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.12 }} className="glass p-5 mb-4">

                  {/* ── Header — click to expand/collapse ─────────────────── */}
                  <button className="w-full flex items-center justify-between" onClick={() => setNutrientsOpen(v => !v)}>
                    <p className="label-xs">Évolution des nutriments</p>
                    {nutrientsOpen ? <IconChevronUp size={14} style={{ color: "var(--text-muted)" }} /> : <IconChevronDown size={14} style={{ color: "var(--text-muted)" }} />}
                  </button>

                  <AnimatePresence initial={false}>
                    {nutrientsOpen && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                        style={{ overflow: "hidden" }}>
                        <div className="pt-4">

                  {/* ── Tabs ─────────────────────────────────────────────── */}
                  <div className="flex justify-end mb-4">
                    <div className="flex gap-1 p-0.5 rounded-lg"
                      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)" }}>
                      {([["macros", "Macros"], ["micros", "Micros"]] as const).map(([key, lbl]) => (
                        <button key={key} onClick={() => setNutriTab(key)}
                          className="px-3 py-1 rounded-md text-[11px] font-medium transition-all"
                          style={{
                            background:  nutriTab === key ? "rgba(249,115,22,0.12)" : "transparent",
                            color:       nutriTab === key ? "var(--calories)"        : "var(--text-muted)",
                            border:      nutriTab === key ? "1px solid rgba(249,115,22,0.35)" : "1px solid transparent",
                          }}>
                          {lbl}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* ── MACROS view ──────────────────────────────────────── */}
                  {nutriTab === "macros" && (
                    <>
                      {/* Legend chips */}
                      <div className="flex items-center gap-3 mb-3">
                        {(["proteinG", "carbsG", "fatG"] as const).map((k, i) => {
                          const [label, cssVar] = [["Protéines", "var(--protein)"], ["Glucides", "var(--carbs)"], ["Lipides", "var(--fat)"]].at(i)!;
                          return (
                            <div key={k} className="flex items-center gap-1">
                              <div className="w-2 h-2 rounded-full" style={{ background: cssVar }} />
                              <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{label}</span>
                            </div>
                          );
                        })}
                      </div>
                      <ResponsiveContainer key={range} width="100%" height={140}>
                        <ComposedChart data={macroChartData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                          <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.04)" />
                          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--text-muted)" }} tickLine={false} axisLine={false}
                            interval={caloriePoints.length > 20 ? Math.floor(caloriePoints.length / 8) : 0} />
                          <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} tickLine={false} axisLine={false}
                            tickFormatter={v => `${v}g`} />
                          <Tooltip content={({ active, payload, label }) => {
                            if (!active || !payload?.length) return null;
                            return (
                              <div className="px-3 py-2 rounded-xl space-y-0.5 text-[11px]"
                                style={{ background: "rgba(13,13,17,0.96)", border: "1px solid var(--border)" }}>
                                <p style={{ color: "var(--text-muted)", marginBottom: 4 }}>{label}</p>
                                {payload.map(e => (
                                  <p key={e.dataKey as string} style={{ color: e.color }}>{e.name} {e.value}g</p>
                                ))}
                              </div>
                            );
                          }} />
                          {goals.proteinGrams > 0 && <ReferenceLine y={goals.proteinGrams} stroke="var(--protein)" strokeDasharray="4 3" strokeOpacity={0.35} />}
                          {goals.carbsGrams   > 0 && <ReferenceLine y={goals.carbsGrams}   stroke="var(--carbs)"   strokeDasharray="4 3" strokeOpacity={0.35} />}
                          {goals.fatGrams     > 0 && <ReferenceLine y={goals.fatGrams}     stroke="var(--fat)"     strokeDasharray="4 3" strokeOpacity={0.35} />}
                          <Line type="linear" dataKey="proteinG" name="Protéines" stroke="var(--protein)" strokeWidth={2} dot={{ r: 1.5, fill: "var(--protein)", strokeWidth: 0 }} activeDot={{ r: 3.5 }} connectNulls />
                          <Line type="linear" dataKey="carbsG"   name="Glucides"  stroke="var(--carbs)"   strokeWidth={2} dot={{ r: 1.5, fill: "var(--carbs)",   strokeWidth: 0 }} activeDot={{ r: 3.5 }} connectNulls />
                          <Line type="linear" dataKey="fatG"     name="Lipides"   stroke="var(--fat)"     strokeWidth={2} dot={{ r: 1.5, fill: "var(--fat)",     strokeWidth: 0 }} activeDot={{ r: 3.5 }} connectNulls />
                        </ComposedChart>
                      </ResponsiveContainer>
                      {/* Average summary */}
                      <div className="flex gap-3 mt-3 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                        {[
                          { label: "Protéines", val: avgProteinV, goal: goals.proteinGrams, cssVar: "var(--protein)" },
                          { label: "Glucides",  val: avgCarbsV,   goal: goals.carbsGrams,   cssVar: "var(--carbs)"   },
                          { label: "Lipides",   val: avgFatV,     goal: goals.fatGrams,     cssVar: "var(--fat)"     },
                        ].map(({ label, val, goal, cssVar }) => (
                          <div key={label} className="flex-1 text-center">
                            <p className="text-[15px] font-bold tabular-nums" style={{ color: cssVar }}>{val}g</p>
                            <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{label} moy.</p>
                            {goal > 0 && (
                              <p className="text-[11px] tabular-nums"
                                style={{ color: val >= goal * 0.85 && val <= goal * 1.15 ? "var(--fiber)" : "var(--carbs)" }}>
                                obj. {goal}g
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  {/* ── MICROS view ──────────────────────────────────────── */}
                  {nutriTab === "micros" && (
                    activeMicros.length === 0 ? (
                      <p className="text-[12px] py-6 text-center" style={{ color: "var(--text-muted)" }}>
                        Activez le suivi des micronutriments dans Réglages
                      </p>
                    ) : (
                      <div className={`grid gap-4 ${activeMicros.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
                        {activeMicros.map(k => {
                          const ref = REF[k];
                          const microData = caloriePoints
                            .filter(p => (p[k] ?? 0) > 0)
                            .map(p => ({ label: format(parseISO(p.date), "d/M", { locale: fr }), value: p[k] as number }));
                          if (microData.length < 2) return null;
                          const avgVal  = avg(microData.map(d => d.value));
                          const isOkAvg = k === "fiberG" ? avgVal >= ref.refLine : avgVal <= ref.refLine;
                          return (
                            <div key={k}>
                              <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center gap-1.5">
                                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: ref.color }} />
                                  <span className="text-[11px] font-semibold" style={{ color: "var(--text-secondary)" }}>{ref.label}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[11px] font-bold tabular-nums"
                                    style={{ color: isOkAvg ? "var(--fiber)" : "var(--danger)" }}>{avgVal}{ref.unit}</span>
                                  <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>moy.</span>
                                </div>
                              </div>
                              <ResponsiveContainer width="100%" height={64}>
                                <AreaChart data={microData} margin={{ top: 2, right: 2, left: -40, bottom: 0 }}>
                                  <defs>
                                    <linearGradient id={`micro-grad-${k}`} x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="0%"   stopColor={ref.color} stopOpacity={0.25} />
                                      <stop offset="100%" stopColor={ref.color} stopOpacity={0.02} />
                                    </linearGradient>
                                  </defs>
                                  <XAxis dataKey="label" tick={false} axisLine={false} tickLine={false} />
                                  <YAxis tick={false} axisLine={false} tickLine={false} />
                                  <Tooltip content={({ active, payload, label }) => {
                                    if (!active || !payload?.length) return null;
                                    return (
                                      <div className="px-2 py-1 rounded-lg text-[11px]"
                                        style={{ background: "rgba(13,13,17,0.96)", border: "1px solid var(--border)" }}>
                                        <p style={{ color: "var(--text-muted)" }}>{label}</p>
                                        <p style={{ color: ref.color }}>{payload[0].value}{ref.unit}</p>
                                      </div>
                                    );
                                  }} />
                                  <ReferenceLine y={ref.refLine} stroke={ref.color} strokeDasharray="3 3" strokeOpacity={0.5} />
                                  <Area type="linear" dataKey="value" stroke={ref.color} strokeWidth={1.5}
                                    fill={`url(#micro-grad-${k})`} dot={{ r: 1.3, fill: ref.color, strokeWidth: 0 }} activeDot={{ r: 3 }} connectNulls />
                                </AreaChart>
                              </ResponsiveContainer>
                              <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                                {k === "fiberG" ? `Objectif ≥ ${ref.refLine}${ref.unit}` : `Limite ${ref.refLine}${ref.unit}`} · {ref.note}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    )
                  )}

                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>

  );
}
