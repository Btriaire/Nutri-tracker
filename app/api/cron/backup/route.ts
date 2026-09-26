import { NextRequest, NextResponse } from "next/server";
import { runBackup } from "@/app/lib/backup";
import { getAdminFirestore } from "@/app/lib/firebase-admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CRON_SECRET = process.env.CRON_SECRET || "";

/**
 * Sauvegarde Firestore -> Vercel Blob. Sans parametre : tout sauf les collections a
 * photos (quotidien). `?set=dayPhotos|mealPhotos|faceScans` : une collection photo
 * (hebdomadaire, voir vercel.json). Le resultat est consigne dans system/cronStatus
 * (affiche dans Reglages). Vercel Cron appelle en GET avec Authorization: Bearer.
 * Manuel : curl -H "X-Cron-Secret: $CRON_SECRET" https://nutri-tracker-mocha.vercel.app/api/cron/backup
 */
export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}

async function record(key: string, data: Record<string, unknown>) {
  try {
    await getAdminFirestore().doc("system/cronStatus").set({ [key]: data }, { merge: true });
  } catch (e) {
    console.error("[cron/backup] statut non enregistre", e);
  }
}

async function handle(req: NextRequest) {
  const xSecret = req.headers.get("x-cron-secret");
  const bearer  = req.headers.get("authorization");
  const ok = (!!xSecret && xSecret === CRON_SECRET) || (!!bearer && bearer === `Bearer ${CRON_SECRET}`);
  if (!CRON_SECRET || !ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const set = req.nextUrl.searchParams.get("set") ?? undefined;
  const key = set ? `backup_${set}` : "backup";
  try {
    const result = await runBackup(set);
    await record(key, { ok: true, at: new Date().toISOString(), totalDocs: result.totalDocs, sizeBytes: result.sizeBytes, url: result.url });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("[cron/backup] Error:", e);
    await record(key, { ok: false, at: new Date().toISOString(), error: e instanceof Error ? e.message : "erreur inconnue" });
    return NextResponse.json({ error: "Backup failed" }, { status: 500 });
  }
}
