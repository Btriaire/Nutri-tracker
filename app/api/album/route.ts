export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import type { DayLog, FoodEntry, ManualActivity } from "@/app/lib/types";
import type { DayPhoto, DayPhotosDoc } from "@/app/api/photos/route";
import { FieldPath } from "firebase-admin/firestore";

const USER = "owner";

export interface AlbumMeal {
  name:     string;
  meal:     string;        // "breakfast" | "lunch" | "dinner" | "snacks"
  calories: number;
  grams:    number;
}

export interface AlbumDay {
  date:       string;                // YYYY-MM-DD
  photos:     DayPhoto[];            // day photos
  activityThumbnails: {              // manual activity thumbnails
    id:       string;
    name:     string;
    emoji:    string;
    thumb:    string;                // base64 data url
  }[];
  meals: {
    breakfast: AlbumMeal[];
    lunch:     AlbumMeal[];
    dinner:    AlbumMeal[];
    snacks:    AlbumMeal[];
  };
  totalCalories: number;
  activityNames: string[];
}

const MEAL_EMOJI: Record<string, string> = {
  0: "🏅", 1: "🏃", 7: "🚴", 17: "🏋️", 46: "🚶", 93: "🏊",
  82: "🧘", 9: "💪", 83: "💃", 45: "⚽", 54: "🎾", 104: "🥊",
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to   = searchParams.get("to");

  if (!from || !to) return NextResponse.json({ error: "from + to required" }, { status: 400 });

  const db = getAdminFirestore();

  const [logSnap, photosSnap, mealPhotosSnap, actSnap] = await Promise.all([
    db.collection(`users/${USER}/foodLog`)
      .where(FieldPath.documentId(), ">=", from)
      .where(FieldPath.documentId(), "<=", to)
      .orderBy(FieldPath.documentId(), "asc")
      .get(),
    db.collection(`users/${USER}/dayPhotos`)
      .where(FieldPath.documentId(), ">=", from)
      .where(FieldPath.documentId(), "<=", to)
      .orderBy(FieldPath.documentId(), "asc")
      .get(),
    db.collection(`users/${USER}/mealPhotos`)
      .where(FieldPath.documentId(), ">=", from)
      .where(FieldPath.documentId(), "<=", to)
      .orderBy(FieldPath.documentId(), "asc")
      .get(),
    db.collection(`users/${USER}/manualActivities`)
      .where("date", ">=", from)
      .where("date", "<=", to)
      .get(),
  ]);

  const MEAL_LABEL: Record<string, string> = {
    breakfast: "Petit-déjeuner", lunch: "Déjeuner", dinner: "Dîner", snacks: "Collation",
  };

  // Build photos map — day photos + meal (dish) photos merged into the same strip
  const photosMap = new Map<string, DayPhoto[]>();
  for (const d of photosSnap.docs) {
    const doc = d.data() as DayPhotosDoc;
    photosMap.set(d.id, doc.photos ?? []);
  }
  for (const d of mealPhotosSnap.docs) {
    const { updatedAt, ...mealShots } = d.data() as Record<string, unknown>;
    const dishPhotos: DayPhoto[] = Object.entries(mealShots)
      .filter(([, url]) => typeof url === "string" && url)
      .map(([mealKey, url]) => ({
        id:      `meal_${mealKey}`,
        dataUrl: url as string,
        addedAt: typeof updatedAt === "string" ? updatedAt : new Date().toISOString(),
        label:   MEAL_LABEL[mealKey] ?? "Plat",
      }));
    photosMap.set(d.id, [...(photosMap.get(d.id) ?? []), ...dishPhotos]);
  }

  // Build activities map (date → activity with thumb)
  const actMap = new Map<string, { id: string; name: string; emoji: string; thumb: string }[]>();
  for (const d of actSnap.docs) {
    const a = d.data() as ManualActivity & { photoDataUrl?: string };
    if (!a.photoDataUrl) continue;
    const date = a.date as string;
    if (!actMap.has(date)) actMap.set(date, []);
    actMap.get(date)!.push({
      id:    d.id,
      name:  a.name ?? "Activité",
      emoji: MEAL_EMOJI[a.activityType] ?? "🏅",
      thumb: a.photoDataUrl,
    });
  }

  // Build activity names map (all activities, not just those with photos)
  const actNamesMap = new Map<string, string[]>();
  for (const d of actSnap.docs) {
    const a = d.data() as ManualActivity;
    const date = a.date as string;
    if (!actNamesMap.has(date)) actNamesMap.set(date, []);
    actNamesMap.get(date)!.push(a.name ?? "Activité");
  }

  const days: AlbumDay[] = [];

  for (const d of logSnap.docs) {
    const log = d.data() as DayLog;
    const date = d.id;
    const photos = photosMap.get(date) ?? [];
    const activityThumbnails = actMap.get(date) ?? [];
    const activityNames = actNamesMap.get(date) ?? [];

    const sortEntries = (entries: FoodEntry[], mealKey: string): AlbumMeal[] =>
      (entries ?? [])
        .filter(e => e.meal === mealKey)
        .map(e => ({
          name:     e.name,
          meal:     mealKey,
          calories: Math.round(e.nutrition?.calories ?? 0),
          grams:    e.servingGrams ?? 0,
        }));

    days.push({
      date,
      photos,
      activityThumbnails,
      activityNames,
      meals: {
        breakfast: sortEntries(log.entries ?? [], "breakfast"),
        lunch:     sortEntries(log.entries ?? [], "lunch"),
        dinner:    sortEntries(log.entries ?? [], "dinner"),
        snacks:    sortEntries(log.entries ?? [], "snacks"),
      },
      totalCalories: Math.round(log.totals?.calories ?? 0),
    });
  }

  // Add days that have only photos / activities (no food log)
  const loggedDates = new Set(logSnap.docs.map(d => d.id));
  const allDates = new Set([...photosMap.keys(), ...actMap.keys()]);
  for (const date of allDates) {
    if (loggedDates.has(date)) continue;
    days.push({
      date,
      photos:               photosMap.get(date) ?? [],
      activityThumbnails:   actMap.get(date) ?? [],
      activityNames:        actNamesMap.get(date) ?? [],
      meals:                { breakfast: [], lunch: [], dinner: [], snacks: [] },
      totalCalories:        0,
    });
  }

  days.sort((a, b) => b.date.localeCompare(a.date)); // most recent first

  return NextResponse.json({ days });
}
