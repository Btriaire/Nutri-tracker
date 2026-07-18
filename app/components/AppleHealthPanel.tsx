"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  IconChevronDown, IconChevronUp, IconCircleCheck, IconCopy, IconCheck, IconLoader2, IconHeartbeat,
} from "@tabler/icons-react";

export default function AppleHealthPanel() {
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/apple-health/token", { cache: "no-store" })
      .then(r => r.ok ? r.json() : { token: null })
      .then((data: { token: string | null }) => setToken(data.token))
      .catch(() => {});
  }, []);

  const generateToken = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/apple-health/token", { method: "POST" });
      if (res.ok) {
        const data = await res.json() as { token: string };
        setToken(data.token);
      }
    } finally {
      setLoading(false);
    }
  };

  const ingestUrl = typeof window !== "undefined" ? `${window.location.origin}/api/apple-health/ingest` : "/api/apple-health/ingest";

  const copyToken = () => {
    if (!token) return;
    navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.05 }}
      className="glass p-5 mb-4"
    >
      <button className="w-full flex items-center gap-3" onClick={() => setOpen(v => !v)}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "linear-gradient(135deg, #ff2d55 0%, #ff375f 100%)" }}>
          <IconHeartbeat size={18} color="white" />
        </div>
        <div className="flex-1 min-w-0 text-left">
          <p className="font-semibold text-[14px]" style={{ color: "var(--text-primary)" }}>Apple Health</p>
          <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>Pas · FC · Sommeil · Poids via Shortcuts</p>
        </div>
        {token && <IconCircleCheck size={18} style={{ color: "var(--fiber)", flexShrink: 0 }} />}
        {open ? <IconChevronUp size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} /> : <IconChevronDown size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }} style={{ overflow: "hidden" }}>
            <div className="mt-4 space-y-3">
              <p className="text-[11px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                Apple n&apos;offre pas d&apos;API web pour HealthKit — la synchronisation passe par un
                <strong style={{ color: "var(--text-secondary)" }}> Raccourci (Shortcuts)</strong> sur ton iPhone
                qui envoie tes données à cette adresse, ou par l&apos;app <strong style={{ color: "var(--text-secondary)" }}>Health Auto Export</strong> (App Store, ~5€).
              </p>

              {!token ? (
                <button onClick={generateToken} disabled={loading}
                  className="btn btn-primary w-full gap-2 text-[13px]" style={{ height: "40px" }}>
                  {loading ? <IconLoader2 size={14} className="animate-spin" /> : null}
                  Générer mon token de connexion
                </button>
              ) : (
                <>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
                    style={{ background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.2)" }}>
                    <IconCircleCheck size={13} style={{ color: "var(--fiber)" }} />
                    <span className="text-[12px]" style={{ color: "var(--fiber)" }}>Token actif</span>
                  </div>

                  <div>
                    <label className="text-[10px] font-medium block mb-1" style={{ color: "var(--text-muted)" }}>URL du webhook</label>
                    <div className="px-3 py-2 rounded-lg text-[11px] font-mono break-all"
                      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                      {ingestUrl}
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-medium block mb-1" style={{ color: "var(--text-muted)" }}>Token</label>
                    <div className="flex gap-2">
                      <div className="flex-1 px-3 py-2 rounded-lg text-[11px] font-mono break-all"
                        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                        {token}
                      </div>
                      <button onClick={copyToken}
                        className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center"
                        style={{ background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.3)" }}>
                        {copied ? <IconCheck size={14} style={{ color: "var(--fiber)" }} /> : <IconCopy size={14} style={{ color: "var(--indigo)" }} />}
                      </button>
                    </div>
                  </div>

                  <button onClick={generateToken} disabled={loading}
                    className="w-full text-[11px] font-medium py-1.5"
                    style={{ color: "var(--text-muted)" }}>
                    Régénérer le token (invalide l&apos;ancien)
                  </button>
                </>
              )}

              <div className="rounded-lg p-3 space-y-1.5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
                <p className="text-[10px] font-semibold" style={{ color: "var(--text-secondary)" }}>Créer le Raccourci (gratuit, ~10 min) :</p>
                <ol className="text-[10px] leading-relaxed list-decimal list-inside space-y-0.5" style={{ color: "var(--text-muted)" }}>
                  <li>App Raccourcis → Nouveau raccourci</li>
                  <li>Ajoute des blocs &quot;Santé&quot; : Nombre de pas, FC repos, Analyse du sommeil, Poids (un par métrique du jour)</li>
                  <li>Ajoute un bloc &quot;Dictionnaire&quot; avec les clés : date, steps, heartRateResting, sleepMinutes, weightKg (relie chaque valeur santé à sa clé)</li>
                  <li>Ajoute &quot;Obtenir le contenu de l&apos;URL&quot; → méthode POST → URL ci-dessus → Corps JSON → ajoute le champ &quot;token&quot; avec la valeur ci-dessus</li>
                  <li>Automatisation → tous les jours à une heure fixe → Exécuter le raccourci (sans demander)</li>
                </ol>
                <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
                  Alternative sans montage manuel : l&apos;app <strong>Health Auto Export</strong> exporte 100+ métriques automatiquement vers une API REST personnalisée — configure-la avec l&apos;URL et le token ci-dessus.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
