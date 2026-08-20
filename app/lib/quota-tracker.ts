import { FieldValue } from "firebase-admin/firestore";
import { format } from "date-fns";
import { getAdminFirestore } from "./firebase-admin";

// Best-effort self-tracking of Firestore reads — the Admin SDK exposes no live
// quota counter, so the app tracks its own estimate for the handful of routes
// that dominate read cost (Répartition, backup, Progress). One doc per day
// (system/quotaTracker/days/{date}) so recording never needs a read-before-write —
// FieldValue.increment works even on a field that doesn't exist yet.

export const DAILY_READ_LIMIT   = 50_000;
export const WARNING_THRESHOLD  = 40_000;

function todayDocPath(): string {
  return `system/quotaTracker/days/${format(new Date(), "yyyy-MM-dd")}`;
}

export async function recordReads(count: number): Promise<void> {
  if (count <= 0) return;
  try {
    const db = getAdminFirestore();
    await db.doc(todayDocPath()).set(
      { date: format(new Date(), "yyyy-MM-dd"), reads: FieldValue.increment(count) },
      { merge: true },
    );
  } catch {
    // Never let tracking failure break the actual request.
  }
}

export interface QuotaStatus {
  date:             string;
  reads:            number;
  limit:            number;
  warningThreshold: number;
  approaching:       boolean;
}

export async function getQuotaStatus(): Promise<QuotaStatus> {
  const date = format(new Date(), "yyyy-MM-dd");
  let reads = 0;
  try {
    const db   = getAdminFirestore();
    const snap = await db.doc(todayDocPath()).get();
    reads = snap.exists ? (snap.data()?.reads as number ?? 0) : 0;
  } catch {
    // If the tracker itself can't be read (e.g. quota already exhausted),
    // treat it as "approaching" — that failure is itself the warning sign.
    return { date, reads: DAILY_READ_LIMIT, limit: DAILY_READ_LIMIT, warningThreshold: WARNING_THRESHOLD, approaching: true };
  }
  return { date, reads, limit: DAILY_READ_LIMIT, warningThreshold: WARNING_THRESHOLD, approaching: reads >= WARNING_THRESHOLD };
}
