export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import { format, subDays } from "date-fns";

const USER = "owner";

export interface BodyCompPoint {
  date:          string;
  // Body composition (Withings scale only)
  bodyFatPct:    number | null;
  muscleMassKg:  number | null;
  fatMassKg:     number | null;
  boneMassKg:    number | null;   // meastype 42
  hydrationPct:  number | null;   // meastype 41
  visceralFat:   number | null;   // meastype 173
  // Vital signs (Withings ScanWatch/BPM → fallback Apple Health)
  spO2Pct:       number | null;   // %   — meastype 54 OR appleHealth.spO2
  restingHR:     number | null;   // bpm — Withings only
  tempCelsius:   number | null;   // °C  — Withings only
  systolicBP:    number | null;   // mmHg — Withings BPM (meastype 10)
  diastolicBP:   number | null;   // mmHg — Withings BPM (meastype 9)
  // Sleep (Withings > Apple Health > Google Fit > Manual)
  totalSleepH:   number | null;
  deepSleepH:    number | null;
  remSleepH:     number | null;
  lightSleepH:   number | null;
  sleepScore:    number | null;   // Withings only
  hrAvgSleep:    number | null;   // Withings only
  wakeupCount:   number | null;   // Withings only
  sleepSource:   "withings" | "applehealth" | "googlefit" | "manual" | null;
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const days = Math.min(365, Math.max(7, parseInt(searchParams.get("days") ?? "90", 10)));

  const to   = format(new Date(), "yyyy-MM-dd");
  const from = format(subDays(new Date(), days - 1), "yyyy-MM-dd");

  const db   = getAdminFirestore();
  const [snap, healthSnap] = await Promise.all([
    db.collection(`users/${USER}/fitnessData`)
      .where("date", ">=", from)
      .where("date", "<=", to)
      .orderBy("date", "asc")
      .get(),
    // healthLog stores manual BP entries + Withings BPM auto-sync
    db.collection(`users/${USER}/healthLog`)
      .where("date", ">=", from)
      .where("date", "<=", to)
      .get(),
  ]);

  // Build per-date BP map from healthLog ──────────────────────────────────────
  // healthLog has two BP formats:
  //   A) bloodPressure[] array (manual readings): { systolic, diastolic, ... }
  //   B) systolic/diastolic directly on doc (Withings BPM auto-sync)
  const bpMap = new Map<string, { sys: number; dia: number }>();
  for (const d of healthSnap.docs) {
    const h = d.data() as Record<string, unknown>;
    const readings = (h.bloodPressure ?? []) as { systolic: number; diastolic: number }[];
    if (readings.length > 0) {
      const sys = Math.round(readings.reduce((s, r) => s + r.systolic,  0) / readings.length);
      const dia = Math.round(readings.reduce((s, r) => s + r.diastolic, 0) / readings.length);
      bpMap.set(d.id, { sys, dia });
    } else if (typeof h.systolic === "number" && typeof h.diastolic === "number") {
      bpMap.set(d.id, { sys: h.systolic, dia: h.diastolic });
    }
  }

  // Dates already covered by fitnessData
  const fitnessDates = new Set(snap.docs.map(d => d.id));

  // BP-only points: healthLog entries with no matching fitnessData doc
  const bpOnlyPoints: BodyCompPoint[] = [];
  for (const [date, bp] of bpMap.entries()) {
    if (!fitnessDates.has(date)) {
      bpOnlyPoints.push({
        date,
        bodyFatPct:   null, muscleMassKg: null, fatMassKg:   null,
        boneMassKg:   null, hydrationPct: null, visceralFat: null,
        spO2Pct:      null, restingHR:    null, tempCelsius: null,
        systolicBP:   bp.sys,
        diastolicBP:  bp.dia,
        totalSleepH:  null, deepSleepH:   null, remSleepH:   null,
        lightSleepH:  null, sleepScore:   null, hrAvgSleep:  null,
        wakeupCount:  null, sleepSource:  null,
      });
    }
  }

