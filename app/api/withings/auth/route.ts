import { NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";

export const dynamic = "force-dynamic";

const SCOPES = "user.metrics,user.activity";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL("https://account.withings.com/oauth2_user/authorize2");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id",     process.env.WITHINGS_CLIENT_ID!.trim());
  url.searchParams.set("redirect_uri",  process.env.WITHINGS_REDIRECT_URI!.trim());
  url.searchParams.set("scope",         SCOPES);
  url.searchParams.set("state",         "nutri");

  return NextResponse.redirect(url.toString());
}
