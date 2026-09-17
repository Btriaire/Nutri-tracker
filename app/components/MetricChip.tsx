"use client";

import type { ReactNode } from "react";

// Pastille metrique (icone + valeur + unite) — extrait de ActivityClient.tsx.
export default function MetricChip({ value, unit, color, icon }: {
  value: string | number;
  unit:  string;
  color: string;
  icon:  ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-0.5 py-2.5 rounded-xl"
      style={{ background: `color-mix(in srgb, ${color} 7%, transparent)`, border: `1px solid color-mix(in srgb, ${color} 13%, transparent)` }}>
      <span style={{ color, opacity: 0.75, display: "flex" }}>{icon}</span>
      {/* La valeur passe au neutre : sur le fond auto-teinte a 7% de `color`,
          certaines couleurs de jeton descendent sous le seuil AA (marge
          mesuree jusqu'a 4,27 au lieu de 4,5) — l'icone au-dessus porte deja
          l'identite de couleur. */}
      <span className="text-[13px] font-bold tabular-nums leading-none" style={{ color: "var(--text-primary)" }}>{value}</span>
      <span className="text-[11px] leading-none mt-0.5" style={{ color: "var(--text-muted)" }}>{unit}</span>
    </div>
  );
}
