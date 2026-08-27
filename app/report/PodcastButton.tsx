"use client";

import { useEffect, useRef, useState } from "react";
import { IconMicrophone, IconLoader2, IconDownload, IconAlertCircle } from "@tabler/icons-react";

type PodcastFile = { name: string; mtime: string; sizeKb: number };
type Status = { success: boolean; running: boolean; files: PodcastFile[] };
type PeriodKey = "7d" | "30d" | "90d" | "all";

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "7d",  label: "Semaine" },
  { key: "30d", label: "Mois" },
  { key: "90d", label: "Trimestre" },
  { key: "all", label: "Depuis le début" },
];

export default function PodcastButton() {
  const [period, setPeriod] = useState<PeriodKey>("7d");
  const [running, setRunning] = useState(false);
  const [latest, setLatest] = useState<PodcastFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/podcast/status", { cache: "no-store" });
      const data = await res.json() as Status;
      if (data.success) {
        setRunning(data.running);
        setLatest(data.files?.[0] ?? null);
      }
    } catch { /* silencieux — VPS injoignable temporairement */ }
  };

  useEffect(() => {
    fetchStatus();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  useEffect(() => {
    if (running) {
      pollRef.current = setInterval(fetchStatus, 5000);
    } else if (pollRef.current) {
      clearInterval(pollRef.current);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [running]);

  const launch = async () => {
    setError(null);
    try {
      const res = await fetch("/api/podcast/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period }),
      });
      const data = await res.json() as { success: boolean; error?: string };
      if (data.success) setRunning(true);
      else setError(data.error || "Échec du lancement");
    } catch {
      setError("VPS injoignable");
    }
  };

  return (
    <div className="glass p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <IconMicrophone size={14} style={{ color: "var(--text-muted)" }} />
        <p className="text-[12px] font-semibold" style={{ color: "var(--text-primary)" }}>Podcast audio</p>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-3">
        {PERIODS.map((p) => {
          const active = period === p.key;
          return (
            <button key={p.key} onClick={() => setPeriod(p.key)} disabled={running}
              className="px-3 py-1.5 rounded-full text-[11px] font-medium transition-all"
              style={{
                background: active ? "rgba(249,115,22,0.15)" : "rgba(255,255,255,0.04)",
                border:     active ? "1px solid rgba(249,115,22,0.5)" : "1px solid var(--border)",
                color:      active ? "#f97316" : "var(--text-muted)",
              }}>
              {p.label}
            </button>
          );
        })}
      </div>

      <button onClick={launch} disabled={running}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-[13px] font-semibold transition-all"
        style={{
          background: running ? "rgba(148,163,184,0.1)" : "linear-gradient(135deg,rgba(249,115,22,0.18),rgba(251,191,36,0.15))",
          border: running ? "1px solid var(--border)" : "1px solid rgba(249,115,22,0.4)",
          color: running ? "var(--text-muted)" : "#f97316",
        }}>
        {running
          ? <><IconLoader2 size={14} className="animate-spin" />Génération en cours…</>
          : <><IconMicrophone size={14} />Générer le podcast maintenant</>
        }
      </button>

      {error && (
        <div className="flex items-center gap-2 px-3 py-2 mt-3 rounded-xl text-[11px]"
          style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.25)", color: "#f87171" }}>
          <IconAlertCircle size={12} /> {error}
        </div>
      )}

      {latest && (
        <div className="mt-3 px-3 py-2.5 rounded-xl"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
              🎙️ Dernier podcast prêt · {new Date(latest.mtime).toLocaleDateString("fr-FR")}
            </span>
            <a href={`/api/podcast/download/${latest.name}`} title="Télécharger"
              style={{ color: "var(--text-muted)" }}>
              <IconDownload size={13} />
            </a>
          </div>
          <audio controls preload="none" className="w-full" style={{ height: 32 }}
            src={`/api/podcast/download/${latest.name}?inline=1`}>
          </audio>
        </div>
      )}
    </div>
  );
}
