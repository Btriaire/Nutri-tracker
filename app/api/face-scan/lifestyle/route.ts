export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import { sanitizeMetrics } from "@/app/lib/face-metrics";
import { faceLifestyle, type DayFactors } from "@/app/lib/face-lifestyle";

type Entry = { nutrition?: { alcoholG?: number; sodiumMg?: number } };

// GET : liens entre mesures du visage et sommeil, alcool, sel, poids, sur tout l'historique de la personne.
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = getAdminFirestore(), U = `users/${session.userId}`;
  const [faces, foods, fits] = await Promise.all([
    db.collection(`${U}/faceScans`).select("date", "metrics").get(),
    db.collection(`${U}/foodLog`).select("entries", "totals").get(),
    db.collection(`${U}/fitnessData`).select("googleFit", "manualSleep").get(),
  ]);
  const days: Record<string, DayFactors> = {};
  for (const d of foods.docs) {
    const x = d.data() as { entries?: Entry[]; totals?: { sodiumMg?: number } };
    const e = x.entries ?? [];
    if (!e.length) continue;
    const na = x.totals?.sodiumMg ?? e.reduce((s, y) => s + (y.nutrition?.sodiumMg ?? 0), 0);
    days[d.id] = { alcoholG: e.reduce((s, y) => s + (y.nutrition?.alcoholG ?? 0), 0), saltG: na ? (na * 2.5) / 1000 : null };
  }
  for (const d of fits.docs) {
    const x = d.data() as { googleFit?: { sleepMinutes?: number | null; weightKg?: number | null }; manualSleep?: { sleepMinutes?: number | null } };
    const sl = x.manualSleep?.sleepMinutes ?? x.googleFit?.sleepMinutes;
    days[d.id] = { ...days[d.id], sleepH: sl ? sl / 60 : null, weightKg: x.googleFit?.weightKg ?? null };
  }
  const scans = faces.docs.flatMap((d) => {
    const x = d.data() as { date?: string; metrics?: unknown };
    const m = sanitizeMetrics(x.metrics);
    return x.date && m ? [{ date: x.date, metrics: m }] : [];
  });
  return NextResponse.json({ ...faceLifestyle(scans, days), photos: scans.length });
}
