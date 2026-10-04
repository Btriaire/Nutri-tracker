"use client";

import type { HungerLevel } from "@/app/lib/types";

// ─── Config ────────────────────────────────────────────────────────────────────

export const HUNGER_CFG: Record<HungerLevel, { emoji: string; label: string; color: string }> = {
  1: { emoji: "😌", label: "Pas faim",  color: "var(--ok)" },
  2: { emoji: "🙂", label: "Peu faim",  color: "var(--hunger-mild)" },
  3: { emoji: "😐", label: "Modéré",   color: "var(--warn)" },
  4: { emoji: "😤", label: "Faim",      color: "var(--calories)" },
  5: { emoji: "🤤", label: "Très faim", color: "var(--danger)" },
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
        <span className="text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>
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
                  height:       6,
                  borderRadius: 3,
                  background:   filled ? color : "var(--layer-3)",
                  border:       "none",
                  padding:      0,
                  transition:   "background 0.12s",
                  cursor:       "pointer",
                }}
              />
            );
          })}
        </div>
        {/* Niveau choisi, en clair */}
        {compact && (
          <span className="text-[12px] font-medium whitespace-nowrap text-right" aria-live="polite"
            style={{ width: 64, flexShrink: 0, color: isSet ? HUNGER_CFG[value!].color : "var(--text-muted)" }}>
            {isSet ? HUNGER_CFG[value!].label : "—"}
          </span>
        )}
        {/* − et + pour décrémenter / incrémenter */}
        <button
          type="button"
          onClick={() => handleClick(Math.max(1, (value ?? 1) - 1) as HungerLevel)}
          aria-label="Moins faim"
          style={{
            width: 24, height: 24, borderRadius: 6, border: "none", padding: 0,
            background: "var(--layer-3)",
            color: "var(--text-muted)",
            fontSize: 13, fontWeight: 700, lineHeight: 1,
            cursor: "pointer", flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >−</button>
        <button
          type="button"
          onClick={() => handleClick(Math.min(5, (value ?? 0) + 1) as HungerLevel)}
          aria-label="Plus faim"
          style={{
            width: 24, height: 24, borderRadius: 6, border: "none", padding: 0,
            background: "var(--layer-3)",
            color: "var(--text-muted)",
            fontSize: 13, fontWeight: 700, lineHeight: 1,
            cursor: "pointer", flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >+</button>
      </div>

      {/* Légende labels (non-compact uniquement) */}
      {!compact && (
        <div className="flex justify-between px-0.5">
          {([1, 2, 3, 4, 5] as HungerLevel[]).map((l) => (
            <span key={l} className="text-[12px]"
              style={{ color: value === l ? HUNGER_CFG[l].color : "var(--text-muted)", opacity: value === l ? 1 : 0.4 }}>
              {HUNGER_CFG[l].label.split(" ")[0]}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
