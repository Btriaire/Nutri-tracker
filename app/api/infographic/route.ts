import { NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import { INFOGRAPHICS, type InfographicMeta } from "@/app/lib/infographics";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const snap = await getAdminFirestore().collection(INFOGRAPHICS)
    .orderBy("createdAt", "desc").limit(60)
    .select("period", "from", "to", "createdAt", "bytes", "title").get();
  const infographics: InfographicMeta[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<InfographicMeta, "id">) }));
  return NextResponse.json({ infographics });
}
