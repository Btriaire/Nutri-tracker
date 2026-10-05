"use client";

import { useState } from "react";
import { IconDroplet } from "@tabler/icons-react";
import { queueWater } from "@/app/lib/offline-meals";

interface Props {
  date: string;
  waterMl: number;
  goalMl: number;
  onWaterUpdate: (newMl: number) => void;
}

const chip = "flex items-center justify-center gap-1.5 min-h-[44px] px-4 rounded-full text-[13px] font-semibold transition-transform active:scale-95";

export default function QuickAddChips({ date, waterMl, goalMl, onWaterUpdate }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [queued, setQueued] = useState(false);

  const addWater = async (delta: number) => {
    if (busy) return;
    const next = waterMl + delta;
    setBusy(true);
    setError(false);
    // Hors ligne : gardee sur le telephone, envoyee au retour du reseau.
    const keepOffline = () => { queueWater(date, next); onWaterUpdate(next); setQueued(true); };
    if (!navigator.onLine) { keepOffline(); setBusy(false); return; }
    try {
      const res = await fetch("/api/log/water", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, waterMl: next }),
      });
      if (!res.ok) throw new Error();
      onWaterUpdate(next);
      setQueued(false);
    } catch (e) {
      if (e instanceof TypeError) keepOffline();   // reseau coupe pendant l'envoi
      else setError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-5">
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-[12px] flex items-center gap-1" style={{ color: "var(--text-secondary)" }}>
            <IconDroplet size={14} stroke={1.8} style={{ color: "var(--fat)" }} /> Eau
          </p>
          <p className="text-[14px] font-semibold tabular-nums whitespace-nowrap" style={{ color: "var(--text-primary)" }}>
            {(waterMl / 1000).toFixed(2).replace(".", ",")}
            <span className="text-[12px] font-normal" style={{ color: "var(--text-muted)" }}> / {(goalMl / 1000).toFixed(1).replace(".", ",")} L</span>
          </p>
          <div className="h-[4px] mt-1 rounded-full overflow-hidden" style={{ background: "var(--layer-2)" }}>
            <div className="h-full rounded-full" style={{ width: `${Math.min(100, (waterMl / Math.max(1, goalMl)) * 100)}%`, background: "var(--fat)" }} />
          </div>
        </div>
        <button type="button" disabled={busy} onClick={() => addWater(250)} aria-label="Ajouter 250 ml d'eau"
          className={chip} style={{ background: "var(--fat)", color: "var(--bg)" }}>
          +250 ml
        </button>
        <button type="button" disabled={busy} onClick={() => addWater(500)} aria-label="Ajouter 500 ml d'eau"
          className={chip} style={{ background: "var(--surface-active)", color: "var(--text-primary)", border: "1px solid var(--border-strong)" }}>
          +500 ml
        </button>
      </div>
      {queued && (
        <p role="status" className="text-[12px] mt-2" style={{ color: "var(--text-muted)" }}>
          Pas de réseau : gardé sur le téléphone, envoyé au retour du réseau.
        </p>
      )}
      {error && (
        <p role="alert" className="text-[12px] mt-2" style={{ color: "var(--danger)" }}>
          Impossible d&apos;enregistrer l&apos;eau, réessaie.
        </p>
      )}
    </div>
  );
}
