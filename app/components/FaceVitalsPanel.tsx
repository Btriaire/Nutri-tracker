"use client";

import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { IconHeartbeat, IconTrash, IconAlertTriangle, IconLungs, IconEye } from "@tabler/icons-react";
import FaceVitalsCapture from "./FaceVitalsCapture";
import ProcedureHelp, { VITALS_PROCEDURE } from "./ProcedureHelp";
import type { FaceVitals } from "@/app/lib/face-vitals";
import type { FaceVitalsEntry } from "@/app/api/face-vitals/route";

const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

/** Lecture prudente des valeurs, avec les reperes usuels de repos chez l'adulte. */
function readings(v: FaceVitals) {
  const out: { label: string; value: string; note: string; tone: "ok" | "warn" | "muted" }[] = [];
  out.push(v.heartRate === null
    ? { label: "Pouls", value: "—", note: "signal trop faible, refais la mesure", tone: "muted" }
    : {
      label: "Pouls", value: `${v.heartRate} bpm`,
      note: `confiance ${v.heartConfidence}${v.heartRate > 100 ? " · au-dessus de la plage de repos (60-100)" : v.heartRate < 50 ? " · bas (normal chez les sportifs)" : " · dans la plage de repos (60-100)"}`,
      tone: v.heartRate > 100 ? "warn" : "ok",
    });
  out.push(v.respRate === null
    ? { label: "Respiration", value: "—", note: "non détectée sur cette mesure", tone: "muted" }
    : { label: "Respiration", value: `≈ ${v.respRate} / min`, note: `indicatif (confiance ${v.respConfidence}) · repos habituel 12-20`, tone: v.respRate > 24 ? "warn" : "ok" });
  out.push({
    label: "Clignements", value: `${v.blinksPerMin} / min`,
    note: v.blinksPerMin < 8 ? "peu fréquents (écrans, concentration, yeux secs)" : v.blinksPerMin > 30 ? "fréquents (fatigue oculaire, irritation)" : "fréquence habituelle (8-30)",
    tone: v.blinksPerMin < 8 || v.blinksPerMin > 30 ? "warn" : "ok",
  });
  out.push({
    label: "Yeux fermés (PERCLOS)", value: `${String(v.perclos).replace(".", ",")} %`,
    note: v.perclos >= 15 ? "élevé : signe de somnolence, repose-toi avant de conduire" : "pas de signe de somnolence (< 15 %)",
    tone: v.perclos >= 15 ? "warn" : "ok",
  });
  return out;
}

