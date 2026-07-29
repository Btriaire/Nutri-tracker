export const dynamic = "force-dynamic";

import { getSession } from "@/app/lib/session";
import { redirect } from "next/navigation";
import HistoryClient from "./HistoryClient";

export default async function ReportHistoryPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <HistoryClient />;
}
