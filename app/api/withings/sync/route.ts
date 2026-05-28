export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { syncDay, syncRange } from "@/app/lib/withings";
import { getSession } from "@/app/lib/session";
import { format, subDays } from "date-fns";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body  = await req.json() as { date?: string; days?: number };
  const today = format(new Date(), "yyyy-MM-dd");

  if (body.days) {
    const from = format(subDays(new Date(), body.days - 1), "yyyy-MM-dd");
    const n    = await syncRange("owner", from, today);
    return NextResponse.json({ ok: true, days: n });
  }

  const date = body.date ?? today;
  const ok   = await syncDay("owner", date);
  return NextResponse.json({ ok, date });
}
