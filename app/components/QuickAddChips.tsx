"use client";

import { useState } from "react";
import Link from "next/link";
import { IconDroplet, IconRuler } from "@tabler/icons-react";

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

  const addWater = async (delta: number) => {
    if (busy) return;
    const next = waterMl + delta;
    setBusy(true);
    setError(false);
    try {
      const res = await fetch("/api/log/water", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, waterMl: next }),
      });
      if (!res.ok) throw new Error();
      onWaterUpdate(next);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-5">
      <div className="flex flex-wrap gap-2 items-center">
        <button type="button" disabled={busy} onClick={() => addWater(250)} aria-label="Ajouter 250 ml d'eau"
          className={chip} style={{ background: "var(--fat)", color: "var(--bg)" }}>
          <IconDroplet size={16} stroke={2} /> +250 ml
        </button>
        <button type="button" disabled={busy} onClick={() => addWater(500)} aria-label="Ajouter 500 ml d'eau"
          className={chip} style={{ background: "var(--surface-active)", color: "var(--text-primary)", border: "1px solid var(--border-strong)" }}>
          +500 ml
        </button>
        <span className="text-[12px] tabular-nums" style={{ color: "var(--text-secondary)" }}>
          {(waterMl / 1000).toFixed(2).replace(".", ",")} / {(goalMl / 1000).toFixed(1).replace(".", ",")} L
        </span>
        <Link href="/health" className={`${chip} ml-auto`}
          style={{ background: "var(--surface-active)", color: "var(--text-primary)", border: "1px solid var(--border-strong)" }}>
          <IconRuler size={16} stroke={2} /> Mesurer
        </Link>
      </div>
      {error && (
        <p role="alert" className="text-[12px] mt-2" style={{ color: "var(--danger)" }}>
          Impossible d&apos;enregistrer l&apos;eau, réessaie.
        </p>
      )}
    </div>
  );
}
