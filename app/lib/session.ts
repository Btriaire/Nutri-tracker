import { cookies } from "next/headers";

const COOKIE = "session";

export interface SessionPayload {
  userId: string;
  email:  string;
  name:   string;
}

// Auth disabled — personal app, single owner
export async function getSession(): Promise<SessionPayload | null> {
  return { userId: "owner", email: process.env.ADMIN_EMAIL ?? "owner", name: "Bruno" };
}

export async function createSession(_idToken: string) {
  void _idToken;
}

export async function deleteSession() {
  const store = await cookies();
  store.delete(COOKIE);
}
