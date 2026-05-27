import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import type { GoogleFitDay } from "@/app/lib/types";
import { subDays, format } from "date-fns";

export const dynamic = "force-dynamic";

export interface CardioPoint {
  date:         string;
  hrAvg:        number | null;
  hrMin:        number | null;
  hrMax:        number | null;
  activeMin:    number;
  steps:        number;
  sleepMinutes: number | null;
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const days = Math.min(parseInt(searchParams.get("days") ?? "30"), 90);
  const userId = "owner";

  const db  = getAdminFirestore();
  const today = new Date();

  // Build date range
  const dates: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    dates.push(format(subDays(today, i), "yyyy-MM-dd"));
  }

  // Fetch all fitness docs in parallel (batches of 10 to avoid Firestore limits)
  const BATCH = 10;
  const points: CardioPoint[] = [];

  for (let b = 0; b < dates.length; b += BATCH) {
    const batch = dates.slice(b, b + BATCH);
    const snaps = await Promise.all(
      batch.map((d) => db.doc(`users/${userId}/fitnessData/${d}`).get())
    );
    for (let i = 0; i < batch.length; i++) {
      const snap = snaps[i];
      const gf = snap.exists ? (snap.data() as { googleFit?: GoogleFitDay }).googleFit : undefined;
      points.push({
        date:         batch[i],
        hrAvg:        gf?.heartRateAvg ?? null,
        hrMin:        null,
        hrMax:        null,
        activeMin:    gf?.activeMinutes ?? 0,
        steps:        gf?.steps ?? 0,
        sleepMinutes: gf?.sleepMinutes ?? null,
      });
    }
  }

  return NextResponse.json({ points });
}
