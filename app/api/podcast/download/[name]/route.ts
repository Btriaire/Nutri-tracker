export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";
import { fetchVps, VPS_DOWN_MESSAGE } from "@/app/lib/podcasts";

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
  let res: Response;
  try {
    res = await fetchVps(`/api/notebooklm-nutri/download/${name}`, { headers: range ? { Range: range } : undefined }, 15_000);
  } catch {
    return NextResponse.json({ error: VPS_DOWN_MESSAGE }, { status: 504 });
  }
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
