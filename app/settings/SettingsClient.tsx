"use client";

import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { IconCircleCheck, IconCircleX, IconRefresh, IconBolt, IconLoader2, IconDatabase, IconChevronDown, IconChevronUp, IconTrash, IconAlertCircle, IconSun, IconMoon, IconRuler, IconUser, IconHeartbeat, IconShoe, IconCalculator, IconDeviceFloppy, IconLogout, IconFileTypePdf } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { getClientAuth } from "@/app/lib/firebase-client";
import { useTheme, type Theme } from "@/app/components/ThemeProvider";
import { format, subYears, startOfYear, endOfYear, getYear } from "date-fns";
import { calcTDEE, TDEE_FORMULA_CONFIG, type TDEEFormula } from "@/app/lib/nutrition";
import type { NutritionGoals, NutritionPlan, ActivityLevel, Gender, PlannedActivity, ActivityPlan, TrackedNutrients } from "@/app/lib/types";
import { format as formatDate } from "date-fns";

type OAuthStatus = "connected" | "needs_reauth" | "disconnected";

interface Props {
  fitConnected:       OAuthStatus;
  withingsConnected:  OAuthStatus;
  initialGoals:       NutritionGoals;
  initialPhotoUrl?:   string;
  initialDisplayName?: string;
}

interface YearProgress { year: number; status: "pending" | "running" | "done" | "error"; days?: number }

export default function SettingsClient({ fitConnected: initialFit, withingsConnected: initialWithings, initialGoals, initialPhotoUrl, initialDisplayName }: Props) {
  const router = useRouter();

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    try { await signOut(getClientAuth()); } catch {}
    router.push("/login");
  };
  const { theme, setTheme } = useTheme();
  const params = useSearchParams();
  const [fit, setFit]                   = useState<OAuthStatus>(initialFit);
  const [syncing, setSyncing]           = useState(false);
  const [syncMsg, setSyncMsg]           = useState("");

  // Withings
  const [withings, setWithings]         = useState<OAuthStatus>(initialWithings);
  const [wSyncing,  setWSyncing]  = useState(false);
  const [wSyncMsg,  setWSyncMsg]  = useState("");
  const [wDebug,    setWDebug]    = useState(false);
  const [wDebugRes, setWDebugRes] = useState<string | null>(null);
  const [wDisconnecting, setWDisconnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [syncingHistory, setSyncingHistory] = useState(false);

  // Full history sync state
  const [showFullSync, setShowFullSync] = useState(false);
  const [fitOpen,     setFitOpen]     = useState(false);
  const [withingsOpen,setWithingsOpen]= useState(false);
  const [yearsBack, setYearsBack]       = useState(5);
  const [fullSyncRunning, setFullSyncRunning] = useState(false);
  const [yearProgress, setYearProgress] = useState<YearProgress[]>([]);
  const [fullSyncDone, setFullSyncDone] = useState(false);

  useEffect(() => {
    if (params.get("fit")      === "connected") setFit("connected");
    if (params.get("fit")      === "error")     setSyncMsg("Erreur lors de la connexion");
    if (params.get("withings") === "connected") setWithings("connected");
    if (params.get("withings") === "error")     setWSyncMsg("Erreur lors de la connexion");
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
    setFit("disconnected");
    setDisconnecting(false);
  };

  const handleWithingsSync = async (days?: number) => {
    setWSyncing(true); setWSyncMsg("");
    try {
      const body = days ? { days } : {};
      const res  = await fetch("/api/withings/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json() as { ok: boolean; days?: number };
      setWSyncMsg(json.ok
        ? days ? `${json.days} mesure${(json.days ?? 0) > 1 ? "s" : ""} synchronisée${(json.days ?? 0) > 1 ? "s" : ""}` : "Synchronisé !"
        : "Aucune mesure trouvée");
    } catch { setWSyncMsg("Erreur réseau"); }
    finally { setWSyncing(false); }
  };

  const handleWithingsDebug = async () => {
    setWDebug(true); setWDebugRes(null);
    try {
      const res  = await fetch("/api/withings/test");
      const json = await res.json();
      setWDebugRes(JSON.stringify(json, null, 2));
    } catch (e) { setWDebugRes(`Erreur: ${e}`); }
    finally { setWDebug(false); }
  };

  const handleWithingsDisconnect = async () => {
    setWDisconnecting(true);
    await fetch("/api/withings/disconnect", { method: "POST" });
    setWithings("disconnected");
    setWSyncMsg("");
    setWDisconnecting(false);
  };

  const totalSynced = yearProgress.reduce((s, p) => s + (p.days ?? 0), 0);

  return (
    <div className="relative min-h-screen" style={{ paddingBottom: "80px" }}>
      <div className="bg-orbs" />
      <div className="relative z-10 max-w-md mx-auto px-4 py-6 md:ml-[220px]">

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <p className="label-xs mb-0.5">Compte</p>
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-[22px] font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
              Réglages
            </h1>
            <Link href="/report"
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-semibold transition-all"
              style={{
                background: "linear-gradient(135deg,rgba(249,115,22,0.12),rgba(251,191,36,0.10))",
                border: "1px solid rgba(249,115,22,0.35)",
                color: "#f97316",
              }}>
              <IconFileTypePdf size={15} />
              Rapport PDF
            </Link>
          </div>
        </motion.div>

        {/* Data safety banner */}
        <DataSafetyBanner />

        {/* Profil — TOP */}
        <ProfilePanel initialPhotoUrl={initialPhotoUrl} initialDisplayName={initialDisplayName} initialGoals={initialGoals} />

        {/* Nutrition & Profile Goals */}
        <GoalsPanel initialGoals={initialGoals} />

        {/* Alcool */}
        <AlcoolPanel initialGoals={initialGoals} />

        {/* Theme picker */}
        <ThemePicker current={theme} onChange={setTheme} />

        {/* Google Fit card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="glass p-5 mb-4"
        >
          <button className="w-full flex items-center gap-3" onClick={() => setFitOpen(v => !v)}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
              style={{ background: "linear-gradient(135deg, #4285f4 0%, #34a853 50%, #ea4335 100%)" }}>
              <IconBolt size={18} color="white" />
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="font-semibold text-[14px]" style={{ color: "var(--text-primary)" }}>Google Fit</p>
              <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>Pas · Calories · Sommeil · Poids · Séances</p>
            </div>
            {fit === "connected"    && <IconCircleCheck size={18} style={{ color: "var(--fiber)",    flexShrink: 0 }} />}
            {fit === "needs_reauth" && <IconAlertCircle  size={18} style={{ color: "#f59e0b",       flexShrink: 0 }} />}
            {fit === "disconnected" && <IconCircleX      size={18} style={{ color: "var(--text-muted)", flexShrink: 0 }} />}
            {fitOpen ? <IconChevronUp size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} /> : <IconChevronDown size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />}
          </button>

          <AnimatePresence initial={false}>
          {fitOpen && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }} style={{ overflow: "hidden" }}>
          <div className="mt-4">
          {fit !== "disconnected" ? (
            <div className="space-y-2.5">
              {fit === "needs_reauth" ? (
                <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg"
                  style={{ background: "rgba(245,158,11,0.10)", border: "1px solid rgba(245,158,11,0.35)" }}>
                  <IconAlertCircle size={14} style={{ color: "#f59e0b", flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <p className="text-[12px] font-semibold" style={{ color: "#f59e0b" }}>Reconnexion requise</p>
                    <p className="text-[11px] mt-0.5" style={{ color: "rgba(245,158,11,0.75)" }}>
                      Le token a expiré. Reconnectez Google Fit pour rétablir la sync.
                    </p>
                    <Link href="/api/google-fit/auth"
                      className="inline-flex items-center gap-1 mt-2 px-3 py-1.5 rounded-lg text-[12px] font-semibold"
                      style={{ background: "#f59e0b", color: "#000" }}>
                      Reconnecter Google Fit
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
                  style={{ background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.2)" }}>
                  <IconCircleCheck size={13} style={{ color: "var(--fiber)" }} />
                  <span className="text-[12px]" style={{ color: "var(--fiber)" }}>Connecté</span>
                </div>
              )}

              {syncMsg && (
                <p className="text-[12px] px-1" style={{ color: "var(--text-muted)" }}>{syncMsg}</p>
              )}

              {/* Quick sync row */}
              <div className="flex gap-2">
                <button onClick={handleSync} disabled={syncing}
                  className="btn btn-ghost flex-1 gap-1.5 text-[12px]">
                  {syncing ? <IconLoader2 size={12} className="animate-spin" /> : <IconRefresh size={12} />}
                  Aujourd'hui
                </button>
                <button onClick={handleSyncHistory} disabled={syncingHistory}
                  className="btn btn-ghost flex-1 gap-1.5 text-[12px]">
                  {syncingHistory ? <IconLoader2 size={12} className="animate-spin" /> : <IconRefresh size={12} />}
                  90 jours
                </button>
                <button onClick={handleDisconnect} disabled={disconnecting}
                  className="btn btn-ghost text-[12px] px-3"
                  style={{ color: "#f87171", borderColor: "rgba(248,113,113,0.3)" }}>
                  {disconnecting ? <IconLoader2 size={12} className="animate-spin" /> : "Déconnecter"}
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
                    <IconDatabase size={13} />
                    Synchroniser tout l'historique
                  </span>
                  {showFullSync ? <IconChevronUp size={11} /> : <IconChevronDown size={11} />}
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
                                  {p.status === "running" && <IconLoader2 size={11} className="animate-spin" style={{ color: "var(--accent)" }} />}
                                  {p.status === "done"    && <IconCircleCheck size={11} style={{ color: "var(--fiber)" }} />}
                                  {p.status === "error"   && <IconCircleX     size={11} style={{ color: "#f87171" }} />}
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
                            ? <><IconLoader2 size={12} className="animate-spin" /> Synchronisation en cours…</>
                            : <><IconDatabase size={12} /> Lancer la synchronisation complète</>
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
              <IconBolt size={14} />
              Connecter Google Fit
            </a>
          )}
          </div>
          </motion.div>
          )}
          </AnimatePresence>
        </motion.div>

        {/* Withings card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="glass p-5 mb-4"
        >
          <button className="w-full flex items-center gap-3" onClick={() => setWithingsOpen(v => !v)}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
              style={{ background: "linear-gradient(135deg, rgba(0,150,255,0.25) 0%, rgba(0,200,180,0.25) 100%)", border: "1px solid rgba(255,255,255,0.1)" }}>
              ⚖️
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="font-semibold text-[14px]" style={{ color: "var(--text-primary)" }}>Withings</p>
              <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>Poids · % graisse · Masse musculaire</p>
            </div>
            {withings === "connected"    && <IconCircleCheck  size={18} style={{ color: "var(--fiber)",      flexShrink: 0 }} />}
            {withings === "needs_reauth" && <IconAlertCircle size={18} style={{ color: "#f59e0b",           flexShrink: 0 }} />}
            {withings === "disconnected" && <IconCircleX     size={18} style={{ color: "var(--text-muted)", flexShrink: 0 }} />}
            {withingsOpen ? <IconChevronUp size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} /> : <IconChevronDown size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />}
          </button>

          <AnimatePresence initial={false}>
          {withingsOpen && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }} style={{ overflow: "hidden" }}>
          <div className="mt-4">
          {withings !== "disconnected" ? (
            <div className="space-y-2.5">
              {withings === "needs_reauth" ? (
                <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg"
                  style={{ background: "rgba(245,158,11,0.10)", border: "1px solid rgba(245,158,11,0.35)" }}>
                  <IconAlertCircle size={14} style={{ color: "#f59e0b", flexShrink: 0, marginTop: 1 }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold" style={{ color: "#f59e0b" }}>Reconnexion requise</p>
                    <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>Le token a expiré ou a été révoqué.</p>
                  </div>
                  <a href="/api/withings/auth"
                    className="flex-shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all"
                    style={{ background: "rgba(245,158,11,0.20)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.40)" }}>
                    Reconnecter
                  </a>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
                  style={{ background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.2)" }}>
                  <IconCircleCheck size={13} style={{ color: "var(--fiber)" }} />
                  <span className="text-[12px]" style={{ color: "var(--fiber)" }}>Connecté</span>
                </div>
              )}

              {wSyncMsg && (
                <p className="text-[12px] px-1" style={{ color: "var(--text-muted)" }}>{wSyncMsg}</p>
              )}

              <div className="flex gap-2">
                <button onClick={() => handleWithingsSync()} disabled={wSyncing}
                  className="btn btn-ghost flex-1 gap-1.5 text-[12px]">
                  {wSyncing ? <IconLoader2 size={12} className="animate-spin" /> : <IconRefresh size={12} />}
                  Aujourd'hui
                </button>
                <button onClick={() => handleWithingsSync(90)} disabled={wSyncing}
                  className="btn btn-ghost flex-1 gap-1.5 text-[12px]">
                  {wSyncing ? <IconLoader2 size={12} className="animate-spin" /> : <IconRefresh size={12} />}
                  90 jours
                </button>
                <button onClick={handleWithingsDisconnect} disabled={wDisconnecting}
                  className="btn btn-ghost text-[12px] px-3"
                  style={{ color: "#f87171", borderColor: "rgba(248,113,113,0.3)" }}>
                  {wDisconnecting ? <IconLoader2 size={12} className="animate-spin" /> : "Déconnecter"}
                </button>
              </div>

              {/* Debug button */}
              <button onClick={handleWithingsDebug} disabled={wDebug}
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-medium transition-all"
                style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.25)", color: "#fbbf24" }}>
                {wDebug
                  ? <><IconLoader2 size={11} className="animate-spin" /> Diagnostic en cours…</>
                  : <>🔍 Diagnostic Withings — voir ce que l&apos;API renvoie</>}
              </button>

              {wDebugRes && (
                <div className="rounded-xl p-3 overflow-x-auto"
                  style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(251,191,36,0.2)" }}>
                  <pre className="text-[10px] leading-relaxed whitespace-pre-wrap"
                    style={{ color: "#fbbf24", fontFamily: "monospace" }}>
                    {wDebugRes}
                  </pre>
                </div>
              )}
            </div>
          ) : (
            <a href="/api/withings/auth" className="btn btn-primary w-full gap-2 text-[13px]" style={{ height: "40px", background: "linear-gradient(135deg,#0096ff,#00c8b4)", border: "none" }}>
              ⚖️ Connecter Withings
            </a>
          )}
          </div>
          </motion.div>
          )}
          </AnimatePresence>
        </motion.div>

        {/* Chart customization */}
        <ChartPrefsPanel />

        {/* Tracked nutrients */}
        <TrackedNutrientsPanel />

        {/* Export data */}
        <ExportPanel />

        {/* Reset stats */}
        <ResetPanel />

        {/* Jeûne Intermittent */}
        <FastingPanel />

        {/* Logout */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-[13px] font-medium transition-all"
            style={{
              background: "rgba(248,113,113,0.06)",
              border: "1px solid rgba(248,113,113,0.2)",
              color: "#f87171",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(248,113,113,0.12)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(248,113,113,0.06)")}
          >
            <IconLogout size={15} />
            Se déconnecter / Changer de compte
          </button>
        </motion.div>

      </div>
    </div>
  );
}

// ─── Data Safety Banner ──────────────────────────────────────────────────────

function DataSafetyBanner() {
  const [downloading, setDownloading] = useState(false);
  const [done,        setDone]        = useState(false);

  const handleQuickExport = async () => {
    setDownloading(true);
    try {
      const res = await fetch("/api/export?format=json");
      if (!res.ok) return;
      const blob = await res.blob();
      const cd   = res.headers.get("Content-Disposition") ?? "";
      const fnMatch = cd.match(/filename="(.+?)"/);
      const filename = fnMatch?.[1] ?? `nutri-tracker-backup.json`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
      setDone(true);
      setTimeout(() => setDone(false), 4000);
    } catch { /* ignore */ }
    finally { setDownloading(false); }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.05 }}
      className="flex items-center gap-3 px-4 py-3 rounded-2xl mb-4"
      style={{
        background: "linear-gradient(135deg,rgba(52,211,153,0.08),rgba(96,165,250,0.06))",
        border: "1px solid rgba(52,211,153,0.2)",
      }}
    >
      <span className="text-[18px] flex-shrink-0">🔒</span>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-semibold" style={{ color: "#34d399" }}>
          Tes données sont en sécurité
        </p>
        <p className="text-[10.5px]" style={{ color: "var(--text-muted)" }}>
          Stockées dans Firestore · accessibles uniquement par toi
        </p>
      </div>
      <button
        onClick={handleQuickExport}
        disabled={downloading}
        className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all"
        style={{
          background: done ? "rgba(52,211,153,0.15)" : "rgba(96,165,250,0.12)",
          border: `1px solid ${done ? "rgba(52,211,153,0.3)" : "rgba(96,165,250,0.3)"}`,
          color: done ? "#34d399" : "#60a5fa",
        }}
      >
        {downloading ? (
          <IconLoader2 size={10} className="animate-spin" />
        ) : done ? (
          <><IconCircleCheck size={11} /> OK</>
        ) : (
          <><IconDatabase size={11} /> Sauvegarder</>
        )}
      </button>
    </motion.div>
  );
}

