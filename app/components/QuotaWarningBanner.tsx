"use client";

import { useEffect, useState } from "react";
import { IconAlertTriangle } from "@tabler/icons-react";

interface QuotaStatus {
  reads: number;
  limit: number;
  warningThreshold: number;
  approaching: boolean;
}

/**
 * Warns when the app's self-tracked Firestore read estimate is approaching the
 * daily quota (40k/50k) — shown near actions that themselves cost hundreds of
 * reads (Répartition, Progrès), so the user can hold off before triggering more.
 * The check itself costs one read; call sites should mount this sparingly, not
 * on every page.
 */
export default function QuotaWarningBanner() {
  const [status, setStatus] = useState<QuotaStatus | null>(null);

  useEffect(() => {
    fetch("/api/quota-status")
      .then((r) => r.json())
      .then((d: QuotaStatus) => setStatus(d))
      .catch(() => {});
  }, []);

  if (!status?.approaching) return null;

  return (
    <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl mb-4"
      style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.28)" }}>
      <IconAlertTriangle size={16} stroke={1.8} style={{ color: "#f87171", flexShrink: 0 }} />
      <p className="text-[11.5px] leading-snug" style={{ color: "var(--text-primary)" }}>
        <span style={{ color: "#f87171", fontWeight: 500 }}>Quota Firestore proche de la limite</span>
        {" "}({status.reads.toLocaleString("fr-FR")} / {status.limit.toLocaleString("fr-FR")} lectures estimées aujourd&apos;hui) —
        évitez les actions lourdes (Répartition, historique complet) le reste de la journée.
      </p>
    </div>
  );
}
