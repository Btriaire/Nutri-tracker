"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  format,
  parseISO,
  isAfter,
  isSameDay,
} from "date-fns";
import { fr } from "date-fns/locale";
import type { MoodPoint } from "./MoodTrendChart";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Props {
  points: MoodPoint[];
  today:  string; // YYYY-MM-DD
}

// ─── Colours ─────────────────────────────────────────────────────────────────

const MOOD_COLORS: Record<number, string> = {
  1: "#7f1d1d",
  2: "#92400e",
  3: "#1e3a5f",
  4: "#14532d",
  5: "#365314",
};

const MOOD_LABELS: Record<number, string> = {
  1: "Très mauvaise humeur",
  2: "Mauvaise humeur",
  3: "Humeur neutre",
  4: "Bonne humeur",
  5: "Excellente humeur",
};

const MOOD_EMOJIS: Record<number, string> = {
  1: "😞",
  2: "😔",
  3: "😐",
  4: "🙂",
  5: "😄",
};

const WEEK_LABEL_NAMES: Record<number, string> = {
  1: "Sérénité",
  2: "Inquiétude",
  3: "Neutralité",
  4: "Bien-être",
  5: "Euphorie",
};

const WEEK_LABEL_COLORS: Record<number, string> = {
  1: "🔴",
  2: "🟠",
  3: "🔵",
  4: "🟢",
  5: "🟡",
};

// ISO weekday: Monday = 0 … Sunday = 6 (for our column layout)
function isoWeekday(date: Date): number {
  const d = getDay(date); // 0=Sun … 6=Sat
  return d === 0 ? 6 : d - 1;
}

const DAY_COLS = ["L", "M", "M", "J", "V", "S", "D"];

// ─── Component ───────────────────────────────────────────────────────────────

export default function PixelWall({ points, today }: Props) {
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);

  const todayDate = useMemo(() => parseISO(today), [today]);

  // Build lookup: date string → mood point
  const pointMap = useMemo(() => {
    const m: Record<string, MoodPoint> = {};
    for (const p of points) m[p.date] = p;
    return m;
  }, [points]);

  // All days in the current month
  const monthStart = startOfMonth(todayDate);
  const monthEnd   = endOfMonth(todayDate);
  const allDays    = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Leading empty cells so first day lands on the right column
  const leadingBlanks = isoWeekday(monthStart);

  // Flatten into grid cells: null = blank, Date = actual day
  const cells: (Date | null)[] = [
    ...Array(leadingBlanks).fill(null),
    ...allDays,
  ];

  // Split into weeks (rows of 7)
  const rows: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(cells.slice(i, i + 7));
  }

  // Stats
  const filledDays  = allDays.filter(d => pointMap[format(d, "yyyy-MM-dd")]?.mood != null).length;
  const totalDays   = allDays.length;

  // Week summary: dominant mood this week (last 7 days up to today)
  const weekSummary = useMemo(() => {
    const counts: Record<number, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(todayDate);
      d.setDate(d.getDate() - i);
      const key = format(d, "yyyy-MM-dd");
      const mood = pointMap[key]?.mood;
      if (mood != null) counts[mood] = (counts[mood] ?? 0) + 1;
    }
    if (Object.keys(counts).length === 0) return null;
    const dominant = Number(
      Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
    );
    return dominant;
  }, [todayDate, pointMap]);

  // Month name in French
  const monthLabel = format(todayDate, "MMMM yyyy", { locale: fr });
  const monthLabelCap = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

  // Pixel index for stagger
  let pixelIndex = 0;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <p className="label-xs">Mur de pixels — {monthLabelCap}</p>
        <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
          {filledDays} jour{filledDays !== 1 ? "s" : ""} rempli{filledDays !== 1 ? "s" : ""} sur {totalDays}
        </span>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto">
        <div style={{ display: "inline-block" }}>
          {/* Day column headers */}
          <div className="flex gap-1 mb-1">
            {DAY_COLS.map((d, i) => (
              <div
                key={i}
                className="text-center text-[9px] font-medium"
                style={{ width: 32, color: "var(--text-muted)" }}
              >
                {d}
              </div>
            ))}
          </div>

          {/* Week rows */}
          {rows.map((row, rowIdx) => (
            <div key={rowIdx} className="flex gap-1 mb-1">
              {row.map((day, colIdx) => {
                if (!day) {
                  return (
                    <div
                      key={`blank-${colIdx}`}
                      style={{ width: 32, height: 32 }}
                    />
                  );
                }

                const dateStr   = format(day, "yyyy-MM-dd");
                const point     = pointMap[dateStr];
                const mood      = point?.mood ?? null;
                const isFuture  = isAfter(day, todayDate) && !isSameDay(day, todayDate);
                const isToday   = isSameDay(day, todayDate);
                const isHovered = hoveredDate === dateStr;
                const idx       = pixelIndex++;

                let bg: string;
                if (isFuture)        bg = "rgba(255,255,255,0.03)";
                else if (mood != null) bg = MOOD_COLORS[mood];
                else                 bg = "rgba(255,255,255,0.06)";

                // Tooltip text
                const dayLabel = format(day, "EEEE d MMMM", { locale: fr });
                const dayLabelCap = dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1);
                const tooltipText = mood != null
                  ? `${dayLabelCap} · ${MOOD_EMOJIS[mood]} ${MOOD_LABELS[mood]}`
                  : isFuture
                    ? dayLabelCap
                    : `${dayLabelCap} · Pas de donnée`;

                return (
                  <div key={dateStr} className="relative" style={{ width: 32, height: 32 }}>
                    <motion.div
                      initial={{ opacity: 0, scale: 0.6 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: idx * 0.02, duration: 0.2, ease: "easeOut" }}
                      onMouseEnter={() => setHoveredDate(dateStr)}
                      onMouseLeave={() => setHoveredDate(null)}
                      style={{
                        width: 32,
                        height: 32,
                        background: bg,
                        borderRadius: 6,
                        cursor: mood != null ? "pointer" : "default",
                        outline: isToday ? "2px solid rgba(255,255,255,0.6)" : "none",
                        outlineOffset: isToday ? "1px" : undefined,
                        transition: "transform 0.12s",
                        transform: isHovered ? "scale(1.15)" : "scale(1)",
                        position: "relative",
                      }}
                    />
                    {/* Tooltip */}
                    {isHovered && (
                      <div
                        className="absolute z-50 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[11px] font-medium pointer-events-none"
                        style={{
                          bottom: "calc(100% + 6px)",
                          left: "50%",
                          transform: "translateX(-50%)",
                          background: "rgba(13,13,17,0.96)",
                          border: "1px solid var(--border)",
                          backdropFilter: "blur(8px)",
                          color: "var(--text-primary)",
                        }}
                      >
                        {tooltipText}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Week summary */}
      {weekSummary != null && (
        <div
          className="mt-3 text-[11px] rounded-lg px-3 py-2"
          style={{ background: "rgba(255,255,255,0.04)", color: "var(--text-secondary)" }}
        >
          Cette semaine, couleur dominante&nbsp;:&nbsp;
          <span className="font-semibold" style={{ color: "var(--text-primary)" }}>
            {WEEK_LABEL_COLORS[weekSummary]} {WEEK_LABEL_NAMES[weekSummary]}
          </span>
        </div>
      )}
    </div>
  );
}
