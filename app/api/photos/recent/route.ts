export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import type { DayPhoto, DayPhotosDoc } from "../route";

export interface RecentPhoto {
  date:  string;
  photo: DayPhoto;   // first photo of the day
}

// GET /api/photos/recent?days=14
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const days = parseInt(req.nextUrl.searchParams.get("days") ?? "14", 10);

  const db   = getAdminFirestore();
  const snap = await db.collection("users/owner/dayPhotos")
    .orderBy("date", "desc")
    .limit(days)
    .get();

  const recent: RecentPhoto[] = [];
  for (const doc of snap.docs) {
    const data = doc.data() as DayPhotosDoc;
    if (data.photos?.length > 0) {
      recent.push({ date: data.date, photo: data.photos[0] });
    }
  }

  return NextResponse.json({ photos: recent });
}
