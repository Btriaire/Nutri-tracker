"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { IconEye, IconCircleCheck, IconAlertTriangle, IconAlertOctagon, IconTrash, IconDroplet, IconFish, IconChevronDown } from "@tabler/icons-react";
import EyeScanCapture, { type EyeCaptureResult } from "@/app/components/EyeScanCapture";
import ProcedureHelp, { EYE_PROCEDURE } from "@/app/components/ProcedureHelp";
import EyeDetailCard from "@/app/components/EyeDetailCard";
import { eyeIndexes, eyeSignals, eyeSideIndexes, sideNotes, rednessGrade, scanValue, type EyeValueKey } from "@/app/lib/eye-metrics";
import type { EyeScanEntry } from "@/app/api/eye-scan/route";

type Context = {
  waterAvgMl: number | null; waterGoalMl: number; waterDays: number;
  ironAvgMg: number | null; b12AvgUg: number | null; foodDays: number;
  omega3Intakes: number; ironIntakes: number; b12Intakes: number;
};

const n = (v: number | null | undefined, d = 1) => (v == null ? "—" : (Math.round(v * 10 ** d) / 10 ** d).toString().replace(".", ","));

const PARAMS: { key: EyeValueKey; label: string; unit: string; hint: string }[] = [
  { key: "mbi", label: "Yeux ouverts sans cligner", unit: "s", hint: "moins de 10 s = sécheresse probable" },
  { key: "rougeur", label: "Rougeur du blanc", unit: "a*", hint: "plus haut = plus rouge" },
  { key: "pupille", label: "Pupille", unit: "mm", hint: "varie avec la lumière" },
  { key: "constriction", label: "Réflexe pupillaire", unit: "%", hint: "constriction au flash" },
  { key: "mrd1", label: "Ouverture paupière (MRD1)", unit: "mm", hint: "plus bas = paupière plus basse" },
  { key: "pallor", label: "Couleur de la conjonctive", unit: "", hint: "plus bas = plus pâle" },
  { key: "jaune", label: "Jaune du blanc de l'œil", unit: "b*", hint: "à comparer à ton habitude" },
  { key: "fente", label: "Hauteur de la fente", unit: "mm", hint: "ouverture totale de l'œil" },
  { key: "sclereBas", label: "Blanc sous l'iris", unit: "mm", hint: "plus haut = paupière inférieure plus basse" },
  { key: "cernes", label: "Cernes", unit: "L*", hint: "plus haut = cernes plus marqués" },
  { key: "pir", label: "Pupille / iris", unit: "", hint: "rapport, suit l'éveil et la lumière" },
];

const INDEX_META = [
  { key: "secheresse" as const, label: "Sécheresse", color: "var(--warn)" },
  { key: "fatigue" as const, label: "Fatigue de l'œil", color: "var(--indigo)" },
  { key: "coloration" as const, label: "Coloration", color: "var(--danger)" },
  { key: "ouverture" as const, label: "Ouverture", color: "var(--ok)" },
  { key: "cernes" as const, label: "Cernes", color: "var(--calories)" },
];

