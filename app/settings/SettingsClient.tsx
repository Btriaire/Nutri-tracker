"use client";

import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { IconCircleCheck, IconCircleX, IconRefresh, IconBolt, IconLoader2, IconDatabase, IconChevronDown, IconChevronUp, IconTrash, IconAlertCircle, IconSun, IconUser, IconDeviceFloppy, IconLogout, IconFileTypePdf, IconPill, IconApple, IconChevronRight } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { getClientAuth } from "@/app/lib/firebase-client";
import { useTheme, type Theme } from "@/app/components/ThemeProvider";
import { format, subYears, startOfYear, endOfYear, getYear } from "date-fns";
import type { NutritionGoals, TrackedNutrients, DietProgramPrefs, DietProgramId, MealType } from "@/app/lib/types";
import {
  DIET_PROGRAMS, dietMealSummary, DIET_INTERDITS_SUMMARY,
  APPROVED_FRUITS_SUMMARY, FORBIDDEN_FRUITS_SUMMARY,
  CHOLESTEROL_FAVORISER_SUMMARY, CHOLESTEROL_LIMITER_SUMMARY,
  resolveDietProgramId,
} from "@/app/lib/diet-program";
import SupplementConfig from "@/app/components/SupplementConfig";
import AppleHealthPanel from "@/app/components/AppleHealthPanel";
import IntegrationsHealthPanel from "@/app/components/IntegrationsHealthPanel";
import GoalsPanel from "./panels/GoalsPanel";
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
                  Aujourd&apos;hui
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
                  <button type="button" onClick={openWithingsAuth}
                    className="flex-shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all"
                    style={{ background: "rgba(245,158,11,0.20)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.40)" }}>
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
            Aide à contextualiser le niveau d&apos;activité et le stress
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
                        1 unité standard = 10 g d&apos;alcool pur.
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

// ─── Programme diététique ───────────────────────────────────────────────────

const DIET_MEAL_ORDER: MealType[] = ["breakfast", "lunch", "snacks", "dinner"];
const DIET_MEAL_LABEL: Record<MealType, string> = {
  breakfast: "Petit-déjeuner",
  lunch:     "Déjeuner",
  snacks:    "Goûter",
  dinner:    "Dîner",
};

const DIET_PROGRAM_OPTIONS: { id: DietProgramId | null; label: string }[] = [
  { id: null,          label: "Aucun" },
  { id: "tl",          label: DIET_PROGRAMS.tl.name },
  { id: "cholesterol", label: DIET_PROGRAMS.cholesterol.name },
];

