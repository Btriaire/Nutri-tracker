"use client";

import type { MealGlucoseResponse } from "@/app/lib/glucose";

export interface Target { min: number; max: number }

export const fmt = (v: number | null | undefined) => (v == null ? "—" : String(v).replace(".", ","));
/** Glycemie : toujours une decimale (5 -> "5,0") pour que les valeurs s'alignent et se comparent d'un coup d'oeil. */
export const mmol = (v: number | null | undefined) => (v == null ? "—" : v.toFixed(1).replace(".", ","));
export const hhmm = (ms: number) => new Date(ms).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

/** Couleur d'une valeur : dans la cible, au-dessus (rouge) ou en dessous (ambre). */
export function levelColor(mmol: number | null | undefined, t: Target): string {
  if (mmol == null) return "var(--text-muted)";
  if (mmol > t.max) return "var(--danger)";
  if (mmol < t.min) return "var(--carbs)";
  return "var(--fat)";
}

const SCALE_MIN = 3, SCALE_MAX = 14;

/**
 * Signes verticaux : une barre par valeur (avant / pic / 2 h), haute en proportion de la glycemie,
 * coloree selon la cible. Lisible d'un coup d'oeil, sans cadre.
 */
export function GlucoseBars({ values, target, height = 30 }: { values: { label: string; mmol: number | null }[]; target: Target; height?: number }) {
  const aria = values.map((v) => `${v.label} ${v.mmol == null ? "inconnu" : mmol(v.mmol) + " mmol/L"}`).join(", ");
  return (
    <span role="img" aria-label={aria} className="inline-flex items-end gap-[3px] flex-shrink-0" style={{ height }}>
      {values.map((v) => {
        const h = v.mmol == null ? 3 : Math.max(4, Math.round(((Math.min(Math.max(v.mmol, SCALE_MIN), SCALE_MAX) - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)) * height));
        return (
          <span
            key={v.label}
            title={`${v.label} : ${v.mmol == null ? "—" : mmol(v.mmol) + " mmol/L"}`}
            style={{
              width: 7, height: h, borderRadius: 3,
              background: v.mmol == null ? "var(--layer-2)" : levelColor(v.mmol, target),
              opacity: v.mmol == null ? 0.7 : 1,
            }}
          />
        );
      })}
    </span>
  );
}

export function responseBars(r: MealGlucoseResponse) {
  return [
    { label: "avant", mmol: r.pre?.mmol ?? null },
    { label: "pic", mmol: r.peak?.mmol ?? null },
    { label: "2 h après", mmol: r.post?.mmol ?? null },
  ];
}

/** Ligne discrete sous l'en-tete d'un repas du journal : sa reponse glycemique, sans cadre. */
export function MealGlucoseStrip({ response, target }: { response: MealGlucoseResponse; target: Target }) {
  const r = response;
  if (r.status === "no-data") {
    return (
      <p className="px-4 pb-2.5 -mt-0.5 text-[12px]" style={{ color: "var(--text-muted)" }}>
        Pas de lecture de glycémie autour de ce repas
        {r.firstReadingMs && r.lastReadingMs ? ` (capteur : ${hhmm(r.firstReadingMs)}–${hhmm(r.lastReadingMs)})` : ""}.
      </p>
    );
  }
  return (
    <div className="flex items-center gap-2.5 px-4 pb-2.5 -mt-0.5" style={{ color: "var(--text-secondary)" }}>
      <GlucoseBars values={responseBars(r)} target={target} height={22} />
      <p className="text-[12px] leading-tight min-w-0">
        <span style={{ color: levelColor(r.pre?.mmol, target) }}>{mmol(r.pre?.mmol)}</span>
        {" → "}
        <strong style={{ color: levelColor(r.peak?.mmol, target) }}>{mmol(r.peak?.mmol)}</strong>
        {" → "}
        <span style={{ color: levelColor(r.post?.mmol, target) }}>{mmol(r.post?.mmol)}</span>
        <span style={{ color: "var(--text-muted)" }}> mmol/L</span>
        {r.status === "pending" ? (
          <span style={{ color: "var(--text-muted)" }}> · en cours{r.lastReadingMs ? `, lecture ${hhmm(r.lastReadingMs)}` : ""}</span>
        ) : r.riseMmol !== null && r.minutesToPeak !== null && (
          <span style={{ color: "var(--text-muted)" }}> · pic +{mmol(r.riseMmol)} à {r.minutesToPeak} min</span>
        )}
      </p>
    </div>
  );
}
