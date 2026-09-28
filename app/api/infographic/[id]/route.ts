import { NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import { INFOGRAPHICS } from "@/app/lib/infographics";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!/^(semaine|mois)-\d{4}-\d{2}-\d{2}$/.test(id)) return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });

  const snap = await getAdminFirestore().doc(`${INFOGRAPHICS}/${id}`).get();
  const data = snap.data() as { imageBase64?: string } | undefined;
  if (!data?.imageBase64) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  const download = new URL(req.url).searchParams.get("download") === "1";
  return new NextResponse(new Uint8Array(Buffer.from(data.imageBase64, "base64")), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "private, max-age=86400",
      ...(download ? { "Content-Disposition": `attachment; filename="nutri-tracker-infographie-${id}.jpg"` } : {}),
    },
  });
}
