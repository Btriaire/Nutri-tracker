export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { deleteTokens } from "@/app/lib/withings";
import { getSession } from "@/app/lib/session";

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await deleteTokens("owner");
  return NextResponse.json({ ok: true });
}
