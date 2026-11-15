export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import { sanitizeMetrics } from "@/app/lib/face-metrics";
import { faceLifestyle, type DayFactors } from "@/app/lib/face-lifestyle";
import { isEstimatedEntry } from "@/app/lib/day-status";
import type { DayPlan } from "@/app/lib/period-plan";

type Entry = { foodId?: string; nutrition?: { alcoholG?: number; sodiumMg?: number } };

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = getAdminFirestore(), U = `users/${session.userId}`;
  const excludeEstimated = req.nextUrl.searchParams.get("excludeEstimated") === "1";
  const [faces, foods, fits, estimatedDays] = await Promise.all([
    db.collection(`${U}/faceScans`).select("date", "metrics").get(),
    db.collection(`${U}/foodLog`).select("entries", "totals").get(),
    db.collection(`${U}/fitnessData`).select("googleFit", "manualSleep").get(),
    db.collection(`${U}/estimatedDays`).get(),
  ]);
  const days: Record<string, DayFactors> = {};
  let estimatedUsed = 0;
  for (const d of foods.docs) {
    const x = d.data() as { entries?: Entry[]; totals?: { sodiumMg?: number } };
    const e = x.entries ?? [];
    if (!e.length) continue;
    const real = e.filter(y => !isEstimatedEntry(y));
    const hasEstimated = e.some(isEstimatedEntry);
    let alcoholG: number | null;
    let saltG: number | null;
    if (!hasEstimated) {
      alcoholG = real.reduce((s, y) => s + (y.nutrition?.alcoholG ?? 0), 0);
      const na = x.totals?.sodiumMg ?? real.reduce((s, y) => s + (y.nutrition?.sodiumMg ?? 0), 0);
      saltG = na ? (na * 2.5) / 1000 : null;
    } else {
      if (excludeEstimated) {
        alcoholG = null;
        saltG = null;
      } else {
        const plan = estimatedDays.docs.find(doc => doc.id === d.id)?.data() as { periodId?: string; plan?: DayPlan } | undefined;
        if (plan?.plan?.confirmed) {
          alcoholG = real.reduce((s, y) => s + (y.nutrition?.alcoholG ?? 0), 0) + (plan.plan.drinks * 10);
          estimatedUsed++;
        } else {
          alcoholG = null;
        }
        saltG = null;
      }
    }
    days[d.id] = { alcoholG, saltG };
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
  return NextResponse.json({ ...faceLifestyle(scans, days), photos: scans.length, estimatedDays: estimatedUsed, excludeEstimated });
}
