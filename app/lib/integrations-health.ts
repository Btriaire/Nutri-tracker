// Calcul de l'état des synchros, partagé entre le rendu serveur de Réglages
// (données initiales, sans effet client) et la route API (bouton "revérifier").
import { getAdminFirestore } from "./firebase-admin";

const USER = "owner";
const DAYS_SCANNED = 10;
const STALE_AFTER_DAYS = 3;

export type IntegrationState = "ok" | "stale" | "error" | "off";

export interface IntegrationHealth {
  id:           "googleFit" | "appleHealth" | "withings" | "ai";
  label:        string;
  state:        IntegrationState;
  /** Dernier jour portant de VRAIES données (pas juste un ping de synchro). */
  lastDataDate: string | null;
  staleDays:    number | null;
  detail:       string;
}

function ymd(d: Date) { return d.toISOString().slice(0, 10); }

/** Vrai si le nœud porte au moins une valeur utile (hors marqueur de synchro). */
function hasRealData(node: Record<string, unknown> | undefined): boolean {
  if (!node) return false;
  return Object.entries(node).some(([k, v]) => {
    if (k === "syncedAt" || k === "date") return false;
    if (v === null || v === undefined) return false;
    if (typeof v === "number") return v > 0;
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === "object") return Object.keys(v as object).length > 0;
    return true;
  });
}

export async function getIntegrationsHealth(): Promise<IntegrationHealth[]> {
  const db = getAdminFirestore();
  const today = new Date();

  const dates: string[] = [];
  for (let i = 0; i < DAYS_SCANNED; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    dates.push(ymd(d));
  }

  // Des get() explicites plutôt qu'une query triée : orderBy(documentId, "desc")
  // sur fitnessData exige un index composite qui n'existe pas sur ce projet.
  const [profileSnap, gfitTokenSnap, withingsTokenSnap, debugSnap, ...daySnaps] = await Promise.all([
    db.doc(`users/${USER}`).get(),
    db.doc(`users/${USER}/oauthTokens/google_fit`).get(),
    db.doc(`users/${USER}/oauthTokens/withings`).get(),
    db.collection("debug").get(),
    ...dates.map((d) => db.doc(`users/${USER}/fitnessData/${d}`).get()),
  ]);

  const days = daySnaps.map((s, i) => ({
    date: dates[i],
    data: (s.exists ? s.data() : {}) as Record<string, Record<string, unknown> | undefined>,
  }));

  /** Cherche le jour le plus récent où `key` porte de vraies données. */
  const lastDataFor = (key: string): string | null =>
    days.find((d) => hasRealData(d.data[key]))?.date ?? null;

  const daysSince = (date: string | null): number | null =>
    date === null ? null : Math.round((today.getTime() - new Date(date + "T12:00:00").getTime()) / 86_400_000);

  const build = (
    id: IntegrationHealth["id"],
    label: string,
    connected: boolean,
    lastDataDate: string | null,
    opts: { errorDetail?: string; offDetail?: string } = {},
  ): IntegrationHealth => {
    if (opts.errorDetail) return { id, label, state: "error", lastDataDate, staleDays: daysSince(lastDataDate), detail: opts.errorDetail };
    if (!connected)       return { id, label, state: "off", lastDataDate, staleDays: daysSince(lastDataDate), detail: opts.offDetail ?? "Non connecté" };

    const stale = daysSince(lastDataDate);
    if (lastDataDate === null) {
      return { id, label, state: "stale", lastDataDate, staleDays: null,
               detail: `Connecté, mais aucune donnée reçue sur les ${DAYS_SCANNED} derniers jours` };
    }
    if (stale !== null && stale > STALE_AFTER_DAYS) {
      return { id, label, state: "stale", lastDataDate, staleDays: stale,
               detail: `Dernière donnée il y a ${stale} jours` };
    }
    return { id, label, state: "ok", lastDataDate, staleDays: stale,
             detail: stale === 0 ? "Données reçues aujourd'hui" : `Dernière donnée il y a ${stale} jour${stale! > 1 ? "s" : ""}` };
  };

  const profile = (profileSnap.data() ?? {}) as {
    integrations?: { appleHealth?: { connected?: boolean; token?: string } };
  };

  // ── Google Fit : un refresh de token échoué récemment = reconnexion requise
  const gfit = gfitTokenSnap.data();
  const gfitFailedAt = (gfit?.refreshFailedAt as { toMillis?: () => number } | undefined)?.toMillis?.();
  const gfitNeedsReauth = !!gfitFailedAt && Date.now() - gfitFailedAt < 48 * 3600_000;

  const integrations: IntegrationHealth[] = [
    build("googleFit", "Google Fit", gfitTokenSnap.exists, lastDataFor("googleFit"), {
      errorDetail: gfitNeedsReauth ? "Rafraîchissement du token échoué — reconnexion nécessaire" : undefined,
    }),
    // Pour Apple Health on ignore volontairement integrations.appleHealth.lastSyncedAt :
    // il se met à jour même quand le payload reçu ne contenait rien d'exploitable
    // (cas vécu — la synchro semblait active alors qu'aucune donnée n'arrivait).
    build("appleHealth", "Apple Health",
      !!profile.integrations?.appleHealth?.connected && !!profile.integrations?.appleHealth?.token,
      lastDataFor("appleHealth"),
      { offDetail: "Pas de token — voir Réglages > Apple Health" }),
    build("withings", "Withings", withingsTokenSnap.exists,
      lastDataFor("withingsSleep") ?? lastDataFor("withingsBody")),
  ];

  // ── IA (Groq) : remonte la dernière panne enregistrée par recordGroqFailure()
  const recentAiErrors = debugSnap.docs
    .filter((d) => d.id.startsWith("groq-last-error-"))
    .map((d) => d.data() as { context?: string; message?: string; at?: string; code?: string })
    .filter((e) => e.at && Date.now() - new Date(e.at).getTime() < 48 * 3600_000)
    .sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""));

  integrations.push(
    recentAiErrors.length > 0
      ? { id: "ai", label: "IA (Groq)", state: "error", lastDataDate: null, staleDays: null,
          detail: `${recentAiErrors[0].context} : ${recentAiErrors[0].message}` }
      : { id: "ai", label: "IA (Groq)", state: "ok", lastDataDate: null, staleDays: null,
          detail: "Aucune erreur sur les 48 dernières heures" },
  );

  return integrations;
}
