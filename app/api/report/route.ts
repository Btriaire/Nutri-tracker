export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";
import { buildReportData } from "@/app/lib/report-builder";

export type {
  ReportData, DayNutrition, DayActivity, DayHealth, TopSymptom,
  SupplementAdherenceRow, MicronutrientRow, FaceScanRow, SymptomHistoryDay,
} from "@/app/lib/report-builder";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to   = searchParams.get("to");
  if (!from || !to) return NextResponse.json({ error: "from & to required" }, { status: 400 });

  const data = await buildReportData(session.userId, from, to);
  return NextResponse.json(data);
}
