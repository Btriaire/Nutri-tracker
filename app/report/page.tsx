export const dynamic = "force-dynamic";

import { getSession } from "@/app/lib/session";
import { redirect } from "next/navigation";
import ReportClient from "./ReportClient";

export default async function ReportPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <ReportClient />;
}
