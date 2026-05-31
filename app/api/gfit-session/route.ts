import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/app/lib/firebase-admin";

export const dynamic = "force-dynamic";

// PATCH — persist user edits for a Google Fit session.
// Edits stored in fitnessData/{date} under sessionEdits.{sessionId}.*
// This field is NEVER touched by the sync process.
export async function PATCH(req: NextRequest) {
  let body: { date: string; sessionId: string; name?: string; calories?: number | null; durationMin?: number };
  try { body = await req.json() as typeof body; }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { date, sessionId } = body;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !sessionId)
    return NextResponse.json({ error: "Missing/invalid date or sessionId" }, { status: 400 });

  // Build dot-notation update object — only include defined fields
  const update: Record<string, unknown> = {};
  if (body.name        !== undefined) update[`sessionEdits.${sessionId}.name`]        = body.name;
  if (body.calories    !== undefined) update[`sessionEdits.${sessionId}.calories`]    = body.calories ?? FieldValue.delete();
  if (body.durationMin !== undefined) update[`sessionEdits.${sessionId}.durationMin`] = body.durationMin;

  if (Object.keys(update).length === 0)
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  const db  = getAdminFirestore();
  const ref = db.doc(`users/owner/fitnessData/${date}`);

  try {
    await ref.update(update);
  } catch {
    // Document might not exist yet — create it
    await ref.set({ date, sessionEdits: { [sessionId]: {} } }, { merge: true });
    await ref.update(update);
  }

  return NextResponse.json({ ok: true });
}
