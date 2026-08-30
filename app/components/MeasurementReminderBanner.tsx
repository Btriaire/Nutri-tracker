"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { IconRuler, IconX } from "@tabler/icons-react";
import type { MeasurementEntry } from "@/app/api/measurements/route";

const SNOOZE_KEY = "measurementReminderSnoozeUntil";
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Nudges toward the weekly minimum for body measurements — shown in the
 * Journal (the page opened most often) rather than buried in Santé, since
 * that's the only way an "until it's done" reminder actually gets seen.
 * Dismissing snoozes it for a week rather than forever, so it comes back
 * if the user still hasn't measured by then.
 */
export default function MeasurementReminderBanner() {
  const [daysSince, setDaysSince] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const snoozeUntil = Number(localStorage.getItem(SNOOZE_KEY) ?? 0);
    if (Date.now() < snoozeUntil) { setDismissed(true); return; }

    fetch("/api/measurements?months=2")
      .then(r => r.json())
      .then((d: { entries?: MeasurementEntry[] }) => {
        const entries = d.entries ?? [];
        const lastLoggedAt = entries.reduce((max, e) => Math.max(max, e.loggedAt?.seconds ?? 0), 0);
        const days = lastLoggedAt === 0 ? Infinity : (Date.now() - lastLoggedAt * 1000) / 86_400_000;
        setDaysSince(days);
      })
      .catch(() => {});
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(SNOOZE_KEY, String(Date.now() + WEEK_MS));
    setDismissed(true);
  };

  if (dismissed || daysSince === null || daysSince < 7) return null;

  const label = daysSince === Infinity
    ? "Tu n'as jamais saisi tes mensurations"
    : `Pas de mensurations depuis ${Math.floor(daysSince)} jours`;

  return (
    <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl mb-4"
      style={{ background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.28)" }}>
      <IconRuler size={16} stroke={1.8} style={{ color: "#a78bfa", flexShrink: 0 }} />
      <p className="text-[11.5px] leading-snug flex-1" style={{ color: "var(--text-primary)" }}>
        <span style={{ color: "#a78bfa", fontWeight: 500 }}>{label}</span>
        {" "}— objectif : au moins 1× par semaine.{" "}
        <Link href="/health" className="underline underline-offset-2" style={{ color: "#a78bfa" }}>
          Saisir maintenant
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
