export const dynamic = "force-dynamic";

import { isConnected as fitIsConnected } from "@/app/lib/google-fit";
import { isConnected as withingsIsConnected } from "@/app/lib/withings";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import { defaultGoals } from "@/app/lib/nutrition";
import type { NutritionGoals, UserProfile } from "@/app/lib/types";
import SettingsClient from "./SettingsClient";

export default async function SettingsPage() {
  let fitConnected      = false;
  let withingsConnected = false;
  let goals: NutritionGoals = defaultGoals();
  let photoUrl: string | undefined;
  try {
    const db = getAdminFirestore();
    const profile = await db.doc("users/owner").get();
    [fitConnected, withingsConnected] = await Promise.all([
      fitIsConnected("owner"),
      withingsIsConnected("owner"),
    ]);
    if (profile.exists) {
      const p = profile.data() as UserProfile;
      goals    = { ...defaultGoals(), ...p.goals };
      photoUrl = p.photoUrl;
    }
  } catch { /* ignore */ }

  return (
    <SettingsClient
      fitConnected={fitConnected}
      withingsConnected={withingsConnected}
      initialGoals={goals}
      initialPhotoUrl={photoUrl}
    />
  );
}
