"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  IconChevronDown, IconChevronUp, IconCircleCheck, IconCopy, IconCheck, IconLoader2, IconActivity,
} from "@tabler/icons-react";

export default function GoogleHealthPanel() {
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<"url" | "token" | null>(null);

  useEffect(() => {
    fetch("/api/google-health/token", { cache: "no-store" })
      .then(r => r.ok ? r.json() : { token: null })
      .then((data: { token: string | null }) => setToken(data.token))
      .catch(() => {});
  }, []);

  const generateToken = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/google-health/token", { method: "POST" });
      if (res.ok) {
        const data = await res.json() as { token: string };
        setToken(data.token);
      }
    } finally {
      setLoading(false);
    }
  };

  const origin    = typeof window !== "undefined" ? window.location.origin : "";
  const ingestUrl = token ? `${origin}/api/google-health/ingest?token=${token}` : `${origin}/api/google-health/ingest`;

  const copyText = (text: string, which: "url" | "token") => {
    navigator.clipboard.writeText(text);
    setCopied(which);
    setTimeout(() => setCopied(null), 2000);
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
          style={{ background: "linear-gradient(135deg, #4285F4 0%, #34A853 50%, #FBBC05 100%)" }}>
          <IconActivity size={18} color="white" />
        </div>
        <div className="flex-1 min-w-0 text-left">
          <p className="font-semibold text-[14px]" style={{ color: "var(--text-primary)" }}>Google Health (Connect)</p>
          <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>Health Connect · Android · Automatisations REST</p>
        </div>
        {token && <IconCircleCheck size={18} style={{ color: "var(--fiber)", flexShrink: 0 }} />}
        {open ? <IconChevronUp size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} /> : <IconChevronDown size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }} style={{ overflow: "hidden" }}>
            <div className="mt-4 space-y-3">
              <p className="text-[12px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                Google Health Connect centralise les données sur Android (Samsung Health, Withings, Pixel Watch, Garmin).
                Cette passerelle REST permet d&apos;ingérer directement les mesures (pas, sommeil, calories, tension, glycémie)
                via n&apos;importe quelle app d&apos;automatisation Android (ex: Tasker, Automate, Health Connect Toolbox ou webhook).
              </p>

              {!token ? (
                <button onClick={generateToken} disabled={loading}
                  className="btn btn-primary w-full gap-2 text-[13px]" style={{ height: "38px" }}>
                  {loading ? <IconLoader2 size={14} className="animate-spin" /> : <IconActivity size={14} />}
                  Générer mon jeton d&apos;ingestion Google Health
                </button>
              ) : (
                <div className="space-y-3 pt-1">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>
                        URL d&apos;ingestion (Webhook POST)
                      </span>
                      <button onClick={() => copyText(ingestUrl, "url")}
                        className="flex items-center gap-1 text-[11px] font-medium transition-colors"
                        style={{ color: copied === "url" ? "var(--fiber)" : "var(--accent)" }}>
                        {copied === "url" ? <><IconCheck size={11} /> Copié !</> : <><IconCopy size={11} /> Copier l&apos;URL</>}
                      </button>
                    </div>
                    <div className="px-3 py-2 rounded-lg font-mono text-[11px] break-all select-all"
                      style={{ background: "rgba(0,0,0,0.3)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                      {ingestUrl}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>
                        Jeton secret
                      </span>
                      <button onClick={() => copyText(token, "token")}
                        className="flex items-center gap-1 text-[11px] font-medium transition-colors"
                        style={{ color: copied === "token" ? "var(--fiber)" : "var(--accent)" }}>
                        {copied === "token" ? <><IconCheck size={11} /> Copié !</> : <><IconCopy size={11} /> Copier le jeton</>}
                      </button>
                    </div>
                    <div className="px-3 py-2 rounded-lg font-mono text-[11px] break-all select-all"
                      style={{ background: "rgba(0,0,0,0.3)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                      {token}
                    </div>
                  </div>

                  <div className="rounded-xl p-3" style={{ background: "var(--layer-1)", border: "1px solid var(--border)" }}>
                    <p className="text-[11px] font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>Exemple de payload JSON attendu :</p>
                    <pre className="text-[10px] font-mono leading-relaxed overflow-x-auto select-all" style={{ color: "var(--text-muted)" }}>
{`{
  "token": "${token}",
  "date": "2026-10-13",
  "steps": 8450,
  "activeCalories": 420,
  "activeMinutes": 45,
  "heartRateAvg": 68,
  "sleepMinutes": 450,
  "weightKg": 74.2,
  "bloodPressure": { "systolic": 120, "diastolic": 78 }
}`}
                    </pre>
                  </div>

                  <button onClick={generateToken} disabled={loading}
                    className="text-[11px] font-medium transition-colors"
                    style={{ color: "var(--text-muted)" }}>
                    {loading ? "Régénération…" : "Régénérer un nouveau jeton (révoque l'actuel)"}
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
