import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import { decrypt } from "@/app/lib/oauth";
import { format } from "date-fns";

export const dynamic = "force-dynamic";

export async function GET() {
  const db     = getAdminFirestore();
  const userId = "owner";

  const tokSnap = await db.doc(`users/${userId}/oauthTokens/google_fit`).get();
  if (!tokSnap.exists) return NextResponse.json({ error: "No GFit tokens" }, { status: 400 });
  const { accessToken: enc } = tokSnap.data() as { accessToken: string };
  const accessToken = decrypt(enc);
  const auth = `Bearer ${accessToken}`;

  const date        = format(new Date(), "yyyy-MM-dd");
  const startMs     = new Date(date + "T00:00:00").getTime();
  const noonMs      = startMs + 12 * 3600 * 1000;
  const windowStart = startMs - 12 * 3600 * 1000; // noon yesterday

  // 1. Aggregate API (current approach)
  const aggRes = await fetch("https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate", {
    method: "POST",
    headers: { Authorization: auth, "Content-Type": "application/json" },
    body: JSON.stringify({
      aggregateBy: [{ dataTypeName: "com.google.sleep.segment" }],
      bucketByTime: { durationMillis: 86_400_000 },
      startTimeMillis: windowStart,
      endTimeMillis: noonMs,
    }),
  });
  const aggJson = aggRes.ok ? await aggRes.json() : { error: aggRes.status };

  // 2. Dataset API — merged sleep segments (last 3 days)
  const from3dNs = String((Date.now() - 3 * 86400000) * 1_000_000);
  const nowNs    = String(Date.now() * 1_000_000);
  const dsRes = await fetch(
    `https://www.googleapis.com/fitness/v1/users/me/dataSources/derived:com.google.sleep.segment:com.google.android.gms:merge_sleep_segments/datasets/${from3dNs}-${nowNs}`,
    { headers: { Authorization: auth } }
  );
  const dsJson  = dsRes.ok ? await dsRes.json() : { error: dsRes.status, body: await dsRes.text() };

  // 3. Sessions (last 3 days) — type 72 = sleep
  const from3d = new Date(Date.now() - 3 * 86400000).toISOString();
  const now    = new Date().toISOString();
  const sessRes = await fetch(
    `https://www.googleapis.com/fitness/v1/users/me/sessions?startTime=${from3d}&endTime=${now}`,
    { headers: { Authorization: auth } }
  );
  const sessJson = sessRes.ok ? await sessRes.json() : { error: sessRes.status };

  // Parse what we actually get from aggregate
  const points: { startMs: number; endMs: number; stage: number; durMin: number }[] = [];
  for (const bkt of (aggJson as { bucket?: { dataset?: { point?: { startTimeNanos: string; endTimeNanos: string; value: { intVal?: number }[] }[] }[] }[] }).bucket ?? []) {
    for (const pt of bkt.dataset?.[0]?.point ?? []) {
      const s = Number(pt.startTimeNanos) / 1_000_000;
      const e = Number(pt.endTimeNanos)   / 1_000_000;
      points.push({ startMs: s, endMs: e, stage: pt.value?.[0]?.intVal ?? -1, durMin: Math.round((e - s) / 60000) });
    }
  }

  // 4. List all data sources that contain sleep data
  const dsListRes = await fetch(
    "https://www.googleapis.com/fitness/v1/users/me/dataSources?dataTypeName=com.google.sleep.segment",
    { headers: { Authorization: auth } }
  );
  const dsListJson = dsListRes.ok ? await dsListRes.json() : { error: dsListRes.status };

  return NextResponse.json({
    date,
    window: { from: new Date(windowStart).toISOString(), to: new Date(noonMs).toISOString() },
    aggregateParsed: points,
    aggregateRaw: aggJson,
    datasetRaw: dsJson,
    sessionsRaw: sessJson,
    dataSourcesList: dsListJson,
  });
}
