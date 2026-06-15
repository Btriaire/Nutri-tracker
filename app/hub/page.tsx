import { redirect } from "next/navigation";
import { getSession } from "@/app/lib/session";
import HubClient from "./HubClient";

export default async function HubPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <HubClient />;
}
