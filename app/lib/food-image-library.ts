import { getAdminFirestore } from "./firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import { normalizeFoodKey } from "./micronutrient-library";

interface FoodImageLibraryEntry {
  name:      string;
  photoUrl:  string; // small base64 thumbnail
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

const COLLECTION = "foodImageLibrary"; // shared, not per-user — same food looks the same regardless of who logs it

export async function getCachedFoodImage(name: string): Promise<string | null> {
  const key = normalizeFoodKey(name);
  if (!key) return null;
  try {
    const db = getAdminFirestore();
    const snap = await db.collection(COLLECTION).doc(key).get();
    if (!snap.exists) return null;
    return (snap.data() as FoodImageLibraryEntry).photoUrl ?? null;
  } catch (e) {
    console.warn("[food-image-library] read failed", e);
    return null;
  }
}

export async function saveFoodImage(name: string, photoUrl: string): Promise<void> {
  const key = normalizeFoodKey(name);
  if (!key) return;
  try {
    const db = getAdminFirestore();
    const now = Timestamp.now();
    const ref = db.collection(COLLECTION).doc(key);
    const existing = await ref.get();
    await ref.set({
      name,
      photoUrl,
      createdAt: existing.exists ? (existing.data() as FoodImageLibraryEntry).createdAt : now,
      updatedAt: now,
    });
  } catch (e) {
    console.warn("[food-image-library] write failed", e);
  }
}
