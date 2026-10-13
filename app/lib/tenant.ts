// Multi-utilisateur : chaque compte a son espace Firestore users/{userId}. Le proprietaire garde "owner"
// (ses donnees ne bougent pas). Les autres comptes ont userId = uid Firebase, et ne voient que les routes
// listees dans TENANT_PREFIXES (middleware) : tout le reste leur est refuse, pour ne jamais melanger.
import { NextResponse } from "next/server";
import { getSession } from "./session";

export const OWNER_ID = "owner";

/** Quel compte se connecte avec cet email : "owner", un uid de compte autorise, ou null (refuse). */
export function resolveUserId(email: string, uid: string, env: { adminEmail?: string; allowedEmails?: string }): string | null {
  const mail = email.trim().toLowerCase();
  if (env.adminEmail && mail === env.adminEmail.trim().toLowerCase()) return OWNER_ID;
  const allowed = (env.allowedEmails ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  return allowed.includes(mail) ? uid : null;
}

/** userId de la session en cours, ou une reponse 401 a renvoyer telle quelle. */
export async function requireUser(): Promise<{ userId: string } | NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return { userId: session.userId };
}

export const isOwner = (userId: string) => userId === OWNER_ID;
