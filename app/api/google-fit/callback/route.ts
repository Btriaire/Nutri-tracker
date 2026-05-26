import { NextRequest, NextResponse } from "next/server";
import { saveTokens, syncDay } from "@/app/lib/google-fit";
import { format } from "date-fns";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code  = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(new URL("/settings?fit=error", req.url));
  }

  // Exchange code for tokens
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:    new URLSearchParams({
      grant_type:   "authorization_code",
      code,
      redirect_uri:  process.env.GOOGLE_REDIRECT_URI!.trim(),
      client_id:     process.env.GOOGLE_CLIENT_ID!.trim(),
      client_secret: process.env.GOOGLE_CLIENT_SECRET!.trim(),
    }),
  });

  const json = await res.json() as {
    access_token?:  string;
    refresh_token?: string;
    expires_in?:    number;
    error?:         string;
  };

  if (!json.access_token || !json.refresh_token) {
    console.error("Token exchange failed:", json);
    return NextResponse.redirect(new URL("/settings?fit=error", req.url));
  }

  try {
    await saveTokens("owner", {
      accessToken:  json.access_token,
      refreshToken: json.refresh_token,
      expiresAt:    Date.now() + (json.expires_in ?? 3600) * 1000,
    });
  } catch (e) {
    console.error("saveTokens failed:", e);
    return NextResponse.redirect(new URL("/settings?fit=error", req.url));
  }

  // Sync today in background (don't fail the redirect if it errors)
  syncDay("owner", format(new Date(), "yyyy-MM-dd")).catch(console.error);

  return NextResponse.redirect(new URL("/settings?fit=connected", req.url));
}
