import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import { nanoid } from "nanoid";
import type { ManualActivity } from "@/app/lib/types";

export const dynamic = "force-dynamic";

const ACTIVITY_NAMES: Record<number, string> = {
  1: "Course à pied", 3: "Course", 7: "Vélo", 8: "Vélo",
  9: "Aérobic", 10: "Ski", 17: "Musculation", 37: "Aviron",
  41: "Course", 45: "Football", 46: "Marche", 49: "Snowboard",
  54: "Tennis", 55: "Escaliers", 56: "Vélo",60: "Musculation",
  72: "Tennis", 74: "Volley", 75: "Marche", 82: "Yoga",
  83: "Danse", 93: "Natation", 104: "Boxe", 108: "Yoga", 109: "Rugby",
  0: "Activité libre",
};

// GET /api/activity?date=YYYY-MM-DD
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  const db  = getAdminFirestore();
  const snap = await db
    .collection(`users/${session.userId}/manualActivities`)
    .where("date", "==", date)
    .orderBy("loggedAt", "desc")
    .get();

  const activities = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return NextResponse.json({ activities });
}

// POST /api/activity
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    date: string;
    name?: string;
    activityType: number;
    durationMin: number;
    caloriesBurned?: number | null;
    notes?: string;
  };

  if (!body.date || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  const db = getAdminFirestore();
  const id = nanoid();
  const activity: ManualActivity = {
    id,
    date:           body.date,
    name:           body.name?.trim() || ACTIVITY_NAMES[body.activityType] || "Activité",
    activityType:   body.activityType,
    durationMin:    Math.max(1, body.durationMin),
    caloriesBurned: body.caloriesBurned ?? null,
    notes:          body.notes,
    loggedAt:       Timestamp.now(),
  };

  await db.doc(`users/${session.userId}/manualActivities/${id}`).set(activity);
  return NextResponse.json({ activity }, { status: 201 });
}
