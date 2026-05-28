"use client";

import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, XCircle, ArrowsClockwise, Lightning, Spinner, Database, CaretDown, CaretUp, Trash, Warning, Sun, Moon, Ruler, Person, Heartbeat, Footprints, Calculator, FloppyDisk, SignOut } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { getClientAuth } from "@/app/lib/firebase-client";
import { useTheme } from "@/app/components/ThemeProvider";
import { format, subYears, startOfYear, endOfYear, getYear } from "date-fns";
import { calcTDEE } from "@/app/lib/nutrition";
import type { NutritionGoals, ActivityLevel, Gender } from "@/app/lib/types";

interface Props {
  fitConnected:      boolean;
  withingsConnected: boolean;
  initialGoals:      NutritionGoals;
  initialPhotoUrl?:  string;
}

interface YearProgress { year: number; status: "pending" | "running" | "done" | "error"; days?: number }

export default function SettingsClient({ fitConnected: initialFit, withingsConnected: initialWithings, initialGoals, initialPhotoUrl }: Props) {
  const router = useRouter();

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    try { await signOut(getClientAuth()); } catch {}
    router.push("/login");
  };
  const { theme, toggle } = useTheme();
  const params = useSearchParams();
  const [fit, setFit]                   = useState(initialFit);
  const [syncing, setSyncing]           = useState(false);
  const [syncMsg, setSyncMsg]           = useState("");

  // Withings
  const [withings, setWithings]         = useState(initialWithings);
  const [wSyncing, setWSyncing]         = useState(false);
  const [wSyncMsg, setWSyncMsg]         = useState("");
  const [wDisconnecting, setWDisconnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [syncingHistory, setSyncingHistory] = useState(false);

  // Full history sync state
  const [showFullSync, setShowFullSync] = useState(false);
  const [yearsBack, setYearsBack]       = useState(5);
  const [fullSyncRunning, setFullSyncRunning] = useState(false);
  const [yearProgress, setYearProgress] = useState<YearProgress[]>([]);
  const [fullSyncDone, setFullSyncDone] = useState(false);

  useEffect(() => {
    if (params.get("fit")      === "connected") setFit(true);
    if (params.get("fit")      === "error")     setSyncMsg("Erreur lors de la connexion");
    if (params.get("withings") === "connected") setWithings(true);
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
    setFit(false);
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

  const handleWithingsDisconnect = async () => {
    setWDisconnecting(true);
    await fetch("/api/withings/disconnect", { method: "POST" });
    setWithings(false);
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

        {/* Withings card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="glass p-5 mb-4"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
              style={{ background: "linear-gradient(135deg, rgba(0,150,255,0.25) 0%, rgba(0,200,180,0.25) 100%)", border: "1px solid rgba(255,255,255,0.1)" }}>
              ⚖️
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-[14px]" style={{ color: "var(--text-primary)" }}>Withings</p>
              <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>Poids · % graisse · Masse musculaire</p>
            </div>
            {withings
              ? <CheckCircle size={20} weight="fill" style={{ color: "var(--fiber)", flexShrink: 0 }} />
              : <XCircle    size={20} weight="fill" style={{ color: "var(--text-muted)", flexShrink: 0 }} />
            }
          </div>

          {withings ? (
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
                style={{ background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.2)" }}>
                <CheckCircle size={13} style={{ color: "var(--fiber)" }} />
                <span className="text-[12px]" style={{ color: "var(--fiber)" }}>Connecté</span>
              </div>

              {wSyncMsg && (
                <p className="text-[12px] px-1" style={{ color: "var(--text-muted)" }}>{wSyncMsg}</p>
              )}

              <div className="flex gap-2">
                <button onClick={() => handleWithingsSync()} disabled={wSyncing}
                  className="btn btn-ghost flex-1 gap-1.5 text-[12px]">
                  {wSyncing ? <Spinner size={12} className="animate-spin" /> : <ArrowsClockwise size={12} />}
                  Aujourd'hui
                </button>
                <button onClick={() => handleWithingsSync(90)} disabled={wSyncing}
                  className="btn btn-ghost flex-1 gap-1.5 text-[12px]">
                  {wSyncing ? <Spinner size={12} className="animate-spin" /> : <ArrowsClockwise size={12} />}
                  90 jours
                </button>
                <button onClick={handleWithingsDisconnect} disabled={wDisconnecting}
                  className="btn btn-ghost text-[12px] px-3"
                  style={{ color: "#f87171", borderColor: "rgba(248,113,113,0.3)" }}>
                  {wDisconnecting ? <Spinner size={12} className="animate-spin" /> : "Déconnecter"}
                </button>
              </div>
            </div>
          ) : (
            <a href="/api/withings/auth" className="btn btn-primary w-full gap-2 text-[13px]" style={{ height: "40px", background: "linear-gradient(135deg,#0096ff,#00c8b4)", border: "none" }}>
              ⚖️ Connecter Withings
            </a>
          )}
        </motion.div>

        {/* Profile photo */}
        <PhotoPanel initialPhotoUrl={initialPhotoUrl} />

        {/* Nutrition & Profile Goals */}
        <GoalsPanel initialGoals={initialGoals} />

        {/* Chart customization */}
        <ChartPrefsPanel />

        {/* Reset stats */}
        <ResetPanel />

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
            <SignOut size={15} />
            Se déconnecter / Changer de compte
          </button>
        </motion.div>

      </div>
    </div>
  );
}

// ─── Photo Panel ─────────────────────────────────────────────────────────────

function PhotoPanel({ initialPhotoUrl }: { initialPhotoUrl?: string }) {
  const [photoUrl, setPhotoUrl] = useState(initialPhotoUrl ?? "");
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 128; canvas.height = 128;
        const ctx = canvas.getContext("2d")!;
        const size = Math.min(img.width, img.height);
        ctx.drawImage(img, (img.width - size) / 2, (img.height - size) / 2, size, size, 0, 0, 128, 128);
        setPhotoUrl(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!photoUrl) return;
    setSaving(true);
    try {
      await fetch("/api/goals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoUrl }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally { setSaving(false); }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.07 }}
      className="glass p-5 mt-4"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(249,115,22,0.12)" }}>
          <Person size={18} style={{ color: "var(--calories)" }} />
        </div>
        <div>
          <p className="font-semibold text-[14px]" style={{ color: "var(--text-primary)" }}>Photo de profil</p>
          <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>Visible sur l'accueil et la navigation</p>
        </div>
      </div>

      <div className="flex items-center gap-5">
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
          {photoUrl && (
            <button onClick={handleSave} disabled={saving}
              className="btn btn-primary w-full text-[12.5px]" style={{ height: "36px" }}>
              {saved
                ? <><CheckCircle size={13} weight="fill" /> Sauvegardée</>
                : saving
                  ? <><Spinner size={11} className="animate-spin" /> Sauvegarde…</>
                  : <><FloppyDisk size={13} /> Sauvegarder</>}
            </button>
          )}
          <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
            Recadrée automatiquement à 128×128 px (JPEG)
          </p>
        </div>
      </div>

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
  const [weeklyGoal, setWeeklyGoal] = useState(initialGoals.weeklyGoal ?? "maintain");
  const [tdeeCalc,        setTdeeCalc]        = useState<number | null>(null);
  const [selectedProgram, setSelectedProgram] = useState<string | null>(null);
  const [saving,          setSaving]          = useState(false);
  const [saved,           setSaved]           = useState(false);
  const [expanded,        setExpanded]        = useState(false);

  const PROGRAMS: Record<string, { label: string; emoji: string; desc: string; protPct: number; carbPct: number; fatPct: number; fiber: number; calorieBonus?: number }> = {
    balanced: { label: "Équilibré",       emoji: "⚖️",  desc: "50% G · 25% P · 25% L",   protPct: 0.25, carbPct: 0.50, fatPct: 0.25, fiber: 30 },
    keto:     { label: "Cétogène",        emoji: "🥑",  desc: "5% G · 25% P · 70% L",    protPct: 0.25, carbPct: 0.05, fatPct: 0.70, fiber: 25 },
    lowcarb:  { label: "Sans sucre",      emoji: "🚫🍬", desc: "20% G · 30% P · 50% L",   protPct: 0.30, carbPct: 0.20, fatPct: 0.50, fiber: 28 },
    highprot: { label: "Hyperprotéiné",   emoji: "💪",  desc: "25% G · 40% P · 35% L",   protPct: 0.40, carbPct: 0.25, fatPct: 0.35, fiber: 30 },
    mediter:  { label: "Méditerranéen",   emoji: "🫒",  desc: "45% G · 20% P · 35% L",   protPct: 0.20, carbPct: 0.45, fatPct: 0.35, fiber: 35 },
    bulk:     { label: "Prise de masse",  emoji: "🏋️",  desc: "45% G · 30% P · 25% L",   protPct: 0.30, carbPct: 0.45, fatPct: 0.25, fiber: 30, calorieBonus: 300 },
  };

  const WEEKLY_ADJUSTMENTS: Record<string, number> = { lose: -500, maintain: 0, gain: 300 };

  const handleCalcTDEE = () => {
    const a = parseInt(age);
    const h = parseInt(height);
    const w = parseFloat(weight) || 70;
    if (!a || !h || !gender) return;
    const tdee = calcTDEE(w, h, a, gender as Gender, activity);
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
    const a = parseInt(age), h = parseInt(height), w = parseFloat(weight) || 70;
    let base = parseInt(calories) || 2000;
    if (a && h && gender) {
      base = calcTDEE(w, h, a, gender as Gender, activity);
      setTdeeCalc(base);
    }
    const adj = WEEKLY_ADJUSTMENTS[weeklyGoal] ?? 0;
    const bonus = prog.calorieBonus ?? 0;
    const kcal = Math.max(800, base + adj + bonus);
    const p = Math.round((kcal * prog.protPct) / 4);
    const f = Math.round((kcal * prog.fatPct)  / 9);
    const c = Math.round((kcal * prog.carbPct) / 4);
    setCalories(kcal.toString());
    setProtein(p.toString());
    setFat(f.toString());
    setCarbs(c.toString());
    setFiber(prog.fiber.toString());
    setSelectedProgram(key);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const goals: Partial<NutritionGoals> = {
        dailyCalories:  parseInt(calories) || 2000,
        proteinGrams:   parseInt(protein)  || 150,
        carbsGrams:     parseInt(carbs)    || 220,
        fatGrams:       parseInt(fat)      || 65,
        fiberGrams:     parseInt(fiber)    || 30,
        waterMl:        parseInt(water)    || 2000,
        stepsGoal:      parseInt(steps)    || 10000,
        sleepGoalMin:   (parseInt(sleep)   || 7) * 60,
        activityLevel:  activity,
        weeklyGoal:     weeklyGoal as "lose" | "maintain" | "gain",
        targetWeightKg: parseFloat(weight) || null,
      };
      if (age)    goals.age       = parseInt(age);
      if (height) goals.heightCm  = parseInt(height);
      if (gender) goals.gender    = gender as Gender;

      await fetch("/api/goals", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ goals }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally { setSaving(false); }
  };

  const inputClass = "w-full px-3 py-2 rounded-xl text-[13px] transition-colors outline-none";
  const inputStyle = {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid var(--border)",
    color: "var(--text-primary)",
  };

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
          <Person size={18} style={{ color: "var(--calories)" }} />
          <div className="text-left">
            <p className="font-semibold text-[14px]" style={{ color: "var(--text-primary)" }}>Objectifs & Profil</p>
            <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>Calories, macros, pas, sommeil</p>
          </div>
        </div>
        {expanded ? <CaretUp size={14} style={{ color: "var(--text-muted)" }} /> : <CaretDown size={14} style={{ color: "var(--text-muted)" }} />}
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
                  <Ruler size={11} />
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

                {/* Age / Height / Weight */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "Âge",    unit: "ans", val: age,    set: setAge },
                    { label: "Taille", unit: "cm",  val: height, set: setHeight },
                    { label: "Poids",  unit: "kg",  val: weight, set: setWeight },
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
              </div>

              {/* ── Niveau d'activité ── */}
              <div>
                <p className="label-xs mb-2">Niveau d'activité</p>
                <div className="space-y-1.5">
                  {(Object.keys(ACTIVITY_LABELS) as ActivityLevel[]).map(level => (
                    <button key={level} onClick={() => setActivity(level)}
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
                      {activity === level && <CheckCircle size={14} weight="fill" style={{ color: "var(--calories)" }} />}
                    </button>
                  ))}
                </div>
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

              {/* ── Programmes nutritionnels ── */}
              <div>
                <p className="label-xs mb-2 flex items-center gap-1.5">
                  <Lightning size={11} />
                  Programme nutritionnel
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(PROGRAMS).map(([key, prog]) => {
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
                <p className="text-[10px] mt-2" style={{ color: "var(--text-muted)" }}>
                  Le programme calcule automatiquement les macros selon ton profil et l'objectif sélectionné.
                </p>
              </div>

              {/* ── TDEE Calculator ── */}
              <div className="rounded-xl p-3 space-y-2"
                style={{ background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.2)" }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calculator size={14} style={{ color: "var(--calories)" }} />
                    <p className="text-[12px] font-medium" style={{ color: "var(--calories)" }}>
                      Calcul automatique TDEE
                    </p>
                  </div>
                  {tdeeCalc && (
                    <span className="text-[11px] font-bold" style={{ color: "var(--calories)" }}>
                      {tdeeCalc} kcal
                    </span>
                  )}
                </div>
                <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                  Calcule les besoins caloriques via Mifflin-St Jeor et remplit les macros automatiquement.
                </p>
                <button onClick={handleCalcTDEE}
                  disabled={!age || !height || !gender}
                  className="w-full btn gap-2 text-[12px]"
                  style={{
                    height: "34px",
                    background: age && height && gender ? "var(--calories)" : "rgba(255,255,255,0.06)",
                    color: age && height && gender ? "#fff" : "var(--text-muted)",
                    border: "none",
                    opacity: age && height && gender ? 1 : 0.5,
                  }}>
                  <Calculator size={12} />
                  Calculer et remplir
                </button>
              </div>

              {/* ── Calories & Macros ── */}
              <div>
                <p className="label-xs mb-4 flex items-center gap-1.5">
                  <Heartbeat size={11} />
                  Calories & Macros
                </p>
                <div className="space-y-4">
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
              </div>

              {/* ── Steps & Sleep ── */}
              <div>
                <p className="label-xs mb-4 flex items-center gap-1.5">
                  <Footprints size={11} />
                  Activité & Récupération
                </p>
                <div className="space-y-4">
                  <SliderField label="Objectif pas" unit=" pas" value={steps} min={2000} max={20000} step={500}
                    color="var(--steps)" onChange={setSteps} />
                  <SliderField label="Objectif sommeil" unit="h" value={sleep} min={4} max={12} step={0.5}
                    color="var(--fit-indigo)" onChange={setSleep} />
                </div>
              </div>

              {/* ── Save ── */}
              <button onClick={handleSave} disabled={saving}
                className="btn btn-primary w-full gap-2 text-[13px]" style={{ height: "40px" }}>
                {saved
                  ? <><CheckCircle size={14} weight="fill" /> Sauvegardé</>
                  : saving
                    ? <><Spinner size={12} className="animate-spin" /> Sauvegarde…</>
                    : <><FloppyDisk size={14} /> Sauvegarder les objectifs</>
                }
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
