export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";
import { getAdminFirestore } from "@/app/lib/firebase-admin";

// GET /api/face-scan/image?id=... : la photo d'un scan (stockee en data URL dans Firestore).
// Une photo de scan ne change jamais : mise en cache longue, privee au navigateur.
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id || !/^[\w-]{1,64}$/.test(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const snap = await getAdminFirestore().doc(`users/owner/faceScans/${id}`).get();
  const url = snap.exists ? (snap.get("faceImageUrl") as string | undefined) : undefined;
  const m = url && /^data:(image\/[\w.+-]+);base64,(.+)$/.exec(url);
  if (!m) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return new NextResponse(Buffer.from(m[2], "base64"), {
    headers: { "Content-Type": m[1], "Cache-Control": "private, max-age=31536000, immutable" },
  });
}
