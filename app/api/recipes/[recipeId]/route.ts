import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import { getSession } from "@/app/lib/session";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ recipeId: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { recipeId } = await params;
  const db = getAdminFirestore();
  await db.doc(`users/${session.userId}/recipes/${recipeId}`).delete();
  return NextResponse.json({ ok: true });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ recipeId: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { recipeId } = await params;
  const body = await request.json() as Record<string, unknown>;
  const db   = getAdminFirestore();
  await db.doc(`users/${session.userId}/recipes/${recipeId}`).update({
    ...body,
    updatedAt: FieldValue.serverTimestamp(),
  });
  return NextResponse.json({ ok: true });
}
