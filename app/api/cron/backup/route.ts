import { NextRequest, NextResponse } from "next/server";
import { put, list, del } from "@vercel/blob";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import { recordReads } from "@/app/lib/quota-tracker";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const USER = "owner";
const CRON_SECRET = process.env.CRON_SECRET || "";

// Every per-user subcollection except dayPhotos/mealPhotos/faceScans, which embed
// full base64 JPEG data URLs and blew a single backup up to ~20MB / 2.5min — well
// past the 60s function budget. Those are lower-stakes to lose than logged data
// and change less often; back them up separately/less frequently if ever needed.
const COLLECTIONS = [
  "customFoods", "fastingLog", "fitnessData", "foodLog",
  "gymPrograms", "gymSessions", "healthLog", "manualActivities",
  "meditationSessions", "micronutrientLogs", "recipes", "reports", "supplementLogs", "supplements",
];

const RETENTION_DAYS = 365;

function jsonReplacer(_key: string, value: unknown) {
  if (value && typeof value === "object" && typeof (value as { toDate?: unknown }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return value;
}

/**
 * Daily Firestore backup: dumps the user's profile doc + every subcollection to a
 * single JSON file in Vercel Blob (private access), then prunes backups older than
 * RETENTION_DAYS. Registered in vercel.json to run monthly (1st of the month, 04:00
 * UTC) — this scans ~14 collections (~650 Firestore reads per run), too costly for
 * a daily cadence on the free Firestore quota. Vercel Cron Jobs call via GET with an
 * automatic Authorization: Bearer $CRON_SECRET header.
 * Manual usage: curl -H "X-Cron-Secret: $CRON_SECRET" https://nutri-tracker-mocha.vercel.app/api/cron/backup
 */
export async function GET(req: NextRequest) {
  return runBackup(req);
}

export async function POST(req: NextRequest) {
  return runBackup(req);
}

async function runBackup(req: NextRequest) {
  const xSecret = req.headers.get("x-cron-secret");
  const bearer  = req.headers.get("authorization");
  const ok = (!!xSecret && xSecret === CRON_SECRET) || (!!bearer && bearer === `Bearer ${CRON_SECRET}`);
  if (!CRON_SECRET || !ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getAdminFirestore();
  const backup: Record<string, unknown> = {
    exportedAt: new Date().toISOString(),
    user: USER,
  };

  try {
    const [profileSnap, ...collectionSnaps] = await Promise.all([
      db.doc(`users/${USER}`).get(),
      ...COLLECTIONS.map((col) => db.collection(`users/${USER}/${col}`).get()),
    ]);
    backup.profile = profileSnap.exists ? profileSnap.data() : null;

    let totalDocs = 0;
    COLLECTIONS.forEach((col, i) => {
      const snap = collectionSnaps[i];
      backup[col] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      totalDocs += snap.size;
    });
    void recordReads(totalDocs + 1);

    const json = JSON.stringify(backup, jsonReplacer, 2);
    const dateStr = new Date().toISOString().slice(0, 10);
    const pathname = `backups/nutri-tracker-${dateStr}.json`;

    // Reuses the existing public "nutri-tracker-reports" Blob store (same one
    // already holding exported PDF reports) — its store hostname is an
    // unguessable random ID, same posture already accepted for those reports.
    // A dedicated private store would need dashboard setup for its own token.
    const blob = await put(pathname, json, {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
    });

    // ── Prune backups older than RETENTION_DAYS ──────────────────────────────
    const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const { blobs } = await list({ prefix: "backups/" });
    const stale = blobs.filter((b) => b.uploadedAt.getTime() < cutoff).map((b) => b.url);
    if (stale.length) await del(stale);

    return NextResponse.json({
      ok: true,
      url: blob.url,
      collections: COLLECTIONS.length,
      totalDocs,
      sizeBytes: json.length,
      pruned: stale.length,
    });
  } catch (e) {
    console.error("[cron/backup] Error:", e);
    return NextResponse.json({ error: "Backup failed" }, { status: 500 });
  }
}
