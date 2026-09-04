"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie,
} from "recharts";
import { IconChevronDown, IconChartBar } from "@tabler/icons-react";
import { CATEGORY_META } from "@/app/lib/food-substitution";
import type { BankFood } from "@/app/api/food/bank/route";

const PALETTE = ["#a78bfa", "#f97316", "#34d399", "#f472b6", "#60a5fa", "#fbbf24", "#818cf8", "#4ade80", "#f87171", "#38bdf8", "#e879f9", "#facc15", "#94a3b8"];

function colorForIndex(i: number): string {
  return PALETTE[i % PALETTE.length];
}

// ─── Custom tooltip (dark card, matches BodyCompChart's convention) ──────────

function ChartTooltip({ active, payload, label, unit }: {
  active?: boolean; payload?: { value: number; payload?: { fullName?: string } }[]; label?: string; unit?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-3 py-2 text-[11px]"
      style={{ background: "rgba(15,15,22,0.97)", border: "1px solid var(--border-strong)", boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}>
      <p className="font-medium" style={{ color: "var(--text-primary)" }}>{payload[0]?.payload?.fullName ?? label}</p>
      <p style={{ color: "var(--protein)" }}>{payload[0]?.value}{unit ?? ""}</p>
    </div>
  );
}

export default function BankDashboard({ foods }: { foods: BankFood[] }) {
  const [open, setOpen] = useState(true);

  const topFoods = useMemo(() => {
    return [...foods]
      .sort((a, b) => b.timesLogged - a.timesLogged)
      .slice(0, 8)
      .map((f) => ({
        name: f.name.length > 14 ? `${f.name.slice(0, 13)}…` : f.name,
        fullName: f.name,
        count: f.timesLogged,
      }))
      .reverse(); // horizontal bars read top-to-bottom as highest-first
  }, [foods]);

  const categoryBreakdown = useMemo(() => {
    const m = new Map<string, number>();
    for (const f of foods) m.set(f.category, (m.get(f.category) ?? 0) + f.timesLogged);
    const total = [...m.values()].reduce((s, v) => s + v, 0) || 1;
    return [...m.entries()]
      .map(([cat, count]) => ({
        cat, count,
        pct: Math.round((count / total) * 100),
        fullName: `${CATEGORY_META[cat]?.label ?? cat} — ${Math.round((count / total) * 100)}%`,
      }))
      .sort((a, b) => b.count - a.count);
  }, [foods]);

  const discoveryTimeline = useMemo(() => {
    const m = new Map<string, number>();
    for (const f of foods) {
      const month = f.firstLoggedDate.slice(0, 7); // YYYY-MM
      m.set(month, (m.get(month) ?? 0) + 1);
    }
    return [...m.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, count]) => ({ month: month.slice(2), fullName: month, count })); // "26-05" short label
  }, [foods]);

  const topBrands = useMemo(() => {
    const m = new Map<string, number>();
    for (const f of foods) {
      if (!f.brand) continue;
      m.set(f.brand, (m.get(f.brand) ?? 0) + f.timesLogged);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [foods]);

  if (foods.length === 0) return null;

  return (
    <div className="glass rounded-2xl overflow-hidden mb-4">
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center gap-2 px-4 py-3.5">
        <IconChartBar size={16} stroke={1.5} style={{ color: "var(--text-muted)" }} />
        <p className="flex-1 text-left text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>Vue d&apos;ensemble</p>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <IconChevronDown size={15} style={{ color: "var(--text-muted)" }} />
        </motion.div>
      </button>

      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }} className="px-4 pb-4 space-y-5">

          {/* Top foods */}
          <div>
            <p className="text-[10px] uppercase tracking-wide font-semibold mb-2" style={{ color: "var(--text-muted)" }}>
              Tes aliments les plus fréquents
            </p>
            <div style={{ height: topFoods.length * 28 + 10 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topFoods} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} />
                  <Tooltip content={<ChartTooltip unit=" fois" />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={14}>
                    {topFoods.map((_, i) => <Cell key={i} fill="var(--protein)" fillOpacity={0.4 + (i / topFoods.length) * 0.6} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Category breakdown */}
          <div>
            <p className="text-[10px] uppercase tracking-wide font-semibold mb-2" style={{ color: "var(--text-muted)" }}>
              Répartition par catégorie
            </p>
            <div className="flex items-center gap-4">
              <div style={{ width: 110, height: 110, flexShrink: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={categoryBreakdown} dataKey="count" nameKey="cat" innerRadius={30} outerRadius={52} paddingAngle={2} stroke="none">
                      {categoryBreakdown.map((_, i) => <Cell key={i} fill={colorForIndex(i)} />)}
                    </Pie>
                    <Tooltip content={<ChartTooltip unit="%" />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                {categoryBreakdown.slice(0, 6).map((c, i) => {
                  const meta = CATEGORY_META[c.cat] ?? CATEGORY_META.autre;
                  return (
                    <div key={c.cat} className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: colorForIndex(i) }} />
                      <span className="text-[10.5px] flex-1 truncate" style={{ color: "var(--text-secondary)" }}>{meta.emoji} {meta.label}</span>
                      <span className="text-[10px] tabular-nums flex-shrink-0" style={{ color: "var(--text-muted)" }}>{c.pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Discovery timeline */}
          {discoveryTimeline.length > 1 && (
            <div>
              <p className="text-[10px] uppercase tracking-wide font-semibold mb-2" style={{ color: "var(--text-muted)" }}>
                Nouveaux aliments essayés par mois
              </p>
              <div style={{ height: 90 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={discoveryTimeline} margin={{ top: 0, right: 4, left: -28, bottom: 0 }}>
                    <XAxis dataKey="month" tick={{ fontSize: 9, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} />
                    <YAxis hide />
                    <Tooltip content={<ChartTooltip unit=" nouveaux" />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]} fill="var(--fiber)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Top brands */}
          {topBrands.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wide font-semibold mb-2" style={{ color: "var(--text-muted)" }}>
                Marques les plus fidèles
              </p>
              <div className="space-y-1">
                {topBrands.map(([brand, count], i) => (
                  <div key={brand} className="flex items-center gap-2">
                    <span className="text-[10px] w-4 flex-shrink-0 tabular-nums" style={{ color: "var(--text-muted)" }}>{i + 1}</span>
                    <span className="text-[11.5px] flex-1 truncate" style={{ color: "var(--text-primary)" }}>{brand}</span>
                    <span className="text-[10px] tabular-nums flex-shrink-0" style={{ color: "var(--text-muted)" }}>×{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
