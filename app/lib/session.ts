import { cookies } from "next/headers";
import { sessionSecret, signSession, verifySession } from "./session-crypto";

const COOKIE = "session";
const TTL    = 7 * 24 * 60 * 60; // 7 days in seconds

export interface SessionPayload {
  userId: string;
  email:  string;
  name:   string;
}

export async function getSession(): Promise<SessionPayload | null> {
  const secret = sessionSecret();
  // Pas de secret configuré → on refuse tout (fail closed) plutôt que
  // d'accepter des cookies non vérifiables.
  if (!secret) {
    console.error("[session] SESSION_SECRET manquant ou trop court (32 car. min) — toutes les sessions sont refusées");
    return null;
  }

  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;

  const json = await verifySession(token, secret);
  if (!json) return null;

  try {
    const data = JSON.parse(json) as SessionPayload;
    if (!data?.userId) return null;
    return { userId: data.userId, email: data.email, name: data.name };
  } catch {
    return null;
  }
}

export async function createSession(payload: SessionPayload): Promise<void> {
  const secret = sessionSecret();
  if (!secret) throw new Error("SESSION_SECRET manquant ou trop court (32 caractères minimum)");

  const token = await signSession(JSON.stringify({ ...payload, exp: Date.now() + TTL * 1000 }), secret);
  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge:   TTL,
    path:     "/",
  });
}

export async function deleteSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}
