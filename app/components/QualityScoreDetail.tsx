"use client";

import { IconBulb } from "@tabler/icons-react";
import type { QualityScore } from "@/app/lib/meal-quality";

const ROWS: { key: keyof QualityScore["breakdown"]; label: string; max: number }[] = [
  { key: "macro",     label: "Répartition macro (vs ton objectif)", max: 4   },
  { key: "fiber",     label: "Fibres",                              max: 1.5 },
  { key: "sugar",     label: "Sucre",                                max: 1.5 },
  { key: "sodium",    label: "Sodium",                               max: 1   },
  { key: "satFat",    label: "Graisses saturées",                    max: 1   },
  { key: "diversity", label: "Légumes / fruits / légumineuses",      max: 1   },
];

export default function QualityScoreDetail({ quality }: { quality: QualityScore }) {
  return (
    <div className="space-y-2">
      <div className="space-y-1.5">
        {ROWS.map(({ key, label, max }) => {
          const val = quality.breakdown[key];
          const pct = Math.round((val / max) * 100);
          const barColor = pct >= 85 ? "#22c55e" : pct >= 60 ? "#fbbf24" : "#f87171";
          return (
            <div key={key}>
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{label}</span>
                <span className="text-[10px] font-medium tabular-nums" style={{ color: barColor }}>
                  {val.toFixed(1)}/{max}
                </span>
              </div>
              <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: barColor }} />
              </div>
            </div>
          );
        })}
      </div>

      {quality.tips.length > 0 && (
        <div className="pt-1.5 space-y-1">
          {quality.tips.map((tip, i) => (
            <p key={i} className="text-[10.5px] leading-relaxed flex items-start gap-1.5" style={{ color: "var(--text-muted)" }}>
              <IconBulb size={11} stroke={1.8} className="flex-shrink-0 mt-0.5" style={{ color: "#fbbf24" }} />
              {tip}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
