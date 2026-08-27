export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";

const VPS_MANAGER_URL = process.env.VPS_MANAGER_URL || "http://46.202.131.240:9000";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const res = await fetch(`${VPS_MANAGER_URL}/api/notebooklm-nutri/status`, { cache: "no-store" });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ success: false, error: "VPS injoignable" }, { status: 502 });
  }
}
