import { Timestamp } from "firebase-admin/firestore";

/** Inverse de la serialisation de app/lib/backup.ts : {__ts, nanos} -> Timestamp Firestore. */
export function revive(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(revive);
  if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    if (typeof o.__ts === "number" && Object.keys(o).every((k) => k === "__ts" || k === "nanos")) {
      return new Timestamp(o.__ts, typeof o.nanos === "number" ? o.nanos : 0);
    }
    return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, revive(v)]));
  }
  return value;
}
