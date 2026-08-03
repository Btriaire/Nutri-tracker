import { getAdminFirestore } from "./firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import type { MicronutrientCode } from "./types";

export interface LibraryMicronutrient {
  code:   MicronutrientCode;
  amount: number; // per 100g
  unit:   string;
}

export interface MicronutrientLibraryEntry {
  name:      string;
  per100g:   LibraryMicronutrient[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
  verifiedManually?: boolean; // user-entered/corrected — never overwritten by an AI guess
}

const COLLECTION = "micronutrientLibrary"; // shared, not per-user — food science doesn't depend on who's asking

/** Normalize a food name into a stable Firestore doc id: lowercase, no accents, alnum + underscores only. */
export function normalizeFoodKey(name: string): string {
  return name
    .normalize("NFD").replace(/[̀-ͯ]/g, "") // strip accents (combining diacritical marks)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 200);
}

export async function getCachedMicronutrientProfile(name: string): Promise<LibraryMicronutrient[] | null> {
  const key = normalizeFoodKey(name);
  if (!key) return null;
  try {
    const db = getAdminFirestore();
    const snap = await db.collection(COLLECTION).doc(key).get();
    if (!snap.exists) return null;
    const entry = snap.data() as MicronutrientLibraryEntry;
    return entry.per100g ?? null;
  } catch (e) {
    console.warn("[micronutrient-library] read failed", e);
    return null;
  }
}

/** Full cached entry (including the manual-verification flag) — used by the edit UI. */
export async function getMicronutrientLibraryEntry(name: string): Promise<MicronutrientLibraryEntry | null> {
  const key = normalizeFoodKey(name);
  if (!key) return null;
  try {
    const db = getAdminFirestore();
    const snap = await db.collection(COLLECTION).doc(key).get();
    if (!snap.exists) return null;
    return snap.data() as MicronutrientLibraryEntry;
  } catch (e) {
    console.warn("[micronutrient-library] read failed", e);
    return null;
  }
}

export async function saveMicronutrientProfile(
  name: string, per100g: LibraryMicronutrient[], verifiedManually = false
): Promise<void> {
  const key = normalizeFoodKey(name);
  if (!key) return;
  try {
    const db = getAdminFirestore();
    const now = Timestamp.now();
    const ref = db.collection(COLLECTION).doc(key);
    const existing = await ref.get();
    const existingData = existing.exists ? (existing.data() as MicronutrientLibraryEntry) : null;
    await ref.set({
      name,
      per100g,
      createdAt: existingData?.createdAt ?? now,
      updatedAt: now,
      // A manual save always sets the flag; an AI-driven save never clears a manual one.
      verifiedManually: verifiedManually || existingData?.verifiedManually || false,
    });
  } catch (e) {
    console.warn("[micronutrient-library] write failed", e);
  }
}

export function scaleProfile(per100g: LibraryMicronutrient[], grams: number): LibraryMicronutrient[] {
  const ratio = grams / 100;
  return per100g.map(m => ({ ...m, amount: Math.round(m.amount * ratio * 100) / 100 }));
}
