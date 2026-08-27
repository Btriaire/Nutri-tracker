export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";

const VPS_MANAGER_URL = process.env.VPS_MANAGER_URL || "http://46.202.131.240:9000";
const VALID_PERIODS = new Set(["7d", "30d", "90d", "all"]);

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const period = VALID_PERIODS.has(body?.period) ? body.period : "7d";

  try {
    const res = await fetch(`${VPS_MANAGER_URL}/api/notebooklm-nutri/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ period }),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ success: false, error: "VPS injoignable" }, { status: 502 });
  }
}
