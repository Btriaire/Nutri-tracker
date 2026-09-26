import { NextRequest, NextResponse } from "next/server";
import { readBackupRequest } from "@/app/lib/backup-log";

export const dynamic = "force-dynamic";

const CRON_SECRET = process.env.CRON_SECRET || "";

// Le VPS interroge ce point toutes les 5 min : true = une sauvegarde a ete demandee depuis Reglages.
export async function GET(req: NextRequest) {
  const xSecret = req.headers.get("x-cron-secret");
  if (!CRON_SECRET || xSecret !== CRON_SECRET) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { pending } = await readBackupRequest();
  return NextResponse.json({ pending });
}
