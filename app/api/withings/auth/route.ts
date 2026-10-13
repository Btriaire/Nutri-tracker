import { NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";
import { makeOauthState } from "@/app/lib/oauth-state";

export const dynamic = "force-dynamic";

const SCOPES = "user.metrics,user.activity";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/login", process.env.WITHINGS_REDIRECT_URI ?? "http://localhost"));
  const state = await makeOauthState(session.userId);
  if (!state) return NextResponse.json({ error: "Session secret missing" }, { status: 500 });
  const clientId    = process.env.WITHINGS_CLIENT_ID?.trim();
  const redirectUri = process.env.WITHINGS_REDIRECT_URI?.trim();

  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { error: "Withings env vars not configured", clientId: !!clientId, redirectUri: !!redirectUri },
      { status: 500 },
    );
  }

  const url = new URL("https://account.withings.com/oauth2_user/authorize2");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id",     clientId);
  url.searchParams.set("redirect_uri",  redirectUri);
  url.searchParams.set("scope",         SCOPES);
  url.searchParams.set("state",         state);

  return NextResponse.redirect(url.toString());
}
