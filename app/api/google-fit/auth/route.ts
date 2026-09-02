import { NextResponse } from "next/server";

const SCOPES = [
  "https://www.googleapis.com/auth/fitness.activity.read",
  "https://www.googleapis.com/auth/fitness.body.read",
  "https://www.googleapis.com/auth/fitness.heart_rate.read",
  "https://www.googleapis.com/auth/fitness.sleep.read",
  "https://www.googleapis.com/auth/fitness.location.read",
  "https://www.googleapis.com/auth/fitness.blood_pressure.read",
].join(" ");

export async function GET() {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id",     process.env.GOOGLE_CLIENT_ID!.trim());
  url.searchParams.set("redirect_uri",  process.env.GOOGLE_REDIRECT_URI!.trim());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope",         SCOPES);
  url.searchParams.set("access_type",   "offline");
  url.searchParams.set("prompt",        "consent"); // force refresh_token
  return NextResponse.redirect(url.toString());
}
