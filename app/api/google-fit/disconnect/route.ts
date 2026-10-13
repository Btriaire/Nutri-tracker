import { getSession } from "@/app/lib/session";
import { NextResponse } from "next/server";
import { deleteTokens } from "@/app/lib/google-fit";

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const USER = session.userId;
  await deleteTokens(USER);
  return NextResponse.json({ ok: true });
}
