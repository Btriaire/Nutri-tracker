import { useCallback, useEffect, useState } from "react";
import { addDays, format, parseISO, subDays } from "date-fns";
import { mergeReadings } from "./glucose";
import type { GlucoseDay, GlucoseReading } from "./types";

const POLL_MS = 5 * 60_000;
const TAIL_MS = 4 * 3_600_000;   // queue du lendemain gardee : la reponse d'un diner tardif depasse minuit

export interface GlucoseDayData {
  /** undefined = chargement (ou suivi desactive), null = erreur, tableau = lectures (vide si rien n'a ete recu). */
  readings: GlucoseReading[] | null | undefined;
  /** Derniere lecture du document du jour lui-meme (sans la queue du lendemain) : fin naturelle de la courbe. */
  dayEndMs: number | null;
  syncing: boolean;
  /** Relance une synchronisation Google Fit puis relit. */
  refresh: () => void;
}

/**
 * Lectures de glycemie d'un jour. Une seule requete partagee par la carte Glycemie et par la reponse affichee
 * dans chaque repas. Pour aujourd'hui et hier, le hook declenche une synchronisation LEGERE de la glycemie a
 * l'ouverture puis toutes les 5 min : sans cela, les lectures du soir (donc la reponse du diner) n'arrivaient
 * qu'avec le cron de 05:00 UTC ou une visite du tableau de bord.
 */
export function useGlucoseDay(date: string, enabled: boolean): GlucoseDayData {
  const [state, setState] = useState<{ date: string; readings: GlucoseReading[] | null; dayEndMs: number | null } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const next = format(addDays(parseISO(date), 1), "yyyy-MM-dd");
    const recent = date >= format(subDays(new Date(), 1), "yyyy-MM-dd");
    const isToday = date === format(new Date(), "yyyy-MM-dd");

    const load = async () => {
      try {
        const r = await fetch(`/api/glucose?from=${date}&to=${next}`);
        if (!r.ok) throw new Error();
        const { days } = await r.json() as { days: GlucoseDay[] };
        const mine = days.find((d) => d.date === date)?.readings ?? [];
        const dayEndMs = mine.length ? mine[mine.length - 1].timeMs : null;
        const tail = (days.find((d) => d.date === next)?.readings ?? []).filter((x) => dayEndMs === null || x.timeMs <= dayEndMs + TAIL_MS);
        if (!cancelled) setState({ date, readings: mergeReadings(mine, tail), dayEndMs });
      } catch {
        if (!cancelled) setState({ date, readings: null, dayEndMs: null });
      }
    };

    const sync = async () => {
      if (!recent) return;
      setSyncing(true);
      try {
        await fetch("/api/glucose/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date }) });
        await load();
      } catch { /* la lecture existante reste affichee */ }
      finally { if (!cancelled) setSyncing(false); }
    };

    void load().then(sync);
    const timer = isToday ? setInterval(() => { if (document.visibilityState === "visible") void sync(); }, POLL_MS) : null;
    return () => { cancelled = true; if (timer) clearInterval(timer); };
  }, [date, enabled, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  // Reponse d'un autre jour = ancienne donnee : on affiche le chargement plutot qu'une courbe perimee.
  if (!enabled || !state || state.date !== date) return { readings: undefined, dayEndMs: null, syncing, refresh };
  return { readings: state.readings, dayEndMs: state.dayEndMs, syncing, refresh };
}
