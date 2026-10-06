// Memoire des calculs du visage et de l'oeil : la reference personnelle (mediane/dispersion de chaque mesure)
// est stockee dans users/owner/{faceStats,eyeStats}/current, et chaque scan garde ses index "du jour"
// (calcules par rapport aux scans anterieurs) : rien n'est recalcule a chaque ouverture et l'historique
// conserve la valeur qu'il avait au moment du scan.

import type { Firestore } from "firebase-admin/firestore";
import { Timestamp } from "firebase-admin/firestore";
import { computeBaselines, faceIndexes, FACE_METRICS_VERSION, type FaceMetrics, type FaceIndexes } from "./face-metrics";
import { eyeBaselines, eyeIndexesFrom, eyeSignalsFrom, EYE_METRICS_VERSION, type EyeScanData } from "./eye-metrics";

const USER = "users/owner";
const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export async function refreshFaceStats(db: Firestore) {
  const snap = await db.collection(`${USER}/faceScans`).select("date", "metrics", "indexes").get();
  const scans = snap.docs
    .map((d) => ({ ref: d.ref, ...(d.data() as { date: string; metrics?: FaceMetrics; indexes?: FaceIndexes }) }))
    .filter((s): s is typeof s & { metrics: FaceMetrics } => s.metrics?.version === FACE_METRICS_VERSION)
    .sort((a, b) => a.date.localeCompare(b.date));

  const baselines = computeBaselines(scans.map((s) => s.metrics));
  await db.doc(`${USER}/faceStats/current`).set({
    version: FACE_METRICS_VERSION, baselines, count: scans.length, updatedAt: Timestamp.now(),
  });

  // Index "du jour" : chaque scan compare a la reference des scans jusqu'a sa date (lui compris)
  let written = 0;
  for (let i = 0; i < scans.length; i++) {
    const s = scans[i];
    const asOf = computeBaselines(scans.filter((x) => x.date <= s.date).map((x) => x.metrics));
    const idx = faceIndexes(s.metrics, asOf);
    if (!same(idx, s.indexes)) { await s.ref.update({ indexes: idx }); written++; }
  }
  return { count: scans.length, written };
}

type EyeDoc = EyeScanData & { time: string; indexes?: unknown; signals?: unknown };

export async function refreshEyeStats(db: Firestore) {
  const snap = await db.collection(`${USER}/eyeScans`).select("date", "time", "metrics", "plr", "conjunctiva", "mbiS", "indexes", "signals").get();
  const scans = snap.docs
    .map((d) => ({ ref: d.ref, data: d.data() as EyeDoc }))
    .filter((s) => s.data.metrics?.version === EYE_METRICS_VERSION)
    .sort((a, b) => (a.data.date + a.data.time).localeCompare(b.data.date + b.data.time));

  await db.doc(`${USER}/eyeStats/current`).set({
    version: EYE_METRICS_VERSION, baselines: eyeBaselines(scans.map((s) => s.data)), count: scans.length, updatedAt: Timestamp.now(),
  });

  let written = 0;
  for (let i = 0; i < scans.length; i++) {
    const cur = scans[i].data;
    const b = eyeBaselines(scans.slice(0, i).map((s) => s.data));   // scans anterieurs uniquement
    const indexes = eyeIndexesFrom(cur, b);
    const signals = eyeSignalsFrom(cur, b);
    if (!same(indexes, cur.indexes) || !same(signals, cur.signals)) { await scans[i].ref.update({ indexes, signals }); written++; }
  }
  return { count: scans.length, written };
}
