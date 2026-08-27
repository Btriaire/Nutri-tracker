export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";

const VPS_MANAGER_URL = process.env.VPS_MANAGER_URL || "http://46.202.131.240:9000";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name } = await params;
  if (!/^[\w.-]+\.m4a$/.test(name)) {
    return NextResponse.json({ error: "Nom invalide" }, { status: 400 });
  }

  // ?inline=1 -> pas de Content-Disposition attachment, pour un <audio> lecteur direct
  const inline = new URL(request.url).searchParams.get("inline") === "1";

  const range = request.headers.get("range");
  const res = await fetch(`${VPS_MANAGER_URL}/api/notebooklm-nutri/download/${name}`, {
    headers: range ? { Range: range } : undefined,
  });
  if (!res.ok || !res.body) {
    return NextResponse.json({ error: "Fichier introuvable" }, { status: 404 });
  }

  const headers = new Headers({ "Content-Type": "audio/mp4", "Accept-Ranges": "bytes" });
  if (!inline) headers.set("Content-Disposition", `attachment; filename="${name}"`);
  for (const h of ["content-length", "content-range"]) {
    const v = res.headers.get(h);
    if (v) headers.set(h, v);
  }

  return new NextResponse(res.body, { status: res.status, headers });
}
