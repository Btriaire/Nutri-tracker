export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import { FieldPath } from "firebase-admin/firestore";
import type { SupplementProduct, SupplementLog, MicronutrientDay, MicronutrientCode } from "@/app/lib/types";

const USER = "owner";

export interface SupplementAdherenceDay {
  date:  string;
  taken: string[]; // supplementIds logged that day
}

export interface MicronutrientTrendPoint {
  date:   string;
  amount: number;
}

export interface SupplementsProgressResponse {
  products:  SupplementProduct[];
  adherence: SupplementAdherenceDay[];
  micronutrientSeries: Partial<Record<MicronutrientCode, MicronutrientTrendPoint[]>>;
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (!from || !to) return NextResponse.json({ error: "from + to required" }, { status: 400 });

  try {
    const db = getAdminFirestore();

    const [productsSnap, supplementLogsSnap, micronutrientLogsSnap] = await Promise.all([
      db.collection(`users/${USER}/supplements`).orderBy("createdAt", "desc").get(),
      db.collection(`users/${USER}/supplementLogs`)
        .where(FieldPath.documentId(), ">=", from)
        .where(FieldPath.documentId(), "<=", to)
        .orderBy(FieldPath.documentId(), "asc")
        .get(),
      db.collection(`users/${USER}/micronutrientLogs`)
        .where(FieldPath.documentId(), ">=", from)
        .where(FieldPath.documentId(), "<=", to)
        .orderBy(FieldPath.documentId(), "asc")
        .get(),
    ]);

    const products: SupplementProduct[] = productsSnap.docs.map(d => d.data() as SupplementProduct);

    const adherence: SupplementAdherenceDay[] = supplementLogsSnap.docs.map(d => {
      const log = d.data() as SupplementLog;
      const taken = Array.from(new Set((log.intakes ?? []).map(i => i.supplementId)));
      return { date: log.date, taken };
    });

    const micronutrientSeries: Partial<Record<MicronutrientCode, MicronutrientTrendPoint[]>> = {};
    for (const d of micronutrientLogsSnap.docs) {
      const log = d.data() as MicronutrientDay;
      const totalsByCode = new Map<MicronutrientCode, number>();
      for (const intake of log.intakes ?? []) {
        totalsByCode.set(intake.code, (totalsByCode.get(intake.code) ?? 0) + intake.amount);
      }
      for (const [code, amount] of totalsByCode) {
        if (!micronutrientSeries[code]) micronutrientSeries[code] = [];
        micronutrientSeries[code]!.push({ date: log.date, amount });
      }
    }

    const response: SupplementsProgressResponse = { products, adherence, micronutrientSeries };
    return NextResponse.json(response, { headers: { "Cache-Control": "no-store, must-revalidate" } });
  } catch (e) {
    console.error("[supplements-progress GET]", e);
    return NextResponse.json({ error: "Failed to fetch supplements progress" }, { status: 500 });
  }
}
