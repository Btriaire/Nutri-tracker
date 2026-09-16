"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { IconLoader2, IconDatabase, IconChevronDown } from "@tabler/icons-react";
import { format, subYears, startOfYear } from "date-fns";

export default function ExportPanel() {
  const today     = format(new Date(), "yyyy-MM-dd");
  const yearStart = format(startOfYear(new Date()), "yyyy-MM-dd");

  const [open,        setOpen]        = useState(false);
  const [from,        setFrom]        = useState(yearStart);
  const [to,          setTo]          = useState(today);
  const [exportFmt,   setExportFmt]   = useState<"json" | "csv">("json");
  const [loading,     setLoading]     = useState(false);
  const [done,        setDone]        = useState(false);

  async function handleExport() {
    setLoading(true);
    setDone(false);
    const params = new URLSearchParams({ format: exportFmt, from, to });
    const res = await fetch(`/api/export?${params}`);
    if (!res.ok) { setLoading(false); return; }
    const blob = await res.blob();
    const cd   = res.headers.get("Content-Disposition") ?? "";
    const fnMatch = cd.match(/filename="(.+?)"/);
    const filename = fnMatch?.[1] ?? `nutri-tracker-export.${exportFmt}`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
    setLoading(false);
    setDone(true);
    setTimeout(() => setDone(false), 3000);
  }

  const FIELDS_JSON = [
    { icon: "👤", label: "Profil & objectifs",       desc: "Poids cible, macros, TDEE, plan actif" },
    { icon: "🍽️", label: "Journal alimentaire",      desc: "Toutes les entrées repas, totaux, eau" },
    { icon: "❤️", label: "Données de santé",          desc: "Tension, température, SpO2, notes" },
    { icon: "📊", label: "Fitness (Google Fit)",      desc: "Pas, FC, calories actives, sommeil" },
    { icon: "⚖️", label: "Composition corporelle",    desc: "Poids, % graisse, masse musculaire (Withings)" },
    { icon: "🏃", label: "Activités manuelles",       desc: "Séances saisies manuellement" },
    { icon: "🍳", label: "Recettes & repas sauvegardés", desc: "Ingrédients, macros calculés" },
    { icon: "🥦", label: "Aliments personnalisés",    desc: "Base alimentaire custom" },
    { icon: "🧠", label: "Bien-être mental",          desc: "Humeur, stress, énergie" },
    { icon: "💪", label: "Templates d'entraînement",  desc: "Programmes, exercices" },
  ];

  const FIELDS_CSV = [
    { icon: "🍽️", label: "Journal alimentaire uniquement", desc: "1 ligne par aliment · idéal pour Excel / Google Sheets" },
    { icon: "📋", label: "Colonnes", desc: "date, repas, aliment, marque, source, grammes, calories, protéines, glucides, lipides, fibres, sel, graisses saturées, sodium, eau" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.12 }}
      className="glass overflow-hidden"
    >
      {/* Header (toggle) */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 p-5 text-left"
        style={{ background: "transparent" }}
      >
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "linear-gradient(135deg,rgba(96,165,250,0.15),rgba(167,139,250,0.15))" }}>
          <IconDatabase size={17} style={{ color: "#60a5fa" }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-semibold">Exporter mes données</p>
          <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Export exhaustif de tous tes paramètres</p>
        </div>
        <IconChevronDown
          size={16}
          style={{ color: "var(--text-muted)", transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.25s" }}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="export-content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{ overflow: "hidden" }}
          >
            <div className="px-5 pb-5 space-y-5">

      {/* Format selector */}
      <div className="flex gap-2">
        {(["json", "csv"] as const).map(f => (
          <button key={f}
            onClick={() => setExportFmt(f)}
            className="flex-1 py-2.5 rounded-xl text-[12px] font-semibold uppercase tracking-wide transition-all"
            style={{
              background: exportFmt === f ? (f === "json" ? "rgba(96,165,250,0.15)" : "rgba(52,211,153,0.12)") : "rgba(255,255,255,0.04)",
              border:     exportFmt === f ? `1px solid ${f === "json" ? "rgba(96,165,250,0.4)" : "rgba(52,211,153,0.35)"}` : "1px solid var(--border)",
              color:      exportFmt === f ? (f === "json" ? "#60a5fa" : "#34d399") : "var(--text-muted)",
            }}>
            {f === "json" ? "📦 JSON" : "📊 CSV"}
          </button>
        ))}
      </div>

      {/* What's included */}
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        <div className="px-3 py-2" style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid var(--border)" }}>
          <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            {exportFmt === "json" ? "Contenu du fichier JSON" : "Contenu du fichier CSV"}
          </p>
        </div>
        <div className="divide-y" style={{ borderColor: "var(--border)" }}>
          {(exportFmt === "json" ? FIELDS_JSON : FIELDS_CSV).map(({ icon, label, desc }) => (
            <div key={label} className="flex items-start gap-2.5 px-3 py-2.5">
              <span className="text-[13px] flex-shrink-0 mt-0.5">{icon}</span>
              <div>
                <p className="text-[12px] font-medium" style={{ color: "var(--text-primary)" }}>{label}</p>
                <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Date range */}
      <div className="space-y-2">
        <p className="text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>Période</p>
        <div className="flex gap-2 items-center">
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="input text-[12px] flex-1" style={{ height: "36px" }} />
          <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>→</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="input text-[12px] flex-1" style={{ height: "36px" }} />
        </div>
        {/* Quick range presets */}
        <div className="flex gap-1.5 flex-wrap">
          {[
            { label: "Tout",    from: "2020-01-01",  to: today },
            { label: "1 an",    from: format(subYears(new Date(), 1), "yyyy-MM-dd"), to: today },
            { label: "Cette année", from: yearStart, to: today },
            { label: "3 mois",  from: format(new Date(Date.now() - 90*86400e3), "yyyy-MM-dd"), to: today },
            { label: "30 jours", from: format(new Date(Date.now() - 30*86400e3), "yyyy-MM-dd"), to: today },
          ].map(p => (
            <button key={p.label}
              onClick={() => { setFrom(p.from); setTo(p.to); }}
              className="px-2.5 py-1 rounded-full text-[10px] font-medium transition-all"
              style={{
                background: from === p.from && to === p.to ? "rgba(96,165,250,0.12)" : "rgba(255,255,255,0.05)",
                border:     from === p.from && to === p.to ? "1px solid rgba(96,165,250,0.35)" : "1px solid var(--border)",
                color:      from === p.from && to === p.to ? "#60a5fa" : "var(--text-muted)",
              }}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Export button */}
      <button
        onClick={handleExport}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-[13px] font-semibold transition-all"
        style={{
          background: done ? "rgba(52,211,153,0.15)" : "linear-gradient(135deg,rgba(96,165,250,0.18),rgba(167,139,250,0.18))",
          border:     done ? "1px solid rgba(52,211,153,0.4)" : "1px solid rgba(96,165,250,0.35)",
          color:      done ? "#34d399" : "#60a5fa",
        }}>
        {loading ? (
          <><IconLoader2 size={14} className="animate-spin" /> Préparation du fichier…</>
        ) : done ? (
          <>✓ Téléchargement démarré</>
        ) : (
          <><IconDatabase size={14} /> Télécharger {exportFmt.toUpperCase()}</>
        )}
      </button>

      <p className="text-[9px] text-center" style={{ color: "var(--text-muted)" }}>
        Les données restent sur ton appareil · aucun envoi vers des serveurs tiers
      </p>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Reset Stats Panel ────────────────────────────────────────────────────────
