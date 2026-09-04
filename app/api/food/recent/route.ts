import { NextRequest, NextResponse } from "next/server";
import { FieldPath } from "firebase-admin/firestore";
import { format, subDays } from "date-fns";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import { getSession } from "@/app/lib/session";
import { nutritionPer100gFromServing } from "@/app/lib/nutrition";
import type { DayLog, FoodNutrition, FoodSource, MealType } from "@/app/lib/types";

export const dynamic = "force-dynamic";

export interface RecentFood {
  name:             string;
  brand?:           string;
  source:           FoodSource;
  nutritionPer100g: FoodNutrition;
  lastLoggedAt:     string;
  timesLogged:      number;
}

const LOOKBACK_DAYS = 60;
const MAX_RESULTS    = 60;

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Optional meal filter — same frequency+recency ranking, scoped to one meal
  // slot (e.g. "what do I actually eat for breakfast?"), used by the AI meal
  // suggester to learn habits per meal instead of one global food list.
  const meal = req.nextUrl.searchParams.get("meal") as MealType | null;

  const db  = getAdminFirestore();
  const to   = format(new Date(), "yyyy-MM-dd");
  const from = format(subDays(new Date(), LOOKBACK_DAYS), "yyyy-MM-dd");

  // Ascending __name__ order needs no extra composite index (unlike descending, which
  // Firestore only auto-indexes in the forward direction) — see /api/progress for the
  // same pattern. Iterating oldest → newest and overwriting lastLoggedAt on repeats
  // still lands on the most recent occurrence for each food.
  const snap = await db.collection(`users/${session.userId}/foodLog`)
    .where(FieldPath.documentId(), ">=", from)
    .where(FieldPath.documentId(), "<=", to)
    .orderBy(FieldPath.documentId(), "asc")
    .get();

  const byName = new Map<string, RecentFood>();
  for (const doc of snap.docs) {
    const log = doc.data() as DayLog;
    for (const entry of log.entries ?? []) {
      if (!entry.servingGrams || entry.servingGrams <= 0) continue;
      if (meal && entry.meal !== meal) continue;
      const key = entry.name.trim().toLowerCase();
      const existing = byName.get(key);
      if (existing) { existing.timesLogged += 1; existing.lastLoggedAt = doc.id; continue; }
      byName.set(key, {
        name:             entry.name,
        brand:            entry.brand,
        source:           entry.source,
        nutritionPer100g: nutritionPer100gFromServing(entry.nutrition, entry.servingGrams),
        lastLoggedAt:     doc.id,
        timesLogged:      1,
      });
    }
  }

  const results = Array.from(byName.values())
    .sort((a, b) => b.timesLogged - a.timesLogged || b.lastLoggedAt.localeCompare(a.lastLoggedAt))
    .slice(0, MAX_RESULTS);

  return NextResponse.json({ results });
}
