"use client";

import { useEffect, useRef } from "react";
import type { HungerLevel, MealType } from "@/app/lib/types";
import HungerSlider, { HUNGER_CFG } from "./HungerSlider";

// ─── Config ────────────────────────────────────────────────────────────────────

const MEALS: { key: MealType; label: string; icon: string }[] = [
  { key: "breakfast", label: "Petit-déjeuner", icon: "🌅" },
  { key: "lunch",     label: "Déjeuner",       icon: "☀️" },
  { key: "dinner",    label: "Dîner",          icon: "🌙" },
  { key: "snacks",    label: "Collations",     icon: "🍎" },
];

// ─── SVG geometry ──────────────────────────────────────────────────────────────

const SVG_W   = 320;
const SVG_H   = 130;
const PAD_X   = 40;
const PAD_TOP = 22;
const PAD_BOT = 24;
const PLOT_H  = SVG_H - PAD_TOP - PAD_BOT; // 84px

function xFor(i: number): number {
  // evenly spaced across PAD_X … SVG_W-PAD_X
  return PAD_X + (i * (SVG_W - PAD_X * 2)) / (MEALS.length - 1);
}

function yFor(level: HungerLevel): number {
  // level 1 → bottom, level 5 → top
  return PAD_TOP + PLOT_H - ((level - 1) / 4) * PLOT_H;
}

/** Build smooth cubic-bezier path through points (Catmull-Rom approximation) */
function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return "";
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const p0 = pts[i - 1];
    const p1 = pts[i];
    const cpX = (p0.x + p1.x) / 2;
    d += ` C ${cpX} ${p0.y} ${cpX} ${p1.y} ${p1.x} ${p1.y}`;
  }
  return d;
}

/** Fill path: same as smoothPath but closed at the bottom */
function fillPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return "";
  const line = smoothPath(pts);
  const last = pts[pts.length - 1];
  const first = pts[0];
  const bottom = SVG_H - PAD_BOT + 4;
  return `${line} L ${last.x} ${bottom} L ${first.x} ${bottom} Z`;
}

// ─── Component ─────────────────────────────────────────────────────────────────

interface Props {
  mealHunger: Partial<Record<MealType, HungerLevel>>;
  onSetHunger: (meal: MealType, level: HungerLevel | null) => void;
}

