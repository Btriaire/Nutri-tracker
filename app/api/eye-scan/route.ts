export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { getSession } from "@/app/lib/session";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import { pairFields, sanitizeEyeScan, type EyeScanData, type EyeSignal, type eyeIndexesFrom, type sideIndexesFrom } from "@/app/lib/eye-metrics";
import { refreshEyeStats } from "@/app/lib/scan-stats";

// Scans de l'oeil : users/${USER}/eyeScans/{id} (mesures + petite photo recadree des yeux)
const MAX_IMAGE_CHARS = 120_000; // ~90 Ko de JPEG en base64

const jpeg = (v: unknown) => (typeof v === "string" && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(v) && v.length <= MAX_IMAGE_CHARS ? v : null);

export type EyeScanEntry = EyeScanData & {
  id: string; time: string;
  /** Index et signaux du jour (vs scans anterieurs), memorises a l'enregistrement. */
  indexes?: ReturnType<typeof eyeIndexesFrom>;
  /** Index de chaque oeil, mémorisés (A = droit, B = gauche). */
  indexesEye?: Record<"A" | "B", ReturnType<typeof sideIndexesFrom>>;
  /** Photos isolees de chaque oeil disponibles (servies par /api/eye-scan/image?eye=A|B). */
  eyes?: ("A" | "B")[];
  signals?: EyeSignal[];
};

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const USER = session.userId;
  const COL = `users/${USER}/eyeScans`;
  const db = getAdminFirestore();
  const [snap, stats] = await Promise.all([
    db.collection(COL).orderBy("date", "desc").select("date", "time", "metrics", "plr", "conjunctiva", "mbiS", "indexes", "signals", "indexesEye", "eyes").get(),
    db.doc(`users/${USER}/eyeStats/current`).get(),
  ]);
  const scans = snap.docs.map((d) => ({ ...(d.data() as Omit<EyeScanEntry, "id">), id: d.id }))
    .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  return NextResponse.json({ scans, stats: stats.exists ? stats.data() : null });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const USER = session.userId;
  const COL = `users/${USER}/eyeScans`;
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  const date = typeof body?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : null;
  const time = typeof body?.time === "string" && /^\d{2}:\d{2}$/.test(body.time) ? body.time : null;
  const data = sanitizeEyeScan(body?.data);
  const image = jpeg(body?.image), imageA = jpeg(body?.imageA), imageB = jpeg(body?.imageB);
  const eyes = [...(imageA ? ["A" as const] : []), ...(imageB ? ["B" as const] : [])];
  if (!date || !time || !data) return NextResponse.json({ error: "Invalid eye scan" }, { status: 400 });
  const db = getAdminFirestore();
  const ref = db.collection(COL).doc();
  const entry: EyeScanEntry = { id: ref.id, date, time, ...data, eyes };
  await ref.set({ ...entry, ...(image ? { image } : {}), ...(imageA ? { imageA } : {}), ...(imageB ? { imageB } : {}), createdAt: Timestamp.now() });
  await refreshEyeStats(db, USER).catch((e) => console.error("[eye-scan stats]", e));
  const saved = (await ref.get()).data() as EyeScanEntry;
  return NextResponse.json({ scan: { ...entry, indexes: saved.indexes, signals: saved.signals, indexesEye: saved.indexesEye } }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const USER = session.userId;
  const COL = `users/${USER}/eyeScans`;
  const id = req.nextUrl.searchParams.get("id");
  if (!id || !/^[\w-]{1,64}$/.test(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  const db = getAdminFirestore();
  await db.collection(COL).doc(id).delete();
  await refreshEyeStats(db, USER).catch((e) => console.error("[eye-scan stats]", e));
  return NextResponse.json({ ok: true });
}

/** Recentrage apres coup : remplace les mesures d'un oeil (et sa photo recadree) par celles recalculees sur le client. */
export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const USER = session.userId;
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  const id = body?.id, eye = body?.eye, side = body?.side;
  if (typeof id !== "string" || !/^[\w-]{1,64}$/.test(id) || (eye !== "A" && eye !== "B") || !side || typeof side !== "object") {
    return NextResponse.json({ error: "Invalid recenter" }, { status: 400 });
  }
  const db = getAdminFirestore();
  const ref = db.doc(`users/${USER}/eyeScans/${id}`);
  const snap = await ref.get();
  if (!snap.exists) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const cur = snap.data() as EyeScanData;
  const metrics = { ...cur.metrics, [eye]: side } as EyeScanData["metrics"];
  Object.assign(metrics, pairFields(metrics.A, metrics.B));
  const data = sanitizeEyeScan({ metrics, plr: cur.plr, conjunctiva: cur.conjunctiva, mbiS: cur.mbiS });
  if (!data) return NextResponse.json({ error: "Invalid eye scan" }, { status: 400 });
  const image = jpeg(body?.image);
  await ref.update({ metrics: data.metrics, ...(image ? { [eye === "A" ? "imageA" : "imageB"]: image } : {}) });
  await refreshEyeStats(db, USER).catch((e) => console.error("[eye-scan stats]", e));
  const saved = (await ref.get()).data() as EyeScanEntry;
  return NextResponse.json({ scan: { id, date: saved.date, time: saved.time, metrics: saved.metrics, plr: saved.plr, conjunctiva: saved.conjunctiva, mbiS: saved.mbiS, eyes: saved.eyes, indexes: saved.indexes, signals: saved.signals, indexesEye: saved.indexesEye } });
}
