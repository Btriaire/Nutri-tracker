"use client";

import { useEffect, useRef, useState } from "react";
import { IconMicrophone, IconLoader2, IconDownload, IconAlertCircle, IconChevronDown, IconFolder, IconSparkles } from "@tabler/icons-react";

type PodcastFile = { name: string; mtime: string; sizeKb: number };
type Status = { success: boolean; running: boolean; files: PodcastFile[] };
type PeriodKey = "7d" | "30d" | "90d" | "all";
type LengthKey = "short" | "long";

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "7d",  label: "Semaine" },
  { key: "30d", label: "Mois" },
  { key: "90d", label: "Trimestre" },
  { key: "all", label: "Depuis le début" },
];

const isLongFile = (name: string) => name.includes("-long-");

export default function PodcastButton() {
  const [period, setPeriod] = useState<PeriodKey>("7d");
  const [length, setLength] = useState<LengthKey>("short");
  const [running, setRunning] = useState(false);
  const [files, setFiles] = useState<PodcastFile[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/podcast/status", { cache: "no-store" });
      const data = await res.json() as Status;
      if (data.success) {
        setRunning(data.running);
        setFiles(data.files || []);
      }
    } catch { /* silencieux — VPS injoignable temporairement */ }
  };

  const latest = files[0] ?? null;
  const history = files.slice(1);

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
        body: JSON.stringify({ period, length }),
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

      {/* Version courte / longue */}
      <div className="flex gap-1 p-0.5 rounded-lg mb-3"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)" }}>
        {([["short", "Version courte"], ["long", "Bilan complet"]] as const).map(([key, label]) => (
          <button key={key} onClick={() => setLength(key)} disabled={running}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-[11px] font-medium transition-all"
            style={{
              background: length === key ? "rgba(249,115,22,0.12)" : "transparent",
              color:      length === key ? "#f97316" : "var(--text-muted)",
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
      ) : (
        <p className="text-[11px] mb-3 px-0.5" style={{ color: "var(--text-muted)" }}>
          Depuis le tout début de ton suivi · mensurations incluses · mise en perspective de ta progression · conseils pour les prochaines semaines.
        </p>
      )}

      <button onClick={launch} disabled={running}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-[13px] font-semibold transition-all"
        style={{
          background: running ? "rgba(148,163,184,0.1)" : "linear-gradient(135deg,rgba(249,115,22,0.18),rgba(251,191,36,0.15))",
          border: running ? "1px solid var(--border)" : "1px solid rgba(249,115,22,0.4)",
          color: running ? "var(--text-muted)" : "#f97316",
        }}>
        {running
          ? <><IconLoader2 size={14} className="animate-spin" />Génération en cours…</>
          : <><IconMicrophone size={14} />{length === "long" ? "Générer le bilan complet" : "Générer le podcast maintenant"}</>
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
            <span className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
              <IconMicrophone size={12} />
              Dernier podcast prêt · {new Date(latest.mtime).toLocaleDateString("fr-FR")}
              {isLongFile(latest.name) && (
                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full flex items-center gap-0.5"
                  style={{ background: "rgba(249,115,22,0.12)", color: "#f97316" }}>
                  <IconSparkles size={9} stroke={2} />Bilan complet
                </span>
              )}
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

      {history.length > 0 && (
        <div className="mt-2">
          <button onClick={() => setShowHistory((v) => !v)}
            className="w-full flex items-center justify-between gap-2 py-2 text-[11px]"
            style={{ color: "var(--text-muted)" }}>
            <span className="flex items-center gap-1.5">
              <IconFolder size={12} />
              Historique ({history.length})
            </span>
            <IconChevronDown size={13} style={{ transform: showHistory ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
          </button>
          {showHistory && (
            <div className="space-y-1.5 max-h-[280px] overflow-y-auto pr-1">
              {history.map((f) => (
                <div key={f.name} className="px-3 py-2 rounded-xl"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
                      {new Date(f.mtime).toLocaleDateString("fr-FR")} · {f.sizeKb} Ko
                      {isLongFile(f.name) && (
                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full flex items-center gap-0.5"
                          style={{ background: "rgba(249,115,22,0.12)", color: "#f97316" }}>
                          <IconSparkles size={9} stroke={2} />Bilan complet
                        </span>
                      )}
                    </span>
                    <a href={`/api/podcast/download/${f.name}`} title="Télécharger"
                      style={{ color: "var(--text-muted)" }}>
                      <IconDownload size={12} />
                    </a>
                  </div>
                  <audio controls preload="none" className="w-full" style={{ height: 28 }}
                    src={`/api/podcast/download/${f.name}?inline=1`}>
                  </audio>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
