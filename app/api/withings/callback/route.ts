export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { saveTokens, syncRange } from "@/app/lib/withings";
import { format, subDays } from "date-fns";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code  = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(new URL("/settings?withings=error", req.url));
  }

  const res = await fetch("https://wbsapi.withings.net/v2/oauth2", {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:    new URLSearchParams({
      action:        "requesttoken",
      grant_type:    "authorization_code",
      client_id:     process.env.WITHINGS_CLIENT_ID!.trim(),
      client_secret: process.env.WITHINGS_CLIENT_SECRET!.trim(),
      code,
      redirect_uri:  process.env.WITHINGS_REDIRECT_URI!.trim(),
    }),
  });

  const json = await res.json() as {
    status: number;
    body:   { access_token?: string; refresh_token?: string; expires_in?: number };
    error?: string;
  };

  if (json.status !== 0 || !json.body.access_token || !json.body.refresh_token) {
    console.error("Withings token exchange failed:", json);
    return NextResponse.redirect(new URL("/settings?withings=error", req.url));
  }

  try {
    await saveTokens("owner", {
      accessToken:  json.body.access_token,
      refreshToken: json.body.refresh_token,
      expiresAt:    Date.now() + (json.body.expires_in ?? 10800) * 1000,
    });
  } catch (e) {
    console.error("saveTokens failed:", e);
    return NextResponse.redirect(new URL("/settings?withings=error", req.url));
  }

  // Sync last 7 days synchronously so weight shows up immediately on dashboard
  const today = format(new Date(), "yyyy-MM-dd");
  const from7 = format(subDays(new Date(), 6), "yyyy-MM-dd");
  try { await syncRange("owner", from7, today); } catch { /* ignore */ }

  // Continue syncing 30 days in the background after redirect
  const from30 = format(subDays(new Date(), 30), "yyyy-MM-dd");
  syncRange("owner", from30, today).catch(console.error);

  return NextResponse.redirect(new URL("/settings?withings=connected", req.url));
}
