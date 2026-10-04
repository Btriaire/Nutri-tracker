"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { IconFileTypePdf, IconLoader2, IconRefresh, IconArrowLeft, IconDownload, IconChartInfographic, IconMicrophone } from "@tabler/icons-react";
import PodcastLibrary, { usePodcasts } from "@/app/components/PodcastLibrary";
import Sheet from "@/app/components/Sheet";
import Link from "next/link";
import type { ReportHistoryEntry } from "@/app/api/report/history/route";
import type { InfographicMeta } from "@/app/lib/infographics";

export default function HistoryClient() {
  const [reports, setReports] = useState<ReportHistoryEntry[] | null>(null);
  const [generating, setGenerating] = useState<"7d" | "30d" | null>(null);
  const [error, setError] = useState(false);
  const [infographics, setInfographics] = useState<InfographicMeta[] | null>(null);
  const [viewing, setViewing] = useState<InfographicMeta | null>(null);
  const [showAllInfo, setShowAllInfo] = useState(false);
  const podcasts = usePodcasts();

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

  useEffect(() => {
    fetch("/api/infographic")
      .then(r => (r.ok ? r.json() : Promise.reject(new Error())))
      .then((d: { infographics: InfographicMeta[] }) => setInfographics(d.infographics))
      .catch(() => setInfographics([]));
  }, []);

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
          Historique
        </h1>
        <p className="text-[12px] mb-5" style={{ color: "var(--text-muted)" }}>
          Podcasts, infographies et rapports PDF générés pour toi.
        </p>

        {/* Podcasts — generes par NotebookLM sur le VPS (samedi matin, ou a la demande depuis Rapport) */}
        <section id="podcasts" aria-label="Podcasts" className="mb-6 scroll-mt-20">
          <div className="flex items-center gap-2 mb-2">
            <IconMicrophone size={18} style={{ color: "var(--calories)" }} />
            <h2 className="text-[15px] font-semibold flex-1" style={{ color: "var(--text-primary)" }}>Podcasts</h2>
            <Link href="/report" className="text-[12px] font-medium min-h-[40px] flex items-center" style={{ color: "var(--calories)" }}>
              Générer →
            </Link>
          </div>
          <PodcastLibrary state={podcasts.state} files={podcasts.files} onRetry={podcasts.refresh} />
        </section>

        {/* Infographies — generees chaque nuit par Ammanda (dimanche : semaine, 1er du mois : mois) */}
        <section aria-label="Infographies" className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <IconChartInfographic size={18} style={{ color: "var(--protein)" }} />
            <h2 className="text-[15px] font-semibold" style={{ color: "var(--text-primary)" }}>Infographies</h2>
          </div>
          <p className="text-[12px] mb-3" style={{ color: "var(--text-secondary)" }}>
            Une par semaine (dimanche) et une par mois (le 1ᵉʳ), créées la nuit par Ammanda.
          </p>
          {infographics === null ? (
            <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>Chargement…</p>
          ) : infographics.length === 0 ? (
            <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>Aucune infographie pour le moment : la première arrivera dans la nuit de dimanche.</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                {(showAllInfo ? infographics : infographics.slice(0, 6)).map(g => (
                  <button key={g.id} type="button" onClick={() => setViewing(g)}
                    className="text-left rounded-2xl overflow-hidden active:scale-[0.98] transition-transform"
                    style={{ background: "var(--surface)", border: "1px solid var(--border-strong)" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/infographic/${g.id}`} alt={`Infographie ${g.period} du ${g.to}`} loading="lazy"
                      className="w-full h-40 object-cover object-top" />
                    <div className="px-3 py-2">
                      <p className="text-[13px] font-semibold" style={{ color: g.period === "mois" ? "var(--carbs)" : "var(--protein)" }}>
                        {g.period === "mois" ? "Mois" : "Semaine"}
                      </p>
                      <p className="text-[12px]" style={{ color: "var(--text-secondary)" }}>
                        au {format(new Date(g.to), "d MMM yyyy", { locale: fr })}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
              {infographics.length > 6 && (
                <button type="button" onClick={() => setShowAllInfo(v => !v)}
                  className="mt-2 min-h-[44px] w-full text-[13px] font-medium" style={{ color: "var(--protein)" }}>
                  {showAllInfo ? "Réduire" : `Voir les ${infographics.length} infographies`}
                </button>
              )}
            </>
          )}
        </section>

        <Sheet open={viewing !== null} onClose={() => setViewing(null)}
          title={viewing ? `Infographie ${viewing.period === "mois" ? "du mois" : "de la semaine"} · ${format(new Date(viewing.to), "d MMM yyyy", { locale: fr })}` : "Infographie"}>
          {viewing && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/infographic/${viewing.id}`} alt={`Infographie ${viewing.period} du ${viewing.to}`} className="w-full rounded-xl mb-3" />
              <a href={`/api/infographic/${viewing.id}?download=1`}
                className="flex items-center justify-center gap-2 min-h-[48px] rounded-2xl text-[14px] font-semibold"
                style={{ background: "var(--layer-2)", border: "1px solid var(--border-strong)", color: "var(--text-primary)" }}>
                <IconDownload size={16} /> Télécharger
              </a>
            </>
          )}
        </Sheet>

        <div className="flex items-center gap-2 mb-2">
          <IconFileTypePdf size={18} style={{ color: "var(--calories)" }} />
          <h2 className="text-[15px] font-semibold" style={{ color: "var(--text-primary)" }}>Rapports PDF</h2>
        </div>
        <p className="text-[12px] mb-3" style={{ color: "var(--text-secondary)" }}>
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
                color: "var(--calories)",
              }}>
              {generating === p ? <IconLoader2 size={14} className="animate-spin" /> : <IconRefresh size={14} />}
              Générer {p === "7d" ? "7 jours" : "30 jours"}
            </button>
          ))}
        </div>

        {error && (
          <div className="px-4 py-3 rounded-xl text-[12px] mb-4"
            style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.25)", color: "var(--danger)" }}>
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
                    <IconFileTypePdf size={18} style={{ color: "var(--calories)" }} />
                    <div>
                      <p className="text-[12px] font-medium" style={{ color: "var(--text-primary)" }}>
                        Rapport {r.period === "7d" ? "7 jours" : "30 jours"} — {format(new Date(r.to), "d MMM yyyy", { locale: fr })}
                      </p>
                      <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
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
