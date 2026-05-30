import { getAdminFirestore } from "./firebase-admin";
import { encrypt, decrypt } from "./oauth";
import { FieldValue } from "firebase-admin/firestore";

interface RawTokens {
  accessToken:  string;
  refreshToken: string;
  expiresAt:    number; // ms epoch
}

// ─── Token storage ────────────────────────────────────────────────────────────

export async function saveTokens(userId: string, tokens: RawTokens) {
  const db = getAdminFirestore();
  await db.doc(`users/${userId}/oauthTokens/google_fit`).set({
    provider:     "google_fit",
    accessToken:  encrypt(tokens.accessToken),
    refreshToken: encrypt(tokens.refreshToken),
    expiresAt:    new Date(tokens.expiresAt),
    updatedAt:    FieldValue.serverTimestamp(),
  });
}

export async function getTokens(userId: string): Promise<RawTokens | null> {
  const db  = getAdminFirestore();
  const doc = await db.doc(`users/${userId}/oauthTokens/google_fit`).get();
  if (!doc.exists) return null;

  const d            = doc.data()!;
  const expiresAt    = (d.expiresAt?.toMillis?.() ?? Number(d.expiresAt)) as number;
  const refreshToken = decrypt(d.refreshToken as string);
  let   accessToken  = decrypt(d.accessToken  as string);

  if (Date.now() > expiresAt - 120_000) {
    const fresh = await refreshAccessToken(refreshToken);
    await saveTokens(userId, fresh);
    accessToken = fresh.accessToken;
  }

  return { accessToken, refreshToken, expiresAt };
}

export async function deleteTokens(userId: string) {
  const db = getAdminFirestore();
  await db.doc(`users/${userId}/oauthTokens/google_fit`).delete();
}

export async function isConnected(userId: string): Promise<boolean> {
  const db  = getAdminFirestore();
  const doc = await db.doc(`users/${userId}/oauthTokens/google_fit`).get();
  return doc.exists;
}

// ─── OAuth helpers ────────────────────────────────────────────────────────────

async function refreshAccessToken(refreshToken: string): Promise<RawTokens> {
  const res  = await fetch("https://oauth2.googleapis.com/token", {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:    new URLSearchParams({
      grant_type:    "refresh_token",
      refresh_token: refreshToken,
      client_id:     process.env.GOOGLE_CLIENT_ID!.trim(),
      client_secret: process.env.GOOGLE_CLIENT_SECRET!.trim(),
    }),
  });
  const json = await res.json() as { access_token: string; expires_in: number; error?: string };
  if (json.error) throw new Error(`Token refresh failed: ${json.error}`);
  return {
    accessToken:  json.access_token,
    refreshToken,
    expiresAt:    Date.now() + json.expires_in * 1000,
  };
}

// ─── Activity type labels ─────────────────────────────────────────────────────

const ACTIVITY_LABELS: Record<number, string> = {
  1:  "Aérobic", 3: "Course", 7: "Vélo", 8: "Vélo indoor", 9: "Circuit training",
  10: "Ski de fond", 17: "Elliptique", 37: "Aviron", 41: "Course à pied",
  45: "Football", 46: "Marche", 49: "Snowboard", 54: "Squash", 55: "Escalier",
  56: "Vélo stationnaire", 60: "Musculation", 63: "Surf", 72: "Tennis",
  74: "Volley", 75: "Marche", 80: "Badminton", 82: "Yoga", 83: "Zumba",
  93: "Natation", 104: "Boxe", 108: "Pilates", 109: "Rugby",
};

export function activityLabel(type: number): string {
  return ACTIVITY_LABELS[type] ?? `Activité (${type})`;
}

// ─── Data types ───────────────────────────────────────────────────────────────

export interface WorkoutSession {
  id:           string;
  name:         string;
  activityType: number;
  startMs:      number;
  endMs:        number;
  durationMin:  number;
  calories:     number | null;
}

interface DayFitnessData {
  steps:               number;
  activeCaloriesBurned: number;
  activeMinutes:       number;
  heartRateAvg:        number | null;
  weightKg:            number | null;
  sleepMinutes:        number | null;      // actual sleep (light+deep+REM)
  timeInBedMinutes:    number | null;      // total session time (in bed)
  lightSleepMin:       number | null;
  deepSleepMin:        number | null;
  remSleepMin:         number | null;
  sleepSyncedAt:       string | null;      // ISO date of sleep session start
  sessions:            WorkoutSession[];
}

// ─── Fitness data fetch ───────────────────────────────────────────────────────

