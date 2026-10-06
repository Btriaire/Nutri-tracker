export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import { refreshFaceStats } from "@/app/lib/scan-stats";

// POST /api/face-scan/stats : recalcule et memorise la reference + les index de chaque scan
// (appele une fois a la fin de la mesure de l'historique, plutot qu'apres chaque photo).
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await refreshFaceStats(getAdminFirestore()));
}
