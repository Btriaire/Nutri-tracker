import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import type { GlucoseDay } from "@/app/lib/types";

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
  const snap = await db.collection(`users/${session.userId}/glucoseLog`)
    .where("__name__", ">=", from).where("__name__", "<=", to)
    .limit(365)
    .get();

  const days: GlucoseDay[] = snap.docs
    .map((d) => {
      const raw = d.data() as Partial<GlucoseDay>;
      const readings = Array.isArray(raw.readings) ? raw.readings : [];
      return { date: raw.date ?? d.id, readings } as GlucoseDay;
    })
    .sort((a, b) => a.date.localeCompare(b.date));
  return NextResponse.json({ days });
}
