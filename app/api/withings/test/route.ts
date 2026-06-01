export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";
import { getTokens } from "@/app/lib/withings";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import { format, subDays } from "date-fns";

const USER = "owner";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tokens = await getTokens(USER);
  if (!tokens) {
    return NextResponse.json({
      connected: false,
      error: "Pas de tokens Withings — veuillez vous reconnecter dans /settings",
    });
  }

  const today = format(new Date(), "yyyy-MM-dd");
  const from  = format(subDays(new Date(), 6), "yyyy-MM-dd");
  const startdate = Math.floor(new Date(from  + "T00:00:00Z").getTime() / 1000);
  const enddate   = Math.floor(new Date(today + "T23:59:59Z").getTime() / 1000);

  // Test measure endpoint
  const measRes = await fetch("https://wbsapi.withings.net/measure", {
    method:  "POST",
    headers: {
      "Authorization": `Bearer ${tokens.accessToken}`,
      "Content-Type":  "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      action:    "getmeas",
      meastype:  "1,6,8,76",
      category:  "1",
      startdate: String(startdate),
      enddate:   String(enddate),
    }),
  });
  const measJson = await measRes.json() as {
    status: number; error?: string;
    body?: { measuregrps?: { date: number; measures: { type: number; value: number; unit: number }[] }[] };
  };

  // Test sleep endpoint
  const sleepRes = await fetch("https://wbsapi.withings.net/v2/sleep", {
    method:  "POST",
    headers: {
      "Authorization": `Bearer ${tokens.accessToken}`,
      "Content-Type":  "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      action:       "getsummary",
      startdateymd: from,
      enddateymd:   today,
      data_fields:  "total_sleep_time,deepsleepduration,lightsleepduration,remsleepduration,sleep_score",
    }),
  });
  const sleepJson = await sleepRes.json() as {
    status: number; error?: string;
    body?: { series?: { date: string; data: Record<string, number> }[] };
  };

  // Check Firestore — what's stored for the last 7 days
  const db = getAdminFirestore();
  const firestoreDocs = await Promise.all(
    Array.from({ length: 7 }, (_, i) => format(subDays(new Date(), i), "yyyy-MM-dd"))
      .map(async (date) => {
        const snap = await db.doc(`users/${USER}/fitnessData/${date}`).get();
        if (!snap.exists) return { date, exists: false };
        const data = snap.data();
        const ws = data?.withingsSleep;
        return {
          date,
          exists: true,
          withingsSleep: ws ? {
            totalSleepSec: ws.totalSleepSec,
            lightSleepSec: ws.lightSleepSec,
            deepSleepSec:  ws.deepSleepSec,
            remSleepSec:   ws.remSleepSec,
            sleepScore:    ws.sleepScore,
          } : null,
        };
      })
  );

  return NextResponse.json({
    connected: true,
    tokenExpiresAt: new Date(tokens.expiresAt).toISOString(),
    dateRange: { from, to: today },
    // What the Withings API returns RIGHT NOW
    apiSleep: {
      status:      sleepJson.status,
      error:       sleepJson.error,
      seriesCount: sleepJson.body?.series?.length ?? 0,
      series:      sleepJson.body?.series,
    },
    // What is currently stored in Firestore
    firestoreSleep: firestoreDocs,
    // Body measures
    measure: {
      status:    measJson.status,
      error:     measJson.error,
      groupCount: measJson.body?.measuregrps?.length ?? 0,
    },
  });
}
