import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";
import { getAdminFirestore, getAdminStorage } from "@/app/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import type { MealType } from "@/app/lib/types";

export const dynamic = "force-dynamic";

// POST /api/log/photo — upload a meal illustration photo
// Body: FormData with fields: image (File), date (YYYY-MM-DD), meal (MealType)
// Returns: { photoUrl: string }

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
  const contentType = file.type || "image/jpeg";
  const ext = contentType === "image/png" ? "png" : "jpg";
  const path = `meal-photos/${session.userId}/${date}/${meal}.${ext}`;

  try {
    const bucket = getAdminStorage();
    const fileRef = bucket.file(path);
    await fileRef.save(buffer, { metadata: { contentType }, resumable: false });
    await fileRef.makePublic();

    const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
    const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    const photoUrl = `https://storage.googleapis.com/${bucketName}/${path}`;

    // Store URL in Firestore under mealPhotos/{date}
    const db = getAdminFirestore();
    const ref = db.doc(`users/${session.userId}/mealPhotos/${date}`);
    await ref.set({ [meal]: photoUrl, updatedAt: Timestamp.now() }, { merge: true });

    return NextResponse.json({ photoUrl });
  } catch (err) {
    console.error("Photo upload error:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}

// DELETE /api/log/photo — remove a meal illustration photo
export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  const meal = searchParams.get("meal") as MealType | null;

  if (!date || !meal) return NextResponse.json({ error: "Missing params" }, { status: 400 });

  try {
    const bucket = getAdminStorage();
    for (const ext of ["jpg", "png"]) {
      const path = `meal-photos/${session.userId}/${date}/${meal}.${ext}`;
      await bucket.file(path).delete({ ignoreNotFound: true });
    }

    const db = getAdminFirestore();
    const ref = db.doc(`users/${session.userId}/mealPhotos/${date}`);
    const { FieldValue } = await import("firebase-admin/firestore");
    await ref.update({ [meal]: FieldValue.delete() });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true }); // silently succeed if nothing to delete
  }
}
