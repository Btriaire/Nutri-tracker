import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import { getSession } from "@/app/lib/session";

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { date, waterMl } = await request.json() as { date: string; waterMl: number };
  if (!date || typeof waterMl !== "number" || waterMl < 0) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const db  = getAdminFirestore();
  const ref = db.doc(`users/${session.userId}/foodLog/${date}`);

  // Always include `date` so Firestore range queries on the date field work
  // (documents created with merge:true and no date field are invisible to progress queries)
  await ref.set({ date, waterMl, updatedAt: new Date() }, { merge: true });

  return NextResponse.json({ ok: true, waterMl });
}