export default function HungerTimeline({ mealHunger, onSetHunger }: Props) {
  const pathRef  = useRef<SVGPathElement>(null);
  const fillRef  = useRef<SVGPathElement>(null);

  // Recorded points in order
  const recorded = MEALS
    .map((m, i) => ({ meal: m.key, idx: i, level: mealHunger[m.key] }))
    .filter((p): p is { meal: MealType; idx: number; level: HungerLevel } => p.level != null);

  const pts = recorded.map(({ idx, level }) => ({ x: xFor(idx), y: yFor(level) }));

  const linePath = smoothPath(pts);
  const areaPath = fillPath(pts);

  // Animate path length on mount / change
  useEffect(() => {
    const el = pathRef.current;
    if (!el) return;
    const len = el.getTotalLength?.() ?? 0;
    el.style.strokeDasharray  = `${len}`;
    el.style.strokeDashoffset = `${len}`;
    el.style.transition = "stroke-dashoffset 0.9s cubic-bezier(0.16,1,0.3,1)";
    requestAnimationFrame(() => { el.style.strokeDashoffset = "0"; });
  }, [linePath]);

  const hasAny = recorded.length > 0;

  return (
    <div className="glass p-4 space-y-3">
      {/* Title */}
      <div className="flex items-center gap-2">
        <span className="text-base">🌡️</span>
        <p className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
          Évolution de la faim
        </p>
        {hasAny && (
          <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full"
            style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-muted)" }}>
            {recorded.length}/{MEALS.length} repas
          </span>
        )}
      </div>

      {/* SVG chart */}
      <div className="relative w-full overflow-hidden rounded-xl"
        style={{ background: "rgba(255,255,255,0.025)", border: "1px solid var(--border)" }}>
        <svg
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          width="100%"
          style={{ display: "block" }}
          aria-hidden
        >
          {/* Horizontal grid lines for levels */}
          {[1, 2, 3, 4, 5].map((lvl) => {
            const y = yFor(lvl as HungerLevel);
            const cfg = HUNGER_CFG[lvl as HungerLevel];
            return (
              <g key={lvl}>
                <line
                  x1={PAD_X} y1={y} x2={SVG_W - PAD_X} y2={y}
                  stroke={cfg.color} strokeWidth={0.5} strokeOpacity={0.18} strokeDasharray="3 4"
                />
                <text x={PAD_X - 6} y={y + 4} textAnchor="end"
                  fontSize={8} fill={cfg.color} fillOpacity={0.55}>
                  {lvl}
                </text>
              </g>
            );
          })}

          {/* Vertical meal separators */}
          {MEALS.map((_, i) => (
            <line key={i}
              x1={xFor(i)} y1={PAD_TOP} x2={xFor(i)} y2={SVG_H - PAD_BOT}
              stroke="rgba(255,255,255,0.07)" strokeWidth={1}
            />
          ))}

          {/* Area fill */}
          {areaPath && (
            <path d={areaPath} fill="url(#hungerGrad)" opacity={0.25} />
          )}

          {/* Gradient def */}
          <defs>
            <linearGradient id="hungerGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#f97316" stopOpacity={0.8} />
              <stop offset="100%" stopColor="#f97316" stopOpacity={0.0} />
            </linearGradient>
            <linearGradient id="hungerLine" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%"   stopColor="#22c55e" />
              <stop offset="50%"  stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#ef4444" />
            </linearGradient>
          </defs>

          {/* Smooth line */}
          {linePath && (
            <path
              ref={pathRef}
              d={linePath}
              fill="none"
              stroke="url(#hungerLine)"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Dot markers for recorded meals */}
          {recorded.map(({ idx, level }) => {
            const x = xFor(idx);
            const y = yFor(level);
            const cfg = HUNGER_CFG[level];
            return (
              <g key={idx}>
                <circle cx={x} cy={y} r={8} fill={cfg.color + "33"} stroke={cfg.color} strokeWidth={1.5} />
                <text x={x} y={y + 1} textAnchor="middle" fontSize={8} fontWeight="700" dominantBaseline="middle" fill={cfg.color}>
                  {level}
                </text>
              </g>
            );
          })}

          {/* Tick marks on x-axis for meals without data (no dots — avoid false zero impression) */}
          {MEALS.map((m, i) => {
            if (mealHunger[m.key] != null) return null;
            const x = xFor(i);
            const y = SVG_H - PAD_BOT;
            return (
              <line key={i} x1={x} y1={y} x2={x} y2={y + 4}
                stroke="rgba(255,255,255,0.15)" strokeWidth={1} />
            );
          })}
        </svg>
      </div>

      {/* One slider per meal */}
      <div className="space-y-3 pt-1">
        {MEALS.map((m) => (
          <div key={m.key} className="flex items-center gap-3">
            {/* Meal icon + label */}
            <div className="flex items-center gap-1.5 shrink-0" style={{ width: 90 }}>
              <span className="text-[14px]">{m.icon}</span>
              <span className="text-[11px] font-medium" style={{ color: "var(--text-secondary)" }}>
                {m.label}
              </span>
            </div>
            {/* Slider */}
            <div className="flex-1">
              <HungerSlider
                value={mealHunger[m.key]}
                onChange={(v) => onSetHunger(m.key, v)}
                compact
              />
            </div>
          </div>
        ))}
      </div>

      {/* Mini legend */}
      <div className="flex justify-between px-1 pt-0.5">
        {([1, 2, 3, 4, 5] as HungerLevel[]).map((lvl) => (
          <span key={lvl} className="text-[10px] font-medium tabular-nums"
            style={{ color: "var(--text-muted)", opacity: 0.45 }}>
            {lvl}
          </span>
        ))}
      </div>
    </div>
  );
}
