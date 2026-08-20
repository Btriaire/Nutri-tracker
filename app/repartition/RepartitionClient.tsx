"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { format, subDays } from "date-fns";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import {
  IconChartDonut, IconChevronLeft, IconAlertTriangle, IconCircleCheck, IconLoader2,
} from "@tabler/icons-react";
import QuotaWarningBanner from "@/app/components/QuotaWarningBanner";

type Period = "semaine" | "mois" | "3mois";

const PERIODS: { key: Period; label: string; days: number }[] = [
  { key: "semaine", label: "Semaine", days: 7 },
  { key: "mois",    label: "Mois",    days: 30 },
  { key: "3mois",   label: "3 mois",  days: 90 },
];

interface Insight { label: string; detail: string }
interface FoodGroup { category: string; label: string; calories: number; pct: number; count: number }
interface MicroRow { code: string; label: string; symbol: string; pctAjr: number }

interface RepartitionData {
  loggedDays: number;
  rangeDayCount: number;
  macros: {
    avgCalories: number; proteinG: number; carbsG: number; fatG: number;
    sugarG: number; saturatedFatG: number; proteinPct: number; carbsPct: number; fatPct: number;
  };
  foodGroups: FoodGroup[];
  micronutrients: MicroRow[];
  insights: { concerns: Insight[]; goodHabits: Insight[] };
  dietEnabled: boolean;
}

const MACRO_COLORS = { protein: "var(--protein)", carbs: "var(--carbs)", fat: "var(--fat)" };

const GROUP_COLORS: Record<string, string> = {
  feculents:    "#d97706",
  viande:       "#ef4444",
  poisson:      "#3b82f6",
  legumineuses: "#65a30d",
  legume:       "#10b981",
  fruit:        "#ec4899",
  oeuf:         "#f59e0b",
  laitage:      "#f59e0b",
  oleagineux:   "#92400e",
  corpsgras:    "#eab308",
  sucrerie:     "#a855f7",
  boisson:      "#0ea5e9",
  autre:        "#64748b",
};

function microColor(pct: number) {
  if (pct >= 90) return "#4ade80";
  if (pct >= 60) return "#fbbf24";
  return "#f87171";
}

function MicroGauge({ m }: { m: MicroRow }) {
  const color = microColor(m.pctAjr);
  const pct = Math.min(m.pctAjr, 100);
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="w-14 h-14 rounded-full flex items-center justify-center"
        style={{ background: `conic-gradient(${color} 0% ${pct}%, rgba(255,255,255,0.06) ${pct}% 100%)` }}>
        <div className="w-[42px] h-[42px] rounded-full flex items-center justify-center"
          style={{ background: "var(--surface, #1a1a1f)" }}>
          <span className="text-[11px] font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>
            {Math.round(m.pctAjr)}%
          </span>
        </div>
      </div>
      <span className="text-[10px] text-center" style={{ color: "var(--text-muted)" }}>{m.label}</span>
    </div>
  );
}

