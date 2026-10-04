import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import { FieldPath } from "firebase-admin/firestore";
import type { FoodEntry, GlucoseDay, MealType } from "@/app/lib/types";
import { mealAnchors } from "@/app/lib/glucose";

export const dynamic = "force-dynamic";

/** GET /api/glucose?from=YYYY-MM-DD&to=YYYY-MM-DD — un jour, ou une plage (bornee a 365 jours). */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const from = searchParams.get("from");
  const to   = searchParams.get("to") ?? from;
  if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
  }

  const fromMs = Date.parse(`${from}T00:00:00Z`);
  const toMs = Date.parse(`${to}T23:59:59Z`);
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || fromMs > toMs) {
    return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
  }
  const daysRequested = Math.floor((toMs - fromMs) / 86_400_000) + 1;
  if (daysRequested > 365) {
    return NextResponse.json({ error: "Date range too large (maximum 365 days)" }, { status: 400 });
  }

  const db = getAdminFirestore();
  const [snap, foodSnap] = await Promise.all([
    db.collection(`users/${session.userId}/glucoseLog`)
      .where(FieldPath.documentId(), ">=", from).where(FieldPath.documentId(), "<=", to)
      .limit(365).get(),
    db.collection(`users/${session.userId}/foodLog`)
      .where(FieldPath.documentId(), ">=", from).where(FieldPath.documentId(), "<=", to)
      .limit(365).get(),
  ]);

  const days: GlucoseDay[] = snap.docs
    .map((d) => {
      const raw = d.data() as Partial<GlucoseDay>;
      const readings = Array.isArray(raw.readings) ? raw.readings : [];
      return { date: raw.date ?? d.id, readings } as GlucoseDay;
    })
    .sort((a, b) => a.date.localeCompare(b.date));
  // Un repas = ses aliments : heure retenue (corrigee par l'utilisateur, sinon premier aliment) + macros cumulees.
  const meals = foodSnap.docs.flatMap((doc) => {
    const data = doc.data() as { entries?: FoodEntry[]; mealTimes?: Partial<Record<MealType, number>> };
    return mealAnchors(data.entries ?? [], data.mealTimes).map((a) => ({ date: doc.id, ...a }));
  });
  return NextResponse.json({ days, meals });
}
