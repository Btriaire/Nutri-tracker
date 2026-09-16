export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import { put, del } from "@vercel/blob";

const USER_ID = "owner";

export interface DayPhoto {
  id:        string;   // e.g. "photo_0", "photo_1", "photo_2", "meal_breakfast"
  /**
   * Source utilisable directement dans un <img src> :
   * - photos récentes : URL https Vercel Blob
   * - photos héritées : data URL base64 (stockée ainsi jusqu'en 09/2026)
   * Le nom du champ est conservé pour ne pas avoir à migrer les 47 photos
   * existantes ni à toucher les 7 composants qui le lisent — un <img> traite
   * les deux formes de la même façon.
   */
  dataUrl:   string;
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

  // Les photos partaient en base64 directement dans le document Firestore, qui
  // est plafonné à 1 Mo : 3 photos pesaient déjà jusqu'à 368 Ko, et un
  // dépassement fait échouer l'écriture (donc perdre la photo). On stocke
  // désormais le binaire dans Vercel Blob et seulement l'URL dans Firestore.
  const id = `photo_${Date.now()}`;
  let storedUrl: string;
  try {
    const match = /^data:(image\/[a-zA-Z+]+);base64,(.+)$/.exec(dataUrl);
    if (!match) return NextResponse.json({ error: "Format d'image invalide" }, { status: 400 });
    const [, mime, b64] = match;
    const ext = mime.split("/")[1].replace("jpeg", "jpg");
    const blob = await put(`dayPhotos/${USER_ID}/${date}/${id}.${ext}`, Buffer.from(b64, "base64"), {
      access: "public",
      contentType: mime,
      addRandomSuffix: true,
    });
    storedUrl = blob.url;
  } catch (e) {
    console.error("[photos POST] upload Blob échoué", e);
    return NextResponse.json({ error: "Envoi de la photo échoué" }, { status: 502 });
  }

  const newPhoto: DayPhoto = { id, dataUrl: storedUrl, addedAt: new Date().toISOString() };
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
  const removed  = existing.find(p => p.id === photoId);
  const photos   = existing.filter(p => p.id !== photoId);
  await ref.set({ date, photos }, { merge: true });

  // Sans ça, le binaire resterait dans Blob indéfiniment. Les photos héritées
  // (base64 inline) n'ont rien à supprimer.
  if (removed?.dataUrl.startsWith("http")) {
    await del(removed.dataUrl).catch((e) => console.error("[photos DELETE] blob non supprimé", e));
  }

  return NextResponse.json({ ok: true, photos });
}

// GET /api/photos/recent?days=7  — fetch last N days with photos (for dashboard)
// This is handled by adding ?recent=1&days=N to the GET route
