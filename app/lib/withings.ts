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
  // { merge: true } — never accidentally wipe refreshToken or metadata fields.
  await db.doc(`users/${userId}/oauthTokens/withings`).set({
    provider:          "withings",
    accessToken:       encrypt(tokens.accessToken),
    refreshToken:      encrypt(tokens.refreshToken),
    expiresAt:         new Date(tokens.expiresAt),
    updatedAt:         FieldValue.serverTimestamp(),
    refreshError:      null,
    refreshFailedAt:   null,
    refreshing:        false,
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
  const doc = await db.doc(`users/${userId}/oauthTokens/withings`).get();
  if (!doc.exists) return "disconnected";
  const d = doc.data()!;
  const failedAt = d.refreshFailedAt?.toMillis?.() as number | undefined;
  if (failedAt && Date.now() - failedAt < 48 * 3600_000) return "needs_reauth";
  return "connected";
}

export async function getTokens(userId: string): Promise<RawTokens | null> {
  const db  = getAdminFirestore();
  const ref = db.doc(`users/${userId}/oauthTokens/withings`);
  const doc = await ref.get();
  if (!doc.exists) return null;

  const d            = doc.data()!;
  const expiresAt    = (d.expiresAt?.toMillis?.() ?? Number(d.expiresAt)) as number;
  const refreshToken = decrypt(d.refreshToken as string);
  const accessToken  = decrypt(d.accessToken  as string);

  // Refresh proactively 10 min before expiry (Withings tokens last 3h).
  // Larger buffer = much lower chance of two concurrent requests both trying
  // to refresh the same token (Withings rotates tokens → race causes failures).
  if (Date.now() > expiresAt - 600_000) {
    // ── Anti-concurrent-refresh lock ──────────────────────────────────────────
    // If another serverless invocation is already refreshing, the `refreshing`
    // flag will be set. Wait briefly and re-read — the other invocation will
    // have saved the new token by then.
    if (d.refreshing === true) {
      const lockSetAt = d.refreshingAt?.toMillis?.() as number | undefined;
      // Honour the lock only if it was set less than 20s ago (stale lock guard)
      if (lockSetAt && Date.now() - lockSetAt < 20_000) {
        await new Promise((r) => setTimeout(r, 3000));
        return getTokens(userId); // re-read after waiting
      }
    }

    // Claim the lock
    await ref.set({ refreshing: true, refreshingAt: new Date() }, { merge: true }).catch(() => {/* silent */});

    try {
      const fresh = await refreshWithRetry(refreshToken);
      await saveTokens(userId, fresh);
      return { accessToken: fresh.accessToken, refreshToken: fresh.refreshToken, expiresAt: fresh.expiresAt };
    } catch (err) {
      console.error("Withings token refresh failed:", err);
      await ref.set(
        { refreshError: String(err), refreshFailedAt: new Date(), refreshing: false },
        { merge: true },
      ).catch(() => {/* silent */});
      return null;
    }
  }

  return { accessToken, refreshToken, expiresAt };
}

export async function deleteTokens(userId: string) {
  const db = getAdminFirestore();
  await db.doc(`users/${userId}/oauthTokens/withings`).delete();
  await db.doc(`users/${userId}`).set(
    { integrations: { withings: { connected: false, lastSyncedAt: null } } },
    { merge: true },
  );
}

/** @deprecated Use getConnectionStatus() for richer state. */
export async function isConnected(userId: string): Promise<boolean> {
  const db  = getAdminFirestore();
  const doc = await db.doc(`users/${userId}/oauthTokens/withings`).get();
  return doc.exists;
}

// ─── OAuth ─────────────────────────────────────────────────────────────────────

async function refreshAccessToken(refreshToken: string): Promise<RawTokens> {
  const res = await fetch("https://wbsapi.withings.net/v2/oauth2", {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:    new URLSearchParams({
      action:        "refreshtoken",
      grant_type:    "refresh_token",
      client_id:     process.env.WITHINGS_CLIENT_ID!.trim(),
      client_secret: process.env.WITHINGS_CLIENT_SECRET!.trim(),
      refresh_token: refreshToken,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const json = await res.json() as WithingsTokenResponse;
  if (json.status !== 0) throw new Error(`Withings token refresh failed: status=${json.status}`);
  // Withings always returns a new refresh_token (token rotation).
  // Fall back to the old one only if the API unexpectedly omits it.
  return {
    accessToken:  json.body.access_token,
    refreshToken: json.body.refresh_token ?? refreshToken,
    expiresAt:    Date.now() + (json.body.expires_in ?? 10800) * 1000,
  };
}

/** Retry once on transient failures (Withings API flakiness, cold starts) */
async function refreshWithRetry(refreshToken: string): Promise<RawTokens> {
  try {
    return await refreshAccessToken(refreshToken);
  } catch (firstErr) {
    await new Promise((r) => setTimeout(r, 2500));
    try {
      return await refreshAccessToken(refreshToken);
    } catch {
      throw firstErr;
    }
  }
}

// ─── Measures fetch ───────────────────────────────────────────────────────────

// meastype: 1=weight 6=fat% 8=fat-free-mass 9=diastolicBP 10=systolicBP 11=resting-HR
//           41=hydration 42=bone-mass 54=SpO2 71=body-temp 76=muscle-mass 173=visceral-fat
const MEAS_TYPES = "1,6,8,9,10,11,41,42,54,71,76,173";

interface MeasureGroup {
  date:     number;    // unix timestamp
  measures: { value: number; type: number; unit: number }[];
}

interface DayMeasure {
  date:          string;
  weightKg:      number | null;
  bodyFatPct:    number | null;
  bmi:           number | null;
  muscleMassKg:  number | null;
  fatMassKg:     number | null;
  boneMassKg:    number | null;
  hydrationPct:  number | null;
  visceralFat:   number | null;
  spO2Pct:       number | null;
  restingHR:     number | null;
  tempCelsius:   number | null;
  systolicBP:    number | null;
  diastolicBP:   number | null;
  measuredAt:    number | null; // unix ms
}

function scaleMeas(value: number, unit: number): number {
  return value * Math.pow(10, unit);
}

export async function fetchRange(userId: string, from: string, to: string): Promise<DayMeasure[]> {
  const tokens = await getTokens(userId);
  if (!tokens) return [];

  const startdate = Math.floor(new Date(from + "T00:00:00").getTime() / 1000);
  const enddate   = Math.floor(new Date(to   + "T23:59:59").getTime() / 1000);

  // Withings measure API requires POST with form-encoded body (not GET)
  const formBody = new URLSearchParams({
    action:    "getmeas",
    meastype:  MEAS_TYPES,
    category:  "1",
    startdate: String(startdate),
    enddate:   String(enddate),
  });

  let res = await fetch("https://wbsapi.withings.net/measure", {
    method:  "POST",
    headers: {
      "Authorization":  `Bearer ${tokens.accessToken}`,
      "Content-Type":   "application/x-www-form-urlencoded",
    },
    body: formBody,
  });
  let json = await res.json() as WithingsMeasResponse;
  // Withings returns status 401 in the body when the access token is expired mid-call.
  // Force-refresh and retry once before giving up.
  if (json.status === 401) {
    try {
      const fresh = await refreshAccessToken(tokens.refreshToken);
      await saveTokens(userId, fresh);
      res  = await fetch("https://wbsapi.withings.net/measure", {
        method:  "POST",
        headers: { "Authorization": `Bearer ${fresh.accessToken}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: formBody,
      });
      json = await res.json() as WithingsMeasResponse;
    } catch { return []; }
  }
  if (json.status !== 0) {
    console.error("Withings measure error:", json.status, json.error);
    return [];
  }

  const groups: MeasureGroup[] = json.body?.measuregrps ?? [];

  // Group by date string
  const byDate: Record<string, DayMeasure> = {};
  for (const grp of groups) {
    const date = new Date(grp.date * 1000).toISOString().slice(0, 10);
    if (!byDate[date]) {
      byDate[date] = { date, weightKg: null, bodyFatPct: null, bmi: null, muscleMassKg: null, fatMassKg: null, boneMassKg: null, hydrationPct: null, visceralFat: null, spO2Pct: null, restingHR: null, tempCelsius: null, systolicBP: null, diastolicBP: null, measuredAt: grp.date * 1000 };
    }
    const day = byDate[date];
    for (const m of grp.measures) {
      const v = scaleMeas(m.value, m.unit);
      if (m.type === 1)   day.weightKg     = Math.round(v * 100) / 100;
      if (m.type === 6)   day.bodyFatPct   = Math.round(v * 10)  / 10;
      if (m.type === 8)   day.fatMassKg    = null; // type 8 = fat-free mass, used below
      if (m.type === 9)   day.diastolicBP  = Math.round(v);
      if (m.type === 10)  day.systolicBP   = Math.round(v);
      if (m.type === 11)  day.restingHR    = Math.round(v);
      if (m.type === 41)  day.hydrationPct = Math.round(v * 10) / 10;
      if (m.type === 42)  day.boneMassKg   = Math.round(v * 100) / 100;
      if (m.type === 54)  day.spO2Pct      = Math.round(v * 10) / 10;
      if (m.type === 71)  day.tempCelsius  = Math.round(v * 10) / 10;
      if (m.type === 76)  day.muscleMassKg = Math.round(v * 100) / 100;
      if (m.type === 173) day.visceralFat  = Math.round(v * 10) / 10;
    }
    // Compute fatMassKg from weight - fatFreeMass
    const fatFree = grp.measures.find(m => m.type === 8);
    if (fatFree && byDate[date].weightKg !== null) {
      const ffkg = scaleMeas(fatFree.value, fatFree.unit);
      byDate[date].fatMassKg = Math.round((byDate[date].weightKg! - ffkg) * 100) / 100;
    }
  }

  return Object.values(byDate);
}

// ─── Sync helpers ─────────────────────────────────────────────────────────────

export async function syncRange(userId: string, from: string, to: string): Promise<number> {
  const days = await fetchRange(userId, from, to);
  if (!days.length) return 0;

  const db = getAdminFirestore();
  const ts = FieldValue.serverTimestamp();

  const CHUNK = 400;
  let written = 0;
  for (let i = 0; i < days.length; i += CHUNK) {
    const batch = db.batch();
    for (const day of days.slice(i, i + CHUNK)) {
      const ref = db.doc(`users/${userId}/fitnessData/${day.date}`);
      batch.set(ref, {
        date: day.date,
        withings: {
          weightKg:     day.weightKg,
          bodyFatPct:   day.bodyFatPct,
          bmi:          day.bmi,
          muscleMassKg: day.muscleMassKg,
          fatMassKg:    day.fatMassKg,
          boneMassKg:   day.boneMassKg   ?? null,
          hydrationPct: day.hydrationPct ?? null,
          visceralFat:  day.visceralFat  ?? null,
          spO2Pct:      day.spO2Pct      ?? null,
          restingHR:    day.restingHR    ?? null,
          tempCelsius:  day.tempCelsius  ?? null,
          systolicBP:   day.systolicBP   ?? null,
          diastolicBP:  day.diastolicBP  ?? null,
          measuredAt:   day.measuredAt ? new Date(day.measuredAt) : null,
          syncedAt:     ts,
        },
      }, { merge: true });
      written++;
    }
    await batch.commit();
  }

  // Auto-sync blood pressure to healthLog when Withings BPM data exists
  const bpDays = days.filter(d => d.systolicBP !== null && d.diastolicBP !== null);
  if (bpDays.length > 0) {
    const bpBatch = db.batch();
    for (const day of bpDays) {
      const ref = db.doc(`users/${userId}/healthLog/${day.date}`);
      // Only set if not already manually entered (don't overwrite user data)
      const existing = await ref.get();
      const existingData = existing.data() as { systolic?: number; source?: string } | undefined;
      if (!existing.exists || existingData?.source === "withings") {
        bpBatch.set(ref, {
          date:      day.date,
          systolic:  day.systolicBP,
          diastolic: day.diastolicBP,
          source:    "withings",
          syncedAt:  ts,
        }, { merge: true });
      }
    }
    await bpBatch.commit();
  }

  // Also sync sleep summary
  const sleepDays = await fetchSleepSummary(userId, from, to);
  for (let i = 0; i < sleepDays.length; i += CHUNK) {
    const batch = db.batch();
    for (const s of sleepDays.slice(i, i + CHUNK)) {
      const ref = db.doc(`users/${userId}/fitnessData/${s.date}`);
      batch.set(ref, {
        date: s.date,
        withingsSleep: {
          totalSleepSec: s.totalSleepSec,
          deepSleepSec:  s.deepSleepSec,
          lightSleepSec: s.lightSleepSec,
          remSleepSec:   s.remSleepSec,
          sleepScore:    s.sleepScore,
          hrAvgSleep:    s.hrAvgSleep,
          snoringSec:    s.snoringSec,
          wakeupCount:   s.wakeupCount,
          syncedAt:      ts,
        },
      }, { merge: true });
    }
    await batch.commit();
  }

  // Sync activity data
  const actDays = await fetchActivity(userId, from, to);
  if (actDays.length > 0) {
    const CHUNK2 = 400;
    for (let i = 0; i < actDays.length; i += CHUNK2) {
      const batch = db.batch();
      for (const a of actDays.slice(i, i + CHUNK2)) {
        if (!a.steps && !a.activeCalories) continue; // skip empty days
        const ref = db.doc(`users/${userId}/fitnessData/${a.date}`);
        batch.set(ref, {
          date: a.date,
          withingsActivity: {
            steps:           a.steps,
            distanceM:       a.distanceM,
            activeCalories:  a.activeCalories,
            totalCalories:   a.totalCalories,
            softMinutes:     a.softMinutes,
            moderateMinutes: a.moderateMinutes,
            intenseMinutes:  a.intenseMinutes,
            hrAvg:           a.hrAvg,
            syncedAt:        ts,
          },
        }, { merge: true });
      }
      await batch.commit();
    }
  }

  await db.doc(`users/${userId}`).set(
    { integrations: { withings: { connected: true, lastSyncedAt: ts } } },
    { merge: true },
  );

  return written;
}

export async function syncDay(userId: string, date: string): Promise<boolean> {
  const n = await syncRange(userId, date, date);
  return n > 0;
}

// ─── Activity fetch ───────────────────────────────────────────────────────────

interface WithingsActivityDay {
  date:             string;
  steps:            number | null;
  distanceM:        number | null;
  activeCalories:   number | null;
  totalCalories:    number | null;
  softMinutes:      number | null;
  moderateMinutes:  number | null;
  intenseMinutes:   number | null;
  hrAvg:            number | null;
}

async function fetchActivity(userId: string, from: string, to: string): Promise<WithingsActivityDay[]> {
  const tokens = await getTokens(userId);
  if (!tokens) return [];

  const formBody = new URLSearchParams({
    action:       "getactivity",
    startdateymd: from,
    enddateymd:   to,
    data_fields:  "steps,distance,active_calories,total_calories,soft,moderate,intense,heart_rate_average",
  });

  const res = await fetch("https://wbsapi.withings.net/v2/measure", {
    method:  "POST",
    headers: { "Authorization": `Bearer ${tokens.accessToken}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: formBody,
  });
  if (!res.ok) return [];
  const json = await res.json() as { status: number; body?: { activities: { date: string; steps?: number; distance?: number; active_calories?: number; total_calories?: number; soft?: number; moderate?: number; intense?: number; heart_rate_average?: number }[] } };
  if (json.status !== 0 || !json.body?.activities) return [];

  return json.body.activities.map(a => ({
    date:            a.date,
    steps:           a.steps           ?? null,
    distanceM:       a.distance        ?? null,
    activeCalories:  a.active_calories ?? null,
    totalCalories:   a.total_calories  ?? null,
    softMinutes:     a.soft            ?? null,
    moderateMinutes: a.moderate        ?? null,
    intenseMinutes:  a.intense         ?? null,
    hrAvg:           a.heart_rate_average ?? null,
  }));
}

// ─── Sleep Summary ─────────────────────────────────────────────────────────────

interface SleepSummaryDay {
  date:          string;
  totalSleepSec: number | null;
  deepSleepSec:  number | null;
  lightSleepSec: number | null;
  remSleepSec:   number | null;
  sleepScore:    number | null;
  hrAvgSleep:    number | null;
  snoringSec:    number | null;
  wakeupCount:   number | null;
}

export async function fetchSleepSummary(userId: string, from: string, to: string): Promise<SleepSummaryDay[]> {
  const tokens = await getTokens(userId);
  if (!tokens) return [];

  const formBody = new URLSearchParams({
    action:       "getsummary",
    startdateymd: from,
    enddateymd:   to,
    data_fields:  "total_sleep_time,deepsleepduration,lightsleepduration,remsleepduration,sleep_score,heart_rate_average,snoring,wakeupcount",
  });

  const res = await fetch("https://wbsapi.withings.net/v2/sleep", {
    method:  "POST",
    headers: {
      "Authorization": `Bearer ${tokens.accessToken}`,
      "Content-Type":  "application/x-www-form-urlencoded",
    },
    body: formBody,
  });

  if (!res.ok) return [];
  const json = await res.json() as { status: number; body?: { series: { date: string; data: Record<string, number> }[] } };
  if (json.status !== 0 || !json.body?.series) return [];

  return json.body.series.map(s => ({
    date:          s.date,
    totalSleepSec: s.data.total_sleep_time   ?? null,
    deepSleepSec:  s.data.deepsleepduration  ?? null,
    lightSleepSec: s.data.lightsleepduration ?? null,
    remSleepSec:   s.data.remsleepduration   ?? null,
    sleepScore:    s.data.sleep_score        ?? null,
    hrAvgSleep:    s.data.heart_rate_average ?? null,
    snoringSec:    s.data.snoring            ?? null,
    wakeupCount:   s.data.wakeupcount        ?? null,
  }));
}

// ─── Internal types ────────────────────────────────────────────────────────────

interface WithingsTokenResponse {
  status: number;
  error?: string;
  body:   {
    access_token:  string;
    refresh_token?: string;
    expires_in?:   number;
    token_type?:   string;
    scope?:        string;
    userid?:       string;
  };
}

interface WithingsMeasResponse {
  status: number;
  error?: string;
  body?: {
    measuregrps: MeasureGroup[];
  };
}
