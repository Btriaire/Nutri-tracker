import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import { INFOGRAPHICS, MAX_IMAGE_BYTES } from "@/app/lib/infographics";

export const dynamic = "force-dynamic";

const SECRET = process.env.REPORT_CRON_SECRET || "";
const DATE = /^\d{4}-\d{2}-\d{2}$/;

// Reception des infographies generees la nuit sur le VPS (Ammanda / NotebookLM).
// Stockees dans Firestore (JPEG base64 < 700 Ko) : privees, servies uniquement a la session.
export async function POST(req: NextRequest) {
  const bearer = req.headers.get("authorization");
  if (!SECRET || bearer !== `Bearer ${SECRET}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null) as { period?: string; from?: string; to?: string; imageBase64?: string; title?: string } | null;
  if (!body || (body.period !== "semaine" && body.period !== "mois") || !body.to || !DATE.test(body.to) || !body.from || !DATE.test(body.from) || !body.imageBase64) {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 });
  }

  const bytes = Buffer.from(body.imageBase64, "base64");
  const isJpeg = bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8;
  if (!isJpeg) return NextResponse.json({ error: "JPEG attendu" }, { status: 400 });
  if (bytes.length > MAX_IMAGE_BYTES) return NextResponse.json({ error: `Image trop lourde (${bytes.length} octets)` }, { status: 413 });

  const id = `${body.period}-${body.to}`;
  await getAdminFirestore().doc(`${INFOGRAPHICS}/${id}`).set({
    period: body.period,
    from: body.from,
    to: body.to,
    title: (body.title ?? "").slice(0, 200),
    createdAt: new Date().toISOString(),
    bytes: bytes.length,
    mime: "image/jpeg",
    imageBase64: body.imageBase64,
  });
  return NextResponse.json({ ok: true, id });
}
