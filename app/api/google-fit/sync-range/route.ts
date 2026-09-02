import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";
import { getTokens, activityLabel } from "@/app/lib/google-fit";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { format } from "date-fns";

export const maxDuration = 60;

// This route is listed as public in middleware.ts (the cron calls it without a session
// cookie), so it checks its own auth: either a logged-in session (manual sync from the
// app) or the same CRON_SECRET bearer token the cron endpoint accepts.
async function isAuthorized(req: NextRequest): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  const bearer = req.headers.get("authorization");
  if (secret && bearer === `Bearer ${secret}`) return true;
  const session = await getSession();
  return !!session;
}

export async function POST(req: NextRequest) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { from, to } = await req.json() as { from: string; to: string };
  if (!from || !to) return NextResponse.json({ error: "from and to required" }, { status: 400 });

  const tokens = await getTokens("owner");
  if (!tokens) return NextResponse.json({ error: "Not connected" }, { status: 400 });

  const startMs  = new Date(from + "T00:00:00").getTime();
  const endMs    = new Date(to   + "T23:59:59").getTime();
  const startIso = new Date(startMs).toISOString();
  const endIso   = new Date(endMs).toISOString();
  const auth     = `Bearer ${tokens.accessToken}`;

  // Google's sessions.list only has start/end/activityType/name — no heart rate, calories,
  // or steps *during* the session. To capture all of that, fetch HR/calories/steps at
  // 1-minute resolution across the whole range in one extra request (not one per session,
  // which wouldn't scale with many workouts) and slice it per-session below.
  const [activityRes, sleepRes, sessionsRes, minuteRes, bpRes] = await Promise.all([
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
        aggregateBy: [
          { dataTypeName: "com.google.heart_rate.bpm" },
          { dataTypeName: "com.google.calories.expended" },
          { dataTypeName: "com.google.step_count.delta" },
        ],
        bucketByTime:    { durationMillis: 60_000 },
        startTimeMillis: startMs,
        endTimeMillis:   endMs,
      }),
    }),
    // Blood pressure via the RAW dataset read, not dataset:aggregate — the
    // aggregate endpoint silently returns com.google.blood_pressure.summary
    // instead, whose value array is [sysAvg, sysMin, sysMax, diaAvg, diaMin,
    // diaMax, ...] rather than [systolic, diastolic] (observed producing
    // 151/151 instead of the real 151/83). The raw merged-source dataset
    // preserves each point's value[0]=systolic/value[1]=diastolic untouched.
    fetch(
      `https://www.googleapis.com/fitness/v1/users/me/dataSources/derived:com.google.blood_pressure:com.google.android.gms:merged/datasets/${startMs * 1_000_000}-${endMs * 1_000_000}`,
      { headers: { Authorization: auth } },
    ),
  ]);

  // Flatten the minute-bucketed response into one point per non-empty minute.
  const minutePoints: { tMs: number; bpm: number | null; cal: number; steps: number }[] = [];
  if (minuteRes.ok) {
    const minuteJson = await minuteRes.json() as { bucket?: Bucket[] };
    for (const b of minuteJson.bucket ?? []) {
      const hrPts   = b.dataset?.[0]?.point ?? [];
      const calPts  = b.dataset?.[1]?.point ?? [];
      const stepPts = b.dataset?.[2]?.point ?? [];
      if (!hrPts.length && !calPts.length && !stepPts.length) continue;
      minutePoints.push({
        tMs:   Number(b.startTimeMillis ?? 0),
        bpm:   hrPts.length ? hrPts.reduce((s: number, p: Point) => s + (p.value?.[0]?.fpVal ?? 0), 0) / hrPts.length : null,
        cal:   calPts.reduce((s: number, p: Point) => s + (p.value?.[0]?.fpVal ?? 0), 0),
        steps: stepPts.reduce((s: number, p: Point) => s + (p.value?.[0]?.intVal ?? 0), 0),
      });
    }
  }
  // Group raw blood-pressure points by date (yyyy-MM-dd of each point's own timestamp).
  const bpByDate: Record<string, { systolic: number; diastolic: number; time: string; moment: string; source: string }[]> = {};
  if (bpRes.ok) {
    const bpJson = await bpRes.json() as { point?: (Point & SleepPoint)[] };
    for (const p of bpJson.point ?? []) {
      const systolic  = p.value?.[0]?.fpVal;
      const diastolic = p.value?.[1]?.fpVal;
      if (systolic == null || diastolic == null) continue;
      const d    = new Date(Number(p.startTimeNanos ?? 0) / 1_000_000);
      const date = format(d, "yyyy-MM-dd");
      const hh   = String(d.getHours()).padStart(2, "0");
      const mm   = String(d.getMinutes()).padStart(2, "0");
      const hour = d.getHours();
      (bpByDate[date] ??= []).push({
        systolic:  Math.round(systolic),
        diastolic: Math.round(diastolic),
        time:      `${hh}:${mm}`,
        moment:    hour < 12 ? "morning" : hour >= 18 ? "evening" : "other",
        source:    "google_fit",
      });
    }
  }

  const sessionMetrics = (sStartMs: number, sEndMs: number) => {
    const inWindow = minutePoints.filter(p => p.tMs >= sStartMs && p.tMs <= sEndMs);
    const bpms = inWindow.map(p => p.bpm).filter((v): v is number => v != null);
    return {
      heartRateAvg: bpms.length ? Math.round(bpms.reduce((a, b) => a + b, 0) / bpms.length) : null,
      heartRateMax: bpms.length ? Math.round(Math.max(...bpms)) : null,
      calories:     inWindow.length ? Math.round(inWindow.reduce((s, p) => s + p.cal, 0)) : null,
      steps:        inWindow.length ? inWindow.reduce((s, p) => s + p.steps, 0) : null,
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
        const m = sessionMetrics(sStartMs, sEndMs);
        return {
          id:          s.id,
          name:        s.name || activityLabel(s.activityType ?? 0),
          activityType: s.activityType ?? 0,
          startMs:     sStartMs,
          endMs:       sEndMs,
          durationMin: Math.round((sEndMs - sStartMs) / 60_000),
          calories:     m.calories,
          heartRateAvg: m.heartRateAvg,
          heartRateMax: m.heartRateMax,
          steps:        m.steps,
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

    // Blood pressure lives in healthLog, not fitnessData — same collection the
    // manual Tension widget and Blood Doctor's push both write to. arrayUnion
    // dedups exact-match objects, so re-syncing never adds the same reading twice.
    const bpReadings = bpByDate[date] ?? [];
    if (bpReadings.length > 0) {
      batch.set(
        db.doc(`users/owner/healthLog/${date}`),
        { date, bloodPressure: FieldValue.arrayUnion(...bpReadings), updatedAt: FieldValue.serverTimestamp() },
        { merge: true },
      );
      opCount++;
    }

    written++;

    if (opCount >= 490) {
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
