// Point unique pour les appels Groq : ids de modèles + traduction des erreurs.
//
// Pourquoi ce fichier existe : les ids de modèles étaient codés en dur dans 15
// fichiers. Groq a renommé qwen3.6-27b -> qwen3.8-27b et l'ancien id a commencé
// à répondre "model_not_found" — le Scan Visage ET l'analyse photo de repas
// sont restés morts plusieurs jours, avec pour seul indice un "Vision API
// error" opaque côté client. Un id à changer = un seul endroit désormais.

import { getAdminFirestore } from "./firebase-admin";

export const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

/** Modèle texte (JSON structuré, synthèses, recherche). */
export const GROQ_TEXT_MODEL = "openai/gpt-oss-120b";

/** Modèle vision (images). Accepte plusieurs images par requête. */
export const GROQ_VISION_MODEL = "qwen/qwen3.8-27b";

/**
 * Plafond de tokens de sortie pour les appels vision.
 *
 * Groq applique sur ce modèle une limite OTPM (output tokens/minute) de 1000
 * sur le palier on_demand, séparée du quota total de tokens. Chaque requête
 * réserve son max_tokens sur ce budget glissant : une valeur élevée peut faire
 * rejeter la requête entière en 429 AVANT génération
 * ("Limit 1000, Requested 1200"), sans rapport avec la taille réelle de la
 * réponse.
 *
 * Ce n'est PAS un plafond dur par requête — un max_tokens de 1500 passe sur un
 * budget intact et une requête légère. Mais les appels vision de l'app (1 à 2
 * images, gros prompt) ont été rejetés de façon répétée à 1200-1500, et 900
 * s'est avéré fiable. On reste donc sous le seuil plutôt que de parier sur
 * l'état du budget au moment de l'appel.
 */
export const GROQ_VISION_MAX_TOKENS = 900;

export interface GroqFailure {
  /** Code stable, pour brancher dessus côté appelant si besoin. */
  code:    "model_not_found" | "rate_limit" | "quota" | "auth" | "bad_request" | "timeout" | "unknown";
  /** Message en français, affichable tel quel à l'utilisateur. */
  message: string;
  status:  number;
  /** Corps brut renvoyé par Groq, pour les logs (jamais affiché à l'utilisateur). */
  raw:     string;
}

/**
 * Traduit une réponse d'erreur Groq en message actionnable, au lieu du
 * "Vision API error" générique qui ne disait ni quoi ni pourquoi.
 */
export function describeGroqError(status: number, raw: string): GroqFailure {
  let code: GroqFailure["code"] = "unknown";
  let message = `Service IA indisponible (erreur ${status}).`;

  const lower = raw.toLowerCase();

  if (lower.includes("model_not_found") || lower.includes("does not exist")) {
    code = "model_not_found";
    message = "Le modèle IA n'existe plus chez Groq (renommé ou retiré) — l'id doit être mis à jour dans app/lib/groq.ts.";
  } else if (lower.includes("otpm") || lower.includes("output tokens per minute")) {
    code = "rate_limit";
    message = "Quota Groq de tokens de sortie par minute dépassé : la requête demande plus que le plafond du palier. Réduire max_tokens.";
  } else if (status === 429 || lower.includes("rate_limit")) {
    code = "rate_limit";
    message = "Quota Groq atteint pour le moment — réessaie dans une minute.";
  } else if (lower.includes("insufficient_quota") || lower.includes("billing")) {
    code = "quota";
    message = "Quota Groq épuisé sur ce compte.";
  } else if (status === 401 || status === 403) {
    code = "auth";
    message = "Clé API Groq invalide ou révoquée (GROQ_API_KEY).";
  } else if (status === 400 || status === 413 || status === 422) {
    code = "bad_request";
    message = "Requête refusée par Groq (image trop lourde ou format invalide).";
  }

  return { code, message, status, raw };
}

/**
 * Trace l'échec côté serveur ET dans Firestore, pour pouvoir diagnostiquer
 * après coup sans avoir à tailer les logs Vercel en direct (ce qui était le
 * seul moyen jusqu'ici, et donc jamais fait).
 */
export async function recordGroqFailure(context: string, failure: GroqFailure): Promise<void> {
  console.error(`[groq:${context}] ${failure.code} (${failure.status}) — ${failure.message}`, failure.raw.slice(0, 500));
  try {
    await getAdminFirestore().doc(`debug/groq-last-error-${context}`).set({
      context,
      code:    failure.code,
      status:  failure.status,
      message: failure.message,
      raw:     failure.raw.slice(0, 2000),
      at:      new Date().toISOString(),
    });
  } catch {
    // Le diagnostic ne doit jamais faire échouer la requête elle-même.
  }
}
