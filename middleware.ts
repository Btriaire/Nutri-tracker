import { NextRequest, NextResponse } from "next/server";
import { sessionSecret, verifySession } from "@/app/lib/session-crypto";

// Routes et pages deja cloisonnees par utilisateur (userId de la session). Les autres : proprietaire seulement.
const TENANT_PREFIXES = [
  "/log", "/settings",
  "/api/goals", "/api/log", "/api/meals", "/api/meal-timing", "/api/micronutrient-intakes", "/api/supplements",
  "/api/supplement-intakes", "/api/supplements-progress", "/api/custom-nutrients", "/api/custom-foods", "/api/streak",
  "/api/repartition", "/api/food", "/api/measurements", "/api/workout-templates",
];

const PUBLIC_PREFIXES = [
  "/login",
  "/offline",        // page de secours hors ligne (aucune donnee)
  "/sw.js",
  "/manifest.json",
  "/api/auth/",
  "/api/withings/auth",
  "/api/withings/callback",
  "/api/apple-health/ingest",
  "/api/apple-health/hae",
  "/report/print",
  "/api/report/generate",
  "/api/infographic/upload",
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
  const payload = token && secret ? await verifySession(token, secret) : null;
  if (payload) {
    const userId = (JSON.parse(payload) as { userId?: string }).userId;
    // Comptes ajoutes (multi-utilisateur) : seulement les routes deja cloisonnees par utilisateur
    if (userId && userId !== "owner" && !TENANT_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/") || pathname.startsWith(p + "?"))) {
      if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      return NextResponse.redirect(new URL("/log", req.url));
    }
    return NextResponse.next();
  }

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
