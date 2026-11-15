import { useEffect, useState } from "react";
import DayPlanEditor from "@/app/components/DayPlanEditor";
import type { DayPlan } from "@/app/lib/period-plan";

type DayPlanResult = {
  key: string;
  day: {
    periodId: string;
    plan: DayPlan;
  } | null;
};

export default function EstimatedDayBanner({ date, onChanged }: { date: string; onChanged: () => void }) {
  const [res, setRes] = useState<DayPlanResult | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<DayPlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      try {
        const response = await fetch(`/api/periods?date=${date}`, { cache: "no-store" });
        const data = await response.json();

        if (!cancelled) {
          setRes({ key: date, day: data.day });
        }
      } catch (err) {
        if (!cancelled) {
          setRes({ key: date, day: null });
        }
      }
    };

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [date]);

  const handleEditClick = () => {
    if (res?.day?.plan) {
      setDraft({ ...res.day.plan });
      setIsEditing(true);
    }
  };

  const handleSave = async () => {
    if (!draft) return;

    try {
      const response = await fetch("/api/periods", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ date, plan: { ...draft, confirmed: true } }),
      });

      if (response.ok) {
        const data = await response.json();
        setRes({ key: date, day: data.day });
        setIsEditing(false);
        setDraft(null);
        setError(null);
        onChanged();
      } else {
        setError("Enregistrement impossible.");
      }
    } catch (err) {
      setError("Enregistrement impossible.");
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setDraft(null);
    setError(null);
  };

  if (!res || res.key !== date || !res.day) {
    return null;
  }

  const { plan } = res.day;

  return (
    <section className="glass p-3 mb-4" aria-label="Jour estimé">
      <h2 className="text-[13px] font-semibold">Jour estimé</h2>
      <p className="text-[12px] text-[var(--text-secondary)]">
        {`${plan.kcal} kcal ${plan.quality === "balanced" ? "équilibrées" : "déséquilibrées"}${plan.ecart ? ", un écart" : ""}${plan.drinks ? `, ${plan.drinks} verre${plan.drinks > 1 ? "s" : ""}` : ""} · ressenti ${plan.feeling.energy}/${plan.feeling.mood}/${plan.feeling.sleep}${plan.confirmed ? "" : " · non confirmé"}`}
      </p>
      {plan.note && <p className="text-[12px] text-[var(--text-secondary)]">{plan.note}</p>}
      <button
        className="min-h-[44px]"
        aria-expanded={isEditing}
        onClick={handleEditClick}
      >
        Modifier ce jour
      </button>
      {isEditing && draft && (
        <div>
          <DayPlanEditor plan={draft} onChange={setDraft} />
          <button onClick={handleSave}>Enregistrer</button>
          <button onClick={handleCancel}>Annuler</button>
          {error && <p role="alert">{error}</p>}
        </div>
      )}
      <p className="text-[11px] text-[var(--text-muted)]">
        Les aliments ajoutés à la main ce jour-là sont conservés.
      </p>
    </section>
  );
}
