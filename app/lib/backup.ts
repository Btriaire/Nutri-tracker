import { gzipSync } from "zlib";
import { Timestamp } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import { recordReads } from "@/app/lib/quota-tracker";

const USER = "owner";

// Collections a images base64 : trop lourdes pour le budget de 60 s avec le reste,
// sauvegardees une par une (/api/cron/backup?set=...).
export const PHOTO_COLLECTIONS = ["dayPhotos", "mealPhotos", "faceScans", "infographics"] as const;
// Jamais dans une sauvegarde : jetons OAuth (le blob est en acces public non listable).
const SECRET_COLLECTIONS = ["oauthTokens"];

const DAY_MS = 24 * 60 * 60 * 1000;
const HISTORY_DAYS = 400;

// Les Timestamps sont marques pour pouvoir etre reconvertis a la restauration.
function jsonReplacer(_key: string, value: unknown) {
  if (value && typeof value === "object" && typeof (value as { toDate?: unknown }).toDate === "function") {
    const t = value as { seconds: number; nanoseconds: number };
    return { __ts: t.seconds, nanos: t.nanoseconds };
  }
  return value;
}

function stripSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripSecrets);
  if (value && typeof value === "object" && typeof (value as { toDate?: unknown }).toDate !== "function") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([k]) => !/token|secret|password/i.test(k))
        .map(([k, v]) => [k, stripSecrets(v)]),
    );
  }
  return value;
}

/** Construit la sauvegarde (JSON gzippe, renvoye a l'appelant : jamais publie). Toutes les sous-collections (decouvertes dynamiquement : une nouvelle
 *  collection est couverte sans toucher a ce fichier). `only` = une collection photo. */
export async function buildBackup(only?: string) {
  const db = getAdminFirestore();
  const userRef = db.doc(`users/${USER}`);
  const backup: Record<string, unknown> = { schemaVersion: 2, exportedAt: new Date().toISOString(), user: USER };

  let names: string[];
  if (only) {
    if (!(PHOTO_COLLECTIONS as readonly string[]).includes(only)) throw new Error(`Collection inconnue: ${only}`);
    names = [only];
  } else {
    const all = (await userRef.listCollections()).map((c) => c.id);
    names = all.filter((n) => !SECRET_COLLECTIONS.includes(n) && !(PHOTO_COLLECTIONS as readonly string[]).includes(n));
    const profileSnap = await userRef.get();
    backup.profile = profileSnap.exists ? stripSecrets(profileSnap.data()) : null;
  }

  const snaps = await Promise.all(names.map((n) => db.collection(`users/${USER}/${n}`).get()));
  let totalDocs = 0;
  const counts: Record<string, number> = {};
  names.forEach((n, i) => {
    backup[n] = snaps[i].docs.map((d) => ({ id: d.id, ...d.data() }));
    counts[n] = snaps[i].size;
    totalDocs += snaps[i].size;
  });
  backup.counts = counts;
  void recordReads(totalDocs + 1);

  const json = JSON.stringify(backup, jsonReplacer);
  const gz = gzipSync(Buffer.from(json), { level: 9 });
  const historyPruned = only ? 0 : await pruneHistory(db);

  return { gz, collections: names, counts, totalDocs, sizeBytes: Buffer.byteLength(json), gzBytes: gz.length, historyPruned };
}

async function pruneHistory(db: FirebaseFirestore.Firestore) {
  const cutoff = Timestamp.fromMillis(Date.now() - HISTORY_DAYS * DAY_MS);
  const snap = await db.collection(`users/${USER}/_history`).where("archivedAt", "<", cutoff).limit(400).get();
  if (snap.empty) return 0;
  const batch = db.batch();
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
  return snap.size;
}
