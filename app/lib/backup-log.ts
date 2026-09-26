import { getAdminFirestore } from "@/app/lib/firebase-admin";

// Journal des sauvegardes servies au VPS + demande manuelle en attente.
// Chemins sous system/ : hors du garde d'historique (write-guard) et jamais sauvegardes.
const ENTRIES = "system/backupLog/entries";
const REQUEST = "system/backupRequest";

export interface BackupEntry {
  at: string;
  set: string | null;
  ok: boolean;
  totalDocs?: number;
  sizeBytes?: number;
  gzBytes?: number;
  error?: string;
}

export async function logBackup(entry: BackupEntry) {
  try {
    await getAdminFirestore().collection(ENTRIES).doc(entry.at).set(entry);
  } catch (e) {
    console.error("[backup-log] entree non enregistree", e);
  }
}

export async function requestBackup() {
  await getAdminFirestore().doc(REQUEST).set({ pending: true, requestedAt: new Date().toISOString() });
}

export async function clearBackupRequest() {
  try {
    await getAdminFirestore().doc(REQUEST).set({ pending: false, servedAt: new Date().toISOString() }, { merge: true });
  } catch (e) {
    console.error("[backup-log] demande non effacee", e);
  }
}

export async function readBackupRequest(): Promise<{ pending: boolean; requestedAt: string | null }> {
  const d = (await getAdminFirestore().doc(REQUEST).get()).data() as { pending?: boolean; requestedAt?: string } | undefined;
  return { pending: !!d?.pending, requestedAt: d?.requestedAt ?? null };
}

export async function listBackups(limit = 30): Promise<BackupEntry[]> {
  const snap = await getAdminFirestore().collection(ENTRIES).orderBy("at", "desc").limit(limit).get();
  return snap.docs.map((d) => d.data() as BackupEntry);
}
