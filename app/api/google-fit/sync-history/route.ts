import { NextRequest, NextResponse } from "next/server";
import { getTokens, activityLabel } from "@/app/lib/google-fit";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { format, subDays } from "date-fns";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const { days = 90 } = await req.json() as { days?: number };
  const clampedDays = Math.min(Math.max(days, 1), 365);

  const tokens = await getTokens("owner");
  if (!tokens) return NextResponse.json({ error: "Not connected" }, { status: 400 });

  const endDate   = new Date();
  const startDate = subDays(endDate, clampedDays - 1);
  const startMs   = new Date(format(startDate, "yyyy-MM-dd") + "T00:00:00").getTime();
  const endMs     = new Date(format(endDate,   "yyyy-MM-dd") + "T23:59:59").getTime();
  const startIso  = new Date(startMs).toISOString();
  const endIso    = new Date(endMs).toISOString();
  const auth      = `Bearer ${tokens.accessToken}`;

  // Three parallel API calls covering the full date range
  const [activityRes, sleepRes, sessionsRes] = await Promise.all([
    fetch("https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate", {
      method:  "POST",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify({
        aggregateBy: [
          { dataTypeName: "com.google.step_count.delta" },    // 0
          { dataTypeName: "com.google.calories.expended" },   // 1
          { dataTypeName: "com.google.heart_rate.bpm" },      // 2
          { dataTypeName: "com.google.weight" },              // 3
          { dataTypeName: "com.google.active_minutes" },      // 4
        ],
        bucketByTime:    { durationMillis: 86_400_000 },
        startTimeMillis: startMs,
        endTimeMillis:   endMs,
      }),
    }),
    fetch("https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate", {
      method:  "POST",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify({
        aggregateBy:     [{ dataTypeName: "com.google.sleep.segment" }],
        bucketByTime:    { durationMillis: 86_400_000 },
        startTimeMillis: startMs,
        endTimeMillis:   endMs,
      }),
    }),
    fetch(
      `https://www.googleapis.com/fitness/v1/users/me/sessions?startTime=${startIso}&endTime=${endIso}`,
      { headers: { Authorization: auth } },
    ),
  ]);

  if (!activityRes.ok) {
    const err = await activityRes.text();
    console.error("Fit aggregate error:", err);
    return NextResponse.json({ error: "Google Fit API error", detail: err }, { status: 502 });
  }

  const actJson    = await activityRes.json() as { bucket: Bucket[] };
  const sleepBuckets: Bucket[] = sleepRes.ok
    ? ((await sleepRes.json()) as { bucket: Bucket[] }).bucket ?? []
    : [];

  // Index sessions by date
  const sessionsByDate: Record<string, RawSession[]> = {};
  if (sessionsRes.ok) {
    const sj = await sessionsRes.json() as { session?: RawSession[] };
    for (const s of sj.session ?? []) {
      const d = format(new Date(Number(s.startTimeMillis)), "yyyy-MM-dd");
      (sessionsByDate[d] ??= []).push(s);
    }
  }

  // Index sleep buckets by date
  const sleepByDate: Record<string, number> = {};
  for (const b of sleepBuckets) {
    const d   = format(new Date(Number(b.startTimeMillis ?? 0)), "yyyy-MM-dd");
    const pts = b.dataset?.[0]?.point ?? [];
    if (!pts.length) continue;
    const totalMs = pts
      .filter((p: Point) => (p.value?.[1]?.intVal ?? 0) !== 4)
      .reduce((s: number, p: SleepPoint) => {
        return s + (Number(p.endTimeNanos ?? 0) - Number(p.startTimeNanos ?? 0)) / 1_000_000;
      }, 0);
    sleepByDate[d] = Math.round(totalMs / 60_000);
  }

  // Batch write — Firestore max 500 ops per batch
  const db     = getAdminFirestore();
  let   batch  = db.batch();
  let   opCount = 0;
  let   written = 0;

  for (const b of actJson.bucket ?? []) {
    const date = format(new Date(Number(b.startTimeMillis ?? 0)), "yyyy-MM-dd");

    const getInt    = (i: number) => b.dataset?.[i]?.point?.reduce((s: number, p: Point) => s + (p.value?.[0]?.intVal ?? 0), 0) ?? 0;
    const getFp     = (i: number) => b.dataset?.[i]?.point?.reduce((s: number, p: Point) => s + (p.value?.[0]?.fpVal ?? 0), 0) ?? 0;
    const getAvgFp  = (i: number) => {
      const pts = b.dataset?.[i]?.point ?? [];
      if (!pts.length) return null;
      return pts.reduce((s: number, p: Point) => s + (p.value?.[0]?.fpVal ?? 0), 0) / pts.length;
    };
    const getLastFp = (i: number) => {
      const pts = b.dataset?.[i]?.point ?? [];
      return pts.length ? (pts[pts.length - 1].value?.[0]?.fpVal ?? null) : null;
    };

    const steps    = getInt(0);
    const calories = Math.round(getFp(1));
    const hrAvg    = getAvgFp(2);
    const weight   = getLastFp(3);
    const activeMins = getInt(4);
    const sleep    = sleepByDate[date] ?? null;

    const sessions = (sessionsByDate[date] ?? []).map(s => ({
      id:           s.id,
      name:         s.name || activityLabel(s.activityType ?? 0),
      activityType: s.activityType ?? 0,
      startMs:      Number(s.startTimeMillis),
      endMs:        Number(s.endTimeMillis),
      durationMin:  Math.round((Number(s.endTimeMillis) - Number(s.startTimeMillis)) / 60_000),
      calories:     null,
    }));

    const ref = db.doc(`users/owner/fitnessData/${date}`);
    batch.set(ref, {
      date,
      googleFit: {
        steps,
        activeCaloriesBurned: calories,
        activeMinutes:       activeMins,
        heartRateAvg:        hrAvg !== null ? Math.round(hrAvg) : null,
        weightKg:            weight ? Math.round(weight * 10) / 10 : null,
        sleepMinutes:        sleep && sleep > 0 ? sleep : null,
        sessions,
        syncedAt:            FieldValue.serverTimestamp(),
      },
    }, { merge: true });

    opCount++;
    written++;

    if (opCount === 490) {
      await batch.commit();
      batch   = db.batch();
      opCount = 0;
    }
  }

  if (opCount > 0) await batch.commit();

  return NextResponse.json({ ok: true, days: written });
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Point { value?: { intVal?: number; fpVal?: number }[] }
interface SleepPoint extends Point { startTimeNanos?: string; endTimeNanos?: string }
interface Bucket {
  startTimeMillis?: string;
  dataset?: { point?: (Point & SleepPoint)[] }[];
}
interface RawSession {
  id: string; name: string; activityType?: number;
  startTimeMillis: string; endTimeMillis: string;
}
