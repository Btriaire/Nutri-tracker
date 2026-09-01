import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import { normalizeFoodName } from "@/app/lib/normalize-food-name";

export const dynamic = "force-dynamic";

interface WeightCorrectionDoc {
  normalizedName: string;
  grams:          number;
  label:          string;
  updatedAt:      Timestamp;
}

export async function GET() {
  const db   = getAdminFirestore();
  const snap = await db.collection("users/owner/weightCorrections").get();
  const corrections = snap.docs.map((d) => {
    const data = d.data() as WeightCorrectionDoc;
    return { normalizedName: data.normalizedName, grams: data.grams, label: data.label };
  });
  return NextResponse.json({ corrections });
}

/** Enregistre le poids reel comme nouveau defaut permanent pour cet aliment —
 *  appele quand l'utilisateur corrige le poids d'une entree deja loguee (voir
 *  FoodItem.tsx). Idempotent : un doc par nom normalise, ecrase la precedente
 *  correction si l'utilisateur corrige a nouveau. */
export async function POST(req: NextRequest) {
  const body = await req.json() as { name?: string; grams?: number; label?: string };
  if (!body.name || !body.grams || body.grams <= 0) {
    return NextResponse.json({ error: "Invalid" }, { status: 400 });
  }

  const normalizedName = normalizeFoodName(body.name);
  if (!normalizedName) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  const db    = getAdminFirestore();
  const docId = normalizedName.replace(/\s+/g, "-").slice(0, 200);
  await db.doc(`users/owner/weightCorrections/${docId}`).set({
    normalizedName,
    grams:     body.grams,
    label:     body.label ?? `${Math.round(body.grams)}g`,
    updatedAt: Timestamp.now(),
  });

  return NextResponse.json({ ok: true });
}
