import { NextRequest, NextResponse } from "next/server";
import { buildBackup } from "@/app/lib/backup";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import { logBackup, clearBackupRequest } from "@/app/lib/backup-log";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CRON_SECRET = process.env.CRON_SECRET || "";

/**
 * Sauvegarde Firestore renvoyee en JSON gzippe a l'appelant authentifie (le VPS la tire chaque
 * jour, voir /root/nutri-tracker-backups/pull-backup.sh) : rien n'est publie. Sans parametre :
 * tout sauf les collections a photos. `?set=dayPhotos|mealPhotos|faceScans` : une collection photo.
 * Le resultat est consigne dans system/cronStatus (affiche dans Reglages).
 * Manuel : curl -H "X-Cron-Secret: $CRON_SECRET" -o backup.json.gz https://nutri-tracker-mocha.vercel.app/api/cron/backup
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
    const result = await buildBackup(set);
    const at = new Date().toISOString();
    await record(key, { ok: true, at, totalDocs: result.totalDocs, sizeBytes: result.sizeBytes });
    await logBackup({ at, set: set ?? null, ok: true, totalDocs: result.totalDocs, sizeBytes: result.sizeBytes, gzBytes: result.gzBytes });
    if (!set) await clearBackupRequest();
    return new NextResponse(new Uint8Array(result.gz), {
      headers: {
        "Content-Type": "application/gzip",
        "Content-Disposition": `attachment; filename="nutri-tracker-${set ?? "backup"}-${new Date().toISOString().slice(0, 10)}.json.gz"`,
        "X-Backup-Docs": String(result.totalDocs),
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("[cron/backup] Error:", e);
    const at = new Date().toISOString();
    const error = e instanceof Error ? e.message : "erreur inconnue";
    await record(key, { ok: false, at, error });
    await logBackup({ at, set: set ?? null, ok: false, error });
    return NextResponse.json({ error: "Backup failed" }, { status: 500 });
  }
}
