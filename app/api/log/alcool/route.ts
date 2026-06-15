import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import { getSession } from "@/app/lib/session";
import type { AlcoolDrink } from "@/app/lib/types";

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { date, alcoolDrinks } = await request.json() as { date: string; alcoolDrinks: AlcoolDrink[] };
  if (!date || !Array.isArray(alcoolDrinks)) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const db  = getAdminFirestore();
  const ref = db.doc(`users/${session.userId}/foodLog/${date}`);
  await ref.set({ date, alcoolDrinks, updatedAt: new Date() }, { merge: true });

  return NextResponse.json({ ok: true, alcoolDrinks });
}
