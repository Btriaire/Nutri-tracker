import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import type { ManualActivity } from "@/app/lib/types";

export const dynamic = "force-dynamic";

const USER = "owner";

const ACTIVITY_NAMES: Record<number, string> = {
  1: "Course à pied", 3: "Course", 7: "Vélo", 8: "Vélo",
  9: "Aérobic", 10: "Ski", 17: "Musculation", 37: "Aviron",
  41: "Course", 45: "Football", 46: "Marche", 49: "Snowboard",
  54: "Tennis", 55: "Escaliers", 56: "Vélo", 60: "Musculation",
  72: "Tennis", 74: "Volley", 75: "Marche", 82: "Yoga",
  83: "Danse", 93: "Natation", 104: "Boxe", 108: "Yoga", 109: "Rugby",
  0: "Activité libre",
};

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date))
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });

  const db   = getAdminFirestore();
  // No orderBy to avoid composite index requirement — sort in JS
  const snap = await db
    .collection(`users/${USER}/manualActivities`)
    .where("date", "==", date)
    .get();

  const activities = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
      const aMs = (a.loggedAt as { _seconds?: number })?._seconds ?? 0;
      const bMs = (b.loggedAt as { _seconds?: number })?._seconds ?? 0;
      return bMs - aMs;
    });

  return NextResponse.json({ activities });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    date: string;
    name?: string;
    activityType: number;
    durationMin: number;
    caloriesBurned?: number | null;
    notes?: string;
    sets?: number;
    reps?: number;
    weightKg?: number | null;
    weightPerSet?: number[] | null;
  };
  try {
    body = await req.json() as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.date || !/^\d{4}-\d{2}-\d{2}$/.test(body.date))
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });

  const durationMin = Math.max(1, Number(body.durationMin) || 1);

  try {
    const db  = getAdminFirestore();
    const id  = crypto.randomUUID();
    const activity: ManualActivity = {
      id,
      date:           body.date,
      name:           body.name?.trim() || ACTIVITY_NAMES[body.activityType] || "Activité",
      activityType:   Number(body.activityType) || 0,
      durationMin,
      caloriesBurned: body.caloriesBurned != null ? Number(body.caloriesBurned) : null,
      notes:          body.notes,
      loggedAt:       Timestamp.now(),
      ...(body.sets       != null ? { sets:       Number(body.sets)       } : {}),
      ...(body.reps       != null ? { reps:       Number(body.reps)       } : {}),
      ...(body.weightKg   != null ? { weightKg:   Number(body.weightKg)   } : {}),
      ...(body.weightPerSet       ? { weightPerSet: body.weightPerSet.map(Number) } : {}),
    };

    await db.doc(`users/${USER}/manualActivities/${id}`).set(activity);
    // Serialize loggedAt to plain object so JSON response is valid
    return NextResponse.json({ activity: { ...activity, loggedAt: { seconds: activity.loggedAt.seconds, nanoseconds: activity.loggedAt.nanoseconds } } }, { status: 201 });
  } catch (e) {
    console.error("[activity POST]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
