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
  label?:   string;
  compact?: boolean;   // true = juste les 5 segments, pas de label
}

// ─── Composant : 5 segments cliquables ────────────────────────────────────────

export default function HungerSlider({ value, onChange, label, compact = false }: Props) {
  const isSet = value != null;

  const handleClick = (l: HungerLevel) => {
    // clic sur le niveau déjà sélectionné → reset à null
    onChange(value === l ? null : l);
  };

  return (
    <div className="flex flex-col gap-1 w-full">
      {/* Label */}
      {label && !compact && (
        <span className="text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>
          {label}
        </span>
      )}

      {/* 5 segments + emoji */}
      <div className="flex items-center gap-1.5">
        <div
          role="group"
          aria-label="Niveau de faim"
          className="flex gap-0.5 flex-1"
          style={{ paddingTop: 6, paddingBottom: 6, margin: "-6px 0", cursor: "pointer" }}
        >
          {([1, 2, 3, 4, 5] as HungerLevel[]).map((l) => {
            const filled = isSet && value! >= l;
            const color  = HUNGER_CFG[l].color;
            return (
              <button
                key={l}
                type="button"
                onClick={() => handleClick(l)}
                aria-label={HUNGER_CFG[l].label}
                style={{
                  flex:         1,
                  height:       3,
                  borderRadius: 2,
                  background:   filled ? color : "rgba(255,255,255,0.1)",
                  border:       "none",
                  padding:      0,
                  transition:   "background 0.12s",
                  cursor:       "pointer",
                }}
              />
            );
          })}
        </div>
        {/* Emoji du niveau sélectionné */}
        <span
          className="text-[14px] leading-none flex-shrink-0 transition-all"
          style={{ opacity: isSet ? 1 : 0.2, filter: isSet ? "none" : "grayscale(1)" }}
        >
          {isSet ? HUNGER_CFG[value!].emoji : "😶"}
        </span>
      </div>

      {/* Légende labels (non-compact uniquement) */}
      {!compact && (
        <div className="flex justify-between px-0.5">
          {([1, 2, 3, 4, 5] as HungerLevel[]).map((l) => (
            <span key={l} className="text-[10px]"
              style={{ color: value === l ? HUNGER_CFG[l].color : "var(--text-muted)", opacity: value === l ? 1 : 0.4 }}>
              {HUNGER_CFG[l].label.split(" ")[0]}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
