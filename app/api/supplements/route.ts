export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import type { SupplementProduct } from "@/app/lib/types";
import { Timestamp } from "firebase-admin/firestore";

const USER = "owner";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const db = getAdminFirestore();
    const snap = await db.collection(`users/${USER}/supplements`).orderBy("createdAt", "desc").get();
    const products: SupplementProduct[] = snap.docs.map(d => d.data() as SupplementProduct);
    return NextResponse.json({ products }, { headers: { "Cache-Control": "no-store, must-revalidate" } });
  } catch (e) {
    console.error("[supplements GET]", e);
    return NextResponse.json({ error: "Failed to fetch supplements" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json() as Partial<SupplementProduct>;
    if (!body.name || !body.frequency) {
      return NextResponse.json({ error: "Missing required fields: name, frequency" }, { status: 400 });
    }

    const db = getAdminFirestore();
    const id = db.collection(`users/${USER}/supplements`).doc().id;
    const now = Timestamp.now();

    const product: SupplementProduct = {
      id,
      name: body.name,
      ingredients: body.ingredients || [],
      frequency: body.frequency,
      createdAt: now,
      updatedAt: now,
      ...(body.description       ? { description: body.description }             : {}),
      ...(body.dosagePerServing  ? { dosagePerServing: body.dosagePerServing }    : {}),
      ...(body.recommendedDosage ? { recommendedDosage: body.recommendedDosage } : {}),
      ...(body.micronutrients    ? { micronutrients: body.micronutrients }        : {}),
      ...(body.notes             ? { notes: body.notes }                         : {}),
    };

    await db.collection(`users/${USER}/supplements`).doc(id).set(product);
    return NextResponse.json({ id, product }, { status: 201 });
  } catch (e) {
    console.error("[supplements POST]", e);
    return NextResponse.json({ error: "Failed to create supplement" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const db = getAdminFirestore();
    await db.collection(`users/${USER}/supplements`).doc(id).delete();
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[supplements DELETE]", e);
    return NextResponse.json({ error: "Failed to delete supplement" }, { status: 500 });
  }
}
