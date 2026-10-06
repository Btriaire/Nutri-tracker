export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { getSession } from "@/app/lib/session";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import { sanitizeEyeScan, type EyeScanData } from "@/app/lib/eye-metrics";

// Scans de l'oeil : users/owner/eyeScans/{id} (mesures + petite photo recadree des yeux)
const COL = "users/owner/eyeScans";
const MAX_IMAGE_CHARS = 120_000; // ~90 Ko de JPEG en base64

export type EyeScanEntry = EyeScanData & { id: string; time: string };

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const snap = await getAdminFirestore().collection(COL).orderBy("date", "desc")
    .select("date", "time", "metrics", "plr", "conjunctiva", "mbiS").get();
  const scans = snap.docs.map((d) => ({ ...(d.data() as Omit<EyeScanEntry, "id">), id: d.id }))
    .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  return NextResponse.json({ scans });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  const date = typeof body?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : null;
  const time = typeof body?.time === "string" && /^\d{2}:\d{2}$/.test(body.time) ? body.time : null;
  const data = sanitizeEyeScan(body?.data);
  const image = typeof body?.image === "string" && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(body.image) && body.image.length <= MAX_IMAGE_CHARS ? body.image : null;
  if (!date || !time || !data) return NextResponse.json({ error: "Invalid eye scan" }, { status: 400 });
  const ref = getAdminFirestore().collection(COL).doc();
  const entry: EyeScanEntry = { id: ref.id, date, time, ...data };
  await ref.set({ ...entry, ...(image ? { image } : {}), createdAt: Timestamp.now() });
  return NextResponse.json({ scan: entry }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id || !/^[\w-]{1,64}$/.test(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  await getAdminFirestore().collection(COL).doc(id).delete();
  return NextResponse.json({ ok: true });
}
