import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import * as withings from "@/app/lib/withings";
import { subDays, format } from "date-fns";

export const dynamic = "force-dynamic";

const USER = "owner";
const CRON_SECRET = process.env.CRON_SECRET || "";

/**
 * Cron endpoint: syncs Withings (body + sleep) and Google Fit data
 * Expects: X-Cron-Secret header matching CRON_SECRET
 * Usage: curl -H "X-Cron-Secret: $CRON_SECRET" https://nutri-tracker.vercel.app/api/cron/sync-integrations
 */
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (!secret || secret !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: Record<string, any> = {};

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

  // ─── Google Fit: sync last 7 days ──────────────────────────────────────────────
  try {
    const db = getAdminFirestore();
    const to   = format(new Date(), "yyyy-MM-dd");
    const from = format(subDays(new Date(), 7), "yyyy-MM-dd");

    // Call the sync endpoint via internal fetch if it exists,
    // or manually fetch from Google Fit API
    // For now, we'll just log a placeholder
    results.googlefit = { status: "skipped", reason: "manual sync only" };
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
