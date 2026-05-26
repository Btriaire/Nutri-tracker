"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { CheckCircle, XCircle, ArrowsClockwise, Lightning, Spinner } from "@phosphor-icons/react";

interface Props {
  fitConnected: boolean;
}

export default function SettingsClient({ fitConnected: initialFit }: Props) {
  const params     = useSearchParams();
  const [fit, setFit]       = useState(initialFit);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
  const [disconnecting, setDisconnecting] = useState(false);
  const [syncingHistory, setSyncingHistory] = useState(false);

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
      setSyncMsg(json.ok ? `Historique synchronisé — ${json.days} jours` : "Erreur lors de la synchronisation");
    } catch { setSyncMsg("Erreur réseau"); }
    finally { setSyncingHistory(false); }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    await fetch("/api/google-fit/disconnect", { method: "POST" });
    setFit(false);
    setDisconnecting(false);
  };

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

        {/* Google Fit card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="glass p-5 mb-4"
        >
          <div className="flex items-center gap-3 mb-4">
            {/* Google Fit logo colours */}
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
              style={{
                background: "linear-gradient(135deg, #4285f4 0%, #34a853 50%, #ea4335 100%)",
              }}
            >
              <Lightning size={18} weight="fill" color="white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-[14px]" style={{ color: "var(--text-primary)" }}>Google Fit</p>
              <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>Pas · Calories · Fréquence cardiaque</p>
            </div>
            {fit
              ? <CheckCircle size={20} weight="fill" style={{ color: "var(--fiber)", flexShrink: 0 }} />
              : <XCircle    size={20} weight="fill" style={{ color: "var(--text-muted)", flexShrink: 0 }} />
            }
          </div>

          {fit ? (
            <div className="space-y-2.5">
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-lg"
                style={{ background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.2)" }}
              >
                <CheckCircle size={13} style={{ color: "var(--fiber)" }} />
                <span className="text-[12px]" style={{ color: "var(--fiber)" }}>Connecté</span>
              </div>

              {syncMsg && (
                <p className="text-[12px] px-1" style={{ color: "var(--text-muted)" }}>{syncMsg}</p>
              )}

              <div className="flex gap-2">
                <button
                  onClick={handleSync}
                  disabled={syncing}
                  className="btn btn-ghost flex-1 gap-2 text-[12px]"
                >
                  {syncing ? <Spinner size={13} className="animate-spin" /> : <ArrowsClockwise size={13} />}
                  Aujourd'hui
                </button>
                <button
                  onClick={handleSyncHistory}
                  disabled={syncingHistory}
                  className="btn btn-ghost flex-1 gap-2 text-[12px]"
                >
                  {syncingHistory ? <Spinner size={13} className="animate-spin" /> : <ArrowsClockwise size={13} />}
                  90 jours
                </button>
                <button
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="btn btn-ghost text-[12px] px-3"
                  style={{ color: "#f87171", borderColor: "rgba(248,113,113,0.3)" }}
                >
                  {disconnecting ? <Spinner size={12} className="animate-spin" /> : "Déconnecter"}
                </button>
              </div>
            </div>
          ) : (
            <a
              href="/api/google-fit/auth"
              className="btn btn-primary w-full gap-2 text-[13px]"
              style={{ height: "40px" }}
            >
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

      </div>
    </div>
  );
}
