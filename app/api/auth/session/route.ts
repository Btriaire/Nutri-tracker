import { NextRequest, NextResponse } from "next/server";
import { createSession } from "@/app/lib/session";
import { getAdminAuth } from "@/app/lib/firebase-admin";
import { resolveUserId } from "@/app/lib/tenant";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { idToken, bypass } = await req.json() as {
      idToken?: string;
      bypass?:  { email: string; pass: string };
    };

    // ── Email / password bypass ────────────────────────────────────────────
    if (bypass) {
      const { email, pass } = bypass;
      if (
        email === process.env.ADMIN_EMAIL &&
        pass  === process.env.ADMIN_PASS  &&
        process.env.ADMIN_EMAIL
      ) {
        await createSession({ userId: "owner", email, name: "Bruno" });
        return NextResponse.json({ ok: true });
      }
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    // ── Firebase ID token (Google Sign-In) ─────────────────────────────────
    if (idToken) {
      const adminAuth = getAdminAuth();
      let decoded;
      try {
        decoded = await adminAuth.verifyIdToken(idToken);
      } catch {
        return NextResponse.json({ error: "Invalid token" }, { status: 401 });
      }

      // Proprietaire (ADMIN_EMAIL) = "owner" ; comptes ajoutes (ALLOWED_EMAILS) = leur uid Firebase
      const userId = resolveUserId(decoded.email ?? "", decoded.uid, {
        adminEmail: process.env.ADMIN_EMAIL,
        allowedEmails: process.env.ALLOWED_EMAILS,
      });
      if (!userId) {
        return NextResponse.json({ error: "Unauthorized account" }, { status: 403 });
      }

      await createSession({
        userId,
        email:  decoded.email ?? "",
        name:   decoded.name  ?? decoded.email ?? "Owner",
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Missing credentials" }, { status: 400 });
  } catch (err) {
    console.error("/api/auth/session", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
