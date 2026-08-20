import { NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";
import { getQuotaStatus } from "@/app/lib/quota-tracker";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const status = await getQuotaStatus();
  return NextResponse.json(status);
}
