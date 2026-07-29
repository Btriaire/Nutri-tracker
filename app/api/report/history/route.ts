export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";
import { getAdminFirestore } from "@/app/lib/firebase-admin";

export interface ReportHistoryEntry {
  id: string;
  period: "7d" | "30d";
  from: string;
  to: string;
  generatedAt: string;
  url: string;
  sizeKb: number;
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getAdminFirestore();
  const snap = await db.collection(`users/${session.userId}/reports`)
    .orderBy("generatedAt", "desc")
    .limit(50)
    .get();

  const reports: ReportHistoryEntry[] = snap.docs.map(d => d.data() as ReportHistoryEntry);
  return NextResponse.json({ reports }, { headers: { "Cache-Control": "no-store" } });
}
