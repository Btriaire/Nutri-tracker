"use client"

import { useEffect, useState } from "react";

interface Period {
  id: string;
  params: {
    from: string;
    to: string;
    kcal: number;
    quality: string;
    note: string;
  };
  added: number;
  skipped: number;
  createdAt: string;
}

export default function EstimatedPeriodsList({ refreshKey, onChanged }: { refreshKey: number; onChanged: () => void }) {
  const [periods, setPeriods] = useState<Period[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchPeriods = async () => {
      try {
        const response = await fetch("/api/periods", { cache: "no-store" });
        if (!response.ok) throw new Error("Failed to fetch periods");
        const data = await response.json();
        if (!cancelled) setPeriods(data.periods);
      } catch (err) {
        if (!cancelled) setError("Failed to load periods");
      }
    };

    fetchPeriods();

    return () => { cancelled = true; };
  }, [refreshKey]);

  const handleDelete = async (id: string, added: number) => {
    if (!window.confirm(`Supprimer les ${added} jours estimés de cette période ? Les aliments ajoutés à la main restent.`)) return;

    try {
      const response = await fetch(`/api/periods?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to delete period");
      setPeriods(periods.filter(period => period.id !== id));
      onChanged();
    } catch (err) {
      setError("Suppression impossible.");
    }
  };

  if (error) return <div role="alert" className="text-[12px] text-[var(--danger)]">{error}</div>;
  if (periods.length === 0) return null;

  const fr = (dateString: string) => new Date(dateString + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" });

  return (
    <section aria-label="Périodes estimées" className="mt-4">
      <h3 className="text-[13px] font-semibold text-[var(--text-primary)]">Périodes estimées</h3>
      <ul className="mt-2 space-y-2">
        {periods.map(({ id, params: { from, to, note }, added }) => (
          <li key={id} className="flex flex-col p-2 border border-[var(--border)] rounded">
            <div className="text-[12px]">
              Du {fr(from)} au {fr(to)} · {added} jours estimés
            </div>
            {note && <div className="text-[12px] mt-1">{note}</div>}
            <button
              onClick={() => handleDelete(id, added)}
              className="mt-2 min-h-[44px] text-[12px] text-[var(--danger)]"
            >
              Annuler cette période
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
