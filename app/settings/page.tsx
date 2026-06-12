export const dynamic = "force-dynamic";

import { getConnectionStatus as fitStatus }      from "@/app/lib/google-fit";
import { getConnectionStatus as withingsStatus } from "@/app/lib/withings";
import { getAdminFirestore } from "@/app/lib/firebase-admin";
import { defaultGoals } from "@/app/lib/nutrition";
import type { NutritionGoals, UserProfile } from "@/app/lib/types";
import SettingsClient from "./SettingsClient";

export default async function SettingsPage() {
  let fitConnected:      "connected" | "needs_reauth" | "disconnected" = "disconnected";
  let withingsConnected: "connected" | "needs_reauth" | "disconnected" = "disconnected";
  let goals: NutritionGoals = defaultGoals();
  let photoUrl: string | undefined;
  let displayName: string | undefined;
  try {
    const db = getAdminFirestore();
    const profile = await db.doc("users/owner").get();
    [fitConnected, withingsConnected] = await Promise.all([
      fitStatus("owner"),
      withingsStatus("owner"),
    ]);
    if (profile.exists) {
      const p = profile.data() as UserProfile;
      goals       = { ...defaultGoals(), ...p.goals };
      photoUrl    = p.photoUrl;
      displayName = p.displayName || undefined;
    }
  } catch { /* ignore */ }

  return (
    <SettingsClient
      fitConnected={fitConnected}
      withingsConnected={withingsConnected}
      initialGoals={goals}
      initialPhotoUrl={photoUrl}
      initialDisplayName={displayName}
    />
  );
}
