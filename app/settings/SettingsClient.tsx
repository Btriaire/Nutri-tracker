"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { IconCircleCheck, IconCircleX, IconRefresh, IconBolt, IconLoader2, IconDatabase, IconChevronDown, IconChevronUp, IconAlertCircle, IconLogout, IconFileTypePdf, IconPill, IconApple, IconChevronRight } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { getClientAuth } from "@/app/lib/firebase-client";
import { useTheme } from "@/app/components/ThemeProvider";
import { format, subYears, startOfYear, endOfYear, getYear } from "date-fns";
import type { NutritionGoals } from "@/app/lib/types";
import SupplementConfig from "@/app/components/SupplementConfig";
import AppleHealthPanel from "@/app/components/AppleHealthPanel";
import IntegrationsHealthPanel from "@/app/components/IntegrationsHealthPanel";
import GoalsPanel from "./panels/GoalsPanel";
import DataSafetyBanner from "./panels/DataSafetyBanner";
import ProfilePanel from "./panels/ProfilePanel";
import AlcoolPanel from "./panels/AlcoolPanel";
import ChartPrefsPanel from "./panels/ChartPrefsPanel";
import TrackedNutrientsPanel from "./panels/TrackedNutrientsPanel";
import DietProgramPanel from "./panels/DietProgramPanel";
import ExportPanel from "./panels/ExportPanel";
import ResetPanel from "./panels/ResetPanel";
import FastingPanel from "./panels/FastingPanel";
import ThemePicker from "./panels/ThemePicker";
import type { IntegrationHealth } from "@/app/lib/integrations-health";

type OAuthStatus = "connected" | "needs_reauth" | "disconnected";

interface Props {
  fitConnected:       OAuthStatus;
  withingsConnected:  OAuthStatus;
  initialGoals:       NutritionGoals;
  initialPhotoUrl?:   string;
  initialDisplayName?: string;
  initialIntegrations: IntegrationHealth[];
}

interface YearProgress { year: number; status: "pending" | "running" | "done" | "error"; days?: number }

