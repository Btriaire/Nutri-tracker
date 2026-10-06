"use client";

import { HVID_MM, rednessGrade, type EyeSide } from "@/app/lib/eye-metrics";

const n = (v: number | null | undefined, d = 1) => (v == null ? "—" : (Math.round(v * 10 ** d) / 10 ** d).toString().replace(".", ","));

// La photo isolee est un carre de 6 rayons d'iris (3 diametres) centre sur l'iris, en 320 px :
// 1 mm = 320 / (3 x 11,7) px.
const S = 320, C = S / 2, PX_PER_MM = S / (3 * HVID_MM);

/** Un oeil isole : photo annotee (iris, pupille, paupieres, reflet) et toutes ses mesures. */
export default function EyeDetailCard({ label, side, imageUrl }: { label: string; side: EyeSide; imageUrl: string | null }) {
  const irisR = (HVID_MM / 2) * PX_PER_MM;
  const pupilR = side.pupilMm != null ? (side.pupilMm / 2) * PX_PER_MM : null;
  const upperY = C - side.mrd1Mm * PX_PER_MM, lowerY = C + side.mrd2Mm * PX_PER_MM;
  const cl = side.catchlight;
  const pir = side.pupilMm != null ? Math.round((side.pupilMm / HVID_MM) * 100) : null;

  const rows: [string, string][] = [
    ["Pupille", side.pupilMm == null ? "non mesurable" : `${n(side.pupilMm)} mm · ${pir} % de l'iris`],
    ["Paupière haute (MRD1)", `${n(side.mrd1Mm)} mm`],
    ["Paupière basse (MRD2)", `${n(side.mrd2Mm)} mm`],
    ["Fente : hauteur × largeur", `${n(side.mrd1Mm + side.mrd2Mm)} × ${n(side.fissureWidthMm)} mm`],
    ["Blanc au-dessus / sous l'iris", `${n(side.scleralShowUpperMm)} / ${n(side.scleralShowLowerMm)} mm`],
    ["Rougeur côté nez / tempe", `${n(side.rednessNasal)} / ${n(side.rednessTemporal)} (grade ${rednessGrade(side.rednessA) ?? "—"})`],
    ["Jaune du blanc (b*)", n(side.scleraB)],
    ["Arc cornéen / anneau limbique", `${n(side.arcus)} / ${n(side.limbalRing)}`],
    ["Cernes sous cet œil", side.cernes == null ? "—" : `${n(side.cernes)} (L* joue − sous l'œil)`],
    ["Reflet de l'écran (Hirschberg)", cl ? `${n(cl.dxMm)} / ${n(cl.dyMm)} mm du centre` : "non détecté"],
  ];

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "var(--layer-1)", border: "1px solid var(--border)" }}>
      <p className="text-[13px] font-semibold px-3 pt-2.5 pb-2" style={{ color: "var(--text-primary)" }}>{label}</p>
      {imageUrl && (
        <div className="relative mx-3 mb-2 rounded-lg overflow-hidden" style={{ aspectRatio: "1 / 1", background: "#000" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt={`${label} isolé`} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
          <svg viewBox={`0 0 ${S} ${S}`} className="absolute inset-0 w-full h-full" aria-hidden>
            <circle cx={C} cy={C} r={irisR} fill="none" stroke="#818cf8" strokeWidth={2} />
            {pupilR && <circle cx={C} cy={C} r={pupilR} fill="none" stroke="#fbbf24" strokeWidth={2} />}
            <line x1={C - irisR * 1.6} x2={C + irisR * 1.6} y1={upperY} y2={upperY} stroke="#34d399" strokeWidth={2} strokeDasharray="6 4" />
            <line x1={C - irisR * 1.6} x2={C + irisR * 1.6} y1={lowerY} y2={lowerY} stroke="#34d399" strokeWidth={2} strokeDasharray="6 4" />
            <line x1={C} x2={C} y1={upperY} y2={C} stroke="#34d399" strokeWidth={1.5} />
            {cl && (
              <g stroke="#f87171" strokeWidth={2}>
                <line x1={C + cl.dxMm * PX_PER_MM - 7} x2={C + cl.dxMm * PX_PER_MM + 7} y1={C + cl.dyMm * PX_PER_MM} y2={C + cl.dyMm * PX_PER_MM} />
                <line x1={C + cl.dxMm * PX_PER_MM} x2={C + cl.dxMm * PX_PER_MM} y1={C + cl.dyMm * PX_PER_MM - 7} y2={C + cl.dyMm * PX_PER_MM + 7} />
              </g>
            )}
          </svg>
        </div>
      )}
      {imageUrl && (
        <p className="flex flex-wrap gap-x-3 gap-y-0.5 px-3 mb-2 text-[12px]" style={{ color: "var(--text-muted)" }}>
          <span><span style={{ color: "#818cf8" }}>●</span> iris (11,7 mm)</span>
          <span><span style={{ color: "#fbbf24" }}>●</span> pupille</span>
          <span><span style={{ color: "#34d399" }}>●</span> paupières</span>
          <span><span style={{ color: "#f87171" }}>●</span> reflet</span>
        </p>
      )}
      <dl className="px-3 pb-2.5 text-[12px]">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-2 py-1" style={{ borderTop: "1px solid var(--border)" }}>
            <dt style={{ color: "var(--text-secondary)" }}>{k}</dt>
            <dd className="text-right tabular-nums" style={{ color: "var(--text-primary)" }}>{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
