import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";

export const dynamic = "force-dynamic";

export interface WorkoutTemplate {
  id:                 string;
  name:               string;
  activityType:       number;
  defaultDurationMin: number;
  defaultCalories:    number | null;
  notes?:             string;
  photoDataUrl?:      string;
  createdAt:          { seconds: number; nanoseconds: number };
}

export async function GET() {
  const db   = getAdminFirestore();
  const snap = await db
    .collection("users/owner/workoutTemplates")
    .orderBy("createdAt", "desc")
    .get();
  const templates = snap.docs.map((d) => {
    const data = d.data();
    return { id: d.id, ...data, createdAt: { seconds: (data.createdAt as Timestamp).seconds, nanoseconds: 0 } } as WorkoutTemplate;
  });
  return NextResponse.json({ templates });
}

export async function POST(req: NextRequest) {
  const body = await req.json() as Omit<WorkoutTemplate, "id" | "createdAt">;
  const db   = getAdminFirestore();
  const id   = crypto.randomUUID();
  const doc  = { ...body, id, createdAt: Timestamp.now() };
  await db.doc(`users/owner/workoutTemplates/${id}`).set(doc);
  return NextResponse.json({ template: { ...doc, createdAt: { seconds: doc.createdAt.seconds, nanoseconds: 0 } } }, { status: 201 });
}