// ─── Profile Panel ────────────────────────────────────────────────────────────

function ProfilePanel({ initialPhotoUrl, initialDisplayName, initialGoals }: {
  initialPhotoUrl?:   string;
  initialDisplayName?: string;
  initialGoals:       NutritionGoals;
}) {
  const [open,        setOpen]        = useState(false);
  const [photoUrl,    setPhotoUrl]    = useState(initialPhotoUrl ?? "");
  const [firstName,   setFirstName]   = useState(initialDisplayName ?? "");
  const [birthYear,   setBirthYear]   = useState(
    initialGoals.age ? (new Date().getFullYear() - initialGoals.age).toString() : ""
  );
  const [profession,  setProfession]  = useState("");
  const [healthNotes, setHealthNotes] = useState("");
  const [saving,      setSaving]      = useState(false);
  const [saved,       setSaved]       = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const computedAge = birthYear ? new Date().getFullYear() - parseInt(birthYear) : null;

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement("canvas");
        canvas.width = 128; canvas.height = 128;
        const ctx = canvas.getContext("2d")!;
        const size = Math.min(img.width, img.height);
        ctx.drawImage(img, (img.width - size) / 2, (img.height - size) / 2, size, size, 0, 0, 128, 128);
        const url = canvas.toDataURL("image/jpeg", 0.85);
        setPhotoUrl(url);
        // Auto-save photo immediately
        await saveProfile({ photoUrl: url });
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const saveProfile = async (extra: Record<string, unknown> = {}) => {
    setSaving(true);
    const age = computedAge && computedAge > 0 && computedAge < 120 ? computedAge : undefined;
    try {
      const payload: Record<string, unknown> = { displayName: firstName, ...extra };
      if (age) payload.goals = { age };
      const res = await fetch("/api/goals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 2500); }
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  const handleSave = () => saveProfile();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.07 }}
      className="glass p-5 mt-4"
    >
      <button className="w-full flex items-center gap-3" onClick={() => setOpen(v => !v)}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden"
          style={{ border: "1.5px solid var(--border-strong)" }}>
          {photoUrl
            ? <img src={photoUrl} alt="Avatar" className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center text-[18px]"
                style={{ background: "rgba(249,115,22,0.12)" }}>
                <IconUser size={18} style={{ color: "var(--calories)" }} />
              </div>
          }
        </div>
        <div className="flex-1 text-left">
          <p className="font-semibold text-[14px]" style={{ color: "var(--text-primary)" }}>
            {firstName || "Profil"}
          </p>
          <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
            {[computedAge ? `${computedAge} ans` : null, initialGoals.gender === "male" ? "Homme" : initialGoals.gender === "female" ? "Femme" : null, initialGoals.heightCm ? `${initialGoals.heightCm} cm` : null].filter(Boolean).join(" · ") || "Photo · Prénom · Âge"}
          </p>
        </div>
        {open ? <IconChevronUp size={14} style={{ color: "var(--text-muted)" }} /> : <IconChevronDown size={14} style={{ color: "var(--text-muted)" }} />}
      </button>

      <AnimatePresence initial={false}>
      {open && (
      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
        exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }} style={{ overflow: "hidden" }}>
      <div className="mt-4 flex items-center gap-5">
        {/* Avatar preview */}
        <div className="relative flex-shrink-0">
          <div className="w-20 h-20 rounded-full overflow-hidden"
            style={{ border: "2px solid var(--border-strong)" }}>
            {photoUrl ? (
              <img src={photoUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[32px]"
                style={{ background: "rgba(255,255,255,0.06)" }}>
                👤
              </div>
            )}
          </div>
          <button
            onClick={() => fileRef.current?.click()}
            className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center text-[13px]"
            style={{ background: "var(--calories)", border: "2px solid var(--bg)" }}>
            📷
          </button>
        </div>

        <div className="flex-1 space-y-2.5">
          <button onClick={() => fileRef.current?.click()} className="btn btn-ghost w-full text-[12.5px]">
            Choisir une photo
          </button>
          {/* Status row — auto-save feedback */}
          {photoUrl && (
            <div className="flex items-center gap-2 px-1">
              {saving ? (
                <span className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
                  <IconLoader2 size={11} className="animate-spin" /> Sauvegarde…
                </span>
              ) : saved ? (
                <span className="flex items-center gap-1.5 text-[11px]" style={{ color: "#34d399" }}>
                  <IconCircleCheck size={12} /> Sauvegardée ✓
                </span>
              ) : (
                <button onClick={handleSave}
                  className="flex items-center gap-1.5 text-[11px] underline underline-offset-2"
                  style={{ color: "var(--text-muted)" }}>
                  <IconDeviceFloppy size={11} /> Sauvegarder manuellement
                </button>
              )}
            </div>
          )}
          <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
            Sauvegarde automatique · 128×128 px JPEG
          </p>
        </div>
      </div>

      {/* ── Informations personnelles ── */}
      <div className="mt-4 pt-4 space-y-3" style={{ borderTop: "1px solid var(--border)" }}>
        <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Informations personnelles</p>

        {/* Prénom */}
        <div>
          <label className="text-[11px] font-medium block mb-1.5" style={{ color: "var(--text-secondary)" }}>Prénom / Pseudo</label>
          <input
            type="text"
            value={firstName}
            onChange={e => setFirstName(e.target.value)}
            placeholder="Bruno"
            className="input w-full text-[13px]"
          />
        </div>

        {/* Année de naissance */}
        <div>
          <label className="text-[11px] font-medium block mb-1.5" style={{ color: "var(--text-secondary)" }}>
            Année de naissance
            {computedAge && computedAge > 0 && computedAge < 120 && (
              <span className="ml-2 font-normal" style={{ color: "var(--text-muted)" }}>{computedAge} ans</span>
            )}
          </label>
          <input
            type="number"
            value={birthYear}
            onChange={e => setBirthYear(e.target.value)}
            placeholder={`${new Date().getFullYear() - 35}`}
            min={1920} max={new Date().getFullYear() - 10}
            className="input w-full text-[13px]"
          />
          <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
            Utilisé pour calculer le métabolisme de base (BMR)
          </p>
        </div>

        {/* Profession */}
        <div>
          <label className="text-[11px] font-medium block mb-1.5" style={{ color: "var(--text-secondary)" }}>Profession <span className="font-normal opacity-60">(optionnel)</span></label>
          <input
            type="text"
            value={profession}
            onChange={e => setProfession(e.target.value)}
            placeholder="ex. Développeur, Enseignant…"
            className="input w-full text-[13px]"
          />
          <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
            Aide à contextualiser le niveau d'activité et le stress
          </p>
        </div>

        {/* Notes santé */}
        <div>
          <label className="text-[11px] font-medium block mb-1.5" style={{ color: "var(--text-secondary)" }}>Notes de santé <span className="font-normal opacity-60">(optionnel)</span></label>
          <textarea
            value={healthNotes}
            onChange={e => setHealthNotes(e.target.value)}
            placeholder="Allergies, intolérances, conditions médicales à prendre en compte dans les suggestions…"
            rows={3}
            className="input w-full text-[12px] resize-none"
            style={{ lineHeight: "1.5" }}
          />
          <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
            Utilisé par les suggestions IA pour personnaliser les recettes et conseils
          </p>
        </div>

        {/* Save button */}
        <button onClick={handleSave} disabled={saving}
          className="btn btn-primary w-full gap-2 text-[13px]" style={{ height: "40px" }}>
          {saving ? (
            <><IconLoader2 size={14} className="animate-spin" /> Sauvegarde…</>
          ) : saved ? (
            <><IconCircleCheck size={14} /> Profil sauvegardé ✓</>
          ) : (
            <><IconDeviceFloppy size={14} /> Sauvegarder le profil</>
          )}
        </button>
      </div>
      </motion.div>
      )}
      </AnimatePresence>

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </motion.div>
  );
}

// ─── Slider Field ─────────────────────────────────────────────────────────────

function SliderField({ label, unit, value, min, max, step, color, onChange }: {
  label: string; unit: string; value: string; min: number; max: number; step: number;
  color: string; onChange: (v: string) => void;
}) {
  const num = parseFloat(value) || min;
  const clamped = Math.max(min, Math.min(max, num));
  const pct = ((clamped - min) / (max - min)) * 100;
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] font-medium" style={{ color }}>{label}</p>
        <span className="text-[15px] font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>
          {step < 1 ? num.toFixed(1) : Math.round(num)}
          <span className="text-[11px] font-normal ml-0.5" style={{ color: "var(--text-muted)" }}>{unit}</span>
        </span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={clamped}
        onChange={e => onChange(e.target.value)}
        className="nt-slider"
        style={{
          background: `linear-gradient(to right, ${color} ${pct}%, rgba(255,255,255,0.1) ${pct}%)`,
        }}
      />
      <div className="flex justify-between text-[9px] mt-1" style={{ color: "var(--text-muted)" }}>
        <span>{step < 1 ? min.toFixed(1) : min}{unit}</span>
        <span>{step < 1 ? max.toFixed(1) : max}{unit}</span>
      </div>
    </div>
  );
}

// ─── Goals Panel ─────────────────────────────────────────────────────────────

const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary:   "Sédentaire",
  light:       "Légèrement actif",
  moderate:    "Modérément actif",
  active:      "Très actif",
  very_active: "Extrêmement actif",
};

const ACTIVITY_DESCS: Record<ActivityLevel, string> = {
  sedentary:   "Peu ou pas d'exercice",
  light:       "1–3 fois/sem.",
  moderate:    "3–5 fois/sem.",
  active:      "6–7 fois/sem.",
  very_active: "2× par jour",
};

const ACTIVITY_CATALOG: Omit<PlannedActivity, 'id' | 'durationMin'>[] = [
  // Sport
  { label: "Course à pied",   emoji: "🏃", category: "sport",   kcalPer30min: 300 },
  { label: "Vélo",            emoji: "🚴", category: "sport",   kcalPer30min: 200 },
  { label: "Natation",        emoji: "🏊", category: "sport",   kcalPer30min: 250 },
  { label: "Musculation",     emoji: "🏋️", category: "sport",   kcalPer30min: 150 },
  { label: "Tennis",          emoji: "🎾", category: "sport",   kcalPer30min: 200 },
  { label: "Football",        emoji: "⚽", category: "sport",   kcalPer30min: 250 },
  { label: "Yoga",            emoji: "🧘", category: "sport",   kcalPer30min: 80  },
  { label: "Marche rapide",   emoji: "🚶", category: "sport",   kcalPer30min: 120 },
  // Loisirs
  { label: "Jardinage",       emoji: "🌱", category: "leisure", kcalPer30min: 120 },
  { label: "Danse",           emoji: "💃", category: "leisure", kcalPer30min: 150 },
  { label: "Ménage intensif", emoji: "🧹", category: "leisure", kcalPer30min: 90  },
  { label: "Bricolage",       emoji: "🔨", category: "leisure", kcalPer30min: 100 },
  { label: "Promenade",       emoji: "🌳", category: "leisure", kcalPer30min: 80  },
  { label: "Stretching",      emoji: "🤸", category: "leisure", kcalPer30min: 60  },
];

