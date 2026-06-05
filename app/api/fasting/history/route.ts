import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import type { FastingSession } from "@/app/api/fasting/route";

export const dynamic = "force-dynamic";

// GET /api/fasting/history?from=YYYY-MM-DD&to=YYYY-MM-DD
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const from = req.nextUrl.searchParams.get("from") ?? "";
  const to   = req.nextUrl.searchParams.get("to")   ?? "";

  const db  = getAdminFirestore();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = db.collection(`users/${session.userId}/fastingLog`);
  if (from) q = q.where("date", ">=", from);
  if (to)   q = q.where("date", "<=", to);
  q = q.orderBy("date", "asc");

  const snap = await q.get();
  const sessions = (snap.docs as { data: () => FastingSession }[]).map(d => d.data());
  return NextResponse.json({ sessions });
}
