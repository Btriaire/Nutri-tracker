import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import { getSession } from "@/app/lib/session";
import type { CustomFood } from "@/app/lib/types";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ foodId: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { foodId } = await params;
  const body = await request.json() as Partial<Omit<CustomFood, "id" | "createdAt" | "updatedAt">>;

  const db  = getAdminFirestore();
  await db.doc(`users/${session.userId}/customFoods/${foodId}`).update({
    ...body,
    updatedAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ foodId: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { foodId } = await params;
  const db = getAdminFirestore();
  await db.doc(`users/${session.userId}/customFoods/${foodId}`).delete();

  return NextResponse.json({ ok: true });
}
