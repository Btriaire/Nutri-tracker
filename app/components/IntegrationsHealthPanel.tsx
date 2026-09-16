"use client";

import { useCallback, useState } from "react";
import { motion } from "framer-motion";
import {
  IconCircleCheck, IconAlertTriangle, IconClockExclamation, IconPlugConnectedX,
  IconRefresh, IconLoader2, IconActivityHeartbeat,
} from "@tabler/icons-react";
import type { IntegrationHealth, IntegrationState } from "@/app/lib/integrations-health";

// Pourquoi ce panneau existe : quand une intégration cessait d'envoyer des
// données, RIEN ne le disait — Apple Health est resté muet des jours, et le
// Scan Visage cassé aussi, découverts par hasard. Ici on regarde la dernière
// donnée RÉELLEMENT reçue, pas le dernier ping de synchro (qui peut être
// récent alors que le payload était vide).

const STATE_META: Record<IntegrationState, { color: string; Icon: typeof IconCircleCheck; label: string }> = {
  ok:    { color: "#34d399", Icon: IconCircleCheck,       label: "OK" },
  stale: { color: "#fbbf24", Icon: IconClockExclamation,  label: "Muet" },
  error: { color: "#f87171", Icon: IconAlertTriangle,     label: "Erreur" },
  off:   { color: "var(--text-muted)", Icon: IconPlugConnectedX, label: "Inactif" },
};

export default function IntegrationsHealthPanel({ initial }: { initial: IntegrationHealth[] }) {
  // L'état initial vient du rendu serveur de la page Réglages : pas de fetch
  // dans un effet (qui provoquerait des re-renders en cascade), et pas de
  // clignotement "Vérification…" au chargement. Le bouton ci-dessous refait
  // le calcul à la demande.
  const [items,   setItems]   = useState<IntegrationHealth[]>(initial);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/integrations/health", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json() as { integrations: IntegrationHealth[] };
        setItems(data.integrations);
      }
    } catch { /* réseau — on laisse l'état précédent */ }
    finally { setLoading(false); }
  }, []);

  const problems = items.filter(i => i.state === "error" || i.state === "stale").length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.045 }}
      className="glass p-5 mb-4"
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: problems > 0 ? "rgba(251,191,36,0.15)" : "rgba(52,211,153,0.15)" }}>
          <IconActivityHeartbeat size={18} style={{ color: problems > 0 ? "#fbbf24" : "#34d399" }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-[14px]" style={{ color: "var(--text-primary)" }}>État des synchros</p>
          <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
            {problems === 0
              ? "Tout remonte des données"
              : `${problems} intégration${problems > 1 ? "s" : ""} à vérifier`}
          </p>
        </div>
        <button onClick={load} disabled={loading}
          className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all active:scale-95"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", color: "var(--text-muted)" }}
          aria-label="Revérifier">
          {loading ? <IconLoader2 size={14} className="animate-spin" /> : <IconRefresh size={14} />}
        </button>
      </div>

      <div className="space-y-1.5">
        {items.map(item => {
          const meta = STATE_META[item.state];
          return (
            <div key={item.id} className="flex items-start gap-2.5 px-3 py-2 rounded-xl"
              style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${item.state === "ok" ? "var(--border)" : `${meta.color}33`}` }}>
              <meta.Icon size={13} stroke={1.8} style={{ color: meta.color, flexShrink: 0, marginTop: 1 }} />
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-medium" style={{ color: "var(--text-primary)" }}>{item.label}</p>
                <p className="text-[11px] leading-relaxed" style={{ color: item.state === "ok" ? "var(--text-muted)" : meta.color }}>
                  {item.detail}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
