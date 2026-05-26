import { getAdminAuth } from "./firebase-admin";
import { cookies } from "next/headers";

const COOKIE = "session";
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface SessionPayload {
  userId: string;
  email: string;
  name: string;
}

export async function createSession(idToken: string) {
  const adminAuth = getAdminAuth();
  const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn: TTL_MS });
  const store = await cookies();
  store.set(COOKIE, sessionCookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: TTL_MS / 1000,
    path: "/",
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  // Auth disabled — personal app, single owner
  return { userId: "owner", email: process.env.ADMIN_EMAIL ?? "owner", name: "Bruno" };

  // eslint-disable-next-line no-unreachable
  try {
    const store = await cookies();
    const cookie = store.get(COOKIE)?.value;
    if (!cookie) return null;

    // Bypass token (owner login without Firebase)
    try {
      const raw = Buffer.from(cookie, "base64").toString("utf-8");
      if (raw.startsWith("{")) {
        const p = JSON.parse(raw) as { type?: string; email?: string; ts?: number };
        if (p.type === "bypass" && p.email && p.ts) {
          const ownerEmail = process.env.ADMIN_EMAIL ?? "";
          if (p.email.toLowerCase() === ownerEmail.toLowerCase() && Date.now() - p.ts < TTL_MS) {
            return { userId: "owner", email: p.email, name: "Bruno" };
          }
          return null;
        }
      }
    } catch { /* not a bypass token */ }

    const adminAuth = getAdminAuth();
    const decoded = await adminAuth.verifySessionCookie(cookie, true);
    return { userId: decoded.uid, email: decoded.email ?? "", name: (decoded.name as string) ?? "" };
  } catch {
    return null;
  }
}

export async function deleteSession() {
  const store = await cookies();
  try {
    const cookie = store.get(COOKIE)?.value;
    if (cookie) {
      const raw = Buffer.from(cookie, "base64").toString("utf-8");
      if (!raw.startsWith("{")) {
        const adminAuth = getAdminAuth();
        const decoded = await adminAuth.verifySessionCookie(cookie);
        await adminAuth.revokeRefreshTokens(decoded.sub);
      }
    }
  } catch { /* ignore */ }
  store.delete(COOKIE);
}
