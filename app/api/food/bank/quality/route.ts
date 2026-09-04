import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";
import { lookupBarcode } from "@/app/lib/food-api";

export const dynamic = "force-dynamic";

// On-demand only (never bulk-fetched for the whole bank list) — Open Food
// Facts is a per-product HTTP call, so this is called lazily when the user
// expands one food's detail, not for every OFF-sourced item at once.
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const code = req.nextUrl.searchParams.get("code");
  if (!code) return NextResponse.json({ error: "Missing code" }, { status: 400 });

  const product = await lookupBarcode(code);
  if (!product) return NextResponse.json({ found: false });

  return NextResponse.json({
    found:          true,
    nutriScore:     product.nutriScore ?? null,
    novaGroup:      product.novaGroup ?? null,
    additivesCount: product.additivesCount ?? null,
  });
}