export default function SettingsClient({ fitConnected: initialFit, withingsConnected: initialWithings, initialGoals, initialPhotoUrl, initialDisplayName, initialIntegrations }: Props) {
  const router = useRouter();

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    try { await signOut(getClientAuth()); } catch {}
    router.push("/login");
  };

  // iOS standalone PWAs: a direct <a href> tap to account.withings.com gets hijacked by
  // Universal Links (opens the native Withings app instead of completing the web OAuth
  // flow). Navigating via JS from a click handler avoids the tap-triggered UL interception.
  const openWithingsAuth = () => {
    window.location.href = "/api/withings/auth";
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
  const [supplementsOpen, setSupplementsOpen] = useState(false);
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
          <p className="label-xs mb-0.5 hidden md:block">Compte</p>
          <div className="flex items-center justify-end md:justify-between mb-6">
            <h1 className="text-[22px] font-semibold tracking-tight hidden md:block" style={{ color: "var(--text-primary)" }}>
              Réglages
            </h1>
            <Link href="/report"
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-semibold transition-all"
              style={{
                background: "linear-gradient(135deg,rgba(249,115,22,0.12),rgba(251,191,36,0.10))",
                border: "1px solid rgba(249,115,22,0.35)",
                color: "var(--calories)",
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

        {/* Ma banque d'aliments */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.04 }}
          className="glass p-5 mb-4"
        >
          <Link href="/food-bank" className="w-full flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
              style={{ background: "linear-gradient(135deg, rgba(167,139,250,0.9), rgba(129,140,248,0.9))" }}>
              <IconApple size={18} color="white" />
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="font-semibold text-[14px]" style={{ color: "var(--text-primary)" }}>Ma banque d&apos;aliments</p>
              <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>Tout ce que tu manges, classé par catégorie</p>
            </div>
            <IconChevronRight size={16} style={{ color: "var(--text-muted)" }} />
          </Link>
        </motion.div>

        {/* Suppléments & Compléments */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="glass p-5 mb-4"
        >
          <button className="w-full flex items-center gap-3" onClick={() => setSupplementsOpen(v => !v)}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
              style={{ background: "linear-gradient(135deg, rgba(52,211,153,0.9), rgba(34,197,94,0.9))" }}>
              <IconPill size={18} color="white" />
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="font-semibold text-[14px]" style={{ color: "var(--text-primary)" }}>Suppléments & Compléments</p>
              <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>Produits, dosages, micronutriments</p>
            </div>
            {supplementsOpen ? <IconChevronUp size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} /> : <IconChevronDown size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />}
          </button>

          <AnimatePresence initial={false}>
            {supplementsOpen && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }} style={{ overflow: "hidden" }}>
                <div className="mt-4">
                  <SupplementConfig />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Theme picker */}
        <ThemePicker current={theme} onChange={setTheme} />

        {/* État des synchros — en tête de la zone intégrations, pour voir tout de
            suite si une source a cessé d'envoyer des données */}
        <IntegrationsHealthPanel initial={initialIntegrations} />

        {/* Apple Health card */}
        <AppleHealthPanel />

        {/* Google Fit card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="glass p-5 mb-4"
        >
          <button className="w-full flex items-center gap-3" onClick={() => setFitOpen(v => !v)}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
              style={{ background: "linear-gradient(135deg, var(--fit-blue) 0%, var(--fit-green) 50%, var(--fit-red) 100%)" }}>
              <IconBolt size={18} color="white" />
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="font-semibold text-[14px]" style={{ color: "var(--text-primary)" }}>Google Fit</p>
              <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>Pas · Calories · Sommeil · Poids · Séances</p>
            </div>
            {fit === "connected"    && <IconCircleCheck size={18} style={{ color: "var(--fiber)",    flexShrink: 0 }} />}
            {fit === "needs_reauth" && <IconAlertCircle  size={18} style={{ color: "var(--warn)",       flexShrink: 0 }} />}
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
                  <IconAlertCircle size={14} style={{ color: "var(--warn)", flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <p className="text-[12px] font-semibold" style={{ color: "var(--warn)" }}>Reconnexion requise</p>
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
                  Aujourd&apos;hui
                </button>
                <button onClick={handleSyncHistory} disabled={syncingHistory}
                  className="btn btn-ghost flex-1 gap-1.5 text-[12px]">
                  {syncingHistory ? <IconLoader2 size={12} className="animate-spin" /> : <IconRefresh size={12} />}
                  90 jours
                </button>
                <button onClick={handleDisconnect} disabled={disconnecting}
                  className="btn btn-ghost text-[12px] px-3"
                  style={{ color: "var(--danger)", borderColor: "rgba(248,113,113,0.3)" }}>
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
                    Synchroniser tout l&apos;historique
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
                            Remonter jusqu&apos;à {new Date().getFullYear() - yearsBack + 1}
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
                                  {p.status === "error"   && <IconCircleX     size={11} style={{ color: "var(--danger)" }} />}
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
                                  <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{p.days} j</span>
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

                        <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                          Traitement année par année — chaque appel peut prendre jusqu&apos;à 30s.
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
            {withings === "needs_reauth" && <IconAlertCircle size={18} style={{ color: "var(--warn)",           flexShrink: 0 }} />}
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
                  <IconAlertCircle size={14} style={{ color: "var(--warn)", flexShrink: 0, marginTop: 1 }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold" style={{ color: "var(--warn)" }}>Reconnexion requise</p>
                    <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>Le token a expiré ou a été révoqué.</p>
                  </div>
                  <button type="button" onClick={openWithingsAuth}
                    className="flex-shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all"
                    style={{ background: "rgba(245,158,11,0.20)", color: "var(--warn)", border: "1px solid rgba(245,158,11,0.40)" }}>
                    Reconnecter
                  </button>
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
                  Aujourd&apos;hui
                </button>
                <button onClick={() => handleWithingsSync(90)} disabled={wSyncing}
                  className="btn btn-ghost flex-1 gap-1.5 text-[12px]">
                  {wSyncing ? <IconLoader2 size={12} className="animate-spin" /> : <IconRefresh size={12} />}
                  90 jours
                </button>
                <button onClick={handleWithingsDisconnect} disabled={wDisconnecting}
                  className="btn btn-ghost text-[12px] px-3"
                  style={{ color: "var(--danger)", borderColor: "rgba(248,113,113,0.3)" }}>
                  {wDisconnecting ? <IconLoader2 size={12} className="animate-spin" /> : "Déconnecter"}
                </button>
              </div>

              {/* Debug button */}
              <button onClick={handleWithingsDebug} disabled={wDebug}
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-medium transition-all"
                style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.25)", color: "var(--carbs)" }}>
                {wDebug
                  ? <><IconLoader2 size={11} className="animate-spin" /> Diagnostic en cours…</>
                  : <>🔍 Diagnostic Withings — voir ce que l&apos;API renvoie</>}
              </button>

              {wDebugRes && (
                <div className="rounded-xl p-3 overflow-x-auto"
                  style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(251,191,36,0.2)" }}>
                  <pre className="text-[11px] leading-relaxed whitespace-pre-wrap"
                    style={{ color: "var(--carbs)", fontFamily: "monospace" }}>
                    {wDebugRes}
                  </pre>
                </div>
              )}
            </div>
          ) : (
            <button type="button" onClick={openWithingsAuth} className="btn btn-primary w-full gap-2 text-[13px]" style={{ height: "40px", background: "linear-gradient(135deg,#0096ff,#00c8b4)", border: "none" }}>
              ⚖️ Connecter Withings
            </button>
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

        {/* Programme diététique prescrit */}
        <DietProgramPanel />

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
              color: "var(--danger)",
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