function DietProgramPanel() {
  const [open,      setOpen]      = useState(false);
  const [programId, setProgramId] = useState<DietProgramId | null>(null);
  const [saving,    setSaving]    = useState(false);
  const [saved,     setSaved]     = useState(false);

  useEffect(() => {
    fetch("/api/goals")
      .then(r => r.json())
      .then((d: { dietProgram?: DietProgramPrefs | null }) => {
        setProgramId(resolveDietProgramId(d.dietProgram));
      })
      .catch(() => {});
  }, []);

  const handleSelect = async (next: DietProgramId | null) => {
    setProgramId(next);
    setSaving(true);
    try {
      await fetch("/api/goals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dietProgram: { programId: next, enabled: next === "tl" } as DietProgramPrefs }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 1200);
    } finally { setSaving(false); }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.075 }} className="glass p-4 mb-4">

      {/* Header */}
      <button className="w-full flex items-center gap-3" onClick={() => setOpen(v => !v)}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0"
          style={{ background: "rgba(56,189,248,0.12)" }}>{programId ? DIET_PROGRAMS[programId].icon : "🍽️"}</div>
        <div className="flex-1 min-w-0 text-left">
          <p className="font-semibold text-[13.5px]" style={{ color: "var(--text-primary)" }}>Programme diététique</p>
          <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            {programId ? `${DIET_PROGRAMS[programId].name} — actif` : "Aucun régime actif"}
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

          {/* Sélecteur de programme */}
          <div className="flex gap-1.5 flex-wrap">
            {DIET_PROGRAM_OPTIONS.map(({ id, label }) => {
              const active = programId === id;
              return (
                <button key={label} onClick={() => !saving && handleSelect(id)} disabled={saving}
                  className="px-3 py-1.5 rounded-full text-[11.5px] font-medium transition-all"
                  style={{
                    background: active ? "rgba(56,189,248,0.15)" : "rgba(255,255,255,0.04)",
                    border:     active ? "1px solid rgba(56,189,248,0.5)" : "1px solid var(--border)",
                    color:      active ? "#38bdf8" : "var(--text-muted)",
                  }}>
                  {label}
                </button>
              );
            })}
          </div>

          {saved && (
            <p className="text-[11px] flex items-center gap-1.5 px-1" style={{ color: "#22c55e" }}>
              <IconCircleCheck size={13} /> Enregistré
            </p>
          )}

          {programId === "tl" && (
            <>
              {/* Repères par repas */}
              <div>
                <p className="text-[9px] uppercase tracking-wide mb-1.5 font-semibold" style={{ color: "var(--text-muted)" }}>
                  Repères par repas
                </p>
                <div className="space-y-1.5">
                  {DIET_MEAL_ORDER.map((meal) => (
                    <div key={meal} className="px-3 py-2 rounded-lg"
                      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
                      <p className="text-[11px] font-semibold mb-0.5" style={{ color: "var(--text-primary)" }}>{DIET_MEAL_LABEL[meal]}</p>
                      <p className="text-[10.5px]" style={{ color: "var(--text-secondary)" }}>{dietMealSummary(meal)}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Fruits autorisés */}
              <div>
                <p className="text-[9px] uppercase tracking-wide mb-1.5 font-semibold" style={{ color: "var(--text-muted)" }}>
                  Fruits autorisés
                </p>
                <p className="text-[10.5px] px-0.5" style={{ color: "var(--text-secondary)" }}>
                  {APPROVED_FRUITS_SUMMARY}
                </p>
              </div>

              {/* Fruits interdits */}
              <div>
                <p className="text-[9px] uppercase tracking-wide mb-1.5 font-semibold" style={{ color: "var(--text-muted)" }}>
                  Fruits interdits
                </p>
                <p className="text-[10.5px] px-0.5" style={{ color: "var(--text-secondary)" }}>
                  {FORBIDDEN_FRUITS_SUMMARY}
                </p>
              </div>

              {/* Interdits */}
              <div>
                <p className="text-[9px] uppercase tracking-wide mb-1.5 font-semibold" style={{ color: "var(--text-muted)" }}>
                  Interdits (tous repas)
                </p>
                <p className="text-[10.5px] px-0.5" style={{ color: "var(--text-secondary)" }}>
                  {DIET_INTERDITS_SUMMARY}
                </p>
              </div>

              <p className="text-[9px] italic px-0.5" style={{ color: "var(--text-muted)" }}>
                Détection automatique par mots-clés sur le nom des aliments — vérifiez toujours
                visuellement, ce n&apos;est pas un contrôle médical.
              </p>
            </>
          )}

          {programId === "cholesterol" && (
            <>
              <div>
                <p className="text-[9px] uppercase tracking-wide mb-1.5 font-semibold" style={{ color: "var(--text-muted)" }}>
                  À favoriser
                </p>
                <p className="text-[10.5px] px-0.5" style={{ color: "var(--text-secondary)" }}>
                  {CHOLESTEROL_FAVORISER_SUMMARY}
                </p>
              </div>

              <div>
                <p className="text-[9px] uppercase tracking-wide mb-1.5 font-semibold" style={{ color: "var(--text-muted)" }}>
                  À limiter
                </p>
                <p className="text-[10.5px] px-0.5" style={{ color: "var(--text-secondary)" }}>
                  {CHOLESTEROL_LIMITER_SUMMARY}
                </p>
              </div>

              <p className="text-[9px] italic px-0.5" style={{ color: "var(--text-muted)" }}>
                Repérage automatique par mots-clés — pas un contrôle médical. Les apports en
                graisses saturées en grammes restent suivis ailleurs dans l&apos;app (pastille
                &quot;Lip.sat.&quot;, score de qualité nutritionnelle).
              </p>
            </>
          )}

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
