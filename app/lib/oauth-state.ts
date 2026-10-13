// Parametre "state" des connexions OAuth (Withings, Google Fit) : porte le compte qui connecte, signe
// avec le secret de session pour que le retour du fournisseur ne puisse pas etre fabrique par un tiers.
import { sessionSecret, signSession, verifySession } from "./session-crypto";

const TTL_MS = 15 * 60 * 1000;

export async function makeOauthState(userId: string): Promise<string | null> {
  const secret = sessionSecret();
  if (!secret) return null;
  return signSession(JSON.stringify({ userId, exp: Date.now() + TTL_MS }), secret);
}

export async function readOauthState(state: string | null): Promise<string | null> {
  const secret = sessionSecret();
  if (!secret || !state) return null;
  const json = await verifySession(state, secret);
  if (!json) return null;
  const data = JSON.parse(json) as { userId?: string };
  return data.userId ?? null;
}
