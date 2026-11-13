"use client";
import { useState } from "react";
import Sheet from "@/app/components/Sheet";
import { dayTemplate, type DayQuality } from "@/app/lib/day-template";

export default function DayTemplateModal({
  date,
  hasEntries,
  onClose,
  onAdded,
}: {
  date: string;
  hasEntries: boolean;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [kcal, setKcal] = useState(2000);
  const [quality, setQuality] = useState<DayQuality>("balanced");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [customKcal, setCustomKcal] = useState("");

  const handleKcalChange = (value: number) => {
    setKcal(value);
    setCustomKcal("");
  };

  const handleCustomKcalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCustomKcal(e.target.value);
    const value = Number(e.target.value);
    if (!isNaN(value) && value >= 1000 && value <= 5000) {
      setKcal(value);
    }
  };

  const handleAddDay = async () => {
    if (isSaving || isNaN(kcal) || kcal < 1000 || kcal > 5000) return;

    setIsSaving(true);
    setError("");

    try {
      const response = await fetch("/api/log/batch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          date,
          entries: dayTemplate(kcal, quality),
        }),
      });

      if (response.ok) {
        onAdded();
      } else {
        throw new Error("Ajout impossible");
      }
    } catch (err) {
      setError("Ajout impossible. Vérifie ta connexion et réessaie.");
    } finally {
      setIsSaving(false);
    }
  };

  const formattedDate = new Date(date + "T12:00:00").toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <Sheet open onClose={onClose} title="Journée type">
      <div className="flex flex-col gap-4 p-4">
        {!error ? (
          <>
            <p className="text-sm text-[var(--text-secondary)]">
              Pour rattraper un jour non saisi : une estimation moyenne répartie sur le petit-déjeuner, le déjeuner, une collation et le dîner. Elle sera marquée comme estimation.
            </p>
            <div>
              <h3 className="text-sm font-semibold">Calories</h3>
              <div className="flex gap-2 mt-2">
                <button
                  className={`min-h-[44px] flex-1 rounded-lg border px-3 text-sm ${kcal === 1500 ? "bg-[var(--accent)] text-white border-[var(--accent)]" : "bg-[var(--layer-2)] text-[var(--text-primary)] border-[var(--border)]"}`}
                  onClick={() => handleKcalChange(1500)}
                >
                  1500
                </button>
                <button
                  className={`min-h-[44px] flex-1 rounded-lg border px-3 text-sm ${kcal === 2000 ? "bg-[var(--accent)] text-white border-[var(--accent)]" : "bg-[var(--layer-2)] text-[var(--text-primary)] border-[var(--border)]"}`}
                  onClick={() => handleKcalChange(2000)}
                >
                  2000
                </button>
                <button
                  className={`min-h-[44px] flex-1 rounded-lg border px-3 text-sm ${kcal === 2500 ? "bg-[var(--accent)] text-white border-[var(--accent)]" : "bg-[var(--layer-2)] text-[var(--text-primary)] border-[var(--border)]"}`}
                  onClick={() => handleKcalChange(2500)}
                >
                  2500
                </button>
                <button
                  className={`min-h-[44px] flex-1 rounded-lg border px-3 text-sm ${customKcal !== "" ? "bg-[var(--accent)] text-white border-[var(--accent)]" : "bg-[var(--layer-2)] text-[var(--text-primary)] border-[var(--border)]"}`}
                  onClick={() => setCustomKcal("")}
                >
                  Autre
                </button>
              </div>
              {customKcal !== "" && (
                <div className="mt-2">
                  <label htmlFor="custom-calories-input" className="text-sm">Calories de la journée</label>
                  <input
                    id="custom-calories-input"
                    type="number"
                    inputMode="numeric"
                    min={1000}
                    max={5000}
                    step={50}
                    value={customKcal}
                    onChange={handleCustomKcalChange}
                    className="min-h-[44px] w-full rounded-lg border px-3 text-sm bg-[var(--layer-2)] text-[var(--text-primary)] border-[var(--border)] mt-1"
                  />
                  {isNaN(Number(customKcal)) || Number(customKcal) < 1000 || Number(customKcal) > 5000 ? (
                    <p className="text-sm text-[var(--danger)]">Entre 1000 et 5000 kcal</p>
                  ) : null}
                </div>
              )}
            </div>
            <div>
              <h3 className="text-sm font-semibold">Qualité</h3>
              <div className="flex gap-2 mt-2">
                <button
                  className={`min-h-[44px] flex-1 rounded-lg border px-3 text-sm ${quality === "balanced" ? "bg-[var(--accent)] text-white border-[var(--accent)]" : "bg-[var(--layer-2)] text-[var(--text-primary)] border-[var(--border)]"}`}
                  onClick={() => setQuality("balanced")}
                >
                  Équilibrée
                  <span className="block text-xs text-[var(--text-muted)]">légumes, protéines, peu de sucre et de sel</span>
                </button>
                <button
                  className={`min-h-[44px] flex-1 rounded-lg border px-3 text-sm ${quality === "unbalanced" ? "bg-[var(--accent)] text-white border-[var(--accent)]" : "bg-[var(--layer-2)] text-[var(--text-primary)] border-[var(--border)]"}`}
                  onClick={() => setQuality("unbalanced")}
                >
                  Déséquilibrée
                  <span className="block text-xs text-[var(--text-muted)]">plats rapides, sucré, gras, salé</span>
                </button>
              </div>
            </div>
            {hasEntries && (
              <p className="text-sm text-[var(--text-muted)]">
                Ce jour contient déjà des aliments : la journée type s&apos;ajoutera à eux.
              </p>
            )}
            <p className="text-sm text-[var(--text-secondary)]">
              {`${kcal} kcal ${quality === "balanced" ? "équilibrées" : "déséquilibrées"} le ${formattedDate}`}
            </p>
          </>
        ) : (
          <p className="text-sm text-[var(--danger)]">{error}</p>
        )}
        <div className="flex gap-2 mt-4">
          <button
            className="min-h-[44px] w-full rounded-lg bg-[var(--layer-2)] text-[var(--text-primary)]"
            onClick={onClose}
          >
            Annuler
          </button>
          <button
            className="min-h-[44px] w-full rounded-lg bg-[var(--accent)] text-white font-semibold disabled:opacity-50"
            onClick={handleAddDay}
            disabled={isSaving || isNaN(kcal) || kcal < 1000 || kcal > 5000}
          >
            {isSaving ? "Ajout en cours..." : "Ajouter la journée"}
          </button>
        </div>
      </div>
    </Sheet>
  );
}
