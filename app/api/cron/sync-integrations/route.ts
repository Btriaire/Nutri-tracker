import { NextRequest, NextResponse } from "next/server";
import * as withings from "@/app/lib/withings";
import { subDays, format } from "date-fns";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const USER = "owner";
const CRON_SECRET = process.env.CRON_SECRET || "";

function getBaseUrl() {
  if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

/**
 * Cron endpoint: syncs Withings (body + sleep) and Google Fit data
 * Accepts either the custom X-Cron-Secret header (any external caller, e.g. a VPS cron)
 * or the standard Authorization: Bearer header Vercel's own Cron Jobs send automatically
 * for the same CRON_SECRET — this is registered in vercel.json to run daily on its own.
 * Manual usage: curl -H "X-Cron-Secret: $CRON_SECRET" https://nutri-tracker.vercel.app/api/cron/sync-integrations
 */
export async function POST(req: NextRequest) {
  const xSecret  = req.headers.get("x-cron-secret");
  const bearer   = req.headers.get("authorization");
  const ok = (!!xSecret && xSecret === CRON_SECRET) || (!!bearer && bearer === `Bearer ${CRON_SECRET}`);
  if (!CRON_SECRET || !ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: Record<string, unknown> = {};

  // ─── Withings: sync last 30 days ─────────────────────────────────────────────
  try {
    const to   = format(new Date(), "yyyy-MM-dd");
    const from = format(subDays(new Date(), 30), "yyyy-MM-dd");

    const written = await withings.syncRange(USER, from, to);
    results.withings = { status: "ok", written, from, to };
  } catch (e) {
    const err = e as Error;
    results.withings = { status: "error", message: err.message };
    console.error("[cron] Withings sync failed:", e);
  }

  // ─── Google Fit: sync last 7 days (sessions, HR avg/max, calories, steps) ───────
  try {
    const to   = format(new Date(), "yyyy-MM-dd");
    const from = format(subDays(new Date(), 7), "yyyy-MM-dd");

    const res = await fetch(`${getBaseUrl()}/api/google-fit/sync-range`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ from, to }),
    });
    const data = await res.json();
    results.googlefit = res.ok
      ? { status: "ok", ...data }
      : { status: "error", ...data };
  } catch (e) {
    const err = e as Error;
    results.googlefit = { status: "error", message: err.message };
    console.error("[cron] Google Fit sync failed:", e);
  }

  return NextResponse.json({ ok: true, results }, { status: 200 });
}

// Also support GET for manual trigger
export async function GET(req: NextRequest) {
  return POST(req);
}
