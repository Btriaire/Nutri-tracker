import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore } from "@/app/lib/firebase-admin";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getAdminFirestore();
  await db.doc(`users/owner/manualActivities/${id}`).delete();
  return NextResponse.json({ ok: true });
}
