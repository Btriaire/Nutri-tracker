"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, XCircle, ArrowsClockwise, Lightning, Spinner, Database, CaretDown, CaretUp, Trash, Warning, Sun, Moon } from "@phosphor-icons/react";
import { useTheme } from "@/app/components/ThemeProvider";
import { format, subYears, startOfYear, endOfYear, getYear } from "date-fns";

interface Props {
  fitConnected: boolean;
}

interface YearProgress { year: number; status: "pending" | "running" | "done" | "error"; days?: number }

export default function SettingsClient({ fitConnected: initialFit }: Props) {
  const { theme, toggle } = useTheme();
  const params = useSearchParams();
  const [fit, setFit]                   = useState(initialFit);
  const [syncing, setSyncing]           = useState(false);
  const [syncMsg, setSyncMsg]           = useState("");
  const [disconnecting, setDisconnecting] = useState(false);
  const [syncingHistory, setSyncingHistory] = useState(false);

  // Full history sync state
  const [showFullSync, setShowFullSync] = useState(false);
  const [yearsBack, setYearsBack]       = useState(5);
  const [fullSyncRunning, setFullSyncRunning] = useState(false);
  const [yearProgress, setYearProgress] = useState<YearProgress[]>([]);
  const [fullSyncDone, setFullSyncDone] = useState(false);

  useEffect(() => {
    if (params.get("fit") === "connected") setFit(true);
    if (params.get("fit") === "error")     setSyncMsg("Erreur lors de la connexion");
  }, [params]);

  const handleSync = async () => {
    setSyncing(true); setSyncMsg("");
    try {
      const res  = await fetch("/api/google-fit/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const json = await res.json() as { ok: boolean };
      setSyncMsg(json.ok ? "Synchronisé !" : "Aucune donnée pour aujourd'hui");
    } catch { setSyncMsg("Erreur réseau"); }
    finally { setSyncing(false); }
  };

  const handleSyncHistory = async () => {
    setSyncingHistory(true); setSyncMsg("");
    try {
      const res  = await fetch("/api/google-fit/sync-history", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ days: 90 }) });
      const json = await res.json() as { ok: boolean; days?: number };
      setSyncMsg(json.ok ? `${json.days} jours synchronisés` : "Erreur de synchronisation");
    } catch { setSyncMsg("Erreur réseau"); }
    finally { setSyncingHistory(false); }
  };

  const handleFullSync = async () => {
    setFullSyncRunning(true);
    setFullSyncDone(false);
    setSyncMsg("");

    const today = new Date();
    // Build list of year ranges from oldest → today
    const ranges: { year: number; from: string; to: string }[] = [];
    for (let i = yearsBack - 1; i >= 0; i--) {
      const ref   = subYears(today, i);
      const year  = getYear(ref);
      const from  = i === yearsBack - 1
        ? format(subYears(startOfYear(today), yearsBack - 1), "yyyy-MM-dd")
        : format(startOfYear(ref), "yyyy-MM-dd");
      const to    = i === 0
        ? format(today, "yyyy-MM-dd")
        : format(endOfYear(ref),   "yyyy-MM-dd");
      ranges.push({ year, from, to });
    }

    setYearProgress(ranges.map(r => ({ year: r.year, status: "pending" })));

    let totalDays = 0;
    for (let idx = 0; idx < ranges.length; idx++) {
      const { year, from, to } = ranges[idx];
      setYearProgress(prev => prev.map((p, i) => i === idx ? { ...p, status: "running" } : p));
      try {
        const res  = await fetch("/api/google-fit/sync-range", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ from, to }),
        });
        const json = await res.json() as { ok: boolean; days?: number };
        const days = json.days ?? 0;
        totalDays += days;
        setYearProgress(prev => prev.map((p, i) => i === idx ? { ...p, status: json.ok ? "done" : "error", days } : p));
      } catch {
        setYearProgress(prev => prev.map((p, i) => i === idx ? { ...p, status: "error" } : p));
      }
    }

    setFullSyncRunning(false);
    setFullSyncDone(true);
    setSyncMsg(`Historique complet : ${totalDays} jours synchronisés`);
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    await fetch("/api/google-fit/disconnect", { method: "POST" });
    setFit(false);
    setDisconnecting(false);
  };

  const totalSynced = yearProgress.reduce((s, p) => s + (p.days ?? 0), 0);

  return (
    <div className="relative min-h-screen" style={{ paddingBottom: "80px" }}>
      <div className="bg-orbs" />
      <div className="relative z-10 max-w-md mx-auto px-4 py-6 md:ml-[220px]">

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <p className="label-xs mb-0.5">Compte</p>
          <h1 className="text-[22px] font-semibold tracking-tight mb-6" style={{ color: "var(--text-primary)" }}>
            Réglages
          </h1>
        </motion.div>

        {/* Theme toggle */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.03 }}
          className="glass p-4 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: theme === "light" ? "rgba(249,115,22,0.12)" : "rgba(139,92,246,0.12)" }}>
                {theme === "light"
                  ? <Sun size={18} weight="fill" style={{ color: "var(--calories)" }} />
                  : <Moon size={18} weight="fill" style={{ color: "#818cf8" }} />
                }
              </div>
              <div>
                <p className="text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>Apparence</p>
                <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                  {theme === "light" ? "Interface claire" : "Interface sombre"}
                </p>
              </div>
            </div>
            {/* Toggle pill */}
            <button
              onClick={toggle}
              className="relative flex-shrink-0 w-[52px] h-[28px] rounded-full transition-all"
              style={{
                background: theme === "light" ? "var(--calories)" : "rgba(255,255,255,0.12)",
                border: "1px solid var(--border)",
              }}
            >
              <span
                className="absolute top-[3px] w-[20px] h-[20px] rounded-full flex items-center justify-center transition-all"
                style={{
                  background: "#fff",
                  left: theme === "light" ? "calc(100% - 23px)" : "3px",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                }}
              >
                {theme === "light"
                  ? <Sun size={11} weight="fill" style={{ color: "var(--calories)" }} />
                  : <Moon size={11} weight="fill" style={{ color: "#818cf8" }} />
                }
              </span>
            </button>
          </div>
        </motion.div>

        {/* Google Fit card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="glass p-5 mb-4"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
              style={{ background: "linear-gradient(135deg, #4285f4 0%, #34a853 50%, #ea4335 100%)" }}>
              <Lightning size={18} weight="fill" color="white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-[14px]" style={{ color: "var(--text-primary)" }}>Google Fit</p>
              <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>Pas · Calories · Sommeil · Poids · Séances</p>
            </div>
            {fit
              ? <CheckCircle size={20} weight="fill" style={{ color: "var(--fiber)", flexShrink: 0 }} />
              : <XCircle    size={20} weight="fill" style={{ color: "var(--text-muted)", flexShrink: 0 }} />
            }
          </div>

          {fit ? (
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
                style={{ background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.2)" }}>
                <CheckCircle size={13} style={{ color: "var(--fiber)" }} />
                <span className="text-[12px]" style={{ color: "var(--fiber)" }}>Connecté</span>
              </div>

              {syncMsg && (
                <p className="text-[12px] px-1" style={{ color: "var(--text-muted)" }}>{syncMsg}</p>
              )}

              {/* Quick sync row */}
              <div className="flex gap-2">
                <button onClick={handleSync} disabled={syncing}
                  className="btn btn-ghost flex-1 gap-1.5 text-[12px]">
                  {syncing ? <Spinner size={12} className="animate-spin" /> : <ArrowsClockwise size={12} />}
                  Aujourd'hui
                </button>
                <button onClick={handleSyncHistory} disabled={syncingHistory}
                  className="btn btn-ghost flex-1 gap-1.5 text-[12px]">
                  {syncingHistory ? <Spinner size={12} className="animate-spin" /> : <ArrowsClockwise size={12} />}
                  90 jours
                </button>
                <button onClick={handleDisconnect} disabled={disconnecting}
                  className="btn btn-ghost text-[12px] px-3"
                  style={{ color: "#f87171", borderColor: "rgba(248,113,113,0.3)" }}>
                  {disconnecting ? <Spinner size={12} className="animate-spin" /> : "Déconnecter"}
                </button>
              </div>

              {/* Full history sync — collapsible */}
              <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                <button
                  onClick={() => { setShowFullSync(v => !v); setYearProgress([]); setFullSyncDone(false); setSyncMsg(""); }}
                  className="w-full flex items-center justify-between px-3 py-2.5 text-[12px] transition-colors"
                  style={{ color: "var(--text-secondary)", background: "rgba(255,255,255,0.03)" }}
                >
                  <span className="flex items-center gap-2">
                    <Database size={13} />
                    Synchroniser tout l'historique
                  </span>
                  {showFullSync ? <CaretUp size={11} /> : <CaretDown size={11} />}
                </button>

                <AnimatePresence>
                  {showFullSync && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      style={{ overflow: "hidden" }}
                    >
                      <div className="px-3 pb-3 pt-1 space-y-3"
                        style={{ borderTop: "1px solid var(--border)" }}>

                        {/* Year picker */}
                        <div className="space-y-1.5">
                          <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                            Remonter jusqu'à {new Date().getFullYear() - yearsBack + 1}
                          </p>
                          <div className="flex gap-1.5 flex-wrap">
                            {[1, 2, 3, 5, 7, 10].map(y => (
                              <button key={y}
                                onClick={() => setYearsBack(y)}
                                disabled={fullSyncRunning}
                                className="px-2.5 py-1 rounded-md text-[11px] transition-colors"
                                style={{
                                  background: yearsBack === y ? "var(--accent)" : "rgba(255,255,255,0.05)",
                                  color:      yearsBack === y ? "#fff" : "var(--text-secondary)",
                                  border:     `1px solid ${yearsBack === y ? "var(--accent)" : "var(--border)"}`,
                                }}>
                                {y} an{y > 1 ? "s" : ""}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Year-by-year progress */}
                        {yearProgress.length > 0 && (
                          <div className="space-y-1">
                            {yearProgress.map(p => (
                              <div key={p.year} className="flex items-center gap-2">
                                <div className="w-3 h-3 flex-shrink-0 flex items-center justify-center">
                                  {p.status === "running" && <Spinner size={11} className="animate-spin" style={{ color: "var(--accent)" }} />}
                                  {p.status === "done"    && <CheckCircle size={11} weight="fill" style={{ color: "var(--fiber)" }} />}
                                  {p.status === "error"   && <XCircle     size={11} weight="fill" style={{ color: "#f87171" }} />}
                                  {p.status === "pending" && <div className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--border)" }} />}
                                </div>
                                <span className="text-[11px] flex-1" style={{
                                  color: p.status === "running" ? "var(--text-primary)"
                                       : p.status === "done"    ? "var(--text-secondary)"
                                       : "var(--text-muted)",
                                }}>
                                  {p.year}
                                </span>
                                {p.status === "done" && p.days !== undefined && (
                                  <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{p.days} j</span>
                                )}
                              </div>
                            ))}
                            {(fullSyncRunning || fullSyncDone) && (
                              <div className="pt-1" style={{ borderTop: "1px solid var(--border)" }}>
                                <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                                  {fullSyncRunning ? `${totalSynced} jours traités…` : `✓ ${totalSynced} jours stockés`}
                                </p>
                              </div>
                            )}
                          </div>
                        )}

                        <button
                          onClick={handleFullSync}
                          disabled={fullSyncRunning}
                          className="btn btn-primary w-full gap-2 text-[12px]"
                          style={{ height: "36px" }}
                        >
                          {fullSyncRunning
                            ? <><Spinner size={12} className="animate-spin" /> Synchronisation en cours…</>
                            : <><Database size={12} /> Lancer la synchronisation complète</>
                          }
                        </button>

                        <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                          Traitement année par année — chaque appel peut prendre jusqu'à 30s.
                          Les données sont stockées dans Firestore et disponibles pour les graphiques.
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

            </div>
          ) : (
            <a href="/api/google-fit/auth" className="btn btn-primary w-full gap-2 text-[13px]" style={{ height: "40px" }}>
              <Lightning size={14} weight="fill" />
              Connecter Google Fit
            </a>
          )}
        </motion.div>

        {/* Withings placeholder */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="glass p-5 opacity-50"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--border)" }}>
              ⚖️
            </div>
            <div>
              <p className="font-semibold text-[14px]" style={{ color: "var(--text-primary)" }}>Withings</p>
              <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>Poids · Composition corporelle — bientôt</p>
            </div>
          </div>
        </motion.div>

        {/* Chart customization */}
        <ChartPrefsPanel />

        {/* Reset stats */}
        <ResetPanel />

      </div>
    </div>
  );
}

