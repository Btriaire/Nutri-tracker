"use client";

import type { HungerLevel } from "@/app/lib/types";

// ─── Config ────────────────────────────────────────────────────────────────────

export const HUNGER_CFG: Record<HungerLevel, { emoji: string; label: string; color: string }> = {
  1: { emoji: "😌", label: "Pas faim",  color: "#22c55e" },
  2: { emoji: "🙂", label: "Peu faim",  color: "#84cc16" },
  3: { emoji: "😐", label: "Modéré",   color: "#f59e0b" },
  4: { emoji: "😤", label: "Faim",      color: "#f97316" },
  5: { emoji: "🤤", label: "Très faim", color: "#ef4444" },
};

interface Props {
  value:    HungerLevel | null | undefined;
  onChange: (v: HungerLevel | null) => void;
  label?:   string;       // optionnel, ex. "Avant ce repas"
  compact?: boolean;      // true = pas de label texte sous le slider
}

export default function HungerSlider({ value, onChange, label, compact = false }: Props) {
  const isSet  = value != null;
  const level  = value ?? 3;                          // position neutre si non défini
  const cfg    = isSet ? HUNGER_CFG[value!] : null;
  const fillPct = ((level - 1) / 4) * 100;           // 0 % → 100 %

  return (
    <div className="flex flex-col gap-1.5 w-full">
      {/* Header row: emoji + label */}
      <div className="flex items-center justify-between">
        {label && (
          <span className="text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>
            {label}
          </span>
        )}
        <div className="flex items-center gap-1.5 ml-auto">
          <span className="text-[17px] leading-none transition-all" style={{ filter: isSet ? "none" : "grayscale(1) opacity(0.35)" }}>
            {cfg?.emoji ?? "😶"}
          </span>
          {!compact && (
            <span
              className="text-[11px] font-semibold transition-all"
              style={{ color: cfg?.color ?? "var(--text-muted)", opacity: isSet ? 1 : 0.4, minWidth: 56, textAlign: "right" }}
            >
              {cfg?.label ?? "—"}
            </span>
          )}
        </div>
      </div>

      {/* Slider */}
      <input
        type="range"
        min={1} max={5} step={1}
        value={level}
        className={`nt-hunger${isSet ? "" : " nt-hunger-unset"}`}
        style={{
          "--hfill":  `${fillPct}%`,
          "--hcolor": cfg?.color ?? "#6b7280",
        } as React.CSSProperties}
        onChange={(e) => onChange(parseInt(e.target.value) as HungerLevel)}
        onMouseDown={() => { if (!isSet) onChange(level as HungerLevel); }}
        onTouchStart={() => { if (!isSet) onChange(level as HungerLevel); }}
        aria-label="Niveau de faim"
        aria-valuemin={1} aria-valuemax={5} aria-valuenow={level}
      />

      {/* Tick marks */}
      {!compact && (
        <div className="flex justify-between px-0.5">
          {([1, 2, 3, 4, 5] as HungerLevel[]).map((l) => (
            <span key={l} className="text-[11px]" style={{ opacity: value === l ? 1 : 0.3 }}>
              {HUNGER_CFG[l].emoji}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
