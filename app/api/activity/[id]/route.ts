import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore } from "@/app/lib/firebase-admin";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let body: Record<string, unknown>;
  try { body = await req.json() as Record<string, unknown>; }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const db = getAdminFirestore();
  const update: Record<string, unknown> = {};

  if (typeof body.name          === "string")  update.name          = body.name.trim();
  if (body.caloriesBurned       !== undefined)  update.caloriesBurned = body.caloriesBurned;
  if (typeof body.durationMin   === "number")   update.durationMin   = body.durationMin;
  if (body.notes                !== undefined)  update.notes         = body.notes;
  if (body.photoDataUrl         !== undefined)  update.photoDataUrl  = body.photoDataUrl;
  if (typeof body.sets          === "number")   update.sets          = body.sets;
  if (typeof body.reps          === "number")   update.reps          = body.reps;
  if (body.weightKg             !== undefined)  update.weightKg      = body.weightKg;

  if (Object.keys(update).length === 0)
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  await db.doc(`users/owner/manualActivities/${id}`).update(update);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getAdminFirestore();
  await db.doc(`users/owner/manualActivities/${id}`).delete();
  return NextResponse.json({ ok: true });
}
