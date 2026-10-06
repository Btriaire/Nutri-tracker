export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { FieldPath } from "firebase-admin/firestore";
import { format, subDays, parseISO } from "date-fns";
import { getSession } from "@/app/lib/session";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import type { DayLog, SupplementLog, UserProfile } from "@/app/lib/types";

// GET /api/eye-scan/context?date=YYYY-MM-DD : ce que l'alimentation dit autour d'un scan de l'oeil.
// Eau (7 j), fer et B12 des aliments (14 j), prises d'omega-3 / fer / B12 en complements (14 j).
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const date = req.nextUrl.searchParams.get("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  const d = parseISO(date);
  const from14 = format(subDays(d, 13), "yyyy-MM-dd"), from7 = format(subDays(d, 6), "yyyy-MM-dd");
  const db = getAdminFirestore();
  const range = (col: string) => db.collection(`users/owner/${col}`)
    .where(FieldPath.documentId(), ">=", from14).where(FieldPath.documentId(), "<=", date).get();
  const [logs, supps, profile] = await Promise.all([range("foodLog"), range("supplementLogs"), db.doc("users/owner").get()]);

  const days = logs.docs.map((x) => ({ id: x.id, log: x.data() as DayLog })).filter((x) => (x.log.entries ?? []).length > 0);
  const water = logs.docs.filter((x) => x.id >= from7).map((x) => (x.data() as DayLog).waterMl ?? 0).filter((w) => w > 0);
  const sum = (log: DayLog, k: "ironMg" | "vitaminB12Ug") => (log.entries ?? []).reduce((s, e) => s + (e.nutrition?.[k] ?? 0), 0);
  const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((s, v) => s + v, 0) / xs.length) * 10) / 10 : null);

  const intakes = supps.docs.flatMap((x) => (x.data() as SupplementLog).intakes ?? []);
  const count = (re: RegExp) => intakes.filter((i) => re.test(i.supplementName ?? "")).length;
  const goals = (profile.data() as UserProfile | undefined)?.goals;

  return NextResponse.json({
    waterAvgMl: avg(water),
    waterGoalMl: goals?.waterMl ?? 2000,
    waterDays: water.length,
    ironAvgMg: avg(days.map((x) => sum(x.log, "ironMg"))),
    b12AvgUg: avg(days.map((x) => sum(x.log, "vitaminB12Ug"))),
    foodDays: days.length,
    omega3Intakes: count(/om[ée]ga|epa|dha|huile de poisson|fish oil/i),
    ironIntakes: count(/\bfer\b|iron|bisglycinate de fer/i),
    b12Intakes: count(/b12|cobalamine/i),
  });
}
