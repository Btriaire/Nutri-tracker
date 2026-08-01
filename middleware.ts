import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PREFIXES = [
  "/login",
  "/api/auth/",
  "/api/withings/auth",
  "/api/withings/callback",
  "/api/apple-health/ingest",
  "/api/google-fit/test-sleep",
  "/report/print",
  "/api/report/generate",
  "/api/meditation",
  "/_next/",
  "/favicon",
  "/auth.txt",
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Racine "/" : splash animé public (joué connecté ou non), redirige ensuite
  if (pathname === "/") return NextResponse.next();

  const isPublic = PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));

  if (isPublic) return NextResponse.next();

  const session = req.cookies.get("session")?.value;
  if (session) return NextResponse.next();

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
