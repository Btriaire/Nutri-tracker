import { NextRequest, NextResponse } from "next/server";
import { createSession } from "@/app/lib/session";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

const COOKIE = "session";
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  try {
    const { idToken, bypass } = await req.json() as { idToken?: string; bypass?: { email: string; pass: string } };

    if (bypass) {
      const { email, pass } = bypass;
      if (
        email === process.env.ADMIN_EMAIL &&
        pass  === process.env.ADMIN_PASS
      ) {
        const token = Buffer.from(JSON.stringify({ type: "bypass", email, ts: Date.now() })).toString("base64");
        const store = await cookies();
        store.set(COOKIE, token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: TTL_MS / 1000,
          path: "/",
        });
        return NextResponse.json({ ok: true });
      }
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    if (idToken) {
      await createSession(idToken);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Missing idToken or bypass credentials" }, { status: 400 });
  } catch (err) {
    console.error("/api/auth/session", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
