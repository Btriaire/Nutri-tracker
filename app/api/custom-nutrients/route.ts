export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import { MICRONUTRIENT_DB } from "@/app/lib/micronutrients";
import { Timestamp } from "firebase-admin/firestore";
import type { MicronutrientInfo } from "@/app/lib/types";

const USER = "owner";
const COLLECTION = `users/${USER}/customNutrients`;

// Rotates through a set of colors distinct from the built-in palette so custom
// nutrients are visually identifiable without needing the user to pick one.
const PALETTE = [
  "#e879f9", "#22d3ee", "#fb7185", "#a3e635", "#818cf8", "#fdba74", "#2dd4bf", "#f472b6",
];

function slugify(label: string): string {
  return label
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

interface CustomNutrientEntry extends MicronutrientInfo {
  custom: true;
  createdAt: Timestamp;
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getAdminFirestore();
  const snap = await db.collection(COLLECTION).orderBy("createdAt", "asc").get();
  const nutrients: MicronutrientInfo[] = snap.docs.map(d => {
    const e = d.data() as CustomNutrientEntry;
    return { code: e.code, label: e.label, symbol: e.symbol, unit: e.unit, recommendedDailyIntake: e.recommendedDailyIntake, color: e.color };
  });
  return NextResponse.json({ nutrients }, { headers: { "Cache-Control": "no-store, must-revalidate" } });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { label?: string; unit?: string; symbol?: string; recommendedDailyIntake?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const label = body.label?.trim();
  const unit  = body.unit?.trim();
  if (!label || !unit) return NextResponse.json({ error: "label and unit required" }, { status: 400 });

  const db = getAdminFirestore();
  let code = slugify(label);
  if (!code) return NextResponse.json({ error: "Invalid label" }, { status: 400 });

  // Avoid colliding with a built-in code or an existing custom one
  const ref0 = db.doc(`${COLLECTION}/${code}`);
  if (MICRONUTRIENT_DB[code] || (await ref0.get()).exists) {
    code = `${code}_custom`;
  }

  const existingCount = (await db.collection(COLLECTION).get()).size;
  const color  = PALETTE[existingCount % PALETTE.length];
  const symbol = (body.symbol?.trim() || label.slice(0, 3)).toUpperCase();

  const entry: CustomNutrientEntry = {
    custom: true,
    code, label, symbol, unit, color,
    ...(body.recommendedDailyIntake ? { recommendedDailyIntake: body.recommendedDailyIntake } : {}),
    createdAt: Timestamp.now(),
  };

  await db.doc(`${COLLECTION}/${code}`).set(entry);

  const nutrient: MicronutrientInfo = { code, label, symbol, unit, recommendedDailyIntake: entry.recommendedDailyIntake, color };
  return NextResponse.json({ ok: true, nutrient }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const code = req.nextUrl.searchParams.get("code");
  if (!code) return NextResponse.json({ error: "code required" }, { status: 400 });

  const db = getAdminFirestore();
  await db.doc(`${COLLECTION}/${code}`).delete();
  return NextResponse.json({ ok: true });
}
