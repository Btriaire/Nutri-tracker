import { NextRequest, NextResponse } from "next/server";
import { getTokens, activityLabel } from "@/app/lib/google-fit";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { format } from "date-fns";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const { from, to } = await req.json() as { from: string; to: string };
  if (!from || !to) return NextResponse.json({ error: "from and to required" }, { status: 400 });

  const tokens = await getTokens("owner");
  if (!tokens) return NextResponse.json({ error: "Not connected" }, { status: 400 });

  const startMs  = new Date(from + "T00:00:00").getTime();
  const endMs    = new Date(to   + "T23:59:59").getTime();
  const startIso = new Date(startMs).toISOString();
  const endIso   = new Date(endMs).toISOString();
  const auth     = `Bearer ${tokens.accessToken}`;

  // Session-level heart rate isn't in Google's sessions.list response — it only has
  // start/end/activityType/name. To get avg/max BPM *during* each session, fetch HR at
  // 1-minute resolution across the whole range and slice it per-session below, instead of
  // firing one extra request per session (which wouldn't scale with many workouts).
  const [activityRes, sleepRes, sessionsRes, hrMinuteRes] = await Promise.all([
    fetch("https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate", {
      method:  "POST",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify({
        aggregateBy: [
          { dataTypeName: "com.google.step_count.delta" },
          { dataTypeName: "com.google.calories.expended" },
          { dataTypeName: "com.google.heart_rate.bpm" },
          { dataTypeName: "com.google.weight" },
          { dataTypeName: "com.google.active_minutes" },
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
    fetch("https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate", {
      method:  "POST",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify({
        aggregateBy:     [{ dataTypeName: "com.google.heart_rate.bpm" }],
        bucketByTime:    { durationMillis: 60_000 },
        startTimeMillis: startMs,
        endTimeMillis:   endMs,
      }),
    }),
  ]);

  // Flatten the minute-bucketed response into {tMs, bpm} points, one per non-empty bucket.
  const hrPoints: { tMs: number; bpm: number }[] = [];
  if (hrMinuteRes.ok) {
    const hrJson = await hrMinuteRes.json() as { bucket?: Bucket[] };
    for (const b of hrJson.bucket ?? []) {
      const pts = b.dataset?.[0]?.point ?? [];
      if (!pts.length) continue;
      const avg = pts.reduce((s: number, p: Point) => s + (p.value?.[0]?.fpVal ?? 0), 0) / pts.length;
      hrPoints.push({ tMs: Number(b.startTimeMillis ?? 0), bpm: avg });
    }
  }
  const sessionHeartRate = (sStartMs: number, sEndMs: number): { avg: number | null; max: number | null } => {
    const inWindow = hrPoints.filter(p => p.tMs >= sStartMs && p.tMs <= sEndMs).map(p => p.bpm);
    if (!inWindow.length) return { avg: null, max: null };
    return {
      avg: Math.round(inWindow.reduce((a, b) => a + b, 0) / inWindow.length),
      max: Math.round(Math.max(...inWindow)),
    };
  };

  if (!activityRes.ok) {
    const err = await activityRes.text();
    return NextResponse.json({ error: "Google Fit error", detail: err }, { status: 502 });
  }

  const actJson = await activityRes.json() as { bucket: Bucket[] };

  // Index sessions + sleep by date — sleep extracted from session types
  const SLEEP_TYPES = [72, 110, 111, 112, 113, 114];
  const sessionsByDate: Record<string, RawSession[]> = {};
  const sleepByDate: Record<string, number> = {};
  if (sessionsRes.ok) {
    const sj = await sessionsRes.json() as { session?: RawSession[] };
    for (const s of sj.session ?? []) {
      const d = format(new Date(Number(s.startTimeMillis)), "yyyy-MM-dd");
      if (SLEEP_TYPES.includes(s.activityType ?? 0)) {
        const durMin = Math.round((Number(s.endTimeMillis) - Number(s.startTimeMillis)) / 60_000);
        sleepByDate[d] = (sleepByDate[d] ?? 0) + durMin;
      } else {
        (sessionsByDate[d] ??= []).push(s);
      }
    }
  }

  // Batch write to Firestore
  const db       = getAdminFirestore();
  let   batch    = db.batch();
  let   opCount  = 0;
  let   written  = 0;

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

    const sessions = (sessionsByDate[date] ?? [])
      .map(s => {
        const sStartMs = Number(s.startTimeMillis);
        const sEndMs   = Number(s.endTimeMillis);
        const hr = sessionHeartRate(sStartMs, sEndMs);
        return {
          id:          s.id,
          name:        s.name || activityLabel(s.activityType ?? 0),
          activityType: s.activityType ?? 0,
          startMs:     sStartMs,
          endMs:       sEndMs,
          durationMin: Math.round((sEndMs - sStartMs) / 60_000),
          calories:    null,
          heartRateAvg: hr.avg,
          heartRateMax: hr.max,
        };
      });

    const hrAvg  = getAvgFp(2);
    const weight = getLastFp(3);
    const sleep  = sleepByDate[date] ?? null;

    batch.set(db.doc(`users/owner/fitnessData/${date}`), {
      date,
      googleFit: {
        steps:               getInt(0),
        activeCaloriesBurned: Math.round(getFp(1)),
        activeMinutes:       getInt(4),
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

  return NextResponse.json({ ok: true, days: written, from, to });
}

interface Point      { value?: { intVal?: number; fpVal?: number }[] }
interface SleepPoint extends Point { startTimeNanos?: string; endTimeNanos?: string }
interface Bucket {
  startTimeMillis?: string;
  dataset?: { point?: (Point & SleepPoint)[] }[];
}
interface RawSession {
  id: string; name: string; activityType?: number;
  startTimeMillis: string; endTimeMillis: string;
}
