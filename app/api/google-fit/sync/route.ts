import { NextRequest, NextResponse } from "next/server";
import { syncDay, isConnected } from "@/app/lib/google-fit";
import { format } from "date-fns";

// Vercel's default US-East (iad1) function region was observed reading a
// stale cached "estimated_steps" merge from Google's Fitness API (thousands
// of steps behind the live value), while calls from Europe got the current
// number for the same account/token — a Google-side regional replication
// lag. Paris keeps the function close to where this account actually syncs.
export const preferredRegion = "cdg1";

export async function POST(req: NextRequest) {
  const { date } = await req.json() as { date?: string };
  const targetDate = date ?? format(new Date(), "yyyy-MM-dd");

  if (!await isConnected("owner")) {
    return NextResponse.json({ error: "Not connected" }, { status: 400 });
  }

  const ok = await syncDay("owner", targetDate);
  return NextResponse.json({ ok, date: targetDate });
}