// ─── Programmes & ajustements (module-level pour useEffect) ─────────────────

const PROGRAMS: Record<string, { label: string; emoji: string; desc: string; protPct: number; carbPct: number; fatPct: number; fiber: number; calorieBonus?: number; fixedCalories?: number; group?: string; tip?: string }> = {
  // ── Programmes standard ──
  balanced:    { label: "Équilibré",           emoji: "⚖️",  desc: "50% G · 25% P · 25% L",              protPct: 0.25, carbPct: 0.50, fatPct: 0.25, fiber: 30 },
  keto:        { label: "Cétogène",            emoji: "🥑",  desc: "5% G · 25% P · 70% L",               protPct: 0.25, carbPct: 0.05, fatPct: 0.70, fiber: 25 },
  lowcarb:     { label: "Sans sucre",          emoji: "🚫🍬", desc: "20% G · 30% P · 50% L",              protPct: 0.30, carbPct: 0.20, fatPct: 0.50, fiber: 28 },
  highprot:    { label: "Hyperprotéiné",       emoji: "💪",  desc: "25% G · 40% P · 35% L",              protPct: 0.40, carbPct: 0.25, fatPct: 0.35, fiber: 30 },
  mediter:     { label: "Méditerranéen",       emoji: "🫒",  desc: "45% G · 20% P · 35% L",              protPct: 0.20, carbPct: 0.45, fatPct: 0.35, fiber: 35 },
  bulk:        { label: "Prise de masse",      emoji: "🏋️",  desc: "45% G · 30% P · 25% L",              protPct: 0.30, carbPct: 0.45, fatPct: 0.25, fiber: 30, calorieBonus: 300 },
  // ── Méthode Dr.C (Dr Jean-Michel Cohen) — calories fixes ──
  drc_confort: { label: "Dr.C Confort",        emoji: "🥗",  desc: "1 400 kcal · 45%G · 30%P · 25%L",   protPct: 0.30, carbPct: 0.45, fatPct: 0.25, fiber: 30, fixedCalories: 1400, group: "drc", tip: "Phase principale · perte 2–4 kg/mois" },
  drc_boost:   { label: "Dr.C Boost",          emoji: "⚡",  desc: "900 kcal · 35%G · 40%P · 25%L",     protPct: 0.40, carbPct: 0.35, fatPct: 0.25, fiber: 20, fixedCalories: 900,  group: "drc", tip: "1–2 sem/mois · relance après plateau" },
  drc_stab:    { label: "Dr.C Stabilisation",  emoji: "🏆",  desc: "1 600 kcal · 50%G · 25%P · 25%L",   protPct: 0.25, carbPct: 0.50, fatPct: 0.25, fiber: 30, fixedCalories: 1600, group: "drc", tip: "Maintien du poids · long terme" },
};

const WEEKLY_ADJUSTMENTS: Record<string, number> = { lose: -500, maintain: 0, gain: 300 };

// ─── Goals Panel ─────────────────────────────────────────────────────────────