  const points: BodyCompPoint[] = snap.docs
    .map((d) => {
      const data = d.data();
      const w    = data.withings;       // WithingsDay (body comp + vitals)
      const ws   = data.withingsSleep;  // WithingsSleepDay
      const gf   = data.googleFit;      // GoogleFitDay
      const ah   = data.appleHealth;    // AppleHealthDay
      const ms   = data.manualSleep;    // { sleepMinutes }

      // BP: Withings BPM device first, then healthLog (manual or Withings BPM sync)
      const bpHealth = bpMap.get(d.id);

      // ── SpO2: Withings ScanWatch → Apple Health fallback ─────────────────
      const spO2Pct = w?.spO2Pct ?? ah?.spO2 ?? null;

      // ── Sleep: Withings (best) → Apple Health → Google Fit → Manual ──────
      let totalSleepH: number | null = null;
      let deepSleepH:  number | null = null;
      let remSleepH:   number | null = null;
      let lightSleepH: number | null = null;
      let sleepScore:  number | null = null;
      let hrAvgSleep:  number | null = null;
      let wakeupCount: number | null = null;
      let sleepSource: BodyCompPoint["sleepSource"] = null;

      if (ws?.totalSleepSec != null) {
        // Withings sleep summary — most detailed
        totalSleepH = Math.round(ws.totalSleepSec / 360) / 10;
        deepSleepH  = ws.deepSleepSec  != null ? Math.round(ws.deepSleepSec  / 360) / 10 : null;
        remSleepH   = ws.remSleepSec   != null ? Math.round(ws.remSleepSec   / 360) / 10 : null;
        lightSleepH = ws.lightSleepSec != null ? Math.round(ws.lightSleepSec / 360) / 10 : null;
        sleepScore  = ws.sleepScore    ?? null;
        hrAvgSleep  = ws.hrAvgSleep    ?? null;
        wakeupCount = ws.wakeupCount   ?? null;
        sleepSource = "withings";
      } else if (ah?.sleepMinutes != null && ah.sleepMinutes > 0) {
        // Apple Health — has phases
        totalSleepH = Math.round(ah.sleepMinutes / 60 * 10) / 10;
        deepSleepH  = ah.sleepDeepMinutes != null ? Math.round(ah.sleepDeepMinutes / 60 * 10) / 10 : null;
        remSleepH   = ah.sleepRemMinutes  != null ? Math.round(ah.sleepRemMinutes  / 60 * 10) / 10 : null;
        sleepSource = "applehealth";
      } else if (ms?.sleepMinutes != null && ms.sleepMinutes > 0) {
        // Manual sleep entry (dashboard override)
        totalSleepH = Math.round(ms.sleepMinutes / 60 * 10) / 10;
        sleepSource = "manual";
      } else if (gf?.sleepMinutes != null && gf.sleepMinutes > 0) {
        // Google Fit — total only usually
        totalSleepH = Math.round(gf.sleepMinutes / 60 * 10) / 10;
        deepSleepH  = gf.deepSleepMin  != null ? Math.round(gf.deepSleepMin  / 60 * 10) / 10 : null;
        remSleepH   = gf.remSleepMin   != null ? Math.round(gf.remSleepMin   / 60 * 10) / 10 : null;
        lightSleepH = gf.lightSleepMin != null ? Math.round(gf.lightSleepMin / 60 * 10) / 10 : null;
        sleepSource = "googlefit";
      }

      // Resolved BP: Withings BPM hardware > healthLog (manual/sync)
      const systolicBP  = w?.systolicBP  ?? bpHealth?.sys  ?? null;
      const diastolicBP = w?.diastolicBP ?? bpHealth?.dia ?? null;

      // ── Skip day if absolutely no relevant data ───────────────────────────
      const hasBodyComp = w?.bodyFatPct != null || w?.muscleMassKg != null || w?.boneMassKg != null || w?.hydrationPct != null || w?.visceralFat != null;
      const hasVitals   = spO2Pct != null || w?.restingHR != null || w?.tempCelsius != null || systolicBP != null;
      const hasSleep    = totalSleepH != null;
      if (!hasBodyComp && !hasVitals && !hasSleep) return null;

      return {
        date:         d.id,
        bodyFatPct:   w?.bodyFatPct    ?? null,
        muscleMassKg: w?.muscleMassKg  ?? null,
        fatMassKg:    w?.fatMassKg     ?? null,
        boneMassKg:   w?.boneMassKg    ?? null,
        hydrationPct: w?.hydrationPct  ?? null,
        visceralFat:  w?.visceralFat   ?? null,
        spO2Pct,
        restingHR:    w?.restingHR     ?? null,
        tempCelsius:  w?.tempCelsius   ?? null,
        systolicBP,
        diastolicBP,
        totalSleepH,
        deepSleepH,
        remSleepH,
        lightSleepH,
        sleepScore,
        hrAvgSleep,
        wakeupCount,
        sleepSource,
      } satisfies BodyCompPoint;
    })
    .filter((p): p is BodyCompPoint => p !== null);

  // Merge BP-only points and sort by date
  const allPoints = [...points, ...bpOnlyPoints]
    .sort((a, b) => a.date.localeCompare(b.date));

  return NextResponse.json({ points: allPoints, from, to });
}
