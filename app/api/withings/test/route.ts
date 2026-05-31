export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";
import { getTokens } from "@/app/lib/withings";
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

  return NextResponse.json({
    connected: true,
    tokenExpiresAt: new Date(tokens.expiresAt).toISOString(),
    dateRange: { from, to: today },
    measure: {
      status:    measJson.status,
      error:     measJson.error,
      groupCount: measJson.body?.measuregrps?.length ?? 0,
      sample:    measJson.body?.measuregrps?.slice(0, 2),
    },
    sleep: {
      status:      sleepJson.status,
      error:       sleepJson.error,
      seriesCount: sleepJson.body?.series?.length ?? 0,
      sample:      sleepJson.body?.series?.slice(0, 2),
    },
  });
}
