import { NextResponse } from "next/server";
import { deleteTokens } from "@/app/lib/google-fit";

export async function POST() {
  await deleteTokens("owner");
  return NextResponse.json({ ok: true });
}
