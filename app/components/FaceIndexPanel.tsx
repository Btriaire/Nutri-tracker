"use client";

import { IconArrowUpRight, IconArrowDownRight, IconMinus, IconAlertTriangle } from "@tabler/icons-react";
import { METRICS, computeBaselines, faceIndexes, zScore, describeZ, type FaceMetrics, type MetricInfo } from "@/app/lib/face-metrics";

const GROUPS: { key: MetricInfo["group"]; label: string }[] = [
  { key: "volume", label: "Volume du visage" },
  { key: "fatigue", label: "Fatigue" },
  { key: "teint", label: "Teint" },
  { key: "symetrie", label: "Symétrie" },
];

const INDEX_META = [
  { key: "volume" as const, label: "Volume", hint: "plus haut = visage plus plein", color: "var(--fit-indigo, var(--indigo))" },
  { key: "fatigue" as const, label: "Fatigue", hint: "plus haut = plus de signes", color: "var(--warn)" },
  { key: "teint" as const, label: "Teint", hint: "plus haut = plus irrégulier", color: "var(--danger)" },
];

/** Jauge 0-100 avec le repere "ton habitude" au milieu. */
function Gauge({ value, color }: { value: number | null; color: string }) {
  return (
    <div className="relative h-2 rounded-full" style={{ background: "var(--layer-2)" }} aria-hidden>
      <div className="absolute top-[-3px] bottom-[-3px] w-[2px] rounded" style={{ left: "50%", background: "var(--text-muted)" }} />
      {value !== null && (
        <div className="absolute top-1/2 w-3.5 h-3.5 rounded-full -translate-y-1/2 -translate-x-1/2"
          style={{ left: `${value}%`, background: color, boxShadow: "0 0 0 2px var(--bg)" }} />
      )}
    </div>
  );
}

interface Props {
  current: FaceMetrics;
  /** Mesures de tous les scans (y compris le courant) : la reference personnelle. */
  all: FaceMetrics[];
  dateLabel: string;
}

export default function FaceIndexPanel({ current, all, dateLabel }: Props) {
  const baselines = computeBaselines(all);
  const idx = faceIndexes(current, baselines);
  const n = Math.max(0, ...Object.values(baselines).map((b) => b?.n ?? 0));

  return (
    <section aria-label="Index visage" className="glass p-4 mb-4">
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <h2 className="text-[15px] font-semibold" style={{ color: "var(--text-primary)" }}>Index visage</h2>
        <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>{dateLabel}</span>
      </div>
      <p className="text-[12px] mb-3" style={{ color: "var(--text-secondary)" }}>
        Mesures objectives sur 478 points du visage et la couleur de la peau, comparées à <strong>ta</strong> référence
        {n >= 3 ? ` (médiane de ${n} photos)` : " (en construction : 3 photos de bonne qualité nécessaires)"}. 50 = ton habitude.
      </p>

      {current.quality.warnings.length > 0 && (
        <p className="flex items-start gap-1.5 text-[12px] mb-3 rounded-lg p-2" style={{ color: "var(--warn)", background: "color-mix(in srgb, var(--warn) 8%, transparent)" }}>
          <IconAlertTriangle size={14} className="shrink-0 mt-0.5" />
          Photo {current.quality.score}/100 : {current.quality.warnings.join(" ; ")}. Les mesures sont moins fiables.
        </p>
      )}

      <div className="space-y-3 mb-4">
        {INDEX_META.map((m) => (
          <div key={m.key}>
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>{m.label}</span>
              <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>
                <strong className="text-[15px] tabular-nums" style={{ color: idx[m.key] === null ? "var(--text-muted)" : m.color }}>{idx[m.key] ?? "—"}</strong> · {m.hint}
              </span>
            </div>
            <Gauge value={idx[m.key]} color={m.color} />
          </div>
        ))}
      </div>

      <div className="space-y-3">
        {GROUPS.map((g) => (
          <div key={g.key}>
            <p className="text-[12px] font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>{g.label}</p>
            <ul className="space-y-1">
              {METRICS.filter((i) => i.group === g.key).map((info) => {
                const z = zScore(current[info.key] as number, baselines[info.key]);
                const Icon = z === null || Math.abs(z) < 0.6 ? IconMinus : z > 0 ? IconArrowUpRight : IconArrowDownRight;
                const strong = z !== null && Math.abs(z) >= 1.5;
                return (
                  <li key={info.key} className="flex items-center gap-2 text-[13px]">
                    <Icon size={15} style={{ color: strong ? "var(--warn)" : "var(--text-muted)", flexShrink: 0 }} />
                    <span className="flex-1 min-w-0" style={{ color: "var(--text-secondary)" }}>{info.label}</span>
                    <span className="text-right" style={{ color: strong ? "var(--warn)" : "var(--text-primary)" }}>{describeZ(z, info)}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