export default function EyeScanClient() {
  const [scans, setScans] = useState<EyeScanEntry[] | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [ctx, setCtx] = useState<Context | null>(null);
  const [param, setParam] = useState<EyeValueKey>("mbi");
  const [showSources, setShowSources] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/eye-scan", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { scans: [] }))
      .then((d: { scans?: EyeScanEntry[] }) => { if (!cancelled) setScans(d.scans ?? []); })
      .catch(() => { if (!cancelled) setScans([]); });
    return () => { cancelled = true; };
  }, []);

  const latest = scans?.[0] ?? null;
  useEffect(() => {
    if (!latest) return;
    let cancelled = false;
    fetch(`/api/eye-scan/context?date=${latest.date}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Context | null) => { if (!cancelled) setCtx(d); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [latest]);

  const save = async (r: EyeCaptureResult) => {
    setCapturing(false);
    setSaveError(false);
    const now = new Date();
    const res = await fetch("/api/eye-scan", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: format(now, "yyyy-MM-dd"), time: format(now, "HH:mm"), image: r.image, imageA: r.imageA, imageB: r.imageB, data: { metrics: r.metrics, plr: r.plr, conjunctiva: r.conjunctiva, mbiS: r.mbiS } }),
    }).catch(() => null);
    if (res?.ok) {
      const { scan } = await res.json() as { scan: EyeScanEntry };
      setScans((s) => [scan, ...(s ?? [])]);
    } else setSaveError(true);
  };

  const remove = async (id: string) => {
    if (!confirm("Supprimer ce scan de l'œil ?")) return;
    const res = await fetch(`/api/eye-scan?id=${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => null);
    if (res?.ok) setScans((s) => (s ?? []).filter((x) => x.id !== id));
  };

  const history = scans ?? [];
  // Index et signaux memorises a l'enregistrement (sinon calcules ici pour les anciens scans)
  const idx = latest ? latest.indexes ?? eyeIndexes(latest, history) : null;
  const signals = latest ? latest.signals ?? eyeSignals(latest, history) : [];
  const m = latest?.metrics;
  const chart = [...history].reverse().map((s) => ({ t: parseISO(`${s.date}T${s.time}:00`).getTime(), v: scanValue[param](s) })).filter((d) => d.v !== null);
  const paramInfo = PARAMS.find((p) => p.key === param)!;

  return (
    <div className="relative min-h-screen" style={{ paddingBottom: "80px" }}>
      <div className="bg-orbs" />
      <div className="relative z-10 max-w-md mx-auto px-4 py-6 md:ml-[220px]">
        <Link href="/health/face-scan" className="inline-flex items-center min-h-[44px] pr-3 text-[13px] font-medium" style={{ color: "var(--text-secondary)" }}>← Scan visage</Link>
        <h1 className="text-[20px] font-semibold tracking-tight mt-4 mb-1" style={{ color: "var(--text-primary)" }}>Œil</h1>
        <p className="text-[12px] mb-4" style={{ color: "var(--text-secondary)" }}>
          Pupilles, paupières, rougeur, conjonctive et sécheresse, mesurées en millimètres (l&apos;iris de 11,7 mm sert de règle)
          et comparées à ta propre référence. Suivi bien-être, pas un diagnostic.
        </p>

        <section className="glass p-4 mb-4" aria-label="Scan guidé">
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>Scan guidé (≈ 10 s + test optionnel)</p>
            <ProcedureHelp procedure={EYE_PROCEDURE} />
          </div>
          <ol className="text-[12px] space-y-1 mb-3" style={{ color: "var(--text-secondary)" }}>
            <li>1. Fixe le point en haut de l&apos;écran, yeux bien ouverts, téléphone à 25-30 cm (3 s)</li>
            <li>2. Réflexe pupillaire : l&apos;écran passe au noir puis flashe en blanc (4 s)</li>
            <li>3. Paupière inférieure doucement tirée vers le bas, regard vers la flèche</li>
            <li>4. Option : garder les yeux ouverts sans cligner (test de sécheresse)</li>
          </ol>
          <p className="text-[12px] mb-3" style={{ color: "var(--text-muted)" }}>Pièce plutôt sombre, sans lunettes ni lentilles colorées. L&apos;écran sert d&apos;éclairage.</p>
          <button type="button" onClick={() => setCapturing(true)} className="w-full min-h-[48px] rounded-xl text-[14px] font-semibold" style={{ background: "var(--indigo)", color: "var(--bg)" }}>
            Commencer le scan
          </button>
          {saveError && <p role="alert" className="text-[12px] mt-2" style={{ color: "var(--danger)" }}>Le scan n&apos;a pas pu être enregistré : vérifie ta connexion, puis refais-le.</p>}
        </section>

        {scans === null && <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>Chargement…</p>}
        {scans && scans.length === 0 && <p className="text-[12px] mb-4" style={{ color: "var(--text-muted)" }}>Aucun scan pour l&apos;instant : les index apparaissent dès le premier, la comparaison à ton habitude à partir du 4ᵉ.</p>}

        {latest && m && idx && (
          <>
            <section className="glass p-4 mb-4" aria-label="Index de l'œil">
              <div className="flex items-baseline justify-between mb-3">
                <h2 className="text-[15px] font-semibold" style={{ color: "var(--text-primary)" }}>Index</h2>
                <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>{format(parseISO(latest.date), "EEE d MMM", { locale: fr })} {latest.time} · 50 = ton habitude</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {INDEX_META.map((i) => (
                  <div key={i.key} className="rounded-xl p-2.5 text-center" style={{ background: "var(--layer-1)" }}>
                    <p className="text-[12px]" style={{ color: "var(--text-secondary)" }}>{i.label}</p>
                    <p className="text-[22px] font-semibold tabular-nums" style={{ color: (idx as Record<string, number | null>)[i.key] == null ? "var(--text-muted)" : i.color }}>{(idx as Record<string, number | null>)[i.key] ?? "—"}</p>
                  </div>
                ))}
                <div className="rounded-xl p-2.5 text-center" style={{ background: "var(--layer-1)" }}>
                  <p className="text-[12px]" style={{ color: "var(--text-secondary)" }}>Symétrie</p>
                  <p className="text-[22px] font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>{m.symmetryScore ?? "—"}<span className="text-[12px] font-normal" style={{ color: "var(--text-muted)" }}>/100</span></p>
                </div>
              </div>
              <p className="text-[12px] mt-2" style={{ color: "var(--text-muted)" }}>
                Sécheresse, fatigue, coloration, ouverture et cernes : 50 = ton habitude. Symétrie : 100 = deux yeux identiques.
                {m.hirschbergMm != null && ` Alignement du regard : ${n(m.hirschbergMm)} mm d'écart entre les reflets (moins de 0,7 mm = aligné).`}
              </p>
              {Object.values(idx).every((v) => v === null) && (
                <p className="text-[12px] mt-2" style={{ color: "var(--text-muted)" }}>Index disponibles après 3 scans de bonne qualité (référence personnelle).</p>
              )}
              {m.quality.warnings.length > 0 && (
                <p className="flex items-start gap-1.5 text-[12px] mt-3" style={{ color: "var(--warn)" }}>
                  <IconAlertTriangle size={14} className="shrink-0 mt-0.5" /> Qualité {m.quality.score}/100 : {m.quality.warnings.join(" ; ")}
                </p>
              )}
            </section>

            <section className="glass p-4 mb-4" aria-label="Analyse détaillée par œil">
              <h2 className="text-[15px] font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Analyse détaillée par œil</h2>
              <p className="text-[12px] mb-3" style={{ color: "var(--text-secondary)" }}>
                Chaque œil est isolé et mesuré séparément ; les traits montrent ce qui a été mesuré sur la photo.
              </p>
              <div className="space-y-3">
                <EyeDetailCard label="Œil droit" side={m.A} imageUrl={latest.eyes?.includes("A") ? `/api/eye-scan/image?id=${encodeURIComponent(latest.id)}&eye=A` : null}
                  indexes={latest.indexesEye?.A ?? eyeSideIndexes(latest, history, "A")} notes={sideNotes(latest, history, "A")} />
                <EyeDetailCard label="Œil gauche" side={m.B} imageUrl={latest.eyes?.includes("B") ? `/api/eye-scan/image?id=${encodeURIComponent(latest.id)}&eye=B` : null}
                  indexes={latest.indexesEye?.B ?? eyeSideIndexes(latest, history, "B")} notes={sideNotes(latest, history, "B")} />
              </div>
            </section>

            <section className="glass p-4 mb-4" aria-label="Mesures">
              <h2 className="text-[15px] font-semibold mb-2" style={{ color: "var(--text-primary)" }}>Mesures</h2>
              <dl className="text-[13px] divide-y" style={{ borderColor: "var(--border)" }}>
                {[
                  ["Pupille droite / gauche", `${n(m.A.pupilMm)} / ${n(m.B.pupilMm)} mm`],
                  ["Écart entre pupilles", m.anisocoriaMm === null ? "—" : `${n(m.anisocoriaMm)} mm`],
                  ["Réflexe au flash", latest.plr ? `−${n(latest.plr.constrictionPct, 0)} %${latest.plr.latencyMs !== null ? ` en ${latest.plr.latencyMs} ms` : ""} · ${n(latest.plr.maxVelocityMmS)} mm/s` : "non mesuré"],
                  ["Ouverture paupière (MRD1) D / G", `${n(m.A.mrd1Mm)} / ${n(m.B.mrd1Mm)} mm`],
                  ["Rougeur du blanc (estimée)", rednessGrade(scanValue.rougeur(latest)) === null ? "—" : `grade ${rednessGrade(scanValue.rougeur(latest))} / 4`],
                  ["Couleur de la conjonctive", latest.conjunctiva ? `${n(latest.conjunctiva.pallorIndex)} (œil ${latest.conjunctiva.eye === "A" ? "droit" : "gauche"})` : "non mesurée (paupière pas assez tirée)"],
                  ["Yeux ouverts sans cligner", latest.mbiS == null ? "test passé" : `${n(latest.mbiS)} s`],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3 py-1.5" style={{ borderColor: "var(--border)" }}>
                    <dt style={{ color: "var(--text-secondary)" }}>{k}</dt>
                    <dd className="text-right tabular-nums" style={{ color: "var(--text-primary)" }}>{v}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section className="glass p-4 mb-4" aria-label="Signaux à surveiller">
              <h2 className="text-[15px] font-semibold mb-2" style={{ color: "var(--text-primary)" }}>Signaux à surveiller</h2>
              <ul className="space-y-1.5">
                {signals.map((s) => (
                  <li key={s.text} className="flex items-start gap-2 text-[13px]" style={{ color: "var(--text-primary)" }}>
                    {s.level === "ok" ? <IconCircleCheck size={16} className="shrink-0 mt-0.5" style={{ color: "var(--ok)" }} />
                      : s.level === "alert" ? <IconAlertOctagon size={16} className="shrink-0 mt-0.5" style={{ color: "var(--danger)" }} />
                      : <IconAlertTriangle size={16} className="shrink-0 mt-0.5" style={{ color: "var(--warn)" }} />}
                    {s.text}
                  </li>
                ))}
              </ul>
            </section>

            {ctx && (
              <section className="glass p-4 mb-4" aria-label="Lien avec ton alimentation">
                <h2 className="text-[15px] font-semibold mb-2" style={{ color: "var(--text-primary)" }}>Lien avec ton alimentation</h2>
                <ul className="space-y-2 text-[13px]" style={{ color: "var(--text-secondary)" }}>
                  <li className="flex items-start gap-2">
                    <IconDroplet size={16} className="shrink-0 mt-0.5" style={{ color: "var(--fat)" }} />
                    <span>Eau : {ctx.waterAvgMl === null ? "pas de suivi ces 7 jours" : `${n(ctx.waterAvgMl / 1000)} L/j en moyenne sur 7 j (objectif ${n(ctx.waterGoalMl / 1000)} L)`}
                      {ctx.waterAvgMl !== null && ctx.waterAvgMl < ctx.waterGoalMl * 0.8 && " : boire plus aide contre la sécheresse oculaire."}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <IconFish size={16} className="shrink-0 mt-0.5" style={{ color: "var(--info)" }} />
                    <span>Oméga-3 : {ctx.omega3Intakes} prise{ctx.omega3Intakes > 1 ? "s" : ""} en 14 j{ctx.omega3Intakes === 0 && " (les oméga-3 sont étudiés contre la sécheresse oculaire ; l'effet reste discuté)"}.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <IconEye size={16} className="shrink-0 mt-0.5" style={{ color: "var(--danger)" }} />
                    <span>Fer {ctx.ironAvgMg === null ? "—" : `${n(ctx.ironAvgMg)} mg/j`} (repère 11 mg) · B12 {ctx.b12AvgUg === null ? "—" : `${n(ctx.b12AvgUg)} µg/j`} (repère 4 µg), moyenne des aliments sur {ctx.foodDays} j
                      {(ctx.ironIntakes > 0 || ctx.b12Intakes > 0) && ` + compléments (${ctx.ironIntakes} fer, ${ctx.b12Intakes} B12)`}. Ils comptent pour la couleur de la conjonctive.</span>
                  </li>
                </ul>
                <p className="text-[12px] mt-2" style={{ color: "var(--text-muted)" }}>Valeurs des aliments notés : si un aliment n&apos;a pas de fer ou de B12 renseigné, la moyenne est sous-estimée.</p>
              </section>
            )}

            {chart.length >= 2 && (
              <section className="glass p-4 mb-4" aria-label="Évolution">
                <h2 className="text-[15px] font-semibold mb-2" style={{ color: "var(--text-primary)" }}>Évolution</h2>
                <div className="flex gap-1.5 overflow-x-auto pb-1 mb-2 -mx-1 px-1" role="radiogroup" aria-label="Paramètre">
                  {PARAMS.map((p) => (
                    <button key={p.key} type="button" role="radio" aria-checked={p.key === param} onClick={() => setParam(p.key)}
                      className="shrink-0 min-h-[44px] px-3.5 rounded-full text-[13px] font-medium whitespace-nowrap"
                      style={{ background: p.key === param ? "color-mix(in srgb, var(--indigo) 18%, transparent)" : "var(--layer-1)", border: `1px solid ${p.key === param ? "var(--indigo)" : "var(--border)"}`, color: p.key === param ? "var(--indigo)" : "var(--text-secondary)" }}>
                      {p.label}
                    </button>
                  ))}
                </div>
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={chart} margin={{ top: 6, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid stroke="var(--layer-1)" vertical={false} />
                    <XAxis dataKey="t" type="number" scale="time" domain={["dataMin", "dataMax"]} tick={{ fontSize: 12, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} tickFormatter={(t) => format(new Date(t), "d MMM", { locale: fr })} minTickGap={30} />
                    <YAxis tick={{ fontSize: 12, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} domain={["auto", "auto"]} />
                    <Tooltip contentStyle={{ background: "var(--surface-hover)", border: "1px solid var(--border-strong)", borderRadius: 8, fontSize: 12 }}
                      labelFormatter={(t) => format(new Date(t as number), "d MMM HH:mm", { locale: fr })} formatter={(v) => [`${n(Number(v))} ${paramInfo.unit}`, paramInfo.label]} />
                    <Line type="monotone" dataKey="v" stroke="var(--indigo)" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
                <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>{paramInfo.label} : {paramInfo.hint}.</p>
              </section>
            )}

            <section className="mb-4" aria-label="Historique">
              <h2 className="text-[13px] font-semibold mb-2" style={{ color: "var(--text-primary)" }}>Historique</h2>
              <ul className="space-y-2">
                {history.map((s) => (
                  <li key={s.id} className="flex items-center gap-3 rounded-xl p-2" style={{ background: "var(--layer-1)", border: "1px solid var(--border)" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/eye-scan/image?id=${encodeURIComponent(s.id)}`} alt="" width={80} height={36} loading="lazy" className="w-20 h-9 rounded-md object-cover shrink-0" style={{ background: "var(--layer-2)" }} />
                    <div className="flex-1 min-w-0 text-[12px]">
                      <p style={{ color: "var(--text-primary)" }}>{format(parseISO(s.date), "d MMM yyyy", { locale: fr })} · {s.time}</p>
                      <p className="tabular-nums" style={{ color: "var(--text-muted)" }}>
                        pupilles {n(scanValue.pupille(s))} mm · {s.mbiS == null ? "sans test" : `${n(s.mbiS)} s sans cligner`}
                      </p>
                    </div>
                    <button type="button" onClick={() => remove(s.id)} aria-label="Supprimer ce scan" className="w-10 h-10 flex items-center justify-center shrink-0" style={{ color: "var(--text-muted)" }}>
                      <IconTrash size={15} />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}

        <div className="rounded-xl overflow-hidden mb-4" style={{ background: "var(--layer-1)", border: "1px solid var(--border)" }}>
          <button type="button" onClick={() => setShowSources((v) => !v)} aria-expanded={showSources} className="w-full flex items-center gap-1.5 px-3 min-h-[44px]">
            <span className="text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>Méthodes et sources</span>
            <IconChevronDown size={13} style={{ color: "var(--text-muted)", marginLeft: "auto", transform: showSources ? "rotate(180deg)" : "none" }} />
          </button>
          {showSources && (
            <ul className="px-3 pb-3 space-y-1.5 text-[12px]" style={{ color: "var(--text-muted)" }}>
              <li>• Règle en mm : diamètre visible de l&apos;iris ≈ 11,7 mm chez l&apos;adulte (Rufer et al., Cornea 2005).</li>
              <li>• Réflexe pupillaire sur smartphone : Mariakakis et al., PupilScreen (IMWUT 2017).</li>
              <li>• Jaunissement du blanc de l&apos;œil : Mariakakis et al., BiliScreen (IMWUT 2017).</li>
              <li>• Pâleur de la conjonctive et anémie : Sheth et al. (J Gen Intern Med 1997) ; Collings et al. (PLOS ONE 2016).</li>
              <li>• Rougeur oculaire : échelles d&apos;Efron (grade estimé ici, non calibré).</li>
              <li>• Arc cornéen et risque cardiovasculaire : Christoffersen et al. (BMJ 2011).</li>
              <li>• Temps sans cligner et sécheresse : Inomata et al., DryEyeRhythm (JAMA Ophthalmology 2019).</li>
              <li>• MRD1 : distance reflet pupillaire – paupière supérieure, mesure standard du ptôsis.</li>
            </ul>
          )}
        </div>
        <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
          Pas un diagnostic : la lumière, la distance et la couleur des yeux influencent les mesures. Une pupille inégale,
          une paupière qui tombe ou une vision trouble apparues soudainement doivent être vues par un médecin sans attendre.
        </p>
      </div>
      {capturing && <EyeScanCapture onDone={save} onCancel={() => setCapturing(false)} />}
    </div>
  );
}
