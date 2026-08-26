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
  // Use { merge: true } so we never accidentally wipe refreshToken or other fields.
  // Only update the fields we explicitly set — preserves any existing metadata.
  await db.doc(`users/${userId}/oauthTokens/google_fit`).set({
    provider:          "google_fit",
    accessToken:       encrypt(tokens.accessToken),
    refreshToken:      encrypt(tokens.refreshToken),
    expiresAt:         new Date(tokens.expiresAt),
    updatedAt:         FieldValue.serverTimestamp(),
    // Clear any stale error flags on successful save
    refreshError:      null,
    refreshFailedAt:   null,
  }, { merge: true });
}

/** Connection states:
 * - "connected"    → token doc exists, no recent refresh failure
 * - "needs_reauth" → doc exists but last refresh failed (user must reconnect)
 * - "disconnected" → no token doc
 */
export type ConnectionStatus = "connected" | "needs_reauth" | "disconnected";

export async function getConnectionStatus(userId: string): Promise<ConnectionStatus> {
  const db  = getAdminFirestore();
  const doc = await db.doc(`users/${userId}/oauthTokens/google_fit`).get();
  if (!doc.exists) return "disconnected";
  const d = doc.data()!;
  // If a refresh failed within the last 48h, flag as needs_reauth
  const failedAt = d.refreshFailedAt?.toMillis?.() as number | undefined;
  if (failedAt && Date.now() - failedAt < 48 * 3600_000) return "needs_reauth";
  return "connected";
}

export async function getTokens(userId: string): Promise<RawTokens | null> {
  const db  = getAdminFirestore();
  const doc = await db.doc(`users/${userId}/oauthTokens/google_fit`).get();
  if (!doc.exists) return null;

  const d            = doc.data()!;
  const expiresAt    = (d.expiresAt?.toMillis?.() ?? Number(d.expiresAt)) as number;
  const refreshToken = decrypt(d.refreshToken as string);
  const accessToken  = decrypt(d.accessToken  as string);

  // Refresh proactively 10 min before expiry (was 2 min — too short, caused
  // race conditions when parallel requests both tried to refresh)
  if (Date.now() > expiresAt - 600_000) {
    try {
      const fresh = await refreshWithRetry(refreshToken);
      await saveTokens(userId, fresh);
      return { accessToken: fresh.accessToken, refreshToken: fresh.refreshToken, expiresAt: fresh.expiresAt };
    } catch (err) {
      const permanent = err instanceof TokenRefreshError && err.permanent;
      console.error(
        `Google Fit token refresh failed (${permanent ? "permanent — reconnect required" : "transient — will retry later"}):`,
        err,
      );

      // ONLY flag needs_reauth for a genuine invalid_grant (refresh token
      // revoked/expired). Transient errors (cold-start timeout, 5xx, network)
      // must NOT flip the connection status — that's what caused the app to
      // appear "disconnected all the time" after a single network glitch.
      if (permanent) {
        await db.doc(`users/${userId}/oauthTokens/google_fit`).set(
          { refreshError: String(err), refreshFailedAt: new Date() },
          { merge: true },
        ).catch(() => {/* silent */});
        return null;
      }

      // Transient failure: if the current access token hasn't actually expired
      // yet (we refresh 10 min early), keep using it rather than going dark.
      if (Date.now() < expiresAt) {
        return { accessToken, refreshToken, expiresAt };
      }
      return null;
    }
  }

  return { accessToken, refreshToken, expiresAt };
}

export async function deleteTokens(userId: string) {
  const db = getAdminFirestore();
  await db.doc(`users/${userId}/oauthTokens/google_fit`).delete();
}

/** @deprecated Use getConnectionStatus() for richer state. */
export async function isConnected(userId: string): Promise<boolean> {
  const db  = getAdminFirestore();
  const doc = await db.doc(`users/${userId}/oauthTokens/google_fit`).get();
  return doc.exists;
}

// ─── OAuth helpers ────────────────────────────────────────────────────────────

/** A refresh failure. `permanent === true` means the refresh token is dead
 *  (invalid_grant: revoked, expired, or consent withdrawn) and the user MUST
 *  reconnect. Everything else (timeout, network, 5xx) is transient. */
class TokenRefreshError extends Error {
  permanent: boolean;
  constructor(message: string, permanent: boolean) {
    super(message);
    this.name = "TokenRefreshError";
    this.permanent = permanent;
  }
}

