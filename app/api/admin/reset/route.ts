import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import { getSession } from "@/app/lib/session";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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
  // Route destructive (vide des collections entières) : on revérifie la session
  // ici en plus du middleware, pour ne jamais dépendre d'un seul garde-fou.
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { targets, confirm } = await req.json() as { targets: string[]; confirm?: string };
  if (confirm !== "RESET" || !Array.isArray(targets) || targets.length === 0) {
    return NextResponse.json({ error: "Confirmation requise" }, { status: 400 });
  }

  // Jamais de suppression sans sauvegarde recente sur le VPS (les batch.delete contournent l'historique).
  const status = await getAdminFirestore().doc("system/cronStatus").get();
  const last = (status.data() as { backup?: { ok: boolean; at: string } } | undefined)?.backup;
  const fresh = !!last?.ok && Date.now() - new Date(last.at).getTime() < 26 * 3600 * 1000;
  if (!fresh) {
    return NextResponse.json({ error: "Aucune sauvegarde des dernières 26 h : exporte tes données (Réglages) ou attends la sauvegarde quotidienne. Rien n'a été supprimé." }, { status: 409 });
  }

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
