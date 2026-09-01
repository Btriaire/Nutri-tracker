"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { IconFaceId, IconX } from "@tabler/icons-react";
import type { FaceScanEntry } from "@/app/lib/types";

const SNOOZE_KEY = "faceScanReminderSnoozeUntil";
const REMINDER_AFTER_DAYS = 3;
const SNOOZE_MS = REMINDER_AFTER_DAYS * 24 * 60 * 60 * 1000;

/**
 * Même logique que MeasurementReminderBanner — nudge vers le scan visage,
 * affiché dans le Journal (page ouverte le plus souvent) plutôt qu'enfoui
 * dans Santé. Dismiss = snooze pour la même durée que le seuil (3 jours),
 * pas pour toujours, donc ça revient si toujours pas fait d'ici là.
 */
export default function FaceScanReminderBanner() {
  const [daysSince, setDaysSince] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const snoozeUntil = Number(localStorage.getItem(SNOOZE_KEY) ?? 0);
    if (Date.now() < snoozeUntil) { setDismissed(true); return; }

    fetch("/api/face-scan")
      .then(r => r.json())
      .then((d: { scans?: FaceScanEntry[] }) => {
        const scans = d.scans ?? [];
        const lastDate = scans.reduce((max, s) => (s.date > max ? s.date : max), "");
        if (!lastDate) { setDaysSince(Infinity); return; }
        const days = (Date.now() - new Date(`${lastDate}T00:00:00`).getTime()) / 86_400_000;
        setDaysSince(days);
      })
      .catch(() => {});
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MS));
    setDismissed(true);
  };

  if (dismissed || daysSince === null || daysSince < REMINDER_AFTER_DAYS) return null;

  const label = daysSince === Infinity
    ? "Tu n'as jamais fait de scan visage"
    : `Pas de scan visage depuis ${Math.floor(daysSince)} jours`;

  return (
    <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl mb-4"
      style={{ background: "rgba(96,165,250,0.08)", border: "1px solid rgba(96,165,250,0.28)" }}>
      <IconFaceId size={16} stroke={1.8} style={{ color: "#60a5fa", flexShrink: 0 }} />
      <p className="text-[11.5px] leading-snug flex-1" style={{ color: "var(--text-primary)" }}>
        <span style={{ color: "#60a5fa", fontWeight: 500 }}>{label}</span>
        {" "}— objectif : au moins 1× tous les 3 jours.{" "}
        <Link href="/health/face-scan" className="underline underline-offset-2" style={{ color: "#60a5fa" }}>
          Scanner maintenant
        </Link>
      </p>
      <button onClick={handleDismiss} aria-label="Masquer ce rappel"
        className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center"
        style={{ background: "rgba(255,255,255,0.06)" }}>
        <IconX size={12} stroke={2} style={{ color: "var(--text-muted)" }} />
      </button>
    </div>
  );
}