function InsightList({ title, items, tone }: { title: string; items: Insight[]; tone: "danger" | "success" }) {
  if (!items.length) return null;
  const color = tone === "danger" ? "#f87171" : "#4ade80";
  const bg    = tone === "danger" ? "rgba(248,113,113,0.06)" : "rgba(74,222,128,0.06)";
  const Icon  = tone === "danger" ? IconAlertTriangle : IconCircleCheck;
  return (
    <div className="rounded-2xl p-4" style={{ background: bg, borderLeft: `2px solid ${color}` }}>
      <p className="text-[12px] font-semibold mb-3 flex items-center gap-1.5" style={{ color }}>
        <Icon size={14} stroke={1.8} /> {title}
      </p>
      <div className="space-y-2.5">
        {items.map((it, i) => (
          <div key={i} className="flex items-center gap-2.5">
            <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold flex-shrink-0"
              style={{ background: `${color}22`, color }}>
              {i + 1}
            </span>
            <span className="text-[12.5px] flex-1" style={{ color: "var(--text-primary)" }}>{it.label}</span>
            <span className="text-[10.5px] flex-shrink-0" style={{ color }}>{it.detail}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function RepartitionClient() {
  const [period, setPeriod]   = useState<Period | null>(null);
  const [pending, setPending] = useState<Period | null>(null);
  const [data, setData]       = useState<RepartitionData | null>(null);
  const [loading, setLoading] = useState(false);

  const loadPeriod = (p: Period) => {
    const days = PERIODS.find((x) => x.key === p)!.days;
    const to   = format(new Date(), "yyyy-MM-dd");
    const from = format(subDays(new Date(), days - 1), "yyyy-MM-dd");
    setPeriod(p);
    setPending(null);
    setLoading(true);
    fetch(`/api/repartition?from=${from}&to=${to}`)
      .then((r) => r.json())
      .then((d: RepartitionData) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  };

  const macroPieData = useMemo(() => {
    if (!data) return [];
    return [
      { name: "Protéines", value: data.macros.proteinPct, color: MACRO_COLORS.protein },
      { name: "Glucides",  value: data.macros.carbsPct,   color: MACRO_COLORS.carbs },
      { name: "Lipides",   value: data.macros.fatPct,     color: MACRO_COLORS.fat },
    ];
  }, [data]);

  const groupPieData = useMemo(() => {
    if (!data) return [];
    return data.foodGroups.map((g) => ({ name: g.label, value: g.pct, color: GROUP_COLORS[g.category] ?? "#64748b", count: g.count }));
  }, [data]);

  return (
    <div className="relative min-h-screen" style={{ paddingBottom: "80px" }}>
      <div className="bg-orbs" />
      <div className="relative z-10 max-w-md mx-auto px-4 py-6 md:ml-[220px]">

        <div className="flex items-center gap-2 mb-5">
          <Link href="/progress" className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)" }}>
            <IconChevronLeft size={16} stroke={1.8} style={{ color: "var(--text-muted)" }} />
          </Link>
          <IconChartDonut size={18} stroke={1.8} style={{ color: "var(--protein)" }} />
          <h1 className="text-[16px] font-semibold" style={{ color: "var(--text-primary)" }}>Répartition</h1>
        </div>

        <QuotaWarningBanner />

        <div className="flex gap-1.5 mb-5">
          {PERIODS.map((p) => (
            <button key={p.key} onClick={() => setPending(p.key)}
              className="flex-1 px-3 py-2 rounded-xl text-[12.5px] font-medium transition-all"
              style={{
                background: period === p.key ? "rgba(59,130,246,0.14)" : "rgba(255,255,255,0.04)",
                color:      period === p.key ? "var(--protein)" : "var(--text-secondary)",
                border:     `1px solid ${period === p.key ? "rgba(59,130,246,0.4)" : "var(--border)"}`,
              }}>
              {p.label}
            </button>
          ))}
        </div>

        <AnimatePresence>
          {pending && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[300] flex items-center justify-center px-6"
              style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
              onClick={() => setPending(null)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full rounded-2xl p-5" style={{ maxWidth: 340, background: "var(--surface, #1a1a1f)", border: "1px solid var(--border)" }}
              >
                <p className="text-[13.5px] font-semibold mb-2" style={{ color: "var(--text-primary)" }}>Charger la répartition ?</p>
                <p className="text-[12px] leading-relaxed mb-4" style={{ color: "var(--text-secondary)" }}>
                  Cette page scanne tout votre journal sur la période ({PERIODS.find((p) => p.key === pending)?.label.toLowerCase()}) —
                  plusieurs centaines de lectures Firestore, sur un quota limité à 50 000/jour. Continuer ?
                </p>
                <div className="flex gap-2">
                  <button onClick={() => setPending(null)} className="flex-1 btn btn-ghost">Annuler</button>
                  <button onClick={() => loadPeriod(pending)} className="flex-1 btn btn-primary">Continuer</button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {loading ? (
          <div className="flex justify-center py-16">
            <IconLoader2 size={22} className="animate-spin" style={{ color: "var(--text-muted)" }} />
          </div>
        ) : !period ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <IconChartDonut size={28} stroke={1.5} style={{ color: "var(--text-muted)" }} />
            <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>
              Choisissez une période ci-dessus pour charger la répartition.
            </p>
          </div>
        ) : !data || data.loggedDays === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16">
            <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>Aucune donnée sur cette période.</p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div key={period} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
              className="space-y-4">

              {(data.insights.concerns.length > 0 || data.insights.goodHabits.length > 0) && (
                <div className="space-y-3">
                  <InsightList title="À surveiller" items={data.insights.concerns} tone="danger" />
                  <InsightList title="Bonnes habitudes à renforcer" items={data.insights.goodHabits} tone="success" />
                </div>
              )}

              {/* Macros */}
              <div className="glass p-5">
                <p className="text-[13px] mb-3" style={{ color: "var(--text-secondary)" }}>
                  Répartition calorique moyenne · {data.macros.avgCalories} kcal/j
                </p>
                <div className="flex items-center gap-5">
                  <div style={{ width: 120, height: 120, flexShrink: 0 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={macroPieData} dataKey="value" nameKey="name" innerRadius={38} outerRadius={58} startAngle={90} endAngle={-270} stroke="none">
                          {macroPieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                        </Pie>
                        <Tooltip formatter={(v) => `${v}%`} contentStyle={{ background: "rgba(13,13,17,0.96)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: MACRO_COLORS.protein }} />
                      <span className="text-[12.5px] flex-1" style={{ color: "var(--text-secondary)" }}>Protéines</span>
                      <span className="text-[12.5px] font-semibold" style={{ color: "var(--text-primary)" }}>{data.macros.proteinPct}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: MACRO_COLORS.carbs }} />
                      <span className="text-[12.5px] flex-1" style={{ color: "var(--text-secondary)" }}>Glucides</span>
                      <span className="text-[12.5px] font-semibold" style={{ color: "var(--text-primary)" }}>{data.macros.carbsPct}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: MACRO_COLORS.fat }} />
                      <span className="text-[12.5px] flex-1" style={{ color: "var(--text-secondary)" }}>Lipides</span>
                      <span className="text-[12.5px] font-semibold" style={{ color: "var(--text-primary)" }}>{data.macros.fatPct}%</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 mt-4 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
                  <div className="flex-1 rounded-xl px-3 py-2" style={{ background: "rgba(255,255,255,0.04)" }}>
                    <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>dont sucres</p>
                    <p className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>{data.macros.sugarG} g</p>
                  </div>
                  <div className="flex-1 rounded-xl px-3 py-2" style={{ background: "rgba(255,255,255,0.04)" }}>
                    <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>dont saturés</p>
                    <p className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>{data.macros.saturatedFatG} g</p>
                  </div>
                </div>
              </div>

              {/* Food groups */}
              {groupPieData.length > 0 && (
                <div className="glass p-5">
                  <p className="text-[13px] mb-3" style={{ color: "var(--text-secondary)" }}>
                    Groupes alimentaires · part des calories
                  </p>
                  <div className="flex items-center gap-5">
                    <div style={{ width: 120, height: 120, flexShrink: 0 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={groupPieData} dataKey="value" nameKey="name" innerRadius={0} outerRadius={58} stroke="none">
                            {groupPieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                          </Pie>
                          <Tooltip formatter={(v) => `${v}%`} contentStyle={{ background: "rgba(13,13,17,0.96)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 11 }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex-1 grid grid-cols-1 gap-1.5">
                      {data.foodGroups.slice(0, 6).map((g) => (
                        <div key={g.category} className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: GROUP_COLORS[g.category] ?? "#64748b" }} />
                          <span className="text-[10.5px] truncate" style={{ color: "var(--text-secondary)" }}>{g.label} {g.pct}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Micronutrients */}
              {data.micronutrients.length > 0 && (
                <div className="glass p-5">
                  <p className="text-[13px] mb-3" style={{ color: "var(--text-secondary)" }}>
                    Micronutriments · % AJR moyen
                  </p>
                  <div className="grid grid-cols-4 gap-3">
                    {data.micronutrients.slice(0, 8).map((m) => <MicroGauge key={m.code} m={m} />)}
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
