import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore } from "@/app/lib/firebase-admin";

export const dynamic = "force-dynamic";

async function deleteCollection(db: FirebaseFirestore.Firestore, path: string) {
  let deleted = 0;
  let snap = await db.collection(path).limit(200).get();
  while (!snap.empty) {
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    deleted += snap.size;
    snap = await db.collection(path).limit(200).get();
  }
  return deleted;
}

export async function DELETE(req: NextRequest) {
  const { targets } = await req.json() as { targets: string[] };
  const userId = "owner";
  const db = getAdminFirestore();
  const results: Record<string, number> = {};

  const all = targets.includes("all");

  if (all || targets.includes("calories")) {
    results.calories = await deleteCollection(db, `users/${userId}/foodLog`);
  }

  if (all || targets.includes("sports")) {
    results.sports = await deleteCollection(db, `users/${userId}/manualActivities`);
  }

  if (all || targets.includes("sleep")) {
    // Clear sleepMinutes from all fitnessData docs
    const snap = await db.collection(`users/${userId}/fitnessData`).get();
    const batch = db.batch();
    snap.docs.forEach((d) => {
      const gf = (d.data() as { googleFit?: { sleepMinutes?: number | null } }).googleFit;
      if (gf?.sleepMinutes != null) {
        batch.update(d.ref, { "googleFit.sleepMinutes": null });
      }
    });
    await batch.commit();
    results.sleep = snap.size;
  }

  return NextResponse.json({ ok: true, results });
}
