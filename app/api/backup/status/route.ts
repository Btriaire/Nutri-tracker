import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/app/lib/firebase-admin";

export const dynamic = "force-dynamic";

// Etat de la derniere sauvegarde (ecrit par /api/cron/backup), protege par la session du middleware.
export async function GET() {
  const snap = await getAdminFirestore().doc("system/cronStatus").get();
  const backup = (snap.data() as { backup?: { ok: boolean; at: string; totalDocs?: number; error?: string } } | undefined)?.backup ?? null;
  return NextResponse.json({ backup });
}
