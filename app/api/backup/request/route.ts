import { NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";
import { requestBackup } from "@/app/lib/backup-log";

export const dynamic = "force-dynamic";

// Demande une sauvegarde immediate : le VPS la recupere au prochain passage (5 min max).
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await requestBackup();
  return NextResponse.json({ ok: true });
}
