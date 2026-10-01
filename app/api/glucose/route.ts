import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import type { GlucoseDay } from "@/app/lib/types";

export const dynamic = "force-dynamic";

/** GET /api/glucose?from=YYYY-MM-DD&to=YYYY-MM-DD — un jour, ou une plage (bornee a 95 jours). */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const from = searchParams.get("from");
  const to   = searchParams.get("to") ?? from;
  if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
  }

  const db = getAdminFirestore();
  const snap = await db.collection(`users/${session.userId}/glucoseLog`)
    .where("__name__", ">=", from).where("__name__", "<=", to)
    .limit(96)
    .get();

  const days: GlucoseDay[] = snap.docs.map((d) => d.data() as GlucoseDay).sort((a, b) => a.date.localeCompare(b.date));
  return NextResponse.json({ days });
}
