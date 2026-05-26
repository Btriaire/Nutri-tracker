export const dynamic = "force-dynamic";

import { isConnected } from "@/app/lib/google-fit";
import SettingsClient from "./SettingsClient";

export default async function SettingsPage() {
  let fitConnected = false;
  try { fitConnected = await isConnected("owner"); } catch { /* ignore */ }

  return <SettingsClient fitConnected={fitConnected} />;
}
