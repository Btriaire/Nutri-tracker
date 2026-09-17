"use client";

import { motion } from "framer-motion";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  IconFlame, IconDroplet, IconMoon, IconRun, IconScale, IconBolt, IconHeart, IconShoe,
} from "@tabler/icons-react";
import { fmtSleep } from "@/app/lib/health-format";
import type { DayTrendPoint, NutritionGoals } from "@/app/lib/types";

interface Props {
  todayPoint:     DayTrendPoint | undefined;
  loading:        boolean;
  goals:          NutritionGoals;
  targetWeightKg: number | null;
}

// Vue "Jour" (aujourd'hui uniquement) de Progres — extrait de
// ProgressClient.tsx. Le selecteur de plage (1j/7j/30j/...) reste dans le
// parent ; ce composant se contente d'afficher les donnees du jour deja
// calculees.
export default function TodayView({ todayPoint, loading, goals, targetWeightKg }: Props) {
  return (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
            className="space-y-3">

            <p className="text-[13px] font-medium capitalize" style={{ color: "var(--text-muted)" }}>
              {format(new Date(), "EEEE d MMMM yyyy", { locale: fr })}
            </p>

            {loading ? (
              <div className="flex items-center justify-center py-16">
                <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>Chargement…</p>
              </div>
            ) : (
              <>
                {/* Nutrition */}
                <div className="glass p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <IconFlame size={16} stroke={1.5} style={{ color: "var(--calories)" }} />
                    <p className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>Nutrition</p>
                  </div>
                  {todayPoint?.calories ? (
                    <>
                      {/* Calorie bar */}
                      <div className="flex items-baseline gap-2 mb-2">
                        <span className="text-[30px] font-bold tabular-nums" style={{ color: "var(--calories)" }}>
                          {todayPoint.calories}
                        </span>
                        <span className="text-[13px]" style={{ color: "var(--text-muted)" }}>
                          / {goals.dailyCalories} kcal
                        </span>
                      </div>
                      <div className="h-2 rounded-full overflow-hidden mb-4" style={{ background: "rgba(255,255,255,0.07)" }}>
                        <div className="h-full rounded-full" style={{
                          background: "var(--calories)",
                          width: `${Math.min((todayPoint.calories / goals.dailyCalories) * 100, 100)}%`,
                          transition: "width 0.8s ease",
                        }} />
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        {[
                          { label: "Protéines", val: todayPoint.proteinG, goal: goals.proteinGrams, color: "var(--protein)", unit: "g" },
                          { label: "Glucides",  val: todayPoint.carbsG,   goal: goals.carbsGrams,   color: "var(--carbs)",   unit: "g" },
                          { label: "Lipides",   val: todayPoint.fatG,     goal: goals.fatGrams,     color: "var(--fat)",     unit: "g" },
                          { label: "Eau",       val: Math.round((todayPoint.waterMl ?? 0) / 100) / 10, goal: (goals.waterMl ?? 2000) / 1000, color: "var(--info)", unit: "L" },
                        ].map(({ label, val, goal, color, unit }) => (
                          <div key={label} className="flex flex-col items-center gap-1 p-2.5 rounded-xl"
                            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)" }}>
                            <span className="text-[16px] font-bold tabular-nums" style={{ color }}>{val}{unit}</span>
                            <span className="text-[11px] text-center leading-tight" style={{ color: "var(--text-muted)" }}>{label}</span>
                            <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>/{goal}{unit}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="text-[12px] py-3" style={{ color: "var(--text-muted)" }}>Aucun repas enregistré aujourd&apos;hui</p>
                  )}
                </div>

                {/* Activité */}
                <div className="glass p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <IconRun size={16} stroke={1.5} style={{ color: "var(--steps)" }} />
                    <p className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>Activité</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { icon: IconShoe,    label: "Pas",            val: todayPoint?.steps ? todayPoint.steps.toLocaleString("fr-FR") : "—",             color: "var(--steps)",    goal: "/ 10 000" },
                      { icon: IconBolt,     label: "Min. actives",   val: todayPoint?.activeMinutes ?? "—",                                                color: "var(--fit-green)", goal: "/ 30 min" },
                      { icon: IconFlame,    label: "Kcal brûlées",   val: todayPoint?.burned ?? "—",                                                       color: "var(--fit-red)",   goal: "actives" },
                      { icon: IconHeart,    label: "FC moy.",         val: todayPoint?.heartRateAvg ? `${todayPoint.heartRateAvg} bpm` : "—",               color: "var(--fit-red)",   goal: todayPoint?.heartRateAvg ? (todayPoint.heartRateAvg < 60 ? "Repos" : todayPoint.heartRateAvg < 100 ? "Normal" : "Élevé") : "" },
                    ].map(({ icon: Icon, label, val, color, goal }) => (
                      <div key={label} className="flex items-center gap-3 p-3 rounded-xl"
                        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)" }}>
                        <Icon size={22} stroke={1.5} style={{ color, flexShrink: 0 }} />
                        <div>
                          <p className="text-[18px] font-bold tabular-nums leading-tight" style={{ color }}>{val}</p>
                          <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{label}</p>
                          {goal && <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{goal}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Récupération */}
                <div className="glass p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <IconMoon size={16} stroke={1.5} style={{ color: "var(--fit-indigo)" }} />
                    <p className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>Récupération</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-3 p-3 rounded-xl"
                      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)" }}>
                      <IconMoon size={24} stroke={1.5} style={{ color: "var(--fit-indigo)", flexShrink: 0 }} />
                      <div>
                        <p className="text-[20px] font-bold leading-tight" style={{ color: "var(--fit-indigo)" }}>
                          {fmtSleep(todayPoint?.sleepMinutes)}
                        </p>
                        <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Sommeil</p>
                        {todayPoint?.sleepMinutes && (
                          <p className="text-[11px]" style={{ color: (todayPoint.sleepMinutes >= 420) ? "var(--fit-green)" : "var(--carbs)" }}>
                            {todayPoint.sleepMinutes >= 420 ? "✓ Récupéré" : "Insuffisant"}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-xl"
                      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)" }}>
                      <IconDroplet size={24} stroke={1.5} style={{ color: "var(--info)", flexShrink: 0 }} />
                      <div>
                        <p className="text-[20px] font-bold leading-tight" style={{ color: "var(--info)" }}>
                          {todayPoint?.waterMl ? `${(todayPoint.waterMl / 1000).toFixed(1)}L` : "—"}
                        </p>
                        <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Hydratation</p>
                        <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                          / {((goals.waterMl ?? 2000) / 1000).toFixed(1)}L objectif
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Weight today */}
                {todayPoint?.weightKg && (
                  <div className="glass p-4 flex items-center gap-4">
                    <IconScale size={28} stroke={1.5} style={{ color: "var(--protein)" }} />
                    <div className="flex-1">
                      <p className="text-[26px] font-bold" style={{ color: "var(--protein)" }}>
                        {todayPoint.weightKg.toFixed(1)} kg
                      </p>
                      {targetWeightKg && (
                        <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
                          Objectif : {targetWeightKg} kg
                          {` · ${Math.abs(todayPoint.weightKg - targetWeightKg).toFixed(1)} kg ${todayPoint.weightKg > targetWeightKg ? "à perdre" : "sous l'objectif"}`}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </motion.div>

  );
}
