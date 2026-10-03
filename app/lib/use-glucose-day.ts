import { useEffect, useState } from "react";
import type { GlucoseDay, GlucoseReading } from "./types";

/**
 * Lectures de glycemie d'un jour. `undefined` = chargement (ou suivi desactive), `null` = erreur,
 * tableau = lectures (vide si le capteur n'a rien remonte). Une seule requete par jour, partagee par la
 * carte Glycemie et par les reponses affichees dans chaque repas du journal.
 */
export function useGlucoseDay(date: string, enabled: boolean): GlucoseReading[] | null | undefined {
  const [state, setState] = useState<{ date: string; readings: GlucoseReading[] | null } | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    fetch(`/api/glucose?from=${date}&to=${date}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
      .then((d: { days: GlucoseDay[] }) => { if (!cancelled) setState({ date, readings: d.days[0]?.readings ?? [] }); })
      .catch(() => { if (!cancelled) setState({ date, readings: null }); });
    return () => { cancelled = true; };
  }, [date, enabled]);

  // Reponse d'un autre jour = ancienne donnee : on affiche le chargement plutot qu'une courbe perimee.
  if (!enabled || !state || state.date !== date) return undefined;
  return state.readings;
}
