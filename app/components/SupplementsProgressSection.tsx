"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { format, subDays } from "date-fns";
import { fr } from "date-fns/locale";
import {
  AreaChart, Area, XAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { IconPill, IconFlask } from "@tabler/icons-react";
import type { SupplementProduct, MicronutrientCode } from "@/app/lib/types";
import { MICRONUTRIENT_DB } from "@/app/lib/micronutrients";
import type { SupplementsProgressResponse } from "@/app/api/supplements-progress/route";

const FREQUENCY_PER_DAY: Record<SupplementProduct["frequency"], number> = {
  once: 1,
  twice: 2,
  thrice: 3,
  four_times: 4,
};

function avg(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export default function SupplementsProgressSection() {
  const [data, setData] = useState<SupplementsProgressResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState<7 | 14 | 30>(14);

  useEffect(() => {
    const to = format(new Date(), "yyyy-MM-dd");
    const from = format(subDays(new Date(), days - 1), "yyyy-MM-dd");
    setLoading(true);
    fetch(`/api/supplements-progress?from=${from}&to=${to}`, { cache: "no-store" })
      .then(r => r.ok ? r.json() : null)
      .then((d: SupplementsProgressResponse | null) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [days]);

  const dateRange: string[] = Array.from({ length: days }, (_, i) =>
    format(subDays(new Date(), days - 1 - i), "yyyy-MM-dd")
  );

  if (loading) {
    return (
      <div className="glass p-5 mb-4">
        <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>Chargement…</p>
      </div>
    );
  }

  const products = data?.products ?? [];
  const adherenceByDate = new Map((data?.adherence ?? []).map(a => [a.date, new Set(a.taken)]));
  const micronutrientSeries = data?.micronutrientSeries ?? {};
  const trackedCodes = Object.keys(micronutrientSeries) as MicronutrientCode[];

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }} className="glass p-5 mb-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1.5">
          <IconPill size={15} style={{ color: "var(--fiber)" }} />
          <p className="label-xs">Suppléments & Vitamines</p>
        </div>
        <div className="flex gap-1 p-0.5 rounded-lg"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)" }}>
          {([7, 14, 30] as const).map(d => (
            <button key={d} onClick={() => setDays(d)}
              className="px-2.5 py-1 rounded-md text-[11px] font-medium transition-all"
              style={{
                background: days === d ? "rgba(52,211,153,0.12)" : "transparent",
                color:      days === d ? "var(--fiber)"          : "var(--text-muted)",
                border:     days === d ? "1px solid rgba(52,211,153,0.35)" : "1px solid transparent",
              }}>
              {d}J
            </button>
          ))}
        </div>
      </div>

      {/* ── Adherence per supplement ─────────────────────────────────── */}
      {products.length === 0 ? (
        <p className="text-[12px] py-4 text-center" style={{ color: "var(--text-muted)" }}>
          Aucun supplément configuré. Ajoute-en un dans Réglages.
        </p>
      ) : (
        <div className="space-y-3 mb-5">
          {products.map(product => {
            const expectedPerDay = FREQUENCY_PER_DAY[product.frequency] ?? 1;
            const daysTaken = dateRange.filter(d => adherenceByDate.get(d)?.has(product.id)).length;
            const pct = Math.round((daysTaken / days) * 100);
            const color = pct >= 80 ? "#34d399" : pct >= 50 ? "#fbbf24" : "#f87171";

            return (
              <div key={product.id}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[12px] font-semibold" style={{ color: "var(--text-primary)" }}>
                    {product.name}
                  </span>
                  <span className="text-[11px] font-bold tabular-nums" style={{ color }}>
                    {daysTaken}/{days}j ({pct}%)
                  </span>
                </div>
                {/* Mini habit-tracker dot grid */}
                <div className="flex gap-1 flex-wrap">
                  {dateRange.map(d => {
                    const taken = adherenceByDate.get(d)?.has(product.id) ?? false;
                    return (
                      <div
                        key={d}
                        title={d}
                        className="rounded-sm"
                        style={{
                          width: days > 14 ? 6 : 10,
                          height: days > 14 ? 6 : 10,
                          background: taken ? color : "rgba(255,255,255,0.07)",
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Micronutrient trends ────────────────────────────────────── */}
      {trackedCodes.length > 0 && (
        <div className="pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-1.5 mb-3">
            <IconFlask size={13} style={{ color: "var(--text-muted)" }} />
            <span className="text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>
              Micronutriments
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {trackedCodes.map(code => {
              const info = MICRONUTRIENT_DB[code];
              const series = micronutrientSeries[code] ?? [];
              if (series.length < 2) return null;
              const rda = info.recommendedDailyIntake || 0;
              const chartData = series.map(p => ({
                label: format(new Date(p.date), "d/M", { locale: fr }),
                value: p.amount,
              }));
              const avgVal = Math.round(avg(series.map(s => s.amount)));
              const isOk = rda > 0 ? avgVal >= rda * 0.8 : true;

              return (
                <div key={code}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: info.color }} />
                      <span className="text-[11px] font-semibold" style={{ color: "var(--text-secondary)" }}>
                        {info.symbol}
                      </span>
                    </div>
                    <span className="text-[11px] font-bold tabular-nums" style={{ color: isOk ? "#34d399" : "#f87171" }}>
                      {avgVal}{info.unit} moy.
                    </span>
                  </div>
                  <ResponsiveContainer width="100%" height={64}>
                    <AreaChart data={chartData} margin={{ top: 2, right: 2, left: 2, bottom: 0 }}>
                      <defs>
                        <linearGradient id={`supp-grad-${code}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={info.color} stopOpacity={0.25} />
                          <stop offset="100%" stopColor={info.color} stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="label" tick={false} axisLine={false} tickLine={false} />
                      {rda > 0 && <ReferenceLine y={rda} stroke={info.color} strokeDasharray="4 3" strokeOpacity={0.4} />}
                      <Tooltip content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        return (
                          <div className="px-2.5 py-1.5 rounded-lg text-[10px]"
                            style={{ background: "rgba(13,13,17,0.96)", border: "1px solid var(--border)" }}>
                            <p style={{ color: "var(--text-muted)" }}>{label}</p>
                            <p style={{ color: info.color }}>{payload[0].value}{info.unit}</p>
                          </div>
                        );
                      }} />
                      <Area type="monotone" dataKey="value" stroke={info.color} strokeWidth={2}
                        fill={`url(#supp-grad-${code})`}
                        dot={{ r: 3, fill: info.color, stroke: "var(--bg)", strokeWidth: 1.5 }}
                        activeDot={{ r: 4.5 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </motion.div>
  );
}
