"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { IconFileTypePdf, IconLoader2, IconRefresh, IconArrowLeft, IconDownload } from "@tabler/icons-react";
import Link from "next/link";
import type { ReportHistoryEntry } from "@/app/api/report/history/route";

export default function HistoryClient() {
  const [reports, setReports] = useState<ReportHistoryEntry[] | null>(null);
  const [generating, setGenerating] = useState<"7d" | "30d" | null>(null);
  const [error, setError] = useState(false);

  const load = async () => {
    try {
      const res = await fetch("/api/report/history");
      if (!res.ok) { setError(true); return; }
      const json = await res.json() as { reports: ReportHistoryEntry[] };
      setReports(json.reports);
    } catch { setError(true); }
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, []);

  const generateNow = async (period: "7d" | "30d") => {
    setGenerating(period);
    setError(false);
    try {
      const res = await fetch(`/api/report/generate?period=${period}`, { method: "POST" });
      if (!res.ok) { setError(true); return; }
      await load();
    } catch { setError(true); }
    finally { setGenerating(null); }
  };

  return (
    <div className="relative min-h-screen">
      <div className="bg-orbs" />
      <div className="relative z-10 max-w-2xl mx-auto px-4 py-6 md:ml-[220px]">
        <Link href="/report" className="flex items-center gap-1.5 text-[12px] mb-4" style={{ color: "var(--text-muted)" }}>
          <IconArrowLeft size={14} /> Retour au rapport
        </Link>

        <h1 className="text-[22px] font-semibold tracking-tight mb-1" style={{ color: "var(--text-primary)" }}>
          Historique des rapports
        </h1>
        <p className="text-[12px] mb-5" style={{ color: "var(--text-muted)" }}>
          Générés automatiquement chaque dimanche (7 jours) et le 1ᵉʳ du mois (30 jours).
        </p>

        {/* Manual triggers */}
        <div className="glass p-4 mb-5 flex gap-2">
          {(["7d", "30d"] as const).map(p => (
            <button key={p} onClick={() => generateNow(p)} disabled={generating !== null}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[12px] font-semibold"
              style={{
                background: "linear-gradient(135deg,rgba(249,115,22,0.18),rgba(251,191,36,0.15))",
                border: "1px solid rgba(249,115,22,0.4)",
                color: "#f97316",
              }}>
              {generating === p ? <IconLoader2 size={14} className="animate-spin" /> : <IconRefresh size={14} />}
              Générer {p === "7d" ? "7 jours" : "30 jours"}
            </button>
          ))}
        </div>

        {error && (
          <div className="px-4 py-3 rounded-xl text-[12px] mb-4"
            style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.25)", color: "#f87171" }}>
            Erreur lors de la génération ou du chargement.
          </div>
        )}

        {reports === null ? (
          <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>Chargement…</p>
        ) : reports.length === 0 ? (
          <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>Aucun rapport généré pour le moment.</p>
        ) : (
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
            <div className="divide-y" style={{ borderColor: "var(--border)" }}>
              {reports.map(r => (
                <a key={r.id} href={r.url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <IconFileTypePdf size={18} style={{ color: "#f97316" }} />
                    <div>
                      <p className="text-[12px] font-medium" style={{ color: "var(--text-primary)" }}>
                        Rapport {r.period === "7d" ? "7 jours" : "30 jours"} — {format(new Date(r.to), "d MMM yyyy", { locale: fr })}
                      </p>
                      <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                        Généré le {format(new Date(r.generatedAt), "d MMM yyyy 'à' HH:mm", { locale: fr })} · {r.sizeKb} Ko
                      </p>
                    </div>
                  </div>
                  <IconDownload size={16} style={{ color: "var(--text-muted)" }} />
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
