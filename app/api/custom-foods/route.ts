import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { nanoid } from "nanoid";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import { getSession } from "@/app/lib/session";
import type { CustomFood } from "@/app/lib/types";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db   = getAdminFirestore();
  const snap = await db
    .collection(`users/${session.userId}/customFoods`)
    .orderBy("name")
    .get();

  const foods = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as CustomFood[];
  return NextResponse.json({ foods });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as Omit<CustomFood, "id" | "createdAt" | "updatedAt">;
  if (!body.name || !body.nutrition) {
    return NextResponse.json({ error: "name and nutrition required" }, { status: 400 });
  }

  const db  = getAdminFirestore();
  const id  = nanoid(12);
  const now = FieldValue.serverTimestamp();

  await db.doc(`users/${session.userId}/customFoods/${id}`).set({
    ...body,
    id,
    createdAt: now,
    updatedAt: now,
  });

  return NextResponse.json({ id });
}
