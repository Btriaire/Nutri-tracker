import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import { format } from "date-fns";
import type { SupplementIntake, SupplementLog } from "@/app/lib/types";
import { Timestamp } from "firebase-admin/firestore";

const USER = "owner";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") || format(new Date(), "yyyy-MM-dd");

  try {
    const db = getAdminFirestore();
    const snap = await db.collection(`users/${USER}/supplementLogs`).doc(date).get();
    const log = snap.exists ? (snap.data() as SupplementLog) : { date, intakes: [] };
    return NextResponse.json({ log });
  } catch (e) {
    console.error("[supplement-intakes GET]", e);
    return NextResponse.json({ error: "Failed to fetch intakes" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json() as Partial<SupplementIntake>;
    const { date, supplementId, supplementName, time, moment } = body;

    if (!date || !supplementId || !supplementName || !time) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const db = getAdminFirestore();
    const docRef = db.collection(`users/${USER}/supplementLogs`).doc(date);
    const snap = await docRef.get();
    const log = snap.exists ? (snap.data() as SupplementLog) : { date, intakes: [] };

    const intake: SupplementIntake = {
      id: db.collection("dummy").doc().id,
      date,
      supplementId,
      supplementName,
      time,
      ...(moment ? { moment } : {}),
      ...(body.notes ? { notes: body.notes } : {}),
      loggedAt: Timestamp.now(),
    };

    log.intakes.push(intake);
    log.updatedAt = Timestamp.now();
    await docRef.set(log);

    return NextResponse.json({ intake, log }, { status: 201 });
  } catch (e) {
    console.error("[supplement-intakes POST]", e);
    return NextResponse.json({ error: "Failed to log intake" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");
    const intakeId = searchParams.get("intakeId");

    if (!date || !intakeId) {
      return NextResponse.json({ error: "Missing date or intakeId" }, { status: 400 });
    }

    const db = getAdminFirestore();
    const docRef = db.collection(`users/${USER}/supplementLogs`).doc(date);
    const snap = await docRef.get();

    if (!snap.exists) {
      return NextResponse.json({ error: "Log not found" }, { status: 404 });
    }

    const log = snap.data() as SupplementLog;
    log.intakes = log.intakes.filter(i => i.id !== intakeId);
    log.updatedAt = Timestamp.now();
    await docRef.set(log);

    return NextResponse.json({ log });
  } catch (e) {
    console.error("[supplement-intakes DELETE]", e);
    return NextResponse.json({ error: "Failed to delete intake" }, { status: 500 });
  }
}
