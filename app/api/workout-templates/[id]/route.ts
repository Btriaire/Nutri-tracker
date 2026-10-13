import { getSession } from "@/app/lib/session";
import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore } from "@/app/lib/firebase-admin";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const USER = session.userId;
  const { id } = await params;
  const body = await req.json() as Record<string, unknown>;
  const db = getAdminFirestore();
  await db.doc(`users/${USER}/workoutTemplates/${id}`).update(body);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const USER = session.userId;
  const { id } = await params;
  const db = getAdminFirestore();
  await db.doc(`users/${USER}/workoutTemplates/${id}`).delete();
  return NextResponse.json({ ok: true });
}