async function refreshAccessToken(refreshToken: string): Promise<RawTokens> {
  let res: Response;
  try {
    res = await fetch("https://oauth2.googleapis.com/token", {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body:    new URLSearchParams({
        grant_type:    "refresh_token",
        refresh_token: refreshToken,
        client_id:     process.env.GOOGLE_CLIENT_ID!.trim(),
        client_secret: process.env.GOOGLE_CLIENT_SECRET!.trim(),
      }),
      // 15s timeout — avoids hanging indefinitely on slow Vercel cold starts
      signal: AbortSignal.timeout(15_000),
    });
  } catch (netErr) {
    // Network error / timeout / abort → always transient
    throw new TokenRefreshError(`Network error during refresh: ${netErr}`, false);
  }

  const json = await res.json().catch(() => ({})) as { access_token?: string; expires_in?: number; error?: string };

  if (!res.ok || json.error || !json.access_token) {
    // invalid_grant is the ONLY error meaning the refresh token is truly dead.
    // 5xx / rate-limit / anything else is transient and worth retrying.
    const permanent = json.error === "invalid_grant";
    throw new TokenRefreshError(
      `Token refresh failed: ${json.error ?? `HTTP ${res.status}`}`,
      permanent,
    );
  }

  return {
    accessToken:  json.access_token,
    refreshToken,                       // Google doesn't rotate refresh tokens
    expiresAt:    Date.now() + (json.expires_in ?? 3600) * 1000,
  };
}

/** Retry transient failures (network glitch, Vercel cold start, 5xx).
 *  A permanent invalid_grant is surfaced immediately — no point retrying. */
async function refreshWithRetry(refreshToken: string): Promise<RawTokens> {
  try {
    return await refreshAccessToken(refreshToken);
  } catch (firstErr) {
    if (firstErr instanceof TokenRefreshError && firstErr.permanent) throw firstErr;
    // Wait 2s then try once more before giving up
    await new Promise((r) => setTimeout(r, 2000));
    return await refreshAccessToken(refreshToken);
  }
}

// ─── Activity type labels ─────────────────────────────────────────────────────

const ACTIVITY_LABELS: Record<number, string> = {
  // ── Cardio / Course ──────────────────────────────────────────────────────────
  1:   "Aérobic",          3:   "Course",           29:  "Jogging",
  41:  "Course à pied",    67:  "Tapis de course",  27:  "HIIT",
  // ── Vélo ─────────────────────────────────────────────────────────────────────
  7:   "Vélo",             8:   "Vélo indoor",      39:  "VTT",
  56:  "Vélo stationnaire",
  // ── Marche / Randonnée ───────────────────────────────────────────────────────
  46:  "Marche",           75:  "Marche rapide",    19:  "Randonnée",
  // ── Natation / Eau ──────────────────────────────────────────────────────────
  93:  "Natation",         78:  "Aquagym",          79:  "Water-polo",
  // ── Musculation / Force ──────────────────────────────────────────────────────
  60:  "Musculation",      9:   "Circuit training", 103: "Kettlebell",
  81:  "Haltérophilie",
  // ── Sports collectifs ────────────────────────────────────────────────────────
  45:  "Football",         84:  "Basketball",       74:  "Volley",
  80:  "Badminton",        54:  "Squash",           72:  "Tennis",
  109: "Rugby",            16:  "Handball",
  // ── Arts martiaux / Combat ───────────────────────────────────────────────────
  104: "Boxe",             31:  "Kickboxing",       36:  "Arts martiaux",
  // ── Mind-body ────────────────────────────────────────────────────────────────
  82:  "Yoga",             22:  "Hot yoga",         65:  "Tai-chi",
  108: "Pilates",          61:  "Stretching",
  // ── Cardio machines / Salle ─────────────────────────────────────────────────
  17:  "Elliptique",       55:  "Escalier",         58:  "Stepper",
  // ── Sports d'hiver / Extrême ─────────────────────────────────────────────────
  10:  "Ski de fond",      49:  "Snowboard",        53:  "Ski",
  48:  "Escalade",         63:  "Surf",             57:  "Paddle",
  // ── Divers ───────────────────────────────────────────────────────────────────
  37:  "Aviron",           25:  "Patinage",         83:  "Zumba",
  68:  "Triathlon",        51:  "Skateboard",
};

export function activityLabel(type: number): string {
  return ACTIVITY_LABELS[type] ?? `Activité (${type})`;
}

// ─── GPS activity types (outdoor — may have location data) ───────────────────

const GPS_ACTIVITY_TYPES = new Set([
  3, 7, 10, 19, 25, 29, 37, 39, 41, 46, 48, 49, 51, 53, 57, 63, 68, 75,
]);

export function isGpsActivity(type: number): boolean {
  return GPS_ACTIVITY_TYPES.has(type);
}

// ─── Data types ───────────────────────────────────────────────────────────────

export interface WorkoutSession {
  id:             string;
  name:           string;
  activityType:   number;
  startMs:        number;
  endMs:          number;
  durationMin:    number;
  calories:       number | null;
  distanceM:      number | null;
  avgSpeedKmh:    number | null;
  heartRateAvg:   number | null;
  elevationGainM: number | null;
}

// ─── Per-session details: calories, distance, HR ─────────────────────────────

interface SessionDetails {
  calories:       number | null;
  distanceM:      number | null;
  avgSpeedKmh:    number | null;
  heartRateAvg:   number | null;
  elevationGainM: number | null;
}

