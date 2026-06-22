import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import type { GymSession, GymExercise, GymSet, ManualActivity } from "@/app/lib/types";

export const dynamic = "force-dynamic";

const USER = "owner";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Musculation ≈ 5 MET (effort modéré) — calories = MET × 75 kg × h
function estimateCalories(durationMin: number): number {
  return Math.round(5 * 75 * (durationMin / 60));
}

function totalVolume(exercises: GymExercise[]): number {
  let vol = 0;
  for (const ex of exercises) {
    for (const s of ex.sets) {
      if (s.done) vol += (Number(s.reps) || 0) * (Number(s.weightKg) || 0);
    }
  }
  return Math.round(vol);
}

// ─── GET : séances d'un jour, ou d'une plage (?from=&to= pour la progression) ──
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  const from = searchParams.get("from");
  const to   = searchParams.get("to");

  const db  = getAdminFirestore();
  const col = db.collection(`users/${USER}/gymSessions`);

  let docs;
  if (date && DATE_RE.test(date)) {
    docs = (await col.where("date", "==", date).get()).docs;
  } else if (from && to && DATE_RE.test(from) && DATE_RE.test(to)) {
    docs = (await col.where("date", ">=", from).where("date", "<=", to).get()).docs;
  } else {
    return NextResponse.json({ error: "date ou from+to requis" }, { status: 400 });
  }

  const sessions = docs
    .map((d) => d.data())
    .sort((a, b) => {
      const aMs = (a.loggedAt as { _seconds?: number })?._seconds ?? 0;
      const bMs = (b.loggedAt as { _seconds?: number })?._seconds ?? 0;
      return bMs - aMs;
    });

  return NextResponse.json({ sessions });
}

// ─── POST : créer/sauvegarder une séance ────────────────────────────────────────
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    date:        string;
    name?:       string;
    exercises?:  GymExercise[];
    durationMin?: number;
  };
  try {
    body = await req.json() as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.date || !DATE_RE.test(body.date))
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });

  // Sanitize exercises / sets
  const exercises: GymExercise[] = (body.exercises ?? []).map((ex) => ({
    exerciseId:    String(ex.exerciseId ?? ""),
    name:          String(ex.name ?? "Exercice"),
    primaryMuscle: String(ex.primaryMuscle ?? ""),
    sets: (ex.sets ?? []).map((s): GymSet => ({
      reps:     Math.max(0, Math.round(Number(s.reps)     || 0)),
      weightKg: Math.max(0, Number(s.weightKg) || 0),
      done:     s.done !== false,
    })),
    ...(ex.machinePhoto ? { machinePhoto: ex.machinePhoto } : {}),
    ...(ex.notes?.trim() ? { notes: ex.notes.trim() }       : {}),
  })).filter((ex) => ex.exerciseId && ex.sets.length > 0);

  if (exercises.length === 0)
    return NextResponse.json({ error: "Aucun exercice" }, { status: 400 });

  const durationMin = Math.max(1, Math.round(Number(body.durationMin) || 45));
  const caloriesBurned = estimateCalories(durationMin);
  const volume = totalVolume(exercises);
  const name = body.name?.trim() || "Séance muscu";

  try {
    const db   = getAdminFirestore();
    const id   = crypto.randomUUID();
    const actId = crypto.randomUUID();
    const now  = Timestamp.now();

    // Mirror ManualActivity (type 17 = Musculation) so it counts in calories/dashboard
    const activity: ManualActivity = {
      id:             actId,
      date:           body.date,
      name,
      activityType:   17,
      durationMin,
      caloriesBurned,
      loggedAt:       now,
      notes:          `${exercises.length} exercices · ${volume} kg de volume`,
    };

    const gymSession: GymSession = {
      id,
      date:           body.date,
      name,
      exercises,
      durationMin,
      totalVolumeKg:  volume,
      caloriesBurned,
      activityId:     actId,
      loggedAt:       now,
    };

    await Promise.all([
      db.doc(`users/${USER}/gymSessions/${id}`).set(gymSession),
      db.doc(`users/${USER}/manualActivities/${actId}`).set(activity),
    ]);

    return NextResponse.json({
      session: { ...gymSession, loggedAt: { seconds: now.seconds, nanoseconds: now.nanoseconds } },
    }, { status: 201 });
  } catch (e) {
    console.error("[gym POST]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// ─── DELETE : supprimer une séance (+ son activité miroir) ──────────────────────
export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });

  try {
    const db   = getAdminFirestore();
    const ref  = db.doc(`users/${USER}/gymSessions/${id}`);
    const snap = await ref.get();
    const activityId = snap.exists ? (snap.data() as GymSession).activityId : undefined;

    await ref.delete();
    if (activityId) {
      await db.doc(`users/${USER}/manualActivities/${activityId}`).delete().catch(() => {});
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[gym DELETE]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
