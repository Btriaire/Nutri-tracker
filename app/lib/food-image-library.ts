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

// Photo matching only cares about "does this look like the same food", so it's fine (and
// desirable) to be coarser than the micronutrient library's exact-name key: a database entry
// named "Orange, pulpe, crue" and a manually typed "Orange" should share the same photo.
// Strip parenthetical/comma-separated qualifiers down to the base food name before keying.
function normalizeFoodImageKey(name: string): string {
  const base = name.split(",")[0].split("(")[0].trim();
  return normalizeFoodKey(base || name);
}

export async function getCachedFoodImage(name: string): Promise<string | null> {
  const key = normalizeFoodImageKey(name);
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
  const key = normalizeFoodImageKey(name);
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
