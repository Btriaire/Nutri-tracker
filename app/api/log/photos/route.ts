import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";
import { getAdminFirestore } from "@/app/lib/firebase-admin";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  const db  = getAdminFirestore();
  const doc = await db.doc(`users/${session.userId}/mealPhotos/${date}`).get();
  const data = doc.exists ? doc.data() : {};
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { updatedAt, ...photos } = (data ?? {}) as Record<string, unknown>;
  return NextResponse.json({ photos });
}
