"use client";

import { useState } from "react";
import { IconMicrophone, IconLoader2, IconAlertCircle, IconSparkles } from "@tabler/icons-react";
import PodcastLibrary, { usePodcasts } from "@/app/components/PodcastLibrary";

type PeriodKey = "7d" | "30d" | "90d" | "all";
type LengthKey = "short" | "long";

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "7d",  label: "Semaine" },
  { key: "30d", label: "Mois" },
  { key: "90d", label: "Trimestre" },
  { key: "all", label: "Depuis le début" },
];

export default function PodcastButton() {
  const [period, setPeriod] = useState<PeriodKey>("7d");
  const [length, setLength] = useState<LengthKey>("short");
  const { state, files, running, setRunning, refresh } = usePodcasts();
  const [error, setError] = useState<string | null>(null);

  const launch = async () => {
    setError(null);
    try {
      const res = await fetch("/api/podcast/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period, length }),
      });
      const data = await res.json() as { success: boolean; error?: string };
      if (data.success) setRunning(true);
      else setError(data.error || "Échec du lancement");
    } catch {
      setError("Le serveur des podcasts (VPS) ne répond pas");
    }
  };
  const offline = state === "offline";

  return (
    <div className="glass p-4 mb-4">
      <div className="flex items-center gap-2 mb-1">
        <IconMicrophone size={16} style={{ color: "var(--calories)" }} />
        <h2 className="text-[15px] font-semibold" style={{ color: "var(--text-primary)" }}>Podcasts</h2>
      </div>
      <p className="text-[12px] mb-3" style={{ color: "var(--text-muted)" }}>
        Un bilan audio chaque samedi matin, ou à la demande (5 à 10 min de génération).
      </p>

      <PodcastLibrary state={state} files={files} onRetry={refresh} />

      <p className="text-[12px] font-semibold mt-4 mb-1.5" style={{ color: "var(--text-secondary)" }}>Générer un nouveau podcast</p>

      {/* Version courte / longue */}
      <div className="flex gap-1 p-0.5 rounded-lg mb-3"
        style={{ background: "var(--layer-1)", border: "1px solid var(--border)" }}>
        {([["short", "Version courte"], ["long", "Bilan complet"]] as const).map(([key, label]) => (
          <button key={key} onClick={() => setLength(key)} disabled={running}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-[12px] font-medium transition-all"
            style={{
              background: length === key ? "rgba(249,115,22,0.12)" : "transparent",
              color:      length === key ? "var(--calories)" : "var(--text-muted)",
              border:     length === key ? "1px solid rgba(249,115,22,0.35)" : "1px solid transparent",
            }}>
            {key === "long" && <IconSparkles size={11} stroke={2} />}
            {label}
          </button>
        ))}
      </div>

      {length === "short" ? (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {PERIODS.map((p) => {
            const active = period === p.key;
            return (
              <button key={p.key} onClick={() => setPeriod(p.key)} disabled={running}
                className="px-3 py-1.5 rounded-full text-[12px] font-medium transition-all"
                style={{
                  background: active ? "rgba(249,115,22,0.15)" : "var(--layer-1)",
                  border:     active ? "1px solid rgba(249,115,22,0.5)" : "1px solid var(--border)",
                  color:      active ? "var(--calories)" : "var(--text-muted)",
                }}>
                {p.label}
              </button>
            );
          })}
        </div>
      ) : (
        <p className="text-[12px] mb-3 px-0.5" style={{ color: "var(--text-muted)" }}>
          Depuis le tout début de ton suivi · mensurations incluses · mise en perspective de ta progression · conseils pour les prochaines semaines.
        </p>
      )}

      <button onClick={launch} disabled={running || offline}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-[13px] font-semibold transition-all"
        style={{
          background: running || offline ? "rgba(148,163,184,0.1)" : "linear-gradient(135deg,rgba(249,115,22,0.18),rgba(251,191,36,0.15))",
          border: running || offline ? "1px solid var(--border)" : "1px solid rgba(249,115,22,0.4)",
          color: running || offline ? "var(--text-muted)" : "var(--calories)",
        }}>
        {running
          ? <><IconLoader2 size={14} className="animate-spin" />Génération en cours… (5 à 10 min)</>
          : offline
          ? <>Indisponible tant que le serveur ne répond pas</>
          : <><IconMicrophone size={14} />{length === "long" ? "Générer le bilan complet" : "Générer le podcast maintenant"}</>
        }
      </button>

      {error && (
        <div className="flex items-center gap-2 px-3 py-2 mt-3 rounded-xl text-[12px]"
          style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.25)", color: "var(--danger)" }}>
          <IconAlertCircle size={12} /> {error}
        </div>
      )}
    </div>
  );
}
