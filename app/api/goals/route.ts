import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import { defaultGoals } from "@/app/lib/nutrition";
import type { NutritionGoals, UserProfile, ChartPrefs } from "@/app/lib/types";
import { Timestamp } from "firebase-admin/firestore";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getAdminFirestore();
  const doc = await db.doc(`users/${session.userId}`).get();

  if (!doc.exists) {
    return NextResponse.json({ goals: defaultGoals() });
  }

  const profile = doc.data() as UserProfile;
  return NextResponse.json({ goals: profile.goals ?? defaultGoals() });
}

// PATCH for top-level profile fields (e.g. chartPrefs)
export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { chartPrefs?: ChartPrefs };
  const db = getAdminFirestore();
  await db.doc(`users/${session.userId}`).set(body, { merge: true });
  return NextResponse.json({ ok: true });
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const updates = await req.json() as Partial<NutritionGoals>;

  const db = getAdminFirestore();
  const ref = db.doc(`users/${session.userId}`);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const existing = snap.exists ? (snap.data() as UserProfile) : {
      email: session.email,
      displayName: session.name,
      lang: "fr" as const,
      createdAt: Timestamp.now(),
      goals: defaultGoals(),
      integrations: {
        googleFit: { connected: false, lastSyncedAt: null },
        withings:  { connected: false, lastSyncedAt: null },
      },
    };

    tx.set(ref, {
      ...existing,
      goals: { ...existing.goals, ...updates },
    }, { merge: true });
  });

  const snap = await ref.get();
  return NextResponse.json({ goals: (snap.data() as UserProfile).goals });
}
