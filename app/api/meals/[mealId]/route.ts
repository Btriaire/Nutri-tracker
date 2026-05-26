import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore } from "@/app/lib/firebase-admin";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ mealId: string }> }) {
  const { mealId } = await params;
  const db = getAdminFirestore();
  await db.doc(`users/owner/savedMeals/${mealId}`).delete();
  return NextResponse.json({ ok: true });
}
