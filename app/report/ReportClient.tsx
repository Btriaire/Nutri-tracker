"use client";

import { useState, useRef, useEffect } from "react";
import { format, subDays, subMonths, subYears, startOfYear } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import {
  IconFileTypePdf, IconLoader2, IconCalendar, IconChartBar, IconAlertCircle,
} from "@tabler/icons-react";
import type { ReportData } from "@/app/lib/report-builder";
import ReportDocument from "./ReportDocument";
import PodcastButton from "./PodcastButton";

// ─── Period presets ───────────────────────────────────────────────────────────

const today = format(new Date(), "yyyy-MM-dd");
const PRESETS = [
  { label: "7 jours",    from: format(subDays(new Date(), 6), "yyyy-MM-dd"),    to: today },
  { label: "30 jours",   from: format(subDays(new Date(), 29), "yyyy-MM-dd"),   to: today },
  { label: "3 mois",     from: format(subMonths(new Date(), 3), "yyyy-MM-dd"),  to: today },
  { label: "6 mois",     from: format(subMonths(new Date(), 6), "yyyy-MM-dd"),  to: today },
  { label: "Cette année",from: format(startOfYear(new Date()), "yyyy-MM-dd"),   to: today },
  { label: "1 an",       from: format(subYears(new Date(), 1), "yyyy-MM-dd"),   to: today },
];

// ─── Main component ───────────────────────────────────────────────────────────

export default function ReportClient() {
  const [from,    setFrom]    = useState(PRESETS[1].from);
  const [to,      setTo]      = useState(today);
  const [data,    setData]    = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const generate = async () => {
    setLoading(true);
    setError(false);
    setData(null);
    try {
      const res = await fetch(`/api/report?from=${from}&to=${to}`);
      if (!res.ok) { setError(true); return; }
      setData(await res.json() as ReportData);
    } catch { setError(true); }
    finally  { setLoading(false); }
  };

  const downloadPDF = () => {
    window.print();
  };

  // Print styles injected once
  useEffect(() => {
    const style = document.createElement("style");
    style.id = "report-print-styles";
    style.textContent = `
@media print {
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  @page { size: A4 portrait; margin: 12mm 14mm 14mm 14mm; }
  body { background: #ffffff !important; color: #1a1a2e !important; }
  nav, .print-hide, .bg-orbs { display: none !important; }
  .print-container { max-width: 100% !important; padding: 0 !important; margin: 0 !important; }
  .report-cover { page-break-after: always; }
  .report-page-break { page-break-before: always; }
  .glass, .glass-strong { background: #f8f9fc !important; border: 1px solid #e2e8f0 !important; border-radius: 8px !important; }
  :root { --text-primary: #0f172a !important; --text-secondary: #334155 !important; --text-muted: #64748b !important; --border: #e2e8f0 !important; }
  .report-card { break-inside: avoid !important; }
  .report-section-title { border-bottom-color: currentColor !important; }
}
    `;
    if (!document.getElementById("report-print-styles")) {
      document.head.appendChild(style);
    }
    return () => { document.getElementById("report-print-styles")?.remove(); };
  }, []);

  return (
    <div className="relative min-h-screen">
      <div className="bg-orbs" />
      <div className="relative z-10 max-w-2xl mx-auto px-4 py-6 md:ml-[220px] print-container" style={{ paddingBottom: 100 }}>

        {/* ── Controls (hidden on print) ── */}
        <div className="print-hide">
          <div className="mb-1">
            <p className="text-[11px] uppercase tracking-wider font-medium" style={{ color: "var(--text-muted)" }}>Analyses</p>
          </div>
          <div className="flex items-center justify-between mb-5">
            <h1 className="text-[22px] font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
              Rapport de santé
            </h1>
            <IconFileTypePdf size={20} style={{ color: "#f97316" }} />
          </div>

          {/* Period selector */}
          <div className="glass p-4 mb-4 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <IconCalendar size={14} style={{ color: "var(--text-muted)" }} />
              <p className="text-[12px] font-semibold" style={{ color: "var(--text-primary)" }}>Sélectionner la période</p>
            </div>

            {/* Presets */}
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map(p => {
                const active = from === p.from && to === p.to;
                return (
                  <button key={p.label}
                    onClick={() => { setFrom(p.from); setTo(p.to); }}
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

            {/* Custom range */}
            <div className="flex gap-3 items-center">
              <div className="flex-1">
                <p className="text-[10px] mb-1" style={{ color: "var(--text-muted)" }}>Du</p>
                <input type="date" value={from} max={to} onChange={e => setFrom(e.target.value)}
                  className="input text-[12px] w-full" style={{ height: 36 }} />
              </div>
              <div className="flex-1">
                <p className="text-[10px] mb-1" style={{ color: "var(--text-muted)" }}>Au</p>
                <input type="date" value={to} min={from} max={today} onChange={e => setTo(e.target.value)}
                  className="input text-[12px] w-full" style={{ height: 36 }} />
              </div>
            </div>

            <button onClick={generate} disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-[13px] font-semibold transition-all"
              style={{
                background: "linear-gradient(135deg,rgba(249,115,22,0.18),rgba(251,191,36,0.15))",
                border: "1px solid rgba(249,115,22,0.4)",
                color: "#f97316",
              }}>
              {loading
                ? <><IconLoader2 size={14} className="animate-spin" />Génération en cours…</>
                : <><IconChartBar size={14} />Générer le rapport</>
              }
            </button>
          </div>

          {error && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-[12px] mb-4"
              style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.25)", color: "#f87171" }}>
              <IconAlertCircle size={13} /> Erreur de génération. Vérifiez la connexion et réessayez.
            </div>
          )}

          <PodcastButton />

          <a href="/report/history"
            className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-[12px] font-medium mb-4"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
            📁 Voir l&apos;historique des rapports générés automatiquement
          </a>
        </div>

        {/* ── Report content ── */}
        <AnimatePresence>
          {data && (
            <motion.div
              ref={reportRef}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}
            >
              {/* Download button (screen only) */}
              <div className="print-hide flex justify-end mb-4">
                <button onClick={downloadPDF}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold transition-all"
                  style={{
                    background: "linear-gradient(135deg,rgba(248,113,113,0.18),rgba(249,115,22,0.18))",
                    border: "1px solid rgba(248,113,113,0.4)",
                    color: "#f87171",
                  }}>
                  <IconFileTypePdf size={16} />
                  Télécharger PDF
                </button>
              </div>

              <ReportDocument data={data} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
