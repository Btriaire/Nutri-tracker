// Per-meal habit learning, used by /api/menu-suggestions to generate meal
// ideas that stay within what the user actually likes rather than generic
// AI output. Two signals feed the prompt:
//  1. A category-bucketed "palette" of liked foods (see inferFoodCategory) —
//     lets the model swap the SPECIFIC food within a category the user likes
//     (e.g. saumon instead of poulet, both "poisson"/"viande") instead of
//     just resurfacing the same handful of favorites verbatim every time.
//  2. The user's typical macro SPLIT for that meal (not just total calories)
//     — someone whose breakfasts run high-protein shouldn't get a
//     carb-heavy suggestion just because the calorie total matches.
//
// Also tracks the last few suggestion NAMES shown per meal (mealSuggestionHistory)
// so repeated taps of "Idées de repas IA" don't keep circling back to the
// same 3 dishes — a real staleness problem once temperature settles on a
// local optimum.

import { FieldPath } from "firebase-admin/firestore";
import { format, subDays } from "date-fns";
import { getAdminFirestore } from "./firebase-admin";
import { inferFoodCategory } from "./food-substitution";
import type { DayLog, MealType } from "./types";

const LOOKBACK_DAYS  = 60;
const MIN_TIMES      = 2;  // an item must appear at least this often to count as "liked"
const MAX_PER_CATEGORY = 4;
const HISTORY_SIZE   = 9;  // last N suggested names to avoid repeating (3 refreshes worth)

export interface MealHabitProfile {
  /** category -> up to MAX_PER_CATEGORY food names, most-eaten first */
  categoryPalette: Record<string, string[]>;
  /** null if too little history to be meaningful (<3 samples) */
  macroSplit: { proteinPct: number; carbsPct: number; fatPct: number } | null;
  sampleSize: number;
}

const EMPTY_PROFILE: MealHabitProfile = { categoryPalette: {}, macroSplit: null, sampleSize: 0 };

export async function getMealHabitProfile(userId: string, meal: MealType): Promise<MealHabitProfile> {
  try {
    const db   = getAdminFirestore();
    const to   = format(new Date(), "yyyy-MM-dd");
    const from = format(subDays(new Date(), LOOKBACK_DAYS), "yyyy-MM-dd");

    const snap = await db.collection(`users/${userId}/foodLog`)
      .where(FieldPath.documentId(), ">=", from)
      .where(FieldPath.documentId(), "<=", to)
      .orderBy(FieldPath.documentId(), "asc")
      .get();

    const freq = new Map<string, number>();
    let proteinCal = 0, carbsCal = 0, fatCal = 0, samples = 0;

    for (const doc of snap.docs) {
      const log = doc.data() as DayLog;
      for (const entry of log.entries ?? []) {
        if (entry.meal !== meal || !entry.servingGrams) continue;
        const key = entry.name.trim();
        if (!key) continue;
        freq.set(key, (freq.get(key) ?? 0) + 1);
        proteinCal += (entry.nutrition.proteinG ?? 0) * 4;
        carbsCal   += (entry.nutrition.carbsG   ?? 0) * 4;
        fatCal     += (entry.nutrition.fatG     ?? 0) * 9;
        samples++;
      }
    }

    if (samples === 0) return EMPTY_PROFILE;

    // Bucket liked (>= MIN_TIMES) foods by inferred category, most-eaten first per bucket
    const liked = [...freq.entries()].filter(([, n]) => n >= MIN_TIMES).sort((a, b) => b[1] - a[1]);
    const categoryPalette: Record<string, string[]> = {};
    for (const [name] of liked) {
      const cat = inferFoodCategory(name);
      const bucket = categoryPalette[cat] ?? (categoryPalette[cat] = []);
      if (bucket.length < MAX_PER_CATEGORY) bucket.push(name);
    }

    const totalCal = proteinCal + carbsCal + fatCal;
    const macroSplit = totalCal > 0 && samples >= 3
      ? {
          proteinPct: Math.round((proteinCal / totalCal) * 100),
          carbsPct:   Math.round((carbsCal   / totalCal) * 100),
          fatPct:     Math.round((fatCal     / totalCal) * 100),
        }
      : null;

    return { categoryPalette, macroSplit, sampleSize: samples };
  } catch (err) {
    console.error("getMealHabitProfile failed:", err);
    return EMPTY_PROFILE;
  }
}

// ─── Anti-repetition memory across suggestion refreshes ──────────────────────

export async function getRecentlySuggested(userId: string, meal: MealType): Promise<string[]> {
  try {
    const doc = await getAdminFirestore().doc(`users/${userId}/mealSuggestionHistory/${meal}`).get();
    return (doc.data()?.recentNames as string[] | undefined) ?? [];
  } catch {
    return [];
  }
}

/** Best-effort, never blocks the response — prepends the newly-shown names, dedups, caps at HISTORY_SIZE. */
export async function recordSuggested(userId: string, meal: MealType, names: string[]): Promise<void> {
  try {
    const existing = await getRecentlySuggested(userId, meal);
    const merged = [...names, ...existing.filter((n) => !names.includes(n))].slice(0, HISTORY_SIZE);
    await getAdminFirestore().doc(`users/${userId}/mealSuggestionHistory/${meal}`).set({ recentNames: merged });
  } catch (err) {
    console.error("recordSuggested failed:", err);
  }
}
