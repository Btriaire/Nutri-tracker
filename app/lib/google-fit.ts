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

  const d           = doc.data()!;
  const expiresAt   = (d.expiresAt?.toMillis?.() ?? Number(d.expiresAt)) as number;
  const refreshToken = decrypt(d.refreshToken as string);
  let   accessToken  = decrypt(d.accessToken  as string);

  // Refresh if expired (with 2-min buffer)
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
      client_id:     process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
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

// ─── Fitness data fetch ───────────────────────────────────────────────────────

interface DayFitnessData {
  steps:               number;
  activeCaloriesBurned: number;
  distanceMeters:      number;
  heartRateAvg:        number | null;
}

export async function fetchDayData(userId: string, date: string): Promise<DayFitnessData | null> {
  const tokens = await getTokens(userId);
  if (!tokens) return null;

  // date = "YYYY-MM-DD" → day boundaries in ms
  const start = new Date(date + "T00:00:00").getTime();
  const end   = new Date(date + "T23:59:59").getTime();

  const body = {
    aggregateBy: [
      { dataTypeName: "com.google.step_count.delta" },
      { dataTypeName: "com.google.calories.expended" },
      { dataTypeName: "com.google.distance.delta" },
      { dataTypeName: "com.google.heart_rate.bpm" },
    ],
    bucketByTime:    { durationMillis: 86_400_000 },
    startTimeMillis: start,
    endTimeMillis:   end,
  };

  const res = await fetch(
    "https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate",
    {
      method:  "POST",
      headers: {
        Authorization:  `Bearer ${tokens.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );

  if (!res.ok) {
    console.error("Google Fit API error:", res.status, await res.text());
    return null;
  }

  const json = await res.json() as { bucket: GoogleFitBucket[] };
  const bucket = json.bucket?.[0];
  if (!bucket) return null;

  const getInt  = (i: number) => bucket.dataset?.[i]?.point?.reduce((s: number, p: GoogleFitPoint) => s + (p.value?.[0]?.intVal ?? 0), 0) ?? 0;
  const getFp   = (i: number) => bucket.dataset?.[i]?.point?.reduce((s: number, p: GoogleFitPoint) => s + (p.value?.[0]?.fpVal ?? 0), 0) ?? 0;
  const getAvgFp = (i: number) => {
    const pts = bucket.dataset?.[i]?.point ?? [];
    if (!pts.length) return null;
    const sum = pts.reduce((s: number, p: GoogleFitPoint) => s + (p.value?.[0]?.fpVal ?? 0), 0);
    return sum / pts.length;
  };

  return {
    steps:               getInt(0),
    activeCaloriesBurned: Math.round(getFp(1)),
    distanceMeters:      Math.round(getFp(2)),
    heartRateAvg:        getAvgFp(3) ? Math.round(getAvgFp(3)!) : null,
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
      distanceMeters:      data.distanceMeters,
      heartRateAvg:        data.heartRateAvg,
      heartRateMin:        null,
      heartRateMax:        null,
      workouts:            [],
      syncedAt:            FieldValue.serverTimestamp(),
    },
  }, { merge: true });

  return true;
}

// ─── Types (internal) ─────────────────────────────────────────────────────────

interface GoogleFitPoint {
  value?: { intVal?: number; fpVal?: number }[];
}
interface GoogleFitBucket {
  dataset?: { point?: GoogleFitPoint[] }[];
}
