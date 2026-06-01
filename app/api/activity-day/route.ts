import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import type { FitnessDay } from "@/app/lib/types";

export const dynamic = "force-dynamic";
const USER = "owner";

function stripTimestamps(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== "object") return obj;
  const maybeTs = obj as { toMillis?: () => number };
  if (typeof maybeTs.toMillis === "function") return maybeTs.toMillis();
  if (Array.isArray(obj)) return obj.map(stripTimestamps);
  return Object.fromEntries(
    Object.entries(obj as Record<string, unknown>).map(([k, v]) => [k, stripTimestamps(v)])
  );
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date))
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });

  const db = getAdminFirestore();
  const [fitSnap, actSnap] = await Promise.all([
    db.doc(`users/${USER}/fitnessData/${date}`).get(),
    db.collection(`users/${USER}/manualActivities`).where("date", "==", date).get(),
  ]);

  const fitnessDay = fitSnap.exists
    ? (stripTimestamps(fitSnap.data()) as FitnessDay)
    : null;

  const manualActivities = actSnap.docs
    .map((d) => ({ id: d.id, ...(stripTimestamps(d.data()) as Record<string, unknown>) }))
    .sort((a, b) => {
      const aMs = ((a as Record<string, unknown>).loggedAt as { _seconds?: number })?._seconds ?? 0;
      const bMs = ((b as Record<string, unknown>).loggedAt as { _seconds?: number })?._seconds ?? 0;
      return bMs - aMs;
    });

  return NextResponse.json({ fitnessDay, manualActivities });
}
