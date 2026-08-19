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

  const db = getAdminFirestore();
  const normalizedName = body.name.trim().toLowerCase();
  const now = FieldValue.serverTimestamp();

  // Avoid creating a new entry for a food that's already saved (e.g. repeated
  // Nutri-AI searches for a staple like "Café noir") — refresh the existing one instead.
  const existing = await db.collection(`users/${session.userId}/customFoods`)
    .where("normalizedName", "==", normalizedName)
    .limit(1)
    .get();

  if (!existing.empty) {
    const doc = existing.docs[0];
    await doc.ref.set({ ...body, normalizedName, updatedAt: now }, { merge: true });
    return NextResponse.json({ id: doc.id });
  }

  const id = nanoid(12);
  await db.doc(`users/${session.userId}/customFoods/${id}`).set({
    ...body,
    id,
    normalizedName,
    createdAt: now,
    updatedAt: now,
  });

  return NextResponse.json({ id });
}
