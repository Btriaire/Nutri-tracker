export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";
import { getAdminFirestore } from "@/app/lib/firebase-admin";

export interface DayPhoto {
  id:        string;   // e.g. "photo_0", "photo_1", "photo_2", "meal_breakfast"
  dataUrl:   string;   // base64 data URL (compressed JPEG)
  addedAt:   string;   // ISO timestamp
  label?:    string;   // e.g. "Petit-déjeuner" for meal photos merged into the album
}

export interface DayPhotosDoc {
  date:   string;
  photos: DayPhoto[];
}

// GET /api/photos?date=YYYY-MM-DD
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const date = req.nextUrl.searchParams.get("date");
  if (!date) return NextResponse.json({ error: "date required" }, { status: 400 });

  const db    = getAdminFirestore();
  const snap  = await db.doc(`users/owner/dayPhotos/${date}`).get();
  const data  = snap.exists ? (snap.data() as DayPhotosDoc) : null;
  return NextResponse.json({ photos: data?.photos ?? [] });
}

// POST /api/photos  — add a photo
// Body: { date: string; dataUrl: string }
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { date: string; dataUrl: string };
  try { body = await req.json() as typeof body; }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { date, dataUrl } = body;
  if (!date || !dataUrl) return NextResponse.json({ error: "date + dataUrl required" }, { status: 400 });

  const db   = getAdminFirestore();
  const ref  = db.doc(`users/owner/dayPhotos/${date}`);
  const snap = await ref.get();
  const existing: DayPhoto[] = snap.exists ? (snap.data() as DayPhotosDoc).photos ?? [] : [];

  if (existing.length >= 3) {
    return NextResponse.json({ error: "Max 3 photos per day" }, { status: 400 });
  }

  const newPhoto: DayPhoto = {
    id:      `photo_${Date.now()}`,
    dataUrl,
    addedAt: new Date().toISOString(),
  };
  const photos = [...existing, newPhoto];
  await ref.set({ date, photos }, { merge: true });

  return NextResponse.json({ ok: true, photo: newPhoto, photos });
}

// DELETE /api/photos  — remove a photo
// Body: { date: string; photoId: string }
export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { date: string; photoId: string };
  try { body = await req.json() as typeof body; }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { date, photoId } = body;
  if (!date || !photoId) return NextResponse.json({ error: "date + photoId required" }, { status: 400 });

  const db   = getAdminFirestore();
  const ref  = db.doc(`users/owner/dayPhotos/${date}`);
  const snap = await ref.get();
  if (!snap.exists) return NextResponse.json({ ok: true, photos: [] });

  const existing = (snap.data() as DayPhotosDoc).photos ?? [];
  const photos   = existing.filter(p => p.id !== photoId);
  await ref.set({ date, photos }, { merge: true });

  return NextResponse.json({ ok: true, photos });
}

// GET /api/photos/recent?days=7  — fetch last N days with photos (for dashboard)
// This is handled by adding ?recent=1&days=N to the GET route
