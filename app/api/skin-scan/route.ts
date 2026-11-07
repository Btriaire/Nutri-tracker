export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import { sanitizeSkin } from "@/app/lib/skin-info";

// Analyse de peau optionnelle : seuls les parametres sont gardes, jamais la photo.
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const snap = await getAdminFirestore().collection(`users/${session.userId}/skinScans`).orderBy("at", "desc").limit(60).get();
  return NextResponse.json({ scans: snap.docs.map((d) => ({ id: d.id, ...d.data() })) });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null) as { params?: unknown; iodPx?: unknown } | null;
  const params = sanitizeSkin(body?.params);
  const iodPx = typeof body?.iodPx === "number" && Number.isFinite(body.iodPx) ? body.iodPx : null;
  if (!params) return NextResponse.json({ error: "Invalid params" }, { status: 400 });
  const doc = { ...params, iodPx, at: new Date().toISOString() };
  const ref = await getAdminFirestore().collection(`users/${session.userId}/skinScans`).add(doc);
  return NextResponse.json({ scan: { id: ref.id, ...doc } });
}
