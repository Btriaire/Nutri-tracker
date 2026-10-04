export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";
import { fetchVps, VPS_DOWN_MESSAGE } from "@/app/lib/podcasts";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const res = await fetchVps("/api/notebooklm-nutri/status");
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ success: false, error: VPS_DOWN_MESSAGE }, { status: 504 });
  }
}
