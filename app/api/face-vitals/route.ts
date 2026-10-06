export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { getSession } from "@/app/lib/session";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import { sanitizeVitals, type FaceVitals } from "@/app/lib/face-vitals";

// Constantes mesurees par la camera (pouls, respiration, clignements) : users/owner/faceVitals/{id}
const COL = "users/owner/faceVitals";

export interface FaceVitalsEntry { id: string; date: string; time: string; vitals: FaceVitals; createdAt?: unknown }

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const snap = await getAdminFirestore().collection(COL).orderBy("date", "desc").get();
  const entries = snap.docs.map((d) => ({ ...(d.data() as FaceVitalsEntry), id: d.id }))
    .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  return NextResponse.json({ entries });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null) as { date?: unknown; time?: unknown; vitals?: unknown } | null;
  const date = typeof body?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : null;
  const time = typeof body?.time === "string" && /^\d{2}:\d{2}$/.test(body.time) ? body.time : null;
  const vitals = sanitizeVitals(body?.vitals);
  if (!date || !time || !vitals) return NextResponse.json({ error: "Invalid measurement" }, { status: 400 });
  const ref = getAdminFirestore().collection(COL).doc();
  const entry: FaceVitalsEntry = { id: ref.id, date, time, vitals };
  await ref.set({ ...entry, createdAt: Timestamp.now() });
  return NextResponse.json({ entry }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id || !/^[\w-]{1,64}$/.test(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  await getAdminFirestore().collection(COL).doc(id).delete();
  return NextResponse.json({ ok: true });
}
