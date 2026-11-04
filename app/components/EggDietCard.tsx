"use client";
import { useState, useEffect } from "react";
import { IconLoader2 } from "@tabler/icons-react";
import { EGG_DIET_DURATIONS, eggProgramStatus } from "@/app/lib/egg-diet";
import type { EggProgramPrefs } from "@/app/lib/egg-diet";

export default function EggDietCard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [program, setProgram] = useState<EggProgramPrefs | null>(null);
  const [selectedDuration, setSelectedDuration] = useState(5);
  const [autoFill, setAutoFill] = useState(true);

  useEffect(() => {
    const fetchGoals = async () => {
      try {
        const response = await fetch("/api/goals");
        if (!response.ok) throw new Error("Erreur réseau");
        const data = await response.json();
        setProgram(data.eggProgram || null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur inconnue");
      } finally {
        setLoading(false);
      }
    };
    fetchGoals();
  }, []);

  const handleStart = async () => {
    setLoading(true);
    setError(null);
    try {
      const today = new Date();
      const startDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      const response = await fetch("/api/goals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eggProgram: { startDate, days: selectedDuration, autoFill, filled: [] } }),
      });
      if (!response.ok) throw new Error("Erreur réseau");
      const data = await response.json();
      if (data.ok) setProgram({ startDate, days: selectedDuration, autoFill, filled: [] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/goals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eggProgram: null }),
      });
      if (!response.ok) throw new Error("Erreur réseau");
      const data = await response.json();
      if (data.ok) setProgram(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  };

  const handleAutoFillChange = async (newAutoFill: boolean) => {
    if (!program) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/goals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eggProgram: { ...program, autoFill: newAutoFill } }),
      });
      if (!response.ok) throw new Error("Erreur réseau");
      const data = await response.json();
      if (data.ok) setProgram({ ...program, autoFill: newAutoFill });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  };

  const today = new Date();
  const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const status = eggProgramStatus(program, todayString);

  return (
    <div className="bg-[var(--layer-1)] rounded-lg p-4">
      <h2 className="text-[var(--text-primary)] text-lg font-bold">Régime aux œufs</h2>
      <p className="text-[var(--text-secondary)] text-sm mb-4">
        Programme court : chaque jour, les zones de repas sont remplies avec un menu à base d&apos;œufs, que tu peux modifier ensuite.
      </p>
      <p className="text-[var(--text-muted)] text-xs mb-4">
        Menu type d&apos;environ 1 300 kcal par jour, à suivre quelques jours seulement. Ce n&apos;est pas un avis médical : demande conseil à ton médecin ou à un diététicien si tu as une pathologie, un traitement, ou si tu es enceinte.
      </p>
      {loading ? (
        <div className="flex justify-center items-center py-4">
          <IconLoader2 className="animate-spin text-[var(--text-primary)]" />
        </div>
      ) : error ? (
        <div role="alert" className="text-[var(--danger)] text-sm mb-4">
          {error}
        </div>
      ) : program ? (
        <div>
          <p className="text-[var(--text-primary)] mb-2">
            {status.active ? `Jour ${status.day} sur ${status.total}` : "Programme terminé"}
          </p>
          <p className="text-[var(--text-secondary)] mb-4">Début : {program.startDate}</p>
          <div className="flex items-center mb-4">
            <label className="text-[var(--text-secondary)] mr-2">Remplir automatiquement chaque jour</label>
            <button
              role="switch"
              aria-checked={program.autoFill}
              onClick={() => handleAutoFillChange(!program.autoFill)}
              className={`relative inline-flex items-center h-6 rounded-full w-11 ${program.autoFill ? "bg-[var(--accent)]" : "bg-[var(--border)]"}`}
              disabled={loading}
            >
              <span className={`inline-block w-4 h-4 transform transition-transform ${program.autoFill ? "translate-x-6" : "translate-x-1"} bg-white rounded-full`} />
            </button>
          </div>
          <button
            onClick={handleStop}
            className="w-full bg-[var(--danger)] text-white py-2 px-4 rounded min-h-[44px] hover:bg-[var(--danger)]/90 disabled:opacity-50"
            disabled={loading}
          >
            Arrêter le programme
          </button>
        </div>
      ) : (
        <div>
          <div role="radiogroup" className="flex gap-2 mb-4">
            {EGG_DIET_DURATIONS.map((days) => (
              <button
                key={days}
                role="radio"
                aria-checked={selectedDuration === days}
                onClick={() => setSelectedDuration(days)}
                className={`flex-1 py-2 px-4 rounded min-h-[44px] ${selectedDuration === days ? "bg-[var(--accent)] text-white" : "bg-[var(--layer-2)] text-[var(--text-primary)]"}`}
              >
                {days} jours
              </button>
            ))}
          </div>
          <div className="flex items-center mb-4">
            <label className="text-[var(--text-secondary)] mr-2">Remplir automatiquement chaque jour</label>
            <button
              role="switch"
              aria-checked={autoFill}
              onClick={() => setAutoFill(!autoFill)}
              className={`relative inline-flex items-center h-6 rounded-full w-11 ${autoFill ? "bg-[var(--accent)]" : "bg-[var(--border)]"}`}
              disabled={loading}
            >
              <span className={`inline-block w-4 h-4 transform transition-transform ${autoFill ? "translate-x-6" : "translate-x-1"} bg-white rounded-full`} />
            </button>
          </div>
          <button
            onClick={handleStart}
            className="w-full bg-[var(--ok)] text-white py-2 px-4 rounded min-h-[44px] hover:bg-[var(--ok)]/90 disabled:opacity-50"
            disabled={loading}
          >
            Démarrer aujourd&apos;hui
          </button>
        </div>
      )}
    </div>
  );
}
