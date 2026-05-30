"use client";

import {
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  ComposedChart,
} from "recharts";
import { parseISO, format } from "date-fns";
import { fr } from "date-fns/locale";

export interface MoodPoint {
  date:   string;
  mood:   number | null;
  stress: number | null;
  energy: number | null;
}

interface Props {
  points: MoodPoint[];
}

function fmtDate(dateStr: string): string {
  try {
    const d = parseISO(dateStr);
    return format(d, "d/M", { locale: fr });
  } catch {
    return dateStr;
  }
}

function CustomTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number | null; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  const mood   = payload.find(p => p.dataKey === "mood")?.value   ?? null;
  const stress = payload.find(p => p.dataKey === "stress")?.value ?? null;
  const energy = payload.find(p => p.dataKey === "energy")?.value ?? null;

  return (
    <div
      className="px-3 py-2 rounded-xl text-[11px] space-y-1"
      style={{
        background: "rgba(13,13,17,0.96)",
        border: "1px solid var(--border)",
        backdropFilter: "blur(8px)",
      }}
    >
      <p className="font-medium mb-1" style={{ color: "var(--text-muted)" }}>{label}</p>
      {mood   != null && <p style={{ color: "#a855f7" }}>😊 Humeur&nbsp;&nbsp;<span className="font-bold">{mood}/5</span></p>}
      {stress != null && <p style={{ color: "#f87171" }}>😰 Stress&nbsp;&nbsp;&nbsp;<span className="font-bold">{stress}/5</span></p>}
      {energy != null && <p style={{ color: "#fbbf24" }}>⚡ Énergie&nbsp;<span className="font-bold">{energy}/5</span></p>}
    </div>
  );
}

export default function MoodTrendChart({ points }: Props) {
  const data = points.map(p => ({
    label:  fmtDate(p.date),
    mood:   p.mood,
    stress: p.stress,
    energy: p.energy,
  }));

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <p className="label-xs">Évolution 30 jours</p>
        <div className="flex items-center gap-3 text-[10px]" style={{ color: "var(--text-muted)" }}>
          <span className="flex items-center gap-1">
            <span className="inline-block w-4 h-0.5 rounded" style={{ background: "#a855f7" }} />
            😊 Humeur
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-4 h-0.5 rounded" style={{ background: "#f87171", borderBottom: "1px dashed #f87171" }} />
            😰 Stress
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-4 h-0.5 rounded" style={{ background: "#fbbf24" }} />
            ⚡ Énergie
          </span>
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={160}>
        <ComposedChart data={data} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(255,255,255,0.05)"
            vertical={false}
          />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 9, fill: "var(--text-muted)" }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[1, 5]}
            ticks={[1, 2, 3, 4, 5]}
            tick={false}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<CustomTooltip />} />

          {/* Mood — area fill */}
          <defs>
            <linearGradient id="moodGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#a855f7" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#a855f7" stopOpacity={0.03} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="mood"
            stroke="#a855f7"
            strokeWidth={2}
            fill="url(#moodGrad)"
            dot={false}
            connectNulls
          />

          {/* Stress — dashed, no fill */}
          <Line
            type="monotone"
            dataKey="stress"
            stroke="#f87171"
            strokeWidth={1.5}
            strokeDasharray="4 3"
            dot={false}
            connectNulls
          />

          {/* Energy — dashed, no fill */}
          <Line
            type="monotone"
            dataKey="energy"
            stroke="#fbbf24"
            strokeWidth={1.5}
            strokeDasharray="4 3"
            dot={false}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Bottom legend */}
      <div className="flex items-center justify-center gap-5 mt-2 text-[10px]" style={{ color: "var(--text-muted)" }}>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-0.5 rounded" style={{ background: "#a855f7" }} />
          😊 Humeur
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-0.5 rounded" style={{ background: "#f87171" }} />
          😰 Stress
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-0.5 rounded" style={{ background: "#fbbf24" }} />
          ⚡ Énergie
        </span>
      </div>
    </div>
  );
}