export default function FaceVitalsPanel() {
  const [entries, setEntries] = useState<FaceVitalsEntry[] | null>(null);
  const [capturing, setCapturing] = useState<"quick" | "long" | null>(null);
  const [watchHr, setWatchHr] = useState<number | null>(null);
  const [saveError, setSaveError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/face-vitals", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { entries: [] }))
      .then((d: { entries?: FaceVitalsEntry[] }) => { if (!cancelled) setEntries(d.entries ?? []); })
      .catch(() => { if (!cancelled) setEntries([]); });
    return () => { cancelled = true; };
  }, []);

  const latest = entries?.[0] ?? null;

  // Frequence cardiaque moyenne de la montre le meme jour, pour situer la mesure camera
  useEffect(() => {
    if (!latest) return;
    let cancelled = false;
    fetch(`/api/progress?from=${latest.date}&to=${latest.date}`)
      .then((r) => (r.ok ? r.json() : { points: [] }))
      .then((d: { points?: { heartRateAvg?: number }[] }) => { if (!cancelled) setWatchHr(d.points?.[0]?.heartRateAvg ?? null); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [latest]);

  const save = async (v: FaceVitals) => {
    setCapturing(null);
    setSaveError(false);
    const now = new Date();
    const res = await fetch("/api/face-vitals", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: format(now, "yyyy-MM-dd"), time: format(now, "HH:mm"), vitals: v }),
    }).catch(() => null);
    if (res?.ok) {
      const { entry } = await res.json() as { entry: FaceVitalsEntry };
      setEntries((e) => [entry, ...(e ?? [])]);
    } else setSaveError(true);
  };

  const remove = async (id: string) => {
    if (!confirm("Supprimer cette mesure ?")) return;
    const res = await fetch(`/api/face-vitals?id=${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => null);
    if (res?.ok) setEntries((e) => (e ?? []).filter((x) => x.id !== id));
  };

  const goodHr = (entries ?? []).filter((e) => e.vitals.heartRate !== null && e.vitals.heartConfidence !== "faible");
  const usualHr = goodHr.length >= 3 ? Math.round(median(goodHr.slice(1).map((e) => e.vitals.heartRate!))) : null;
  const chart = [...goodHr].reverse().map((e) => ({ t: parseISO(`${e.date}T${e.time}:00`).getTime(), hr: e.vitals.heartRate, rr: e.vitals.respRate ?? undefined }));

  return (
    <section aria-label="Constantes par la caméra" className="glass p-4 mb-4">
      <div className="flex items-center gap-2 mb-1">
        <IconHeartbeat size={18} style={{ color: "var(--danger)" }} />
        <h2 className="text-[15px] font-semibold flex-1" style={{ color: "var(--text-primary)" }}>Constantes par la caméra</h2>
        <ProcedureHelp procedure={VITALS_PROCEDURE} />
      </div>
      <p className="text-[12px] mb-3" style={{ color: "var(--text-secondary)" }}>
        Quelques secondes de vidéo du visage : le pouls se lit dans les micro-variations de couleur de la peau à chaque
        battement (photopléthysmographie à distance), plus les clignements et la somnolence. Assis, au repos, de face.
      </p>

      <button type="button" onClick={() => setCapturing("quick")}
        className="w-full min-h-[48px] rounded-xl text-[14px] font-semibold" style={{ background: "var(--danger)", color: "#fff" }}>
        Mesurer mon pouls (10 à 15 s)
      </button>
      <button type="button" onClick={() => setCapturing("long")}
        className="w-full min-h-[40px] text-[12px] font-medium mb-3" style={{ color: "var(--text-secondary)" }}>
        Mesure longue avec respiration (25 s)
      </button>
      {saveError && <p role="alert" className="text-[12px] mb-2" style={{ color: "var(--danger)" }}>La mesure n&apos;a pas pu être enregistrée.</p>}

      {latest && (
        <div className="rounded-xl p-3 mb-3" style={{ background: "var(--layer-1)", border: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
              Dernière mesure · {format(parseISO(latest.date), "EEE d MMM", { locale: fr })} à {latest.time}
            </p>
            <button type="button" onClick={() => remove(latest.id)} aria-label="Supprimer cette mesure" className="w-9 h-9 -mr-2 flex items-center justify-center" style={{ color: "var(--text-muted)" }}>
              <IconTrash size={14} />
            </button>
          </div>
          <ul className="space-y-2">
            {readings(latest.vitals).map((r) => (
              <li key={r.label} className="flex items-start justify-between gap-3">
                <span className="flex items-center gap-1.5 text-[13px]" style={{ color: "var(--text-secondary)" }}>
                  {r.label === "Pouls" ? <IconHeartbeat size={14} /> : r.label === "Respiration" ? <IconLungs size={14} /> : <IconEye size={14} />}
                  {r.label}
                </span>
                <span className="text-right">
                  <span className="block text-[15px] font-semibold tabular-nums" style={{ color: r.tone === "warn" ? "var(--warn)" : r.tone === "muted" ? "var(--text-muted)" : "var(--text-primary)" }}>{r.value}</span>
                  <span className="block text-[12px]" style={{ color: "var(--text-muted)" }}>{r.note}</span>
                </span>
              </li>
            ))}
          </ul>
          {(usualHr || watchHr) && latest.vitals.heartRate !== null && (
            <p className="text-[12px] mt-2 pt-2" style={{ color: "var(--text-secondary)", borderTop: "1px solid var(--border)" }}>
              {usualHr && `Ton pouls habituel à la caméra : ${usualHr} bpm (${latest.vitals.heartRate - usualHr >= 0 ? "+" : ""}${latest.vitals.heartRate - usualHr}). `}
              {watchHr && `Montre, moyenne du jour : ${Math.round(watchHr)} bpm.`}
            </p>
          )}
          {latest.vitals.warnings.length > 0 && (
            <p className="flex items-start gap-1.5 text-[12px] mt-2" style={{ color: "var(--warn)" }}>
              <IconAlertTriangle size={14} className="shrink-0 mt-0.5" /> {latest.vitals.warnings.join(" ; ")}
            </p>
          )}
        </div>
      )}

      {chart.length >= 2 && (
        <>
          <p className="text-[12px] font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>Pouls au repos (bpm) et respiration</p>
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={chart} margin={{ top: 6, right: 6, left: -20, bottom: 0 }}>
              <CartesianGrid stroke="var(--layer-1)" vertical={false} />
              <XAxis dataKey="t" type="number" scale="time" domain={["dataMin", "dataMax"]} tick={{ fontSize: 12, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} tickFormatter={(t) => format(new Date(t), "d MMM", { locale: fr })} minTickGap={30} />
              <YAxis tick={{ fontSize: 12, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} domain={["auto", "auto"]} />
              <Tooltip contentStyle={{ background: "var(--surface-hover)", border: "1px solid var(--border-strong)", borderRadius: 8, fontSize: 12 }}
                labelFormatter={(t) => format(new Date(t as number), "d MMM HH:mm", { locale: fr })}
                formatter={(v, n) => [v, n === "hr" ? "pouls (bpm)" : "respiration (/min)"]} />
              <Line type="monotone" dataKey="hr" stroke="var(--danger)" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
              <Line type="monotone" dataKey="rr" stroke="var(--info)" strokeWidth={1.5} strokeDasharray="4 3" dot={false} connectNulls isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </>
      )}

      {entries && entries.length > 1 && (
        <ul className="mt-2 space-y-1">
          {entries.slice(1, 8).map((e) => (
            <li key={e.id} className="flex items-center gap-2 text-[12px]" style={{ color: "var(--text-secondary)" }}>
              <span className="flex-1">{format(parseISO(e.date), "d MMM", { locale: fr })} {e.time}</span>
              <span className="tabular-nums">{e.vitals.heartRate ?? "—"} bpm · {e.vitals.blinksPerMin} clign./min</span>
              <button type="button" onClick={() => remove(e.id)} aria-label="Supprimer cette mesure" className="w-9 h-9 flex items-center justify-center" style={{ color: "var(--text-muted)" }}>
                <IconTrash size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="text-[12px] mt-3" style={{ color: "var(--text-muted)" }}>
        Repère de suivi, pas un dispositif médical : la précision baisse avec le mouvement, une lumière faible ou
        changeante. Références : Verkruysse 2008 ; de Haan &amp; Jeanne 2013 ; Wang et al. 2017 (POS) ; Dinges 1998 (PERCLOS).
      </p>

      {capturing && <FaceVitalsCapture mode={capturing} onDone={save} onCancel={() => setCapturing(null)} />}
    </section>
  );
}
