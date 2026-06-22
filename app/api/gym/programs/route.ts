import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import type { GymProgram, GymProgramExercise } from "@/app/lib/types";

export const dynamic = "force-dynamic";

const USER = "owner";

// ─── GET : liste des programmes ─────────────────────────────────────────────────
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db  = getAdminFirestore();
  const col = db.collection(`users/${USER}/gymPrograms`);
  const docs = (await col.get()).docs;

  const programs = docs
    .map((d) => d.data())
    .sort((a, b) => {
      const aMs = (a.createdAt as { _seconds?: number })?._seconds ?? 0;
      const bMs = (b.createdAt as { _seconds?: number })?._seconds ?? 0;
      return bMs - aMs;
    });

  return NextResponse.json({ programs });
}

// ─── POST : créer un programme ──────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { name?: string; exercises?: GymProgramExercise[] };
  try {
    body = await req.json() as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const exercises: GymProgramExercise[] = (body.exercises ?? [])
    .map((ex) => ({
      exerciseId: String(ex.exerciseId ?? ""),
      name:       String(ex.name ?? "Exercice"),
      sets:       Math.max(1, Math.round(Number(ex.sets) || 1)),
    }))
    .filter((ex) => ex.exerciseId);

  if (exercises.length === 0)
    return NextResponse.json({ error: "Aucun exercice" }, { status: 400 });

  const name = body.name?.trim() || "Programme";

  try {
    const db  = getAdminFirestore();
    const id  = crypto.randomUUID();
    const now = Timestamp.now();

    const program: GymProgram = { id, name, exercises, createdAt: now, updatedAt: now };
    await db.doc(`users/${USER}/gymPrograms/${id}`).set(program);

    return NextResponse.json({
      program: { ...program, createdAt: { seconds: now.seconds, nanoseconds: now.nanoseconds }, updatedAt: { seconds: now.seconds, nanoseconds: now.nanoseconds } },
    }, { status: 201 });
  } catch (e) {
    console.error("[gym programs POST]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// ─── DELETE : supprimer un programme ────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });

  try {
    const db = getAdminFirestore();
    await db.doc(`users/${USER}/gymPrograms/${id}`).delete();
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[gym programs DELETE]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
