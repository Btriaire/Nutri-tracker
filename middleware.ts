import { NextRequest, NextResponse } from "next/server";
import { sessionSecret, verifySession } from "@/app/lib/session-crypto";

const PUBLIC_PREFIXES = [
  "/login",
  "/api/auth/",
  "/api/withings/auth",
  "/api/withings/callback",
  "/api/apple-health/ingest",
  "/api/apple-health/hae",
  "/report/print",
  "/api/report/generate",
  "/api/meditation",
  "/api/mental-health",
  "/api/vibefit",
  "/api/cron/sync-integrations",
  "/api/cron/backup",
  "/api/google-fit/sync-range",
  "/_next/",
  "/favicon",
  "/auth.txt",
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Racine "/" : splash animé public (joué connecté ou non), redirige ensuite
  if (pathname === "/") return NextResponse.next();

  const isPublic = PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));

  if (isPublic) return NextResponse.next();

  // Vérifie la SIGNATURE du cookie, pas juste sa présence : un simple test
  // d'existence laissait passer n'importe quel cookie fabriqué à la main.
  const token  = req.cookies.get("session")?.value;
  const secret = sessionSecret();
  if (token && secret && await verifySession(token, secret)) return NextResponse.next();

  // API routes → 401 JSON
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Pages → redirect to /login
  const loginUrl = new URL("/login", req.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|auth\\.txt|.*\\.png$|.*\\.svg$).*)"],
};
