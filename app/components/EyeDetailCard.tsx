"use client";

import EyeStructureMasks from "@/app/components/EyeStructureMasks";
import { eyeAreas } from "@/app/lib/eye-areas";
import { HVID_MM, rednessGrade, type EyeSide } from "@/app/lib/eye-metrics";
import { TEXTURE_LABEL, fiberLabel } from "@/app/lib/eye-iris-texture";

const n = (v: number | null | undefined, d = 1) => (v == null ? "—" : (Math.round(v * 10 ** d) / 10 ** d).toString().replace(".", ","));

// La photo isolee est un carre de 6 rayons d'iris (3 diametres) centre sur l'iris, en 320 px :
// 1 mm = 320 / (3 x 11,7) px.
const S = 320, C = S / 2, PX_PER_MM = S / (3 * HVID_MM);

/** Un oeil isole : photo annotee (iris, pupille, paupieres, reflet) et toutes ses mesures. */
const INDEX_LABEL: Record<string, string> = { ouverture: "Ouverture", paupiereBasse: "Paupière basse", cernes: "Cernes", rougeur: "Rougeur", jaune: "Jaune" };

export default function EyeDetailCard({ label, side, imageUrl, indexes, notes, onRecenter }: {
  label: string; side: EyeSide; imageUrl: string | null; onRecenter?: () => void;
  indexes?: Record<string, number | null> | null; notes?: string[];
}) {
  const irisR = (HVID_MM / 2) * PX_PER_MM;
  const pupilR = side.pupilMm != null ? (side.pupilMm / 2) * PX_PER_MM : null;
  // Décalage du centre de la pupille par rapport à l'iris en pixels SVG
  const pupilDxMm = (side.pupilCenter && side.irisCenter) ? ((side.pupilCenter.x - side.irisCenter.x) * (HVID_MM / side.irisPx)) : 0;
  const pupilDyMm = (side.pupilCenter && side.irisCenter) ? ((side.pupilCenter.y - side.irisCenter.y) * (HVID_MM / side.irisPx)) : 0;
  const pupilCx = C + pupilDxMm * PX_PER_MM;
  const pupilCy = C + pupilDyMm * PX_PER_MM;

  const upperY = C - side.mrd1Mm * PX_PER_MM, lowerY = C + side.mrd2Mm * PX_PER_MM;
  const cl = side.catchlight;
  const pir = side.pupilMm != null ? Math.round((side.pupilMm / HVID_MM) * 100) : null;

  const areas = eyeAreas(side);
  const rows: [string, string][] = [
    ["Pupille", side.pupilMm == null ? "non mesurable" : `${n(side.pupilMm)} mm · ${pir} % de l'iris`],
    ["Surface de la pupille", areas.pupilMm2 == null ? "—" : `${n(areas.pupilMm2)} mm² · ${n(areas.pupilIrisAreaPct, 0)} % de l'iris`],
    ["Iris visible", `${n(areas.irisExposedMm2)} mm² · ${n(areas.irisCoveredPct, 0)} % caché par les paupières`],
    ["Ouverture de la fente / blanc visible", `${n(areas.apertureMm2)} / ${n(areas.scleraExposedMm2)} mm²`],
    ["Centre de l'œil", side.manualCenter ? "proposé à la main" : side.learnedCenter ? "détecté, ajusté d'après tes corrections" : "détecté automatiquement"],
    ["Régularité du bord de la pupille", side.pupilCircularity == null ? "—" : `${Math.round(side.pupilCircularity * 100)} %`],
    ["Décentrement de la pupille", side.pupilDecentrationMm == null ? "—" : `${n(side.pupilDecentrationMm)} mm`],
    ["Paupière haute (MRD1)", `${n(side.mrd1Mm)} mm`],
    ["Paupière basse (MRD2)", `${n(side.mrd2Mm)} mm`],
    ["Fente : hauteur × largeur", `${n(side.mrd1Mm + side.mrd2Mm)} × ${n(side.fissureWidthMm)} mm`],
    ["Blanc au-dessus / sous l'iris", `${n(side.scleralShowUpperMm)} / ${n(side.scleralShowLowerMm)} mm`],
    ["Rougeur côté nez / tempe", `${n(side.rednessNasal)} / ${n(side.rednessTemporal)} (grade ${rednessGrade(side.rednessA) ?? "—"})`],
    ["Jaune du blanc (b*)", n(side.scleraB)],
    ["Arc cornéen / anneau limbique", `${n(side.arcus)} / ${n(side.limbalRing)}`],
    ["Cernes sous cet œil", side.cernes == null ? "—" : `${n(side.cernes)} (L* joue − sous l'œil)`],
    ["Fente / iris", side.fenteRatio == null ? "—" : n(side.fenteRatio, 2)],
    ["Couleur de l'iris", side.irisName ?? "non mesurable"],
    ["Iris : bord pupille / milieu / périphérie (L*)", side.irisZones ? `${n(side.irisZones.rim)} / ${n(side.irisZones.mid)} / ${n(side.irisZones.outer)}` : "—"],
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
            <EyeStructureMasks side={side} />
            <circle cx={C} cy={C} r={irisR} fill="none" stroke="#818cf8" strokeWidth={2} />
            {side.irisTexture?.collaretteRatio != null && (
              <circle cx={C} cy={C} r={irisR * side.irisTexture.collaretteRatio} fill="none" stroke="#c084fc" strokeWidth={1.5} strokeDasharray="3 4" />
            )}
            {pupilR && <circle cx={pupilCx} cy={pupilCy} r={pupilR} fill="none" stroke="#fbbf24" strokeWidth={2} />}
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
      {imageUrl && onRecenter && (
        <div className="px-3 mb-2">
          <button type="button" onClick={onRecenter} className="w-full rounded-lg py-2 text-[13px] font-medium"
            style={{ background: "var(--layer-2)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
            Recentrer l&apos;œil et ré-analyser
          </button>
        </div>
      )}
      {imageUrl && (
        <p className="flex flex-wrap gap-x-3 gap-y-0.5 px-3 mb-2 text-[12px]" style={{ color: "var(--text-muted)" }}>
          <span><span style={{ color: "#818cf8" }}>●</span> iris (11,7 mm)</span>
          <span><span style={{ color: "#fbbf24" }}>●</span> pupille</span>
          <span><span style={{ color: "#34d399" }}>●</span> paupières</span>
          <span><span style={{ color: "#f87171" }}>●</span> reflet</span>
          {side.irisTexture?.collaretteRatio != null && <span><span style={{ color: "#c084fc" }}>●</span> collerette</span>}
        </p>
      )}
      {indexes && (
        <div className="grid grid-cols-5 gap-1 px-3 pb-2">
          {Object.entries(INDEX_LABEL).map(([k, lab]) => (
            <div key={k} className="rounded-lg p-1.5 text-center" style={{ background: "var(--layer-2)" }}>
              <p className="text-[11px] leading-tight" style={{ color: "var(--text-secondary)" }}>{lab}</p>
              <p className="text-[15px] font-semibold tabular-nums" style={{ color: indexes[k] == null ? "var(--text-muted)" : "var(--text-primary)" }}>{indexes[k] ?? "—"}</p>
            </div>
          ))}
        </div>
      )}
      {notes && (
        <ul className="px-3 pb-2 space-y-0.5 text-[12px]" style={{ color: notes.length ? "var(--warn)" : "var(--text-muted)" }}>
          {notes.length ? notes.map((t) => <li key={t}>• {t}</li>) : <li>Dans ton habitude sur toutes les mesures.</li>}
        </ul>
      )}
      <IrisTextureBlock side={side} />
      <p className="px-3 pb-1 text-[12px]" style={{ color: "var(--text-muted)" }}>
        Échelle : iris supposé de 11,7 mm (moyenne adulte, écart de 5 % environ). Les suivis dans le temps sont plus fiables que la valeur absolue.
      </p>
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

/** Texture de l'iris : classe descriptive et quatre mesures, avec leur limite. */
function IrisTextureBlock({ side }: { side: EyeSide }) {
  const t = side.irisTexture;
  if (t === undefined) return null;   // scan analyse avant la texture : la re-quantification l'ajoute
  const stats: [string, string, string][] = t ? [
    ["Relief", n(t.relief), "L*"],
    ["Fibres radiaires", `${Math.round(t.radialRatio * 100)}`, "%"],
    ["Cryptes", `${t.cryptCount}`, `· ${n(t.cryptPct)} %`],
    ["Collerette", t.collaretteRatio == null ? "—" : `${Math.round(t.collaretteRatio * 100)}`, t.collaretteRatio == null ? "" : "% du rayon"],
  ] : [];
  return (
    <div className="mx-3 mb-2 rounded-lg p-2.5" style={{ background: "var(--layer-2)" }}>
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <p className="text-[12px] font-semibold" style={{ color: "var(--text-primary)" }}>Texture de l&apos;iris</p>
        {t && (
          <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: "rgba(192,132,252,0.15)", color: "#c084fc" }}>
            {TEXTURE_LABEL[t.grade]}
          </span>
        )}
      </div>
      {!t ? (
        <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>Non lisible sur cette photo (iris trop petit, flou ou trop caché).</p>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-1">
            {stats.map(([k, v, u]) => (
              <div key={k} className="text-center rounded-md py-1" style={{ background: "var(--layer-1)" }}>
                <p className="text-[10px] leading-tight" style={{ color: "var(--text-secondary)" }}>{k}</p>
                <p className="text-[14px] font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>{v}</p>
                <p className="text-[10px] tabular-nums" style={{ color: "var(--text-muted)" }}>{u}</p>
              </div>
            ))}
          </div>
          <p className="text-[12px] mt-1.5" style={{ color: "var(--text-secondary)" }}>
            Fibres : {fiberLabel(t.radialRatio)} · fiabilité {Math.round(t.confidence * 100)} %
          </p>
          <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
            Description de l&apos;aspect de l&apos;iris, un trait propre à chacun et stable à l&apos;âge adulte.
            Elle ne dit rien de l&apos;état des organes (l&apos;iridologie n&apos;a pas de base scientifique) ; d&apos;un scan
            à l&apos;autre, les écarts viennent surtout de la netteté, de la lumière et de la taille de la pupille.
          </p>
        </>
      )}
    </div>
  );
}
