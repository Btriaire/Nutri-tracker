export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import { getSession } from "@/app/lib/session";
import { randomBytes } from "crypto";

const USER_ID = "owner";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db  = getAdminFirestore();
  const doc = await db.doc(`users/${USER_ID}`).get();
  const token = (doc.data() as { integrations?: { appleHealth?: { token?: string } } })
    ?.integrations?.appleHealth?.token ?? null;

  return NextResponse.json({ token });
}

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const token = randomBytes(24).toString("hex");
  const db    = getAdminFirestore();
  await db.doc(`users/${USER_ID}`).set(
    { integrations: { appleHealth: { token, connected: true, lastSyncedAt: null } } },
    { merge: true },
  );

  return NextResponse.json({ token });
}
