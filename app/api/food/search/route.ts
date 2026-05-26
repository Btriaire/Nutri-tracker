import { NextRequest, NextResponse } from "next/server";
import { searchFoods } from "@/app/lib/food-api";
import { getSession } from "@/app/lib/session";
import type { Lang } from "@/app/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q    = searchParams.get("q")?.trim() ?? "";
  const lang = (searchParams.get("lang") ?? "fr") as Lang;

  if (!q) return NextResponse.json({ results: [] });

  const results = await searchFoods(q, lang);
  return NextResponse.json({ results });
}
