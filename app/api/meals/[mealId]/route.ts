import { getSession } from "@/app/lib/session";
import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore } from "@/app/lib/firebase-admin";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ mealId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const USER = session.userId;
  const { mealId } = await params;
  const db = getAdminFirestore();
  await db.doc(`users/${USER}/savedMeals/${mealId}`).delete();
  return NextResponse.json({ ok: true });
}
