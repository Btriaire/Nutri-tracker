import { NextRequest, NextResponse } from "next/server";
import { syncDay, isConnected } from "@/app/lib/google-fit";
import { format } from "date-fns";

export async function POST(req: NextRequest) {
  const { date } = await req.json() as { date?: string };
  const targetDate = date ?? format(new Date(), "yyyy-MM-dd");

  if (!await isConnected("owner")) {
    return NextResponse.json({ error: "Not connected" }, { status: 400 });
  }

  const ok = await syncDay("owner", targetDate);
  return NextResponse.json({ ok, date: targetDate });
}