function GoalsPanel({ initialGoals }: { initialGoals: NutritionGoals }) {
  const [age,      setAge]      = useState(initialGoals.age?.toString()       ?? "");
  const [height,   setHeight]   = useState(initialGoals.heightCm?.toString()  ?? "");
  const [weight,   setWeight]   = useState(initialGoals.targetWeightKg?.toString() ?? "");
  const [gender,   setGender]   = useState<Gender | "">(initialGoals.gender   ?? "");
  const [activity, setActivity] = useState<ActivityLevel>(initialGoals.activityLevel ?? "moderate");
  const [calories, setCalories] = useState(initialGoals.dailyCalories.toString());
  const [protein,  setProtein]  = useState(initialGoals.proteinGrams.toString());
  const [carbs,    setCarbs]    = useState(initialGoals.carbsGrams.toString());
  const [fat,      setFat]      = useState(initialGoals.fatGrams.toString());
  const [fiber,    setFiber]    = useState(initialGoals.fiberGrams.toString());
  const [water,    setWater]    = useState(initialGoals.waterMl.toString());
  const [steps,    setSteps]    = useState((initialGoals.stepsGoal ?? 10000).toString());
  const [sleep,    setSleep]    = useState(Math.round((initialGoals.sleepGoalMin ?? 420) / 60).toString());
  const [deductBurned,   setDeductBurned]   = useState(initialGoals.deductBurnedCalories !== false);
  const [weeklyGoal,     setWeeklyGoal]     = useState(initialGoals.weeklyGoal ?? "maintain");
  const [currentWeight,  setCurrentWeight]  = useState(initialGoals.currentWeightKg?.toString() ?? "");
  const [targetDate,     setTargetDate]     = useState<string>("");
  const [tdeeCalc,       setTdeeCalc]       = useState<number | null>(null);
  const [selectedProgram,   setSelectedProgram]   = useState<string | null>(null);
  const [tdeeFormula,       setTdeeFormula]       = useState<TDEEFormula>("mifflin");
  const [bodyFatPct,        setBodyFatPct]        = useState<string>("");
  const [saving,            setSaving]            = useState(false);
  const [saved,             setSaved]             = useState(false);
  const [expanded,          setExpanded]          = useState(false);
  const [planLoading,       setPlanLoading]       = useState(false);
  const [planResult,        setPlanResult]        = useState<{ projectedTargetDate: string | null; projectedWeeklyLossKg: number | null; projectedNote: string | null } | null>(null);
  const [activityPlan,      setActivityPlan]      = useState<ActivityPlan | null>(
    (initialGoals as NutritionGoals & { activityPlan?: ActivityPlan }).activityPlan ?? null
  );
  const [apSessions,     setApSessions]     = useState<number>(activityPlan?.sessionsPerWeek ?? 3);
  const [apMinDuration,  setApMinDuration]  = useState<number>(activityPlan?.activities?.[0]?.durationMin ?? 30);
  const [apSelected,     setApSelected]     = useState<Set<string>>(
    new Set((activityPlan?.activities ?? []).map(a => a.id))
  );
  // Plan change confirmation
  const [planActive,         setPlanActive]         = useState(!!initialGoals.plan);
  const [confirmPlanChange,  setConfirmPlanChange]  = useState(false);
  // Section collapse — both start closed
  const [programOpen,    setProgramOpen]    = useState(false);
  const [activityOpen,   setActivityOpen]   = useState(false);
  const [activityLevelOpen, setActivityLevelOpen] = useState(false);
  const [tdeeOpen,          setTdeeOpen]          = useState(false);
  const [macroOpen,         setMacroOpen]          = useState(false);


  // ── Auto-propose date cible dès que poids actuel + cible + profil sont renseignés ──
  useEffect(() => {
    if (!currentWeight || !weight) return;
    const cur = parseFloat(currentWeight);
    const tgt = parseFloat(weight);
    if (!cur || !tgt || Math.abs(cur - tgt) < 0.5) return;
    // Compute deficit: use TDEE if profile available, else assume 500 kcal/day
    let deficit = 500;
    const kcal = parseInt(calories) || 0;
    const a = parseInt(age), h = parseInt(height);
    if (kcal && a && h && gender) {
      const bf   = parseFloat(bodyFatPct) || undefined;
      const tdee = calcTDEE(cur, h, a, gender as Gender, activity, tdeeFormula, bf);
      deficit = Math.max(50, Math.abs(tdee - kcal));
    } else if (kcal) {
      deficit = Math.max(50, Math.abs(cur * 30 - kcal));
    }
    const days     = Math.round(Math.abs(cur - tgt) * 7700 / deficit);
    const proposed = new Date();
    proposed.setDate(proposed.getDate() + days);
    setTargetDate(proposed.toISOString().split("T")[0]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProgram, calories, currentWeight, weight, weeklyGoal, activity, age, height, gender, bodyFatPct, tdeeFormula]);

  const handleCalcTDEE = () => {
    const a = parseInt(age);
    const h = parseInt(height);
    const w = parseFloat(currentWeight) || parseFloat(weight) || 70;
    const bf = parseFloat(bodyFatPct) || undefined;
    if (!a || !h || !gender) return;
    const tdee = calcTDEE(w, h, a, gender as Gender, activity, tdeeFormula, bf);
    setTdeeCalc(tdee);
    setCalories(tdee.toString());
    const p = Math.round(w * 2);
    const f = Math.round((tdee * 0.25) / 9);
    const c = Math.round((tdee - p * 4 - f * 9) / 4);
    setProtein(p.toString());
    setFat(f.toString());
    setCarbs(Math.max(c, 0).toString());
    setSelectedProgram(null);
  };

  const handleApplyProgram = (key: string) => {
    const prog = PROGRAMS[key];
    if (!prog) return;
    const a = parseInt(age), h = parseInt(height), w = parseFloat(currentWeight) || parseFloat(weight) || 70;
    const bf = parseFloat(bodyFatPct) || undefined;
    // Dr.C programs use fixed calories — ignore TDEE
    let kcal: number;
    if (prog.fixedCalories) {
      kcal = prog.fixedCalories;
    } else {
      let base = parseInt(calories) || 2000;
      if (a && h && gender) {
        base = calcTDEE(w, h, a, gender as Gender, activity, tdeeFormula, bf);
        setTdeeCalc(base);
      }
      const adj = WEEKLY_ADJUSTMENTS[weeklyGoal] ?? 0;
      const bonus = prog.calorieBonus ?? 0;
      kcal = Math.max(800, base + adj + bonus);
    }
    const p = Math.round((kcal * prog.protPct) / 4);
    const f = Math.round((kcal * prog.fatPct)  / 9);
    const c = Math.round((kcal * prog.carbPct) / 4);
    setCalories(kcal.toString());
    setProtein(p.toString());
    setFat(f.toString());
    setCarbs(c.toString());
    setFiber(prog.fiber.toString());
    setSelectedProgram(key);
    setProgramOpen(false); // collapse after selection
  };

  const buildGoalsObject = (): Partial<NutritionGoals> => {
    const goals: Partial<NutritionGoals> = {
      dailyCalories:  parseInt(calories) || 2000,
      proteinGrams:   parseInt(protein)  || 150,
      carbsGrams:     parseInt(carbs)    || 220,
      fatGrams:       parseInt(fat)      || 65,
      fiberGrams:     parseInt(fiber)    || 30,
      waterMl:        parseInt(water)    || 2000,
      stepsGoal:            parseInt(steps)    || 10000,
      sleepGoalMin:         (parseInt(sleep)   || 7) * 60,
      activityLevel:        activity,
      deductBurnedCalories: deductBurned,
      weeklyGoal:     weeklyGoal as "lose" | "maintain" | "gain",
      targetWeightKg: parseFloat(weight) || null,
    };
    if (age)           goals.age             = parseInt(age);
    if (height)        goals.heightCm        = parseInt(height);
    if (gender)        goals.gender          = gender as Gender;
    if (currentWeight) goals.currentWeightKg = parseFloat(currentWeight) || undefined;
    if (targetDate)    goals.targetDate      = targetDate;
    return goals;
  };

  const buildActivityPlan = (): ActivityPlan | null => {
    if (apSelected.size === 0) return null;
    const activities: PlannedActivity[] = [...apSelected].map(id => {
      const catalog = ACTIVITY_CATALOG.find(a => `${a.category}-${a.label}` === id);
      if (!catalog) return null;
      return { id, label: catalog.label, emoji: catalog.emoji, category: catalog.category, durationMin: apMinDuration, kcalPer30min: catalog.kcalPer30min };
    }).filter((a): a is PlannedActivity => a !== null);
    const weeklyKcalBurned = activities.reduce((sum, a) => sum + a.kcalPer30min * apMinDuration / 30, 0) * apSessions;
    return { sessionsPerWeek: apSessions, activities, weeklyKcalBurned };
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const goals = buildGoalsObject();
      const ap = buildActivityPlan();
      if (ap) goals.activityPlan = ap;
      // PUT merges into existing goals (preserves alcoholTracking, fasting, etc.)
      await fetch("/api/goals", {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(goals),
      });
      if (ap) setActivityPlan(ap);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally { setSaving(false); }
  };

  const handleStartPlan = async () => {
    if (!selectedProgram) return;
    // Si un plan est déjà actif, demander confirmation
    if (planActive) { setConfirmPlanChange(true); return; }
    await doStartPlan();
  };

  const doStartPlan = async () => {
    if (!selectedProgram) return;
    setConfirmPlanChange(false);
    setPlanLoading(true);
    setPlanResult(null);
    try {
      // 1. Save goals first (PUT merges into existing goals, preserving other fields)
      const goalsObj = buildGoalsObject();
      await fetch("/api/goals", {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(goalsObj),
      });

      // 2. Build NutritionPlan
      const prog = PROGRAMS[selectedProgram];
      const plan: NutritionPlan = {
        programKey:    selectedProgram,
        programLabel:  prog.label,
        programEmoji:  prog.emoji,
        startDate:     formatDate(new Date(), "yyyy-MM-dd"),
        startWeightKg:  parseFloat(currentWeight) || parseFloat(weight) || null,
        targetWeightKg: parseFloat(weight) || null,
        dailyCalories:  parseInt(calories) || 2000,
      };

      // 3. Call projection API
      const res = await fetch("/api/plan/projection", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ plan, goals: goalsObj }),
      });
      if (res.ok) {
        const json = await res.json() as { ok: boolean; projectedTargetDate: string | null; projectedWeeklyLossKg: number | null; projectedNote: string | null };
        setPlanResult({
          projectedTargetDate:   json.projectedTargetDate,
          projectedWeeklyLossKg: json.projectedWeeklyLossKg,
          projectedNote:         json.projectedNote,
        });
        setPlanActive(true);
      }
    } catch { /* noop */ }
    finally { setPlanLoading(false); }
  };

  const inputClass = "w-full px-3 py-2 rounded-xl text-[13px] transition-colors outline-none";
  const inputStyle = {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid var(--border)",
    color: "var(--text-primary)",
  };

  // ── Date presets ──
  const DATE_PRESETS = [
    { label: "1 mois",  months: 1 },
    { label: "3 mois",  months: 3 },
    { label: "6 mois",  months: 6 },
    { label: "1 an",    months: 12 },
  ];
  const addMonthsToToday = (months: number): string => {
    const d = new Date();
    d.setMonth(d.getMonth() + months);
    return d.toISOString().split("T")[0];
  };

  // ── Projection réaliste (calcul live) ──
  const projLive = (() => {
    const cur = parseFloat(currentWeight);
    const tgt = parseFloat(weight);
    if (!cur || !tgt || !targetDate) return null;
    const today = new Date();
    const end   = new Date(targetDate + "T00:00:00");
    const days  = Math.max(1, Math.round((end.getTime() - today.getTime()) / 86400000));
    const totalKg = cur - tgt;
    if (Math.abs(totalKg) < 0.5) return null;
    const perDay        = totalKg / days;
    const perWeek       = perDay * 7;
    const dailyDeficit  = Math.round(Math.abs(perDay) * 7700);
    const isRealistic   = Math.abs(perWeek) <= 0.75;
    const isAmbitious   = Math.abs(perWeek) > 0.75 && Math.abs(perWeek) <= 1.0;
    const isUnrealistic = Math.abs(perWeek) > 1.0;
    const minDays = Math.ceil(Math.abs(totalKg) / 0.75 * 7);
    const minDate = new Date(today.getTime() + minDays * 86400000);
    return { totalKg, perDay, perWeek, dailyDeficit, days, isRealistic, isAmbitious, isUnrealistic, minDate };
  })();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.08 }}
      className="glass p-5 mt-4"
    >
      {/* Header */}
      <button
        className="w-full flex items-center justify-between mb-1"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex items-center gap-2">
          <IconUser size={18} style={{ color: "var(--calories)" }} />
          <div className="text-left">
            <p className="font-semibold text-[14px]" style={{ color: "var(--text-primary)" }}>Objectifs & Profil</p>
            <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>Calories, macros, pas, sommeil</p>
          </div>
        </div>
        {expanded ? <IconChevronUp size={14} style={{ color: "var(--text-muted)" }} /> : <IconChevronDown size={14} style={{ color: "var(--text-muted)" }} />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{ overflow: "hidden" }}
          >
            <div className="pt-4 space-y-5">

              {/* ── Profil ── */}
              <div>
                <p className="label-xs mb-3 flex items-center gap-1.5">
                  <IconRuler size={11} />
                  Profil corporel
                </p>

                {/* Gender */}
                <div className="flex gap-2 mb-3">
                  {(["male", "female"] as Gender[]).map(g => (
                    <button key={g} onClick={() => setGender(g)}
                      className="flex-1 py-2 rounded-xl text-[12px] font-medium transition-all"
                      style={{
                        background: gender === g ? "rgba(249,115,22,0.12)" : "rgba(255,255,255,0.04)",
                        border: `1px solid ${gender === g ? "var(--calories)" : "var(--border)"}`,
                        color: gender === g ? "var(--calories)" : "var(--text-muted)",
                      }}>
                      {g === "male" ? "Homme" : "Femme"}
                    </button>
                  ))}
                </div>

                {/* Age / Height */}
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Âge",    unit: "ans", val: age,    set: setAge },
                    { label: "Taille", unit: "cm",  val: height, set: setHeight },
                  ].map(({ label, unit, val, set }) => (
                    <div key={label}>
                      <p className="text-[10px] mb-1" style={{ color: "var(--text-muted)" }}>{label}</p>
                      <div className="relative">
                        <input
                          type="number"
                          value={val}
                          onChange={e => set(e.target.value)}
                          placeholder="—"
                          className={inputClass}
                          style={{ ...inputStyle, paddingRight: "28px" }}
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px]"
                          style={{ color: "var(--text-muted)" }}>{unit}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* ── Poids actuel ── */}
                <div className="mt-3">
                  <SliderField label="Poids actuel" unit=" kg"
                    value={currentWeight || "70"} min={40} max={200} step={0.5}
                    color="rgba(250,250,250,0.55)" onChange={setCurrentWeight} />
                </div>

                {/* ── Poids cible ── */}
                <div className="mt-4">
                  <SliderField label="Poids cible" unit=" kg"
                    value={weight || "70"} min={40} max={200} step={0.5}
                    color="var(--calories)" onChange={setWeight} />
                </div>

                {/* ── Date cible ── */}
                <div className="mt-4">
                  <p className="text-[10px] mb-2 font-medium" style={{ color: "var(--text-muted)" }}>Date cible</p>
                  <div className="flex gap-1.5 flex-wrap mb-2">
                    {DATE_PRESETS.map(p => {
                      const d = addMonthsToToday(p.months);
                      const sel = targetDate === d;
                      return (
                        <button key={p.months} onClick={() => setTargetDate(d)}
                          className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all"
                          style={{
                            background: sel ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.05)",
                            border: `1px solid ${sel ? "rgba(99,102,241,0.5)" : "var(--border)"}`,
                            color: sel ? "#a5b4fc" : "var(--text-muted)",
                          }}>
                          {p.label}
                        </button>
                      );
                    })}
                  </div>
                  <input type="date" value={targetDate}
                    onChange={e => setTargetDate(e.target.value)}
                    className={inputClass}
                    style={{ ...inputStyle, fontSize: "13px" }}
                    min={new Date().toISOString().split("T")[0]}
                  />
                </div>

                {/* ── Projection live ── */}
                {projLive && (
                  <div className="mt-3 rounded-xl p-3 space-y-2"
                    style={{
                      background: projLive.isUnrealistic ? "rgba(239,68,68,0.07)" : projLive.isAmbitious ? "rgba(251,191,36,0.07)" : "rgba(52,211,153,0.07)",
                      border: `1px solid ${projLive.isUnrealistic ? "rgba(239,68,68,0.3)" : projLive.isAmbitious ? "rgba(251,191,36,0.3)" : "rgba(52,211,153,0.25)"}`,
                    }}>
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] font-semibold"
                        style={{ color: projLive.isUnrealistic ? "#ef4444" : projLive.isAmbitious ? "#fbbf24" : "#34d399" }}>
                        {projLive.isUnrealistic ? "❌ Irréaliste" : projLive.isAmbitious ? "⚠️ Ambitieux" : "✅ Réaliste"}
                      </span>
                      <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                        {Math.abs(projLive.totalKg).toFixed(1)} kg à {projLive.totalKg > 0 ? "perdre" : "prendre"}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                      <div>
                        <p className="text-[9px] uppercase tracking-wide mb-0.5" style={{ color: "var(--text-muted)" }}>Par semaine</p>
                        <p className="text-[16px] font-bold tabular-nums leading-none"
                          style={{ color: projLive.isUnrealistic ? "#ef4444" : "var(--text-primary)" }}>
                          {projLive.totalKg > 0 ? "−" : "+"}{Math.abs(projLive.perWeek).toFixed(2)}
                          <span className="text-[11px] font-normal ml-0.5" style={{ color: "var(--text-muted)" }}>kg</span>
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] uppercase tracking-wide mb-0.5" style={{ color: "var(--text-muted)" }}>Par jour</p>
                        <p className="text-[16px] font-bold tabular-nums leading-none" style={{ color: "var(--text-primary)" }}>
                          {projLive.totalKg > 0 ? "−" : "+"}{Math.abs(projLive.perDay * 1000).toFixed(0)}
                          <span className="text-[11px] font-normal ml-0.5" style={{ color: "var(--text-muted)" }}>g</span>
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] uppercase tracking-wide mb-0.5" style={{ color: "var(--text-muted)" }}>Déficit kcal/jour</p>
                        <p className="text-[16px] font-bold tabular-nums leading-none" style={{ color: "var(--calories)" }}>
                          ~{projLive.dailyDeficit}
                          <span className="text-[11px] font-normal ml-0.5" style={{ color: "var(--text-muted)" }}>kcal</span>
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] uppercase tracking-wide mb-0.5" style={{ color: "var(--text-muted)" }}>Durée totale</p>
                        <p className="text-[16px] font-bold tabular-nums leading-none" style={{ color: "var(--text-secondary)" }}>
                          {projLive.days}
                          <span className="text-[11px] font-normal ml-0.5" style={{ color: "var(--text-muted)" }}>jours</span>
                        </p>
                      </div>
                    </div>
                    {projLive.isUnrealistic && (
                      <p className="text-[10px]" style={{ color: "#f87171" }}>
                        ⚠️ Date mini réaliste pour {Math.abs(projLive.totalKg).toFixed(1)} kg :{" "}
                        <strong>{projLive.minDate.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</strong>
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* ── Niveau d'activité ── */}
              <div>
                <button className="w-full flex items-center justify-between mb-2"
                  onClick={() => setActivityLevelOpen(o => !o)}>
                  <p className="label-xs">Niveau d&apos;activité</p>
                  <div className="flex items-center gap-2">
                    {!activityLevelOpen && (
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                        style={{ background: "rgba(249,115,22,0.1)", color: "var(--calories)", border: "1px solid rgba(249,115,22,0.25)" }}>
                        {ACTIVITY_LABELS[activity]}
                      </span>
                    )}
                    {activityLevelOpen
                      ? <IconChevronUp size={12} style={{ color: "var(--text-muted)" }} />
                      : <IconChevronDown size={12} style={{ color: "var(--text-muted)" }} />}
                  </div>
                </button>
                <AnimatePresence initial={false}>
                  {activityLevelOpen && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} style={{ overflow: "hidden" }}>
                      <div className="space-y-1.5 pb-1">
                        {(Object.keys(ACTIVITY_LABELS) as ActivityLevel[]).map(level => (
                          <button key={level}
                            onClick={() => { setActivity(level); setActivityLevelOpen(false); }}
                            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition-all"
                            style={{
                              background: activity === level ? "rgba(249,115,22,0.08)" : "rgba(255,255,255,0.03)",
                              border: `1px solid ${activity === level ? "rgba(249,115,22,0.35)" : "var(--border)"}`,
                            }}>
                            <div>
                              <p className="text-[12px] font-medium" style={{ color: activity === level ? "var(--calories)" : "var(--text-primary)" }}>
                                {ACTIVITY_LABELS[level]}
                              </p>
                              <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{ACTIVITY_DESCS[level]}</p>
                            </div>
                            {activity === level && <IconCircleCheck size={14} style={{ color: "var(--calories)" }} />}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* ── Objectif poids ── */}
              <div>
                <p className="label-xs mb-2">Objectif</p>
                <div className="flex gap-2">
                  {(["lose", "maintain", "gain"] as const).map(g => (
                    <button key={g} onClick={() => setWeeklyGoal(g)}
                      className="flex-1 py-2 rounded-xl text-[11px] font-medium transition-all"
                      style={{
                        background: weeklyGoal === g ? "rgba(167,139,250,0.12)" : "rgba(255,255,255,0.04)",
                        border: `1px solid ${weeklyGoal === g ? "rgba(167,139,250,0.5)" : "var(--border)"}`,
                        color: weeklyGoal === g ? "var(--protein)" : "var(--text-muted)",
                      }}>
                      {g === "lose" ? "Perdre" : g === "maintain" ? "Maintenir" : "Prendre"}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Plan d'activité ── */}
              <div>
                {/* Collapse header */}
                <button className="w-full flex items-center justify-between mb-2"
                  onClick={() => setActivityOpen(o => !o)}>
                  <p className="label-xs flex items-center gap-1.5">
                    <IconBolt size={11} />
                    Plan d&apos;activité
                  </p>
                  <div className="flex items-center gap-2">
                    {!activityOpen && apSelected.size > 0 && (
                      <span className="text-[11px] font-medium" style={{ color: "var(--calories)" }}>
                        {apSelected.size} activité{apSelected.size > 1 ? "s" : ""} · {apSessions} séances/sem · {apMinDuration} min
                      </span>
                    )}
                    {activityOpen
                      ? <IconChevronUp size={12} style={{ color: "var(--text-muted)" }} />
                      : <IconChevronDown size={12} style={{ color: "var(--text-muted)" }} />
                    }
                  </div>
                </button>

                <AnimatePresence initial={false}>
                  {activityOpen && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} style={{ overflow: "hidden" }}>

                      {/* Sessions par semaine */}
                      <div className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[11px] font-medium" style={{ color: "var(--calories)" }}>Séances par semaine</p>
                          <span className="text-[15px] font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>
                            {apSessions}<span className="text-[11px] font-normal ml-0.5" style={{ color: "var(--text-muted)" }}> séances</span>
                          </span>
                        </div>
                        <input
                          type="range"
                          min={1} max={7} step={1}
                          value={apSessions}
                          onChange={e => setApSessions(parseInt(e.target.value))}
                          className="nt-slider"
                          style={{
                            background: `linear-gradient(to right, var(--calories) ${((apSessions - 1) / 6) * 100}%, rgba(255,255,255,0.1) ${((apSessions - 1) / 6) * 100}%)`,
                          }}
                        />
                        <div className="flex justify-between text-[9px] mt-1" style={{ color: "var(--text-muted)" }}>
                          <span>1 séance</span>
                          <span>7 séances</span>
                        </div>
                      </div>

                      {/* Durée minimale par séance */}
                      <div className="mb-4">
                        <p className="text-[11px] font-medium mb-2" style={{ color: "var(--calories)" }}>
                          Durée minimale par séance
                        </p>
                        <div className="flex gap-1.5 flex-wrap">
                          {[20, 30, 45, 60, 90].map(d => (
                            <button key={d} onClick={() => setApMinDuration(d)}
                              className="px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all"
                              style={{
                                background: apMinDuration === d ? "var(--calories)" : "rgba(255,255,255,0.06)",
                                color: apMinDuration === d ? "#fff" : "var(--text-muted)",
                                border: `1px solid ${apMinDuration === d ? "var(--calories)" : "var(--border)"}`,
                              }}>
                              {d} min
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Grille activités */}
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        {ACTIVITY_CATALOG.map(act => {
                          const id = `${act.category}-${act.label}`;
                          const isSelected = apSelected.has(id);
                          return (
                            <button key={id}
                              onClick={() => {
                                const next = new Set(apSelected);
                                if (isSelected) next.delete(id); else next.add(id);
                                setApSelected(next);
                              }}
                              className="rounded-xl p-3 text-left transition-all"
                              style={{
                                background: isSelected ? "rgba(249,115,22,0.08)" : "rgba(255,255,255,0.04)",
                                border: `1px solid ${isSelected ? "rgba(249,115,22,0.4)" : "var(--border)"}`,
                              }}>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-base">{act.emoji}</span>
                                <p className="text-[12px] font-medium flex-1 leading-tight" style={{ color: isSelected ? "var(--calories)" : "var(--text-primary)" }}>
                                  {act.label}
                                </p>
                                <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                                  style={{ background: isSelected ? "var(--calories)" : "rgba(255,255,255,0.06)", border: `1.5px solid ${isSelected ? "var(--calories)" : "var(--border)"}` }}>
                                  {isSelected && <IconCircleCheck size={10} color="#fff" />}
                                </div>
                              </div>
                              <p className="text-[9px]" style={{ color: "var(--text-muted)" }}>{act.kcalPer30min} kcal/30 min</p>
                            </button>
                          );
                        })}
                      </div>

                      {/* Total estimé + Valider */}
                      {(() => {
                        const totalPerSession = [...apSelected].reduce((sum, id) => {
                          const act = ACTIVITY_CATALOG.find(a => `${a.category}-${a.label}` === id);
                          return sum + (act ? act.kcalPer30min * apMinDuration / 30 : 0);
                        }, 0);
                        const weeklyKcal = Math.round(totalPerSession * apSessions);
                        return (
                          <div className="space-y-2">
                            {apSelected.size > 0 && (
                              <div className="flex items-center justify-between px-3 py-2.5 rounded-xl"
                                style={{ background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.2)" }}>
                                <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
                                  {apSelected.size} activité{apSelected.size > 1 ? "s" : ""} · {apSessions} séances/sem · {apMinDuration} min
                                </p>
                                <p className="text-[14px] font-bold" style={{ color: "var(--calories)" }}>~{weeklyKcal} kcal</p>
                              </div>
                            )}
                            <button onClick={() => setActivityOpen(false)}
                              className="w-full py-2 rounded-xl text-[12px] font-medium transition-all"
                              style={{
                                background: "rgba(249,115,22,0.08)",
                                border: "1px solid rgba(249,115,22,0.25)",
                                color: "var(--calories)",
                              }}>
                              ✓ Valider le plan d&apos;activité
                            </button>
                          </div>
                        );
                      })()}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* ── Programmes nutritionnels ── */}
              <div>
                <button className="w-full flex items-center justify-between mb-2"
                  onClick={() => setProgramOpen(o => !o)}>
                  <p className="label-xs flex items-center gap-1.5">
                    <IconBolt size={11} />
                    Programme nutritionnel
                  </p>
                  <div className="flex items-center gap-2">
                    {selectedProgram && !programOpen && (
                      <span className="text-[11px] font-medium" style={{ color: "var(--calories)" }}>
                        {PROGRAMS[selectedProgram].emoji} {PROGRAMS[selectedProgram].label}
                      </span>
                    )}
                    {programOpen
                      ? <IconChevronUp size={12} style={{ color: "var(--text-muted)" }} />
                      : <IconChevronDown size={12} style={{ color: "var(--text-muted)" }} />
                    }
                  </div>
                </button>
                <AnimatePresence initial={false}>
                  {programOpen && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} style={{ overflow: "hidden" }}>
                      {/* Standard programs */}
                      <div className="grid grid-cols-2 gap-2">
                        {Object.entries(PROGRAMS).filter(([, p]) => !p.group).map(([key, prog]) => {
                          const active = selectedProgram === key;
                          return (
                            <button key={key} onClick={() => handleApplyProgram(key)}
                              className="flex flex-col items-start p-3 rounded-xl text-left transition-all"
                              style={{
                                background: active ? "rgba(249,115,22,0.12)" : "rgba(255,255,255,0.04)",
                                border: `1px solid ${active ? "rgba(249,115,22,0.5)" : "var(--border)"}`,
                              }}>
                              <span className="text-base mb-1">{prog.emoji}</span>
                              <p className="text-[12px] font-semibold leading-tight" style={{ color: active ? "var(--calories)" : "var(--text-primary)" }}>
                                {prog.label}
                              </p>
                              <p className="text-[9px] mt-0.5" style={{ color: "var(--text-muted)" }}>{prog.desc}</p>
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-[10px] mt-2 mb-3" style={{ color: "var(--text-muted)" }}>
                        Le programme calcule automatiquement les macros selon ton profil.
                      </p>

                      {/* Dr.C section */}
                      <div className="rounded-xl p-3 space-y-2"
                        style={{ background: "rgba(34,197,94,0.05)", border: "1px solid rgba(34,197,94,0.2)" }}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                            style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e" }}>Dr.C</span>
                          <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                            Méthode Dr Jean-Michel Cohen · calories fixes
                          </p>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {Object.entries(PROGRAMS).filter(([, p]) => p.group === "drc").map(([key, prog]) => {
                            const active = selectedProgram === key;
                            return (
                              <button key={key} onClick={() => handleApplyProgram(key)}
                                className="flex flex-col items-start p-2.5 rounded-xl text-left transition-all"
                                style={{
                                  background: active ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.04)",
                                  border: `1px solid ${active ? "rgba(34,197,94,0.5)" : "rgba(34,197,94,0.15)"}`,
                                }}>
                                <span className="text-base mb-1">{prog.emoji}</span>
                                <p className="text-[11px] font-semibold leading-tight" style={{ color: active ? "#22c55e" : "var(--text-primary)" }}>
                                  {prog.label}
                                </p>
                                <p className="text-[8px] mt-0.5" style={{ color: "var(--text-muted)" }}>{prog.desc}</p>
                                {prog.tip && (
                                  <p className="text-[8px] mt-1 leading-tight" style={{ color: active ? "#22c55e" : "var(--text-muted)", opacity: 0.8 }}>{prog.tip}</p>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* ── TDEE Calculator ── */}
              <div>
                <button className="w-full flex items-center justify-between mb-2"
                  onClick={() => setTdeeOpen(o => !o)}>
                  <p className="label-xs flex items-center gap-1.5">
                    <IconCalculator size={11} />
                    Calcul TDEE
                  </p>
                  <div className="flex items-center gap-2">
                    {!tdeeOpen && (
                      <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                        {tdeeCalc ? <><span className="font-bold" style={{ color: "var(--calories)" }}>{tdeeCalc} kcal</span> · </> : ""}{TDEE_FORMULA_CONFIG[tdeeFormula].label}
                      </span>
                    )}
                    {tdeeOpen
                      ? <IconChevronUp size={12} style={{ color: "var(--text-muted)" }} />
                      : <IconChevronDown size={12} style={{ color: "var(--text-muted)" }} />}
                  </div>
                </button>
                <AnimatePresence initial={false}>
                  {tdeeOpen && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} style={{ overflow: "hidden" }}>
                      <div className="rounded-xl p-3 space-y-3"
                        style={{ background: "rgba(249,115,22,0.04)", border: "1px solid rgba(249,115,22,0.18)" }}>
                        {/* Compact formula pills */}
                        <div className="flex gap-1.5">
                          {(Object.entries(TDEE_FORMULA_CONFIG) as [TDEEFormula, typeof TDEE_FORMULA_CONFIG[TDEEFormula]][]).map(([key, cfg]) => (
                            <button key={key} onClick={() => setTdeeFormula(key)}
                              className="flex-1 py-1.5 rounded-lg text-[11px] font-medium transition-all"
                              style={{
                                background: tdeeFormula === key ? "var(--calories)" : "rgba(255,255,255,0.05)",
                                color: tdeeFormula === key ? "#fff" : "var(--text-muted)",
                                border: `1px solid ${tdeeFormula === key ? "var(--calories)" : "var(--border)"}`,
                              }}>
                              {cfg.label}
                            </button>
                          ))}
                        </div>
                        {/* Selected formula description */}
                        <p className="text-[10px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                          {TDEE_FORMULA_CONFIG[tdeeFormula].desc}
                        </p>

                        {/* Body fat % input for Katch-McArdle */}
                        <AnimatePresence>
                          {tdeeFormula === "katch" && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} style={{ overflow: "hidden" }}>
                              <div>
                                <p className="text-[10px] mb-1.5 font-medium" style={{ color: "var(--text-muted)" }}>
                                  % masse grasse (requis)
                                </p>
                                <div className="relative">
                                  <input
                                    type="number" min={3} max={60} step={0.5}
                                    value={bodyFatPct}
                                    onChange={e => setBodyFatPct(e.target.value)}
                                    placeholder="ex: 18"
                                    className="w-full px-3 py-2 rounded-xl text-[13px] outline-none transition-colors"
                                    style={{
                                      background: "rgba(255,255,255,0.06)",
                                      border: "1px solid var(--border)",
                                      color: "var(--text-primary)",
                                      paddingRight: "28px",
                                    }}
                                  />
                                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px]"
                                    style={{ color: "var(--text-muted)" }}>%</span>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        <button onClick={() => { handleCalcTDEE(); setTdeeOpen(false); }}
                          disabled={!age || !height || !gender}
                          className="w-full btn gap-2 text-[12px]"
                          style={{
                            height: "34px",
                            background: age && height && gender ? "var(--calories)" : "rgba(255,255,255,0.06)",
                            color: age && height && gender ? "#fff" : "var(--text-muted)",
                            border: "none",
                            opacity: age && height && gender ? 1 : 0.5,
                          }}>
                          <IconCalculator size={12} />
                          {tdeeCalc ? `Recalculer (${tdeeCalc} kcal)` : "Calculer TDEE → appliquer aux macros"}
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* ── Démarrer le plan ── */}
              {selectedProgram && (
                <div className="rounded-xl p-3 space-y-3"
                  style={{ background: "rgba(52,211,153,0.05)", border: "1px solid rgba(52,211,153,0.2)" }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[12px] font-semibold" style={{ color: "var(--fiber)" }}>
                        {PROGRAMS[selectedProgram].emoji} {PROGRAMS[selectedProgram].label}
                      </p>
                      <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                        {parseInt(calories)} kcal/j · {PROGRAMS[selectedProgram].desc}
                      </p>
                    </div>
                    {projLive && (
                      <div className="text-right">
                        <p className="text-[11px] font-bold" style={{ color: projLive.isUnrealistic ? "#ef4444" : projLive.isAmbitious ? "#fbbf24" : "#34d399" }}>
                          {projLive.isUnrealistic ? "⚠️ Irréaliste" : projLive.isAmbitious ? "⚡ Ambitieux" : "✅ Réaliste"}
                        </p>
                        {targetDate && (
                          <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                            ~{new Date(targetDate + "T00:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {projLive && (
                    <div className="flex gap-3 text-center">
                      <div className="flex-1">
                        <p className="text-[9px] uppercase tracking-wide mb-0.5" style={{ color: "var(--text-muted)" }}>Par sem.</p>
                        <p className="text-[14px] font-bold tabular-nums" style={{ color: projLive.isUnrealistic ? "#ef4444" : "var(--text-primary)" }}>
                          {projLive.totalKg > 0 ? "-" : "+"}{Math.abs(projLive.perWeek).toFixed(2)}
                          <span className="text-[10px] font-normal ml-0.5" style={{ color: "var(--text-muted)" }}>kg</span>
                        </p>
                      </div>
                      <div className="flex-1">
                        <p className="text-[9px] uppercase tracking-wide mb-0.5" style={{ color: "var(--text-muted)" }}>Déficit/j</p>
                        <p className="text-[14px] font-bold tabular-nums" style={{ color: "var(--calories)" }}>
                          ~{projLive.dailyDeficit}
                          <span className="text-[10px] font-normal ml-0.5" style={{ color: "var(--text-muted)" }}>kcal</span>
                        </p>
                      </div>
                      <div className="flex-1">
                        <p className="text-[9px] uppercase tracking-wide mb-0.5" style={{ color: "var(--text-muted)" }}>Durée</p>
                        <p className="text-[14px] font-bold tabular-nums" style={{ color: "var(--text-secondary)" }}>
                          {projLive.days}
                          <span className="text-[10px] font-normal ml-0.5" style={{ color: "var(--text-muted)" }}>j</span>
                        </p>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={handleStartPlan}
                    disabled={!age || !height || !gender || planLoading}
                    className="w-full btn gap-2 text-[13px]"
                    style={{
                      height: "38px",
                      background: age && height && gender ? "linear-gradient(135deg,rgba(52,211,153,0.3),rgba(16,185,129,0.2))" : "rgba(255,255,255,0.06)",
                      color: age && height && gender ? "#34d399" : "var(--text-muted)",
                      border: age && height && gender ? "1px solid rgba(52,211,153,0.4)" : "1px solid var(--border)",
                      opacity: age && height && gender ? 1 : 0.5,
                    }}>
                    {planLoading
                      ? <><IconLoader2 size={12} className="animate-spin" /> Calcul…</>
                      : <>🚀 Démarrer le plan</>
                    }
                  </button>

                  {/* Plan result */}
                  <AnimatePresence>
                    {!planLoading && planResult && (
                      <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="px-3 py-2.5 rounded-xl space-y-1"
                        style={{ background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.25)" }}>
                        {planResult.projectedTargetDate && planResult.projectedWeeklyLossKg !== null && (
                          <p className="text-[12px] font-semibold" style={{ color: "var(--fiber)" }}>
                            📅 {formatDate(new Date(planResult.projectedTargetDate + "T00:00:00"), "d MMM yyyy")}
                            {" · "}{planResult.projectedWeeklyLossKg > 0 ? "+" : ""}{planResult.projectedWeeklyLossKg?.toFixed(2)} kg/sem
                          </p>
                        )}
                        {planResult.projectedNote && (
                          <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>{planResult.projectedNote}</p>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* ── Calories & Macros ── */}
              <div>
                <button className="w-full flex items-center justify-between mb-2"
                  onClick={() => setMacroOpen(o => !o)}>
                  <p className="label-xs flex items-center gap-1.5">
                    <IconHeartbeat size={11} />
                    Calories & Macros
                  </p>
                  <div className="flex items-center gap-2">
                    {!macroOpen && (
                      <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                        <span className="font-bold tabular-nums" style={{ color: "var(--calories)" }}>{calories}</span>
                        <span> kcal · </span>
                        <span style={{ color: "var(--protein)" }}>{protein}g P</span>
                        <span> · </span>
                        <span style={{ color: "var(--carbs)" }}>{carbs}g G</span>
                        <span> · </span>
                        <span style={{ color: "var(--fat)" }}>{fat}g L</span>
                      </span>
                    )}
                    {macroOpen
                      ? <IconChevronUp size={12} style={{ color: "var(--text-muted)" }} />
                      : <IconChevronDown size={12} style={{ color: "var(--text-muted)" }} />}
                  </div>
                </button>
                <AnimatePresence initial={false}>
                  {macroOpen && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} style={{ overflow: "hidden" }}>
                      <div className="space-y-4 pt-1">
                        <SliderField label="Calories" unit=" kcal" value={calories} min={800} max={4000} step={50}
                          color="var(--calories)" onChange={setCalories} />
                        <SliderField label="Protéines" unit="g" value={protein} min={30} max={300} step={5}
                          color="var(--protein)" onChange={setProtein} />
                        <SliderField label="Glucides" unit="g" value={carbs} min={50} max={600} step={5}
                          color="var(--carbs)" onChange={setCarbs} />
                        <SliderField label="Lipides" unit="g" value={fat} min={20} max={200} step={5}
                          color="var(--fat)" onChange={setFat} />
                        <SliderField label="Fibres" unit="g" value={fiber} min={10} max={60} step={1}
                          color="var(--fiber)" onChange={setFiber} />
                        <SliderField label="Eau" unit=" ml" value={water} min={500} max={5000} step={250}
                          color="var(--fit-indigo)" onChange={setWater} />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* ── Steps & Sleep ── */}
              <div>
                <p className="label-xs mb-4 flex items-center gap-1.5">
                  <IconShoe size={11} />
                  Activité & Récupération
                </p>
                <div className="space-y-4">
                  <SliderField label="Objectif pas" unit=" pas" value={steps} min={2000} max={20000} step={500}
                    color="var(--steps)" onChange={setSteps} />
                  <SliderField label="Objectif sommeil" unit="h" value={sleep} min={4} max={12} step={0.5}
                    color="var(--fit-indigo)" onChange={setSleep} />

                  {/* Deduct burned calories toggle */}
                  <div className="flex items-center justify-between py-1">
                    <div>
                      <p className="text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>
                        Soustraire les calories brûlées
                      </p>
                      <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                        {deductBurned
                          ? "Budget = Objectif + activité — Budget net affiché"
                          : "Budget = Objectif uniquement — Calories brûlées affichées en info"}
                      </p>
                    </div>
                    <button
                      onClick={() => setDeductBurned(v => !v)}
                      className="relative flex-shrink-0 w-11 h-6 rounded-full transition-colors duration-200"
                      style={{ background: deductBurned ? "var(--fit-green, #34d399)" : "rgba(255,255,255,0.12)" }}
                    >
                      <span
                        className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200"
                        style={{ transform: deductBurned ? "translateX(20px)" : "translateX(0)" }}
                      />
                    </button>
                  </div>

                </div>
              </div>

              {/* ── Save ── */}
              <button onClick={handleSave} disabled={saving}
                className="btn btn-primary w-full gap-2 text-[13px]" style={{ height: "40px" }}>
                {saved
                  ? <><IconCircleCheck size={14} /> Sauvegardé</>
                  : saving
                    ? <><IconLoader2 size={12} className="animate-spin" /> Sauvegarde…</>
                    : <><IconDeviceFloppy size={14} /> Sauvegarder les objectifs</>
                }
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Confirmation dialog : changement de plan ── */}
      <AnimatePresence>
        {confirmPlanChange && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center px-4"
            style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
            onClick={() => setConfirmPlanChange(false)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 8 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 8 }}
              transition={{ duration: 0.2 }}
              className="rounded-2xl p-5 max-w-xs w-full space-y-4"
              style={{ background: "var(--glass-bg)", border: "1px solid var(--border-strong)" }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(239,68,68,0.12)" }}>
                  <IconAlertCircle size={20} style={{ color: "#ef4444" }} />
                </div>
                <div>
                  <p className="font-semibold text-[14px]" style={{ color: "var(--text-primary)" }}>
                    Changer de plan ?
                  </p>
                  <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                    Un plan est déjà actif
                  </p>
                </div>
              </div>
              <p className="text-[12px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                Démarrer un nouveau plan réinitialisera le suivi de progression et les objectifs associés. Cette action ne peut pas être annulée.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmPlanChange(false)}
                  className="flex-1 btn text-[12px]"
                  style={{
                    height: "36px",
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid var(--border)",
                    color: "var(--text-muted)",
                  }}>
                  Annuler
                </button>
                <button
                  onClick={doStartPlan}
                  className="flex-1 btn text-[12px]"
                  style={{
                    height: "36px",
                    background: "rgba(239,68,68,0.15)",
                    border: "1px solid rgba(239,68,68,0.4)",
                    color: "#ef4444",
                  }}>
                  Confirmer
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Alcool Panel ────────────────────────────────────────────────────────────

function AlcoolPanel({ initialGoals }: { initialGoals: NutritionGoals }) {
  const [open,       setOpen]       = useState(false);
  const [enabled,    setEnabled]    = useState(initialGoals.alcoholTracking ?? false);
  const [weeklyGoal, setWeeklyGoal] = useState((initialGoals.weeklyAlcoolUnitsGoal ?? 14).toString());
  const [saving,     setSaving]     = useState(false);
  const [saved,      setSaved]      = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch("/api/goals", {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          alcoholTracking:       enabled,
          weeklyAlcoolUnitsGoal: enabled ? (parseFloat(weeklyGoal) || 14) : 0,
        }),
      });
      setSaved(true);
      // auto-collapse the panel after 1s so user sees the confirmation
      setTimeout(() => {
        setSaved(false);
        setOpen(false);
      }, 1200);
    } finally { setSaving(false); }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.04 }}
      className="glass overflow-hidden mb-4"
    >
      {/* Collapsible header */}
      <button className={`w-full flex items-center justify-between px-5 ${open ? "py-4" : "py-3"} transition-all`} onClick={() => setOpen(v => !v)}>
        <div className="flex items-center gap-3">
          <div className={`${open ? "w-9 h-9" : "w-7 h-7"} rounded-xl flex items-center justify-center flex-shrink-0 transition-all`}
            style={{ background: "rgba(192,132,252,0.12)", border: "1px solid rgba(192,132,252,0.22)" }}>
            {/* Wine glass SVG icon */}
            <svg width={open ? 20 : 16} height={open ? 20 : 16} viewBox="0 0 24 28" fill="none">
              <path d="M5 3 L19 3 L15.5 14 L8.5 14 Z" stroke="#c084fc" strokeWidth="1.7" strokeLinejoin="round" fill="#c084fc" fillOpacity="0.2" />
              <line x1="12" y1="14" x2="12" y2="22" stroke="#c084fc" strokeWidth="1.7" strokeLinecap="round" />
              <path d="M7 22 Q12 25 17 22" stroke="#c084fc" strokeWidth="1.7" strokeLinecap="round" fill="none" />
              <circle cx="11" cy="9" r="1.2" fill="#c084fc" fillOpacity="0.5" />
            </svg>
          </div>
          <div className="text-left">
            <p className={`font-semibold ${open ? "text-[13.5px]" : "text-[13px]"}`} style={{ color: "var(--text-primary)" }}>Suivi Alcool</p>
            <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
              {enabled ? `Activé · objectif ${weeklyGoal} u/sem.` : "Désactivé — cliquer pour configurer"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          {/* Quick toggle in header — stop propagation so it doesn't also open/close */}
          <button
            onClick={e => { e.stopPropagation(); setEnabled(v => !v); }}
            className="relative flex-shrink-0 w-11 h-6 rounded-full transition-colors duration-200"
            style={{ background: enabled ? "#c084fc" : "rgba(255,255,255,0.12)" }}
          >
            <span
              className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200"
              style={{ transform: enabled ? "translateX(20px)" : "translateX(0)" }}
            />
          </button>
          {open
            ? <IconChevronUp  size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
            : <IconChevronDown size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />}
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="alcool-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 space-y-4" style={{ borderTop: "1px solid var(--border)" }}>

              {/* Toggle */}
              <div className="flex items-center justify-between pt-4">
                <div>
                  <p className="text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>
                    Activer le suivi
                  </p>
                  <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {enabled
                      ? "Verre SVG animé + presets rapides dans le Journal"
                      : "N'apparaît pas dans le Journal"}
                  </p>
                </div>
                <button
                  onClick={() => setEnabled(v => !v)}
                  className="relative flex-shrink-0 w-11 h-6 rounded-full transition-colors duration-200"
                  style={{ background: enabled ? "#c084fc" : "rgba(255,255,255,0.12)" }}
                >
                  <span
                    className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200"
                    style={{ transform: enabled ? "translateX(20px)" : "translateX(0)" }}
                  />
                </button>
              </div>

              {/* Weekly goal — only when enabled */}
              <AnimatePresence initial={false}>
                {enabled && (
                  <motion.div
                    key="alcool-goal"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="rounded-2xl p-4 space-y-3"
                      style={{ background: "rgba(192,132,252,0.06)", border: "1px solid rgba(192,132,252,0.18)" }}>
                      <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "#c084fc" }}>
                        Objectif hebdomadaire
                      </p>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setWeeklyGoal(v => String(Math.max(1, (parseFloat(v) || 14) - 1)))}
                          className="w-9 h-9 rounded-xl flex items-center justify-center text-xl font-bold transition-colors"
                          style={{ background: "rgba(255,255,255,0.07)", color: "var(--text-secondary)" }}
                        >−</button>
                        <input
                          type="number" value={weeklyGoal} min="1" max="100" step="1"
                          onChange={e => setWeeklyGoal(e.target.value)}
                          className="w-16 text-center text-[18px] font-bold rounded-xl outline-none tabular-nums"
                          style={{
                            background: "rgba(192,132,252,0.08)",
                            border: "1px solid rgba(192,132,252,0.30)",
                            color: "#c084fc", padding: "7px 4px",
                          }}
                        />
                        <button
                          onClick={() => setWeeklyGoal(v => String((parseFloat(v) || 14) + 1))}
                          className="w-9 h-9 rounded-xl flex items-center justify-center text-xl font-bold transition-colors"
                          style={{ background: "rgba(255,255,255,0.07)", color: "var(--text-secondary)" }}
                        >+</button>
                        <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>unités / semaine</span>
                      </div>
                      <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                        🌍 OMS : ≤ 10 u/sem pour les femmes · ≤ 14 u/sem pour les hommes.
                        1 unité standard = 10 g d'alcool pur.
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Save */}
              <button onClick={handleSave} disabled={saving || saved}
                className="btn btn-primary w-full gap-2" style={{ height: "40px" }}>
                {saved
                  ? <><IconCircleCheck size={14} stroke={2} /> Enregistré !</>
                  : saving
                    ? <><IconLoader2 size={13} stroke={2} className="animate-spin" /> Sauvegarde…</>
                    : <><IconDeviceFloppy size={14} /> Enregistrer</>}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
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
  const [open,       setOpen]       = useState(false);

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

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.12 }}
      className="glass overflow-hidden"
    >
      {/* Collapsible header */}
      <button className="w-full flex items-center justify-between px-5 py-4" onClick={() => setOpen(v => !v)}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0"
            style={{ background: "rgba(167,139,250,0.12)", border: "1px solid rgba(167,139,250,0.2)" }}>
            🎨
          </div>
          <div className="text-left">
            <p className="font-semibold text-[13.5px]" style={{ color: "var(--text-primary)" }}>Graphiques</p>
            <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Apparence &amp; données</p>
          </div>
        </div>
        {open
          ? <IconChevronUp  size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
          : <IconChevronDown size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="chart-prefs-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{ overflow: "hidden" }}
          >
            <div className="px-5 pb-5 space-y-5" style={{ borderTop: "1px solid var(--border)" }}>

              {/* ── Calories chart type ── */}
              <div className="pt-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide mb-2.5" style={{ color: "var(--text-muted)" }}>
                  Tendance calories
                </p>
                <div className="flex gap-2">
                  {CHART_TYPE_OPTIONS.map(opt => (
                    <button key={opt.value} onClick={() => setCalType(opt.value)}
                      className="flex-1 flex flex-col items-center gap-1.5 py-3 rounded-2xl transition-all"
                      style={{
                        background: calType === opt.value ? "rgba(167,139,250,0.15)" : "rgba(255,255,255,0.03)",
                        border: `1.5px solid ${calType === opt.value ? "rgba(167,139,250,0.5)" : "rgba(255,255,255,0.07)"}`,
                      }}>
                      <span style={{ fontSize: 20 }}>{opt.icon}</span>
                      <span className="text-[11px] font-medium"
                        style={{ color: calType === opt.value ? "var(--protein)" : "var(--text-muted)" }}>
                        {opt.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Macros display ── */}
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide mb-2.5" style={{ color: "var(--text-muted)" }}>
                  Affichage macros
                </p>
                <div className="flex gap-2">
                  {MACRO_DISPLAY_OPTIONS.map(opt => (
                    <button key={opt.value} onClick={() => setMacroDisp(opt.value)}
                      className="flex-1 flex flex-col items-center gap-1.5 py-3 rounded-2xl transition-all"
                      style={{
                        background: macroDisp === opt.value ? "rgba(52,211,153,0.12)" : "rgba(255,255,255,0.03)",
                        border: `1.5px solid ${macroDisp === opt.value ? "rgba(52,211,153,0.4)" : "rgba(255,255,255,0.07)"}`,
                      }}>
                      <span style={{ fontSize: 20 }}>{opt.icon}</span>
                      <span className="text-[11px] font-medium"
                        style={{ color: macroDisp === opt.value ? "#34d399" : "var(--text-muted)" }}>
                        {opt.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Weight trend ── */}
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide mb-2.5" style={{ color: "var(--text-muted)" }}>
                  Courbe de poids
                </p>
                <div className="flex gap-2">
                  {CHART_TYPE_OPTIONS.map(opt => (
                    <button key={opt.value} onClick={() => setWtType(opt.value)}
                      className="flex-1 flex flex-col items-center gap-1.5 py-3 rounded-2xl transition-all"
                      style={{
                        background: wtType === opt.value ? "rgba(251,191,36,0.12)" : "rgba(255,255,255,0.03)",
                        border: `1.5px solid ${wtType === opt.value ? "rgba(251,191,36,0.4)" : "rgba(255,255,255,0.07)"}`,
                      }}>
                      <span style={{ fontSize: 20 }}>{opt.icon}</span>
                      <span className="text-[11px] font-medium"
                        style={{ color: wtType === opt.value ? "#fbbf24" : "var(--text-muted)" }}>
                        {opt.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Toggles ── */}
              <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                <button
                  className="w-full flex items-center justify-between px-4 py-3 transition-colors"
                  style={{ background: showMicro ? "rgba(167,139,250,0.06)" : "transparent" }}
                  onClick={() => setShowMicro(v => !v)}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-base">🔬</span>
                    <span className="text-[12.5px]" style={{ color: "var(--text-secondary)" }}>Micro-nutriments</span>
                  </div>
                  <div className="w-10 h-5.5 rounded-full relative flex-shrink-0 transition-all"
                    style={{ background: showMicro ? "var(--protein)" : "rgba(255,255,255,0.12)", height: "22px" }}>
                    <span className="absolute top-[2px] w-[18px] h-[18px] rounded-full transition-all"
                      style={{ background: "#fff", left: showMicro ? "calc(100% - 20px)" : "2px" }} />
                  </div>
                </button>
              </div>

              {/* ── Save ── */}
              <button onClick={handleSave} disabled={saving}
                className="btn btn-primary w-full gap-2 text-[13px]" style={{ height: "42px" }}>
                {saved ? "✓ Préférences sauvegardées" : saving ? <><IconLoader2 size={12} className="animate-spin" /> Sauvegarde…</> : "Appliquer les préférences"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Tracked Nutrients Panel ──────────────────────────────────────────────────

const DEFAULT_TRACKED: TrackedNutrients = { protein: false, sodium: false, sugar: false, saturatedFat: false };

// Références internationales par nutriment
const NUTRIENT_REFS = {
  protein: {
    type: "min" as const,
    unit: "g",
    label: "Protéines",
    emoji: "💪",
    color: "var(--protein)",
    field: "proteinGrams" as const,
    refs: [
      { label: "OMS",   value: 0.8,  per_kg: true,  desc: "0,8 g/kg — minimum recommandé" },
      { label: "EFSA",  value: 0.83, per_kg: true,  desc: "0,83 g/kg — référence européenne" },
      { label: "Sport", value: 1.6,  per_kg: true,  desc: "1,6 g/kg — activité sportive régulière" },
    ],
    note: "Objectif minimum · à augmenter selon l'activité physique",
    typeLabel: "Objectif quotidien",
  },
  sodium: {
    type: "max" as const,
    unit: "mg",
    label: "Sel / Sodium",
    emoji: "🧂",
    color: "#f59e0b",
    field: "sodiumMg" as const,
    refs: [
      { label: "OMS",   value: 2000, per_kg: false, desc: "2 000 mg/j = 5 g de sel — recommandation forte" },
      { label: "EFSA",  value: 2000, per_kg: false, desc: "2 000 mg/j — objectif européen" },
      { label: "FDA",   value: 2300, per_kg: false, desc: "2 300 mg/j — valeur de référence US" },
      { label: "ANSES", value: 1500, per_kg: false, desc: "1 500 mg/j — objectif optimal France" },
    ],
    note: "Maximum à ne pas dépasser · priorité en cas d'HTA",
    typeLabel: "Maximum quotidien",
  },
  sugar: {
    type: "max" as const,
    unit: "g",
    label: "Sucres",
    emoji: "🍬",
    color: "#ec4899",
    field: "sugarGrams" as const,
    refs: [
      { label: "OMS strict", value: 25, per_kg: false, desc: "<25 g/j — idéal (<5% énergie sur 2000 kcal)" },
      { label: "OMS",        value: 50, per_kg: false, desc: "<50 g/j — sucres libres (<10% énergie)" },
      { label: "FDA",        value: 50, per_kg: false, desc: "50 g/j — valeur de référence US" },
    ],
    note: "Sucres libres/ajoutés uniquement · exclut sucres naturels des fruits",
    typeLabel: "Maximum quotidien",
  },
  saturatedFat: {
    type: "max" as const,
    unit: "g",
    label: "Lipides saturés",
    emoji: "🧈",
    color: "var(--fat)",
    field: "saturatedFatGrams" as const,
    refs: [
      { label: "OMS",   value: 22, per_kg: false, desc: "<22 g/j — <10% énergie sur 2000 kcal" },
      { label: "EFSA",  value: 22, per_kg: false, desc: "<10% énergie totale · référence européenne" },
      { label: "FDA",   value: 20, per_kg: false, desc: "20 g/j — valeur de référence US" },
      { label: "ANSES", value: 27, per_kg: false, desc: "<12% énergie · recommandation française" },
    ],
    note: "Viandes grasses, charcuterie, fromage, huile coco/palme",
    typeLabel: "Maximum quotidien",
  },
} as const;

type NutrientKey = keyof typeof NUTRIENT_REFS;

function TrackedNutrientsPanel() {
  const [open,        setOpen]       = useState(false);
  const [tracked,     setTracked]    = useState<TrackedNutrients>(DEFAULT_TRACKED);
  const [chartPrefs,  setChartPrefs] = useState<Record<string, unknown>>({});
  const [goals,       setGoals]      = useState({
    proteinGrams:      50,
    sodiumMg:          2000,
    sugarGrams:        50,
    saturatedFatGrams: 20,
  });
  const [weightKg,  setWeightKg]  = useState<number>(70);
  const [saving,    setSaving]    = useState(false);
  const [saved,     setSaved]     = useState(false);

  useEffect(() => {
    fetch("/api/goals")
      .then(r => r.json())
      .then((d: {
        chartPrefs?: Record<string, unknown> & { trackedNutrients?: TrackedNutrients };
        goals?: { proteinGrams?: number; sodiumMg?: number; sugarGrams?: number; saturatedFatGrams?: number; currentWeightKg?: number; targetWeightKg?: number };
      }) => {
        if (d.chartPrefs) {
          setChartPrefs(d.chartPrefs);
          if (d.chartPrefs.trackedNutrients) setTracked(d.chartPrefs.trackedNutrients);
        }
        setGoals({
          proteinGrams:      d.goals?.proteinGrams      ?? 50,
          sodiumMg:          d.goals?.sodiumMg          ?? 2000,
          sugarGrams:        d.goals?.sugarGrams        ?? 50,
          saturatedFatGrams: d.goals?.saturatedFatGrams ?? 20,
        });
        const w = d.goals?.currentWeightKg ?? d.goals?.targetWeightKg ?? 70;
        if (w) setWeightKg(w);
      })
      .catch(() => {});
  }, []);

  const toggle = (key: keyof TrackedNutrients) =>
    setTracked(prev => ({ ...prev, [key]: !prev[key] }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch("/api/goals", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proteinGrams:      goals.proteinGrams,
          sodiumMg:          goals.sodiumMg,
          sugarGrams:        goals.sugarGrams,
          saturatedFatGrams: goals.saturatedFatGrams,
        }),
      });
      await fetch("/api/goals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chartPrefs: { ...chartPrefs, trackedNutrients: tracked } }),
      });
      setSaved(true);
      setTimeout(() => { setSaved(false); setOpen(false); }, 1200);
    } finally { setSaving(false); }
  };

  const activeCount = Object.values(tracked).filter(Boolean).length;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.07 }} className="glass p-4 mb-4">

      {/* Header */}
      <button className="w-full flex items-center gap-3" onClick={() => setOpen(v => !v)}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0"
          style={{ background: "rgba(236,72,153,0.12)" }}>🔬</div>
        <div className="flex-1 min-w-0 text-left">
          <p className="font-semibold text-[13.5px]" style={{ color: "var(--text-primary)" }}>Suivi nutritionnel avancé</p>
          <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            {activeCount === 0
              ? "OMS · EFSA · FDA · ANSES — activez les paramètres"
              : `${activeCount} paramètre${activeCount > 1 ? "s" : ""} actif${activeCount > 1 ? "s" : ""} · références internationales`}
          </p>
        </div>
        {open ? <IconChevronUp size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
               : <IconChevronDown size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />}
      </button>

      <AnimatePresence initial={false}>
      {open && (
      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
        exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }} style={{ overflow: "hidden" }}>
        <div className="mt-4 space-y-3">

          {/* Source badge */}
          <div className="flex items-center gap-1.5 flex-wrap px-1">
            {(["OMS", "EFSA", "FDA", "ANSES"] as const).map(org => (
              <span key={org} className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
                {org}
              </span>
            ))}
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>Références internationales</span>
          </div>

          {(Object.keys(NUTRIENT_REFS) as NutrientKey[]).map((key) => {
            const cfg = NUTRIENT_REFS[key];
            const isActive = tracked[key as keyof TrackedNutrients];
            const currentVal = goals[cfg.field];
            const isMax = cfg.type === "max";

            // Compute preset value for per_kg refs
            const presetVal = (ref: typeof cfg.refs[number]) =>
              ref.per_kg ? Math.round(ref.value * weightKg) : ref.value;

            // Reference range for bar indicator
            const maxRef = Math.max(...cfg.refs.map(r => presetVal(r)));

            return (
              <div key={key} className="rounded-xl overflow-hidden"
                style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${isActive ? "rgba(255,255,255,0.12)" : "var(--border)"}` }}>

                {/* Row header */}
                <div className="flex items-center gap-3 px-3 py-2.5">
                  <span className="text-base">{cfg.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>{cfg.label}</p>
                    <p className="text-[9px]" style={{ color: isMax ? "#f87171" : "#a78bfa" }}>
                      {isMax ? "MAX recommandé" : "MIN recommandé"}
                    </p>
                  </div>
                  {/* Toggle */}
                  <button onClick={() => toggle(key as keyof TrackedNutrients)}
                    className="relative flex-shrink-0 w-[44px] h-[24px] rounded-full transition-all"
                    style={{ background: isActive ? cfg.color : "rgba(255,255,255,0.1)", border: "1px solid var(--border)" }}>
                    <span className="absolute top-[2px] w-[18px] h-[18px] rounded-full transition-all"
                      style={{ background: "#fff", left: isActive ? "calc(100% - 20px)" : "2px", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
                  </button>
                </div>

                {/* Expanded content when active */}
                <AnimatePresence initial={false}>
                {isActive && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }} style={{ overflow: "hidden" }}>
                    <div className="px-3 pb-3 space-y-3"
                      style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>

                      {/* Reference presets */}
                      <div>
                        <p className="text-[9px] uppercase tracking-wide mt-2.5 mb-1.5 font-semibold"
                          style={{ color: "var(--text-muted)" }}>Références</p>
                        <div className="flex flex-col gap-1">
                          {cfg.refs.map((ref, i) => {
                            const val = presetVal(ref);
                            const isSelected = currentVal === val;
                            return (
                              <button key={i}
                                onClick={() => setGoals(prev => ({ ...prev, [cfg.field]: val }))}
                                className="flex items-center justify-between px-2.5 py-2 rounded-lg text-left transition-all"
                                style={{
                                  background: isSelected ? `${cfg.color}18` : "rgba(255,255,255,0.03)",
                                  border: `1px solid ${isSelected ? cfg.color : "var(--border)"}`,
                                }}>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                                    style={{
                                      background: isSelected ? `${cfg.color}25` : "rgba(255,255,255,0.06)",
                                      color: isSelected ? cfg.color : "var(--text-muted)",
                                      border: `1px solid ${isSelected ? cfg.color : "var(--border)"}`,
                                      minWidth: "44px",
                                      textAlign: "center",
                                    }}>
                                    {ref.label}
                                  </span>
                                  <span className="text-[10px]" style={{ color: "var(--text-secondary)" }}>{ref.desc}</span>
                                </div>
                                <span className="text-[12px] font-bold tabular-nums flex-shrink-0 ml-2"
                                  style={{ color: isSelected ? cfg.color : "var(--text-primary)" }}>
                                  {val} <span className="text-[9px] font-normal" style={{ color: "var(--text-muted)" }}>{cfg.unit}</span>
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Note */}
                      <p className="text-[10px] italic px-0.5" style={{ color: "var(--text-muted)" }}>
                        {cfg.note}
                        {key === "protein" && weightKg && <span> · basé sur {weightKg} kg</span>}
                      </p>

                      {/* Custom input */}
                      <div className="flex items-center gap-2">
                        <p className="text-[11px] flex-1" style={{ color: "var(--text-secondary)" }}>
                          {cfg.typeLabel}
                        </p>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            value={currentVal}
                            onChange={e => setGoals(prev => ({ ...prev, [cfg.field]: Number(e.target.value) }))}
                            className="w-20 h-8 rounded-lg text-center text-[13px] font-medium"
                            style={{
                              background: "rgba(255,255,255,0.06)",
                              border: `1px solid ${cfg.color}`,
                              color: "var(--text-primary)",
                            }}
                          />
                          <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{cfg.unit}</span>
                        </div>
                      </div>

                      {/* Visual bar */}
                      <div>
                        <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                          <div className="h-full rounded-full transition-all" style={{
                            width: `${Math.min(currentVal / (maxRef * 1.3) * 100, 100)}%`,
                            background: isMax && currentVal > maxRef ? "#ef4444" : cfg.color,
                          }} />
                        </div>
                        <div className="flex justify-between text-[8px] mt-1" style={{ color: "var(--text-muted)" }}>
                          <span>0</span>
                          <span>Objectif : {currentVal} {cfg.unit}</span>
                          <span>Réf. max : {maxRef} {cfg.unit}</span>
                        </div>
                      </div>

                    </div>
                  </motion.div>
                )}
                </AnimatePresence>
              </div>
            );
          })}

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-semibold transition-all"
            style={{
              background: saved ? "rgba(34,197,94,0.12)" : "linear-gradient(135deg,rgba(236,72,153,0.15),rgba(168,85,247,0.12))",
              border: `1px solid ${saved ? "rgba(34,197,94,0.4)" : "rgba(236,72,153,0.3)"}`,
              color: saved ? "#22c55e" : "#ec4899",
            }}
          >
            {saving ? <IconLoader2 size={13} className="animate-spin" /> : saved ? <IconCircleCheck size={13} /> : <IconDeviceFloppy size={13} />}
            {saved ? "Enregistré !" : "Enregistrer"}
          </button>
        </div>
      </motion.div>
      )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Export Panel ─────────────────────────────────────────────────────────────

function ExportPanel() {
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

const RESET_OPTIONS = [
  { key: "calories", label: "Journal alimentaire", desc: "Toutes les entrées repas", emoji: "🍽️" },
  { key: "sports",   label: "Activités sportives", desc: "Séances manuelles",        emoji: "🏃" },
  { key: "sleep",    label: "Données de sommeil",  desc: "Historique Google Fit",    emoji: "🌙" },
] as const;

function ResetPanel() {
  const [open,     setOpen]     = useState(false);
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
      className="glass mt-4 overflow-hidden"
    >
      {/* Header (toggle) */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 p-5 text-left"
        style={{ background: "transparent" }}
      >
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(248,113,113,0.1)" }}>
          <IconTrash size={17} style={{ color: "#f87171" }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-[14px]" style={{ color: "var(--text-primary)" }}>Remise à zéro</p>
          <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>Supprimer des données définitivement</p>
        </div>
        <IconChevronDown
          size={16}
          style={{ color: "var(--text-muted)", transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.25s" }}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="reset-content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{ overflow: "hidden" }}
          >
            <div className="px-5 pb-5">

      {done && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg mb-3 text-[12px]"
          style={{ background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.2)", color: "var(--fiber)" }}>
          <IconCircleCheck size={13} />
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
                {checked && <IconCircleCheck size={13} color="#fff" />}
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
          <IconTrash size={13} />
          Réinitialiser ({selected.size} sélectionné{selected.size > 1 ? "s" : ""})
        </button>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-[12px]"
            style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.25)" }}>
            <IconAlertCircle size={14} style={{ color: "#f87171" }} />
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
              {resetting ? <><IconLoader2 size={12} className="animate-spin" /> Suppression…</> : <><IconTrash size={12} /> Confirmer</>}
            </button>
          </div>
        </div>
      )}

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Fasting Panel ────────────────────────────────────────────────────────────

const FASTING_DURATIONS: { h: 8 | 12 | 16 | 24; label: string; desc: string }[] = [
  { h: 8,  label: "8h",  desc: "Sauté" },
  { h: 12, label: "12h", desc: "Léger" },
  { h: 16, label: "16h", desc: "16:8" },
  { h: 24, label: "24h", desc: "Complet" },
];

const WEEK_DAYS = [
  { dow: 1, short: "L" },
  { dow: 2, short: "M" },
  { dow: 3, short: "M" },
  { dow: 4, short: "J" },
  { dow: 5, short: "V" },
  { dow: 6, short: "S" },
  { dow: 0, short: "D" },
];

function FastingPanel() {
  const [open,      setOpen]      = useState(false);
  const [enabled,   setEnabled]   = useState(false);
  const [duration,  setDuration]  = useState<8 | 12 | 16 | 24>(16);
  const [days,      setDays]      = useState<number[]>([1, 2, 3, 4, 5]);
  const [saving,    setSaving]    = useState(false);
  const [saved,     setSaved]     = useState(false);

  useEffect(() => {
    fetch("/api/goals")
      .then(r => r.json())
      .then((d: { goals?: { intermittentFasting?: { enabled: boolean; durationH: 8|12|16|24; days: number[] } } }) => {
        const f = d.goals?.intermittentFasting;
        if (f) {
          setEnabled(f.enabled);
          setDuration(f.durationH);
          setDays(f.days);
        }
      })
      .catch(() => {});
  }, []);

  const toggleDay = (dow: number) => {
    setDays(prev => prev.includes(dow) ? prev.filter(d => d !== dow) : [...prev, dow].sort());
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch("/api/goals", {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          intermittentFasting: { enabled, durationH: duration, days },
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally { setSaving(false); }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.13 }}
      className="glass overflow-hidden"
    >
      {/* Collapsible header */}
      <button className="w-full flex items-center justify-between px-5 py-4" onClick={() => setOpen(v => !v)}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0"
            style={{ background: "rgba(129,140,248,0.12)", border: "1px solid rgba(129,140,248,0.22)" }}>
            🌿
          </div>
          <div className="text-left">
            <p className="font-semibold text-[13.5px]" style={{ color: "var(--text-primary)" }}>Jeûne Intermittent</p>
            <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
              {enabled ? `${duration}h · ${days.length} jour${days.length > 1 ? "s" : ""}/sem` : "Désactivé"}
            </p>
          </div>
        </div>
        {open
          ? <IconChevronUp  size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
          : <IconChevronDown size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 space-y-5" style={{ borderTop: "1px solid var(--border)" }}>

              {/* Toggle */}
              <div className="flex items-center justify-between pt-4">
                <div>
                  <p className="text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>Activer</p>
                  <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                    Affiche un chrono sur le dashboard et le journal
                  </p>
                </div>
                <button
                  onClick={() => setEnabled(v => !v)}
                  className="relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0"
                  style={{
                    background: enabled ? "#818cf8" : "rgba(255,255,255,0.1)",
                    border: "1px solid rgba(255,255,255,0.1)",
                  }}
                >
                  <span
                    className="absolute top-0.5 rounded-full bg-white transition-all duration-200"
                    style={{
                      width: 20, height: 20,
                      left: enabled ? "calc(100% - 22px)" : "2px",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                    }}
                  />
                </button>
              </div>

              {enabled && (
                <>
                  {/* Duration */}
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>
                      Durée du jeûne
                    </p>
                    <div className="grid grid-cols-4 gap-2">
                      {FASTING_DURATIONS.map(({ h, label, desc }) => (
                        <button
                          key={h}
                          onClick={() => setDuration(h)}
                          className="flex flex-col items-center gap-1 py-3 rounded-2xl transition-all"
                          style={{
                            background: duration === h ? "rgba(129,140,248,0.18)" : "rgba(255,255,255,0.04)",
                            border: `1.5px solid ${duration === h ? "#818cf8" : "rgba(255,255,255,0.07)"}`,
                            boxShadow: duration === h ? "0 0 12px rgba(129,140,248,0.2)" : "none",
                          }}
                        >
                          <span className="text-[16px] font-bold"
                            style={{ color: duration === h ? "#818cf8" : "var(--text-primary)" }}>
                            {label}
                          </span>
                          <span className="text-[9px]"
                            style={{ color: duration === h ? "#818cf8" : "var(--text-muted)" }}>
                            {desc}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Days of week */}
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>
                      Jours de la semaine
                    </p>
                    <div className="flex justify-between gap-1.5">
                      {WEEK_DAYS.map(({ dow, short }) => {
                        const on = days.includes(dow);
                        return (
                          <button
                            key={dow}
                            onClick={() => toggleDay(dow)}
                            className="flex-1 h-10 rounded-xl text-[12px] font-bold transition-all"
                            style={{
                              background: on ? "rgba(129,140,248,0.18)" : "rgba(255,255,255,0.04)",
                              color:      on ? "#818cf8" : "var(--text-muted)",
                              border:     `1.5px solid ${on ? "#818cf8" : "rgba(255,255,255,0.07)"}`,
                            }}
                          >
                            {short}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[10px] mt-2" style={{ color: "var(--text-muted)" }}>
                      {days.length === 0
                        ? "Aucun jour sélectionné"
                        : `${days.length} jour${days.length > 1 ? "s" : ""} par semaine`}
                    </p>
                  </div>
                </>
              )}

              {/* Save */}
              <button onClick={handleSave} disabled={saving || saved} className="btn btn-primary w-full gap-2" style={{ height: "40px" }}>
                {saved   ? <><IconCircleCheck size={14} stroke={2} /> Enregistré !</>
                 : saving ? <><IconLoader2 size={13} stroke={2} className="animate-spin" /> Sauvegarde…</>
                 : <><IconDeviceFloppy size={14} /> Enregistrer</>}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ─── Theme Picker ─────────────────────────────────────────────────────────── */

const THEME_DEFS: {
  id: Theme;
  name: string;
  desc: string;
  bg: string;
  surface: string;
  accent: string;
  nav: string;
  protein: string;
  carbs: string;
  fat: string;
  radius: string;
}[] = [
  {
    id: "cosmos",
    name: "Cosmos",
    desc: "Sombre & épuré",
    bg: "#09090b",
    surface: "#1c1c21",
    accent: "#a78bfa",
    nav: "#09090b",
    protein: "#a78bfa",
    carbs: "#fbbf24",
    fat: "#60a5fa",
    radius: "10px",
  },
  {
    id: "lumiere",
    name: "Lumière",
    desc: "Clair & aéré",
    bg: "#f7f8fa",
    surface: "#ffffff",
    accent: "#7c3aed",
    nav: "#f7f8fa",
    protein: "#7c3aed",
    carbs: "#d97706",
    fat: "#2563eb",
    radius: "10px",
  },
  {
    id: "mfp",
    name: "MFP Style",
    desc: "MyFitnessPal",
    bg: "#F2F2F2",
    surface: "#FFFFFF",
    accent: "#00A86B",
    nav: "#FFFFFF",
    protein: "#00A86B",
    carbs: "#FF9800",
    fat: "#F44336",
    radius: "5px",
  },
  {
    id: "ocean",
    name: "Océan",
    desc: "Marine & cyan",
    bg: "#0A1628",
    surface: "#0f2040",
    accent: "#00BCD4",
    nav: "#0A1628",
    protein: "#26C6DA",
    carbs: "#FFCA28",
    fat: "#42A5F5",
    radius: "10px",
  },
];

function ThemePreview({ t, selected }: { t: typeof THEME_DEFS[number]; selected: boolean }) {
  return (
    <div
      className="relative rounded-xl overflow-hidden flex flex-col"
      style={{
        background: t.bg,
        border: selected ? `2px solid ${t.accent}` : "2px solid transparent",
        height: 90,
        boxShadow: selected ? `0 0 0 3px ${t.accent}28` : "none",
        transition: "border-color 0.2s, box-shadow 0.2s",
      }}
    >
      {/* Page content mock */}
      <div className="flex-1 flex flex-col gap-1 p-1.5">
        {/* Card */}
        <div
          style={{
            background: t.surface,
            borderRadius: t.radius,
            padding: "4px 6px",
            border: `1px solid ${t.bg === "#F2F2F2" || t.bg === "#f4f4f8" ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.07)"}`,
          }}
        >
          {/* Mini chart bars */}
          <div className="flex items-end gap-0.5" style={{ height: 16 }}>
            {[0.5, 0.8, 0.6, 1.0, 0.75, 0.9, 0.65].map((h, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: `${h * 100}%`,
                  background: i === 3 ? t.accent : `${t.accent}50`,
                  borderRadius: "2px 2px 0 0",
                }}
              />
            ))}
          </div>
        </div>
        {/* Macro dots */}
        <div className="flex gap-1 px-0.5">
          {[t.protein, t.carbs, t.fat].map((c, i) => (
            <div key={i} style={{ width: 18, height: 4, borderRadius: 2, background: c, opacity: 0.9 }} />
          ))}
        </div>
      </div>
      {/* Nav bar mock */}
      <div
        style={{
          background: t.nav,
          borderTop: `1px solid ${t.bg === "#F2F2F2" || t.bg === "#f4f4f8" || t.nav === "#FFFFFF" ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.06)"}`,
          height: 16,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-around",
          paddingInline: 6,
        }}
      >
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: i === 0 ? t.accent : (t.bg === "#F2F2F2" || t.bg === "#f4f4f8" || t.nav === "#FFFFFF" ? "rgba(0,0,0,0.20)" : "rgba(255,255,255,0.25)"),
            }}
          />
        ))}
      </div>
      {/* Selected checkmark */}
      {selected && (
        <div
          className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center"
          style={{ background: t.accent }}
        >
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
            <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      )}
    </div>
  );
}

function ThemePicker({ current, onChange }: { current: Theme; onChange: (t: Theme) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.03 }}
      className="glass overflow-hidden mb-4 mt-4"
    >
      {/* Collapsible header */}
      <button
        className="w-full flex items-center justify-between px-4 py-3"
        onClick={() => setOpen(v => !v)}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(139,92,246,0.12)" }}
          >
            <IconSun size={15} style={{ color: "#a78bfa" }} />
          </div>
          <div className="text-left">
            <p className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>Apparence</p>
            <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
              {THEME_DEFS.find(t => t.id === current)?.name ?? "Thème actuel"}
            </p>
          </div>
        </div>
        {open
          ? <IconChevronUp  size={14} style={{ color: "var(--text-muted)" }} />
          : <IconChevronDown size={14} style={{ color: "var(--text-muted)" }} />}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="theme-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            {/* 2×2 grid */}
            <div className="grid grid-cols-2 gap-2.5 px-4 pb-4" style={{ borderTop: "1px solid var(--border)" }}>
              {THEME_DEFS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => { onChange(t.id); setOpen(false); }}
                  className="text-left pt-3"
                  style={{ outline: "none" }}
                >
                  <ThemePreview t={t} selected={current === t.id} />
                  <div className="mt-1.5 px-0.5">
                    <p
                      className="text-[12px] font-semibold leading-tight"
                      style={{ color: current === t.id ? "var(--text-primary)" : "var(--text-secondary)" }}
                    >
                      {t.name}
                    </p>
                    <p className="text-[10px] leading-tight" style={{ color: "var(--text-muted)" }}>
                      {t.desc}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