export async function fetchDayData(userId: string, date: string): Promise<DayFitnessData | null> {
  const tokens = await getTokens(userId);
  if (!tokens) return null;

  const startMs        = new Date(date + "T00:00:00").getTime();
  const endMs          = new Date(date + "T23:59:59").getTime();
  const noonMs         = startMs + 12 * 3600 * 1000;   // noon of sync date
  const sleepWindowStart = startMs - 12 * 3600 * 1000; // noon yesterday (captures pre-midnight stages)
  // Sessions query starts 18h before midnight to capture previous-night sleep (which starts ~10 PM day-1)
  const sessionStartMs  = startMs - 18 * 3600 * 1000;
  const startIso = new Date(sessionStartMs).toISOString();
  const endIso   = new Date(endMs).toISOString();
  const auth = `Bearer ${tokens.accessToken}`;

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
        aggregateBy: [{ dataTypeName: "com.google.sleep.segment" }],
        // Extend window to noon-yesterday→noon-today so we capture sleep stages
        // that started before midnight (e.g. falling asleep at 23:00 day-1)
        bucketByTime:    { durationMillis: 86_400_000 },
        startTimeMillis: sleepWindowStart,
        endTimeMillis:   noonMs,
      }),
    }),
    fetch(
      `https://www.googleapis.com/fitness/v1/users/me/sessions?startTime=${startIso}&endTime=${endIso}`,
      { headers: { Authorization: auth } },
    ),
  ]);

  if (!activityRes.ok) {
    console.error("Google Fit activity error:", activityRes.status, await activityRes.text());
    return null;
  }

  const actJson = await activityRes.json() as { bucket: GoogleFitBucket[] };
  const bucket  = actJson.bucket?.[0];
  if (!bucket) return null;

  const getInt    = (i: number) => bucket.dataset?.[i]?.point?.reduce((s: number, p: GoogleFitPoint) => s + (p.value?.[0]?.intVal ?? 0), 0) ?? 0;
  const getFp     = (i: number) => bucket.dataset?.[i]?.point?.reduce((s: number, p: GoogleFitPoint) => s + (p.value?.[0]?.fpVal ?? 0), 0) ?? 0;
  const getAvgFp  = (i: number) => {
    const pts = bucket.dataset?.[i]?.point ?? [];
    if (!pts.length) return null;
    return pts.reduce((s: number, p: GoogleFitPoint) => s + (p.value?.[0]?.fpVal ?? 0), 0) / pts.length;
  };
  const getLastFp = (i: number) => {
    const pts = bucket.dataset?.[i]?.point ?? [];
    return pts.length ? (pts[pts.length - 1].value?.[0]?.fpVal ?? null) : null;
  };

  // Sleep: sessions → timeInBedMinutes; segments → phases + sleepMinutes
  let timeInBedMinutes: number | null = null;
  let lightSleepMin:    number | null = null;
  let deepSleepMin:     number | null = null;
  let remSleepMin:      number | null = null;
  let sleepSyncedAt:    string | null = null;
  const sessions: WorkoutSession[] = [];

  // Sessions API: type 72 = sleep session = full in-bed time.
  // IMPORTANT: some trackers (Garmin, Samsung…) create multiple overlapping
  // sessions for the same night (one master + one per phase). We must merge
  // overlapping intervals to avoid double-counting.
  if (sessionsRes.ok) {
    const sessJson = await sessionsRes.json() as { session?: RawSession[] };
    const nightIntervals: [number, number][] = [];

    for (const s of sessJson.session ?? []) {
      const sessStart   = Number(s.startTimeMillis);
      const sessEnd     = Number(s.endTimeMillis);
      const durationMin = Math.round((sessEnd - sessStart) / 60_000);
      if (durationMin < 1) continue;

      if ((s.activityType ?? 0) === 72) {
        // Night sleep: session must END after midnight AND before noon
        // → excludes afternoon naps; captures the previous night's sleep.
        if (sessEnd >= startMs && sessEnd <= noonMs) {
          nightIntervals.push([sessStart, sessEnd]);
        }
      } else {
        sessions.push({
          id:           s.id,
          name:         s.name || activityLabel(s.activityType ?? 0),
          activityType: s.activityType ?? 0,
          startMs:      sessStart,
          endMs:        sessEnd,
          durationMin,
          calories:     null,
        });
      }
    }

    // Merge overlapping / nested intervals so sub-sessions aren't double-counted
    if (nightIntervals.length > 0) {
      nightIntervals.sort((a, b) => a[0] - b[0]);
      sleepSyncedAt = new Date(nightIntervals[0][0]).toISOString();

      const merged: [number, number][] = [nightIntervals[0]];
      for (let i = 1; i < nightIntervals.length; i++) {
        const last = merged[merged.length - 1];
        if (nightIntervals[i][0] <= last[1]) {
          // Overlapping or nested — extend the end if needed
          last[1] = Math.max(last[1], nightIntervals[i][1]);
        } else {
          merged.push(nightIntervals[i]);
        }
      }

      const inBedMs = merged.reduce((s, [st, en]) => s + en - st, 0);
      timeInBedMinutes = Math.round(inBedMs / 60_000);
    }
  }

  // Sleep segments: classify phases (light=4, deep=5, REM=6, awake=1, unspecified=2)
  // Only count stages that end before noon (excludes afternoon naps).
  // Use a Set keyed by "startNanos-endNanos-stage" to deduplicate identical points
  // (some trackers may sync the same segment multiple times).
  let sleepMinutes: number | null = null;
  if (sleepRes.ok) {
    const sleepJson = await sleepRes.json() as { bucket?: { dataset?: { point?: SleepSegmentPoint[] }[] }[] };
    let light = 0, deep = 0, rem = 0;
    const seen = new Set<string>();

    for (const bkt of sleepJson.bucket ?? []) {
      for (const pt of bkt.dataset?.[0]?.point ?? []) {
        const ptStartMs = Number(pt.startTimeNanos ?? 0) / 1_000_000;
        const ptEndMs   = Number(pt.endTimeNanos ?? 0)   / 1_000_000;
        // Only include stages from the night window (before noon of sync date)
        if (ptEndMs > noonMs) continue;
        const stage  = pt.value?.[0]?.intVal ?? 0;
        // Deduplicate identical points
        const key = `${ptStartMs}-${ptEndMs}-${stage}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const durMs  = ptEndMs - ptStartMs;
        const durMin = Math.round(durMs / 60_000);
        if (durMin < 1) continue;
        if (stage === 4) light += durMin;   // light sleep
        if (stage === 5) deep  += durMin;   // deep / slow-wave
        if (stage === 6) rem   += durMin;   // REM
      }
    }
    if (light + deep + rem > 0) {
      lightSleepMin = light || null;
      deepSleepMin  = deep  || null;
      remSleepMin   = rem   || null;
      sleepMinutes  = light + deep + rem;
    }
  }
  // Fallback: if no segment data, estimate from in-bed time (85% sleep efficiency)
  if (sleepMinutes === null && timeInBedMinutes !== null) {
    sleepMinutes = Math.round(timeInBedMinutes * 0.85);
  }

  return {
    steps:               getInt(0),
    activeCaloriesBurned: Math.round(getFp(1)),
    heartRateAvg:        getAvgFp(2) !== null ? Math.round(getAvgFp(2)!) : null,
    weightKg:            getLastFp(3) ? Math.round(getLastFp(3)! * 10) / 10 : null,
    activeMinutes:       getInt(4),
    sleepMinutes,
    timeInBedMinutes,
    lightSleepMin,
    deepSleepMin,
    remSleepMin,
    sleepSyncedAt,
    sessions,
  };
}

// ─── Sync: write to Firestore fitnessData ────────────────────────────────────

export async function syncDay(userId: string, date: string): Promise<boolean> {
  const data = await fetchDayData(userId, date);
  if (!data) return false;

  const db = getAdminFirestore();
  await db.doc(`users/${userId}/fitnessData/${date}`).set({
    date,
    googleFit: {
      steps:               data.steps,
      activeCaloriesBurned: data.activeCaloriesBurned,
      activeMinutes:       data.activeMinutes,
      heartRateAvg:        data.heartRateAvg,
      weightKg:            data.weightKg,
      sleepMinutes:        data.sleepMinutes,
      timeInBedMinutes:    data.timeInBedMinutes,
      lightSleepMin:       data.lightSleepMin,
      deepSleepMin:        data.deepSleepMin,
      remSleepMin:         data.remSleepMin,
      sleepSyncedAt:       data.sleepSyncedAt,
      sessions:            data.sessions,
      syncedAt:            FieldValue.serverTimestamp(),
    },
  }, { merge: true });

  return true;
}

// ─── Internal types ────────────────────────────────────────────────────────────

interface GoogleFitPoint {
  value?: { intVal?: number; fpVal?: number }[];
}
interface GoogleFitSleepPoint extends GoogleFitPoint {
  startTimeNanos?: string;
  endTimeNanos?:   string;
}
interface GoogleFitBucket {
  dataset?: { point?: (GoogleFitPoint & GoogleFitSleepPoint)[] }[];
}
interface RawSession {
  id:             string;
  name:           string;
  activityType?:  number;
  startTimeMillis: string;
  endTimeMillis:   string;
}

interface SleepSegmentPoint {
  startTimeNanos?: string;
  endTimeNanos?:   string;
  value?:          { intVal?: number }[];
}