async function fetchSessionDetails(auth: string, s: WorkoutSession): Promise<SessionDetails> {
  const durMs = Math.max(1, s.endMs - s.startMs);

  try {
    const res = await fetch(
      "https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate",
      {
        method:  "POST",
        headers: { Authorization: auth, "Content-Type": "application/json" },
        body: JSON.stringify({
          aggregateBy: [
            { dataTypeName: "com.google.calories.expended" },  // 0
            { dataTypeName: "com.google.distance.delta" },      // 1
            { dataTypeName: "com.google.heart_rate.bpm" },      // 2
          ],
          bucketByTime:    { durationMillis: durMs },
          startTimeMillis: s.startMs,
          endTimeMillis:   s.endMs,
        }),
      }
    );
    if (!res.ok) return { calories: null, distanceM: null, avgSpeedKmh: null, heartRateAvg: null, elevationGainM: null };

    type AggPoint = { value?: { fpVal?: number; intVal?: number }[] };
    type AggJson  = { bucket?: { dataset?: { point?: AggPoint[] }[] }[] };
    const json  = await res.json() as AggJson;
    const bkt   = json.bucket?.[0];
    if (!bkt) return { calories: null, distanceM: null, avgSpeedKmh: null, heartRateAvg: null, elevationGainM: null };

    const sumFp = (i: number): number | null => {
      const pts = bkt.dataset?.[i]?.point ?? [];
      const v = pts.reduce((acc, p) => acc + (p.value?.[0]?.fpVal ?? 0), 0);
      return v > 0 ? v : null;
    };
    const avgFp = (i: number): number | null => {
      const pts = bkt.dataset?.[i]?.point ?? [];
      if (!pts.length) return null;
      const v = pts.reduce((acc, p) => acc + (p.value?.[0]?.fpVal ?? 0), 0) / pts.length;
      return v > 0 ? v : null;
    };

    const cal  = sumFp(0);
    const dist = sumFp(1);
    const hr   = avgFp(2);

    // Derive speed from distance + duration (more reliable than speed.summary)
    let avgSpeedKmh: number | null = null;
    if (dist && s.durationMin > 0) {
      avgSpeedKmh = Math.round((dist / 1000) / (s.durationMin / 60) * 10) / 10;
    }

    return {
      calories:       cal  !== null ? Math.round(cal)  : null,
      distanceM:      dist !== null && dist > 10 ? Math.round(dist) : null,
      avgSpeedKmh:    avgSpeedKmh,
      heartRateAvg:   hr   !== null ? Math.round(hr)   : null,
      elevationGainM: null, // computed from GPS route on demand
    };
  } catch {
    return { calories: null, distanceM: null, avgSpeedKmh: null, heartRateAvg: null, elevationGainM: null };
  }
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
          // Pinned to the same merged/estimated stream the Google Fit app itself
          // reads for the step count it displays — without a dataSourceId, the
          // API aggregates raw per-source deltas instead, which under-counts
          // whenever more than one source (phone + watch, etc.) contributes.
          { dataTypeName: "com.google.step_count.delta", dataSourceId: "derived:com.google.step_count.delta:com.google.android.gms:estimated_steps" }, // 0
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

  // If the activity request returned 401, the token expired mid-call.
  // Force-refresh and retry all three requests with the new token.
  if (activityRes.status === 401) {
    try {
      const fresh = await refreshAccessToken(tokens.refreshToken);
      await saveTokens(userId, fresh);
      tokens.accessToken = fresh.accessToken;
    } catch (err) {
      console.error("Google Fit token refresh (retry) failed:", err);
      return null;
    }
    // Re-run the full fetch with the fresh token (tail-call to avoid duplicating logic)
    return fetchDayData(userId, date);
  }

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
        // Workout sessions: only include those that START on the target date
        // (the fetch window extends 18h back for sleep capture — without this
        //  filter yesterday's workouts would bleed into today's dashboard)
        if (sessStart >= startMs) {
          sessions.push({
            id:             s.id,
            name:           s.name || activityLabel(s.activityType ?? 0),
            activityType:   s.activityType ?? 0,
            startMs:        sessStart,
            endMs:          sessEnd,
            durationMin,
            calories:       null,
            distanceM:      null,
            avgSpeedKmh:    null,
            heartRateAvg:   null,
            elevationGainM: null,
          });
        }
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
        if (stage === 2) light += durMin;   // generic/unspecified sleep → treat as light
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

  // ── Fetch per-session details (calories, distance, HR) in parallel batches ─
  if (sessions.length > 0) {
    const BATCH = 5;
    for (let i = 0; i < sessions.length; i += BATCH) {
      const batch = sessions.slice(i, i + BATCH);
      const details = await Promise.all(
        batch.map(s => fetchSessionDetails(auth, s))
      );
      details.forEach((d, j) => {
        const s = sessions[i + j];
        s.calories       = d.calories       ?? s.calories;
        s.distanceM      = d.distanceM;
        s.avgSpeedKmh    = d.avgSpeedKmh;
        s.heartRateAvg   = d.heartRateAvg;
        s.elevationGainM = d.elevationGainM;
      });
    }
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
