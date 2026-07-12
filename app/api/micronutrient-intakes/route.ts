import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import { format } from "date-fns";
import type { MicronutrientDay, MicronutrientIntake } from "@/app/lib/types";
import { Timestamp } from "firebase-admin/firestore";

const USER = "owner";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") || format(new Date(), "yyyy-MM-dd");

  try {
    const db = getAdminFirestore();
    const snap = await db.collection(`users/${USER}/micronutrientLogs`).doc(date).get();
    const log = snap.exists ? (snap.data() as MicronutrientDay) : { date, intakes: [] };
    return NextResponse.json({ log });
  } catch (e) {
    console.error("[micronutrient-intakes GET]", e);
    return NextResponse.json({ error: "Failed to fetch micronutrient intakes" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json() as any;
    const date = body.date as string;
    const code = body.code as string;
    const amount = body.amount as number;
    const unit = body.unit as string;
    const source = body.source as string | undefined;
    const time = body.time as string | undefined;

    if (!date || !code || amount === undefined || !unit) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const db = getAdminFirestore();
    const docRef = db.collection(`users/${USER}/micronutrientLogs`).doc(date);
    const snap = await docRef.get();
    const log: MicronutrientDay = snap.exists ? (snap.data() as MicronutrientDay) : { date, intakes: [] };

    const intake: MicronutrientIntake = {
      code: code as any,
      amount,
      unit,
      source: source || "Supplément",
      time: time || format(new Date(), "HH:mm"),
      loggedAt: Timestamp.now(),
    };

    log.intakes.push(intake);
    log.updatedAt = Timestamp.now();
    await docRef.set(log);

    return NextResponse.json({ intake, log }, { status: 201 });
  } catch (e) {
    console.error("[micronutrient-intakes POST]", e);
    return NextResponse.json({ error: "Failed to log micronutrient intake" }, { status: 500 });
  }
}