// ─── Chart Preferences Panel ─────────────────────────────────────────────────

const CHART_TYPE_OPTIONS: { value: string; label: string; icon: string }[] = [
  { value: "area", label: "Aire",     icon: "📈" },
  { value: "bar",  label: "Barres",   icon: "📊" },
  { value: "line", label: "Ligne",    icon: "〰️" },
];

const MACRO_DISPLAY_OPTIONS: { value: string; label: string; icon: string }[] = [
  { value: "rings", label: "Anneaux", icon: "🔵" },
  { value: "bars",  label: "Barres",  icon: "📊" },
  { value: "pie",   label: "Camembert", icon: "🥧" },
];

function ChartPrefsPanel() {
  const [calType,    setCalType]    = useState<string>("area");
  const [wtType,     setWtType]     = useState<string>("line");
  const [macroDisp,  setMacroDisp]  = useState<string>("rings");
  const [showMicro,  setShowMicro]  = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [saved,      setSaved]      = useState(false);

  // Load current saved prefs on open
  useEffect(() => {
    fetch("/api/goals")
      .then((r) => r.json())
      .then((data: { chartPrefs?: { calorieTrend?: string; weightTrend?: string; macroDisplay?: string; showMicroNutrients?: boolean } | null }) => {
        if (!data.chartPrefs) return;
        if (data.chartPrefs.calorieTrend)  setCalType(data.chartPrefs.calorieTrend);
        if (data.chartPrefs.weightTrend)   setWtType(data.chartPrefs.weightTrend);
        if (data.chartPrefs.macroDisplay)  setMacroDisp(data.chartPrefs.macroDisplay);
        if (data.chartPrefs.showMicroNutrients != null) setShowMicro(data.chartPrefs.showMicroNutrients);
      })
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch("/api/goals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chartPrefs: {
            calorieTrend:       calType,
            weightTrend:        wtType,
            macroDisplay:       macroDisp,
            showMicroNutrients: showMicro,
            showSleepData:      true,
            showHeartRate:      true,
          },
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally { setSaving(false); }
  };

  const Toggle = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) => (
    <div className="flex items-center justify-between py-2.5"
      style={{ borderBottom: "1px solid var(--border)" }}>
      <span className="text-[13px]" style={{ color: "var(--text-secondary)" }}>{label}</span>
      <button
        onClick={() => onChange(!checked)}
        className="w-10 h-6 rounded-full transition-all relative flex-shrink-0"
        style={{ background: checked ? "var(--protein)" : "rgba(255,255,255,0.12)" }}
      >
        <span className="absolute top-0.5 w-5 h-5 rounded-full transition-all"
          style={{ background: "#fff", left: checked ? "calc(100% - 22px)" : "2px" }} />
      </button>
    </div>
  );

  const RadioGroup = ({ label, value, options, onChange }: {
    label: string;
    value: string;
    options: { value: string; label: string; icon: string }[];
    onChange: (v: string) => void;
  }) => (
    <div className="mb-4">
      <p className="label-xs mb-2">{label}</p>
      <div className="flex gap-2">
        {options.map((opt) => (
          <button key={opt.value} onClick={() => onChange(opt.value)}
            className="flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl text-[11px] font-medium transition-all"
            style={{
              background: value === opt.value ? "rgba(167,139,250,0.12)" : "rgba(255,255,255,0.03)",
              border: `1px solid ${value === opt.value ? "rgba(167,139,250,0.5)" : "var(--border)"}`,
              color: value === opt.value ? "var(--protein)" : "var(--text-muted)",
            }}>
            <span className="text-[16px]">{opt.icon}</span>
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.12 }}
      className="glass p-5"
    >
      <div className="flex items-center gap-2 mb-5">
        <span className="text-xl">🎨</span>
        <div>
          <p className="font-semibold text-[14px]" style={{ color: "var(--text-primary)" }}>Personnalisation des graphiques</p>
          <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>Apparence et données affichées</p>
        </div>
      </div>

      <RadioGroup
        label="Tendance calories"
        value={calType}
        options={CHART_TYPE_OPTIONS}
        onChange={setCalType}
      />
      <RadioGroup
        label="Courbe de poids"
        value={wtType}
        options={CHART_TYPE_OPTIONS.filter((o) => o.value !== "area" || true)}
        onChange={setWtType}
      />
      <RadioGroup
        label="Affichage macros"
        value={macroDisp}
        options={MACRO_DISPLAY_OPTIONS}
        onChange={setMacroDisp}
      />

      <div className="mb-4">
        <Toggle
          label="Afficher les micro-nutriments"
          checked={showMicro}
          onChange={setShowMicro}
        />
      </div>

      <button onClick={handleSave} disabled={saving}
        className="btn btn-primary w-full gap-2 text-[13px]" style={{ height: "40px" }}>
        {saved ? "✓ Sauvegardé" : saving ? <><Spinner size={12} className="animate-spin" /> Sauvegarde…</> : "Sauvegarder les préférences"}
      </button>
    </motion.div>
  );
}

// ─── Reset Stats Panel ────────────────────────────────────────────────────────

const RESET_OPTIONS = [
  { key: "calories", label: "Journal alimentaire", desc: "Toutes les entrées repas", emoji: "🍽️" },
  { key: "sports",   label: "Activités sportives", desc: "Séances manuelles",        emoji: "🏃" },
  { key: "sleep",    label: "Données de sommeil",  desc: "Historique Google Fit",    emoji: "🌙" },
] as const;

function ResetPanel() {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm,  setConfirm]  = useState(false);
  const [resetting, setResetting] = useState(false);
  const [done,     setDone]     = useState<Record<string, number> | null>(null);

  const toggle = (key: string) =>
    setSelected((s) => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n; });

  const handleReset = async () => {
    setResetting(true);
    try {
      const targets = selected.size === 3 ? ["all"] : Array.from(selected);
      const res = await fetch("/api/admin/reset", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targets }),
      });
      const json = await res.json() as { ok: boolean; results: Record<string, number> };
      if (json.ok) { setDone(json.results); setConfirm(false); setSelected(new Set()); }
    } finally { setResetting(false); }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.15 }}
      className="glass p-5 mt-4"
    >
      <div className="flex items-center gap-2 mb-4">
        <Trash size={18} style={{ color: "#f87171" }} />
        <div>
          <p className="font-semibold text-[14px]" style={{ color: "var(--text-primary)" }}>Remise à zéro</p>
          <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>Supprimer des données définitivement</p>
        </div>
      </div>

      {done && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg mb-3 text-[12px]"
          style={{ background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.2)", color: "var(--fiber)" }}>
          <CheckCircle size={13} weight="fill" />
          Réinitialisation effectuée
        </div>
      )}

      <div className="space-y-2 mb-4">
        {RESET_OPTIONS.map(({ key, label, desc, emoji }) => {
          const checked = selected.has(key);
          return (
            <button key={key} onClick={() => toggle(key)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left"
              style={{
                background: checked ? "rgba(248,113,113,0.08)" : "rgba(255,255,255,0.03)",
                border: `1px solid ${checked ? "rgba(248,113,113,0.35)" : "var(--border)"}`,
              }}>
              <span className="text-[18px]">{emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>{label}</p>
                <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{desc}</p>
              </div>
              <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
                style={{ background: checked ? "#f87171" : "rgba(255,255,255,0.06)", border: `1px solid ${checked ? "#f87171" : "var(--border)"}` }}>
                {checked && <CheckCircle size={13} weight="fill" color="#fff" />}
              </div>
            </button>
          );
        })}
      </div>

      {!confirm ? (
        <button
          onClick={() => setConfirm(true)}
          disabled={selected.size === 0}
          className="btn w-full gap-2 text-[13px]"
          style={{
            height: "40px",
            background: selected.size > 0 ? "rgba(248,113,113,0.12)" : "rgba(255,255,255,0.04)",
            border: `1px solid ${selected.size > 0 ? "rgba(248,113,113,0.4)" : "var(--border)"}`,
            color: selected.size > 0 ? "#f87171" : "var(--text-muted)",
          }}>
          <Trash size={13} />
          Réinitialiser ({selected.size} sélectionné{selected.size > 1 ? "s" : ""})
        </button>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-[12px]"
            style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.25)" }}>
            <Warning size={14} style={{ color: "#f87171" }} />
            <p style={{ color: "#f87171" }}>
              Cette action est <strong>irréversible</strong>. Confirmer la suppression ?
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setConfirm(false)} className="btn btn-ghost flex-1 text-[12px]">
              Annuler
            </button>
            <button onClick={handleReset} disabled={resetting}
              className="flex-1 btn gap-1.5 text-[12px]"
              style={{ height: "36px", background: "#f87171", color: "#fff", border: "none" }}>
              {resetting ? <><Spinner size={12} className="animate-spin" /> Suppression…</> : <><Trash size={12} /> Confirmer</>}
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}
