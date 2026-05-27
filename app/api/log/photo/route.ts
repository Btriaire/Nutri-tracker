import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import type { MealType } from "@/app/lib/types";

export const dynamic = "force-dynamic";

// POST /api/log/photo  — store meal illustration photo as base64 in Firestore
// Body: FormData with fields: image (File), date (YYYY-MM-DD), meal (MealType)
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("image") as File | null;
  const date = formData.get("date") as string | null;
  const meal = formData.get("meal") as MealType | null;

  if (!file || !date || !meal) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  // Enforce 400KB max after compression
  if (buffer.length > 400 * 1024) {
    return NextResponse.json({ error: "Image too large (max 400KB)" }, { status: 413 });
  }

  const contentType = file.type || "image/jpeg";
  const base64 = buffer.toString("base64");
  const photoUrl = `data:${contentType};base64,${base64}`;

  try {
    const db = getAdminFirestore();
    const ref = db.doc(`users/${session.userId}/mealPhotos/${date}`);
    await ref.set({ [meal]: photoUrl, updatedAt: Timestamp.now() }, { merge: true });
    return NextResponse.json({ photoUrl });
  } catch (err) {
    console.error("Photo store error:", err);
    return NextResponse.json({ error: "Store failed" }, { status: 500 });
  }
}

// DELETE /api/log/photo?date=YYYY-MM-DD&meal=breakfast
export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  const meal = searchParams.get("meal") as MealType | null;
  if (!date || !meal) return NextResponse.json({ error: "Missing params" }, { status: 400 });

  try {
    const db = getAdminFirestore();
    const { FieldValue } = await import("firebase-admin/firestore");
    await db.doc(`users/${session.userId}/mealPhotos/${date}`)
      .update({ [meal]: FieldValue.delete() });
  } catch { /* doc may not exist */ }

  return NextResponse.json({ ok: true });
}
