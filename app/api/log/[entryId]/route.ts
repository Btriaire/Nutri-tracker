import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import { calcTotals } from "@/app/lib/nutrition";
import type { DayLog } from "@/app/lib/types";
import { Timestamp } from "firebase-admin/firestore";

export const dynamic = "force-dynamic";

// ─── PATCH /api/log/[entryId]?date=YYYY-MM-DD ────────────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ entryId: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { entryId } = await params;
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") ?? "";
  const updates = await req.json();

  const db = getAdminFirestore();
  const ref = db.doc(`users/${session.userId}/foodLog/${date}`);

  let totals;
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return;

    const day = snap.data() as DayLog;
    const entries = day.entries.map((e) =>
      e.id === entryId ? { ...e, ...updates } : e,
    );
    totals = calcTotals(entries);
    tx.update(ref, { entries, totals, updatedAt: Timestamp.now() });
  });

  return NextResponse.json({ totals });
}

// ─── DELETE /api/log/[entryId]?date=YYYY-MM-DD ────────────────────────────────

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ entryId: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { entryId } = await params;
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") ?? "";

  const db = getAdminFirestore();
  const ref = db.doc(`users/${session.userId}/foodLog/${date}`);

  let totals;
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return;

    const day = snap.data() as DayLog;
    const entries = day.entries.filter((e) => e.id !== entryId);
    totals = calcTotals(entries);
    tx.update(ref, { entries, totals, updatedAt: Timestamp.now() });
  });

  return NextResponse.json({ totals });
}
