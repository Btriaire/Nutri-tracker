"use client";

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import type { FaceScanEntry } from "@/app/lib/types";

interface Props {
  scans: FaceScanEntry[]; // most-recent-first, as returned by GET /api/face-scan
}

const AXES: { key: keyof FaceScanEntry["analysis"]["scorecard"]; label: string; color: string }[] = [
  { key: "amaigrissement", label: "Amaigrissement visage", color: "#6366f1" },
  { key: "fatigue",        label: "Fatigue",               color: "#f59e0b" },
  { key: "teint",          label: "Teint",                 color: "#f43f5e" },
  { key: "hydratation",    label: "Hydratation",           color: "#06b6d4" },
];

export default function FaceScanTrendChart({ scans }: Props) {
  if (scans.length < 2) return null;

  // Oldest → newest for a left-to-right timeline
  const chronological = [...scans].reverse();
  const data = chronological.map(s => ({
    label: format(parseISO(s.date), "d MMM", { locale: fr }),
    amaigrissement: s.analysis.scorecard?.amaigrissement ?? null,
    fatigue:        s.analysis.scorecard?.fatigue ?? null,
    teint:          s.analysis.scorecard?.teint ?? null,
    hydratation:    s.analysis.scorecard?.hydratation ?? null,
  }));

  return (
    <div className="glass p-4 mb-4">
      <p className="text-[12px] font-semibold mb-3" style={{ color: "var(--text-primary)" }}>
        Évolution dans le temps
      </p>
      <div className="grid grid-cols-2 gap-3">
        {AXES.map(axis => (
          <div key={axis.key}>
            <div className="flex items-center gap-1.5 mb-1">
              <div className="w-2 h-2 rounded-full" style={{ background: axis.color }} />
              <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{axis.label}</span>
            </div>
            <ResponsiveContainer width="100%" height={64}>
              <AreaChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 0 }}>
                <defs>
                  <linearGradient id={`face-grad-${axis.key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={axis.color} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={axis.color} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 8, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis domain={[1, 5]} hide />
                <Tooltip content={({ active, payload, label }) => {
                  if (!active || !payload?.length || payload[0].value == null) return null;
                  return (
                    <div className="px-2 py-1 rounded-lg text-[10px]" style={{ background: "rgba(13,13,17,0.96)", border: "1px solid var(--border)" }}>
                      <p style={{ color: "var(--text-muted)" }}>{label}</p>
                      <p style={{ color: axis.color }}>{payload[0].value}/5</p>
                    </div>
                  );
                }} />
                <Area type="monotone" dataKey={axis.key} stroke={axis.color} strokeWidth={2}
                  fill={`url(#face-grad-${axis.key})`}
                  dot={{ r: 2.5, fill: axis.color, stroke: "var(--bg)", strokeWidth: 1 }}
                  connectNulls />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ))}
      </div>
    </div>
  );
}
