import { NextRequest, NextResponse } from "next/server";
import { lookupBarcode } from "@/app/lib/food-api";
import { getSession } from "@/app/lib/session";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code")?.trim() ?? "";

  if (!code) return NextResponse.json({ found: false, product: null });

  const product = await lookupBarcode(code);
  return NextResponse.json({ found: product !== null, product });
}
