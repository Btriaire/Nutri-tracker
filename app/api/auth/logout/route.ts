import { NextResponse } from "next/server";
import { deleteSession } from "@/app/lib/session";

export const dynamic = "force-dynamic";

export async function POST() {
  await deleteSession();
  return NextResponse.json({ ok: true });
}
