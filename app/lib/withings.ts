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
  await db.doc(`users/${userId}/oauthTokens/withings`).set({
    provider:     "withings",
    accessToken:  encrypt(tokens.accessToken),
    refreshToken: encrypt(tokens.refreshToken),
    expiresAt:    new Date(tokens.expiresAt),
    updatedAt:    FieldValue.serverTimestamp(),
  });
}

export async function getTokens(userId: string): Promise<RawTokens | null> {
  const db  = getAdminFirestore();
  const doc = await db.doc(`users/${userId}/oauthTokens/withings`).get();
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
  await db.doc(`users/${userId}/oauthTokens/withings`).delete();
  await db.doc(`users/${userId}`).set(
    { integrations: { withings: { connected: false, lastSyncedAt: null } } },
    { merge: true },
  );
}

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
  });
  const json = await res.json() as WithingsTokenResponse;
  if (json.status !== 0) throw new Error(`Withings token refresh failed: ${json.status}`);
  return {
    accessToken:  json.body.access_token,
    refreshToken: json.body.refresh_token ?? refreshToken,
    expiresAt:    Date.now() + (json.body.expires_in ?? 10800) * 1000,
  };
}

// ─── Measures fetch ───────────────────────────────────────────────────────────

// meastype: 1=weight(kg) 6=fat% 8=fat-free-mass 76=muscle-mass
const MEAS_TYPES = "1,6,8,76";

interface MeasureGroup {
  date:     number;    // unix timestamp
  measures: { value: number; type: number; unit: number }[];
}

interface DayMeasure {
  date:         string;
  weightKg:     number | null;
  bodyFatPct:   number | null;
  bmi:          number | null;
  muscleMassKg: number | null;
  fatMassKg:    number | null;
  measuredAt:   number | null; // unix ms
}

function scaleMeas(value: number, unit: number): number {
  return value * Math.pow(10, unit);
}

export async function fetchRange(userId: string, from: string, to: string): Promise<DayMeasure[]> {
  const tokens = await getTokens(userId);
  if (!tokens) return [];

  const startdate = Math.floor(new Date(from + "T00:00:00").getTime() / 1000);
  const enddate   = Math.floor(new Date(to   + "T23:59:59").getTime() / 1000);

  const url = new URL("https://wbsapi.withings.net/measure");
  url.searchParams.set("action",    "getmeas");
  url.searchParams.set("meastype",  MEAS_TYPES);
  url.searchParams.set("category",  "1");
  url.searchParams.set("startdate", String(startdate));
  url.searchParams.set("enddate",   String(enddate));

  const res  = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${tokens.accessToken}` },
  });
  const json = await res.json() as WithingsMeasResponse;
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
      byDate[date] = { date, weightKg: null, bodyFatPct: null, bmi: null, muscleMassKg: null, fatMassKg: null, measuredAt: grp.date * 1000 };
    }
    const day = byDate[date];
    for (const m of grp.measures) {
      const v = scaleMeas(m.value, m.unit);
      if (m.type === 1)  day.weightKg     = Math.round(v * 100) / 100;
      if (m.type === 6)  day.bodyFatPct   = Math.round(v * 10)  / 10;
      if (m.type === 8)  day.fatMassKg    = null; // type 8 is fat-free mass — store separately
      if (m.type === 76) day.muscleMassKg = Math.round(v * 100) / 100;
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
          measuredAt:   day.measuredAt ? new Date(day.measuredAt) : null,
          syncedAt:     ts,
        },
      }, { merge: true });
      written++;
    }
    await batch.commit();
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
