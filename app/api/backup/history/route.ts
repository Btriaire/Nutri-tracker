import { NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";
import { listBackups, readBackupRequest } from "@/app/lib/backup-log";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [entries, request] = await Promise.all([listBackups(30), readBackupRequest()]);
  return NextResponse.json({ entries, pending: request.pending, requestedAt: request.requestedAt });
}
