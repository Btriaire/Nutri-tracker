import { cookies } from "next/headers";

const COOKIE = "session";
const TTL    = 7 * 24 * 60 * 60; // 7 days in seconds

export interface SessionPayload {
  userId: string;
  email:  string;
  name:   string;
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const data = JSON.parse(Buffer.from(token, "base64").toString("utf8"));
    if (data?.userId) return data as SessionPayload;
  } catch {}
  return null;
}

export async function createSession(payload: SessionPayload): Promise<void> {
  const store = await cookies();
  const token = Buffer.from(JSON.stringify(payload)).toString("base64");
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
