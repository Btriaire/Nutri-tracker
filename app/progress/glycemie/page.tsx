import { redirect } from "next/navigation";
import { getSession } from "@/app/lib/session";
import GlycemieClient from "./GlycemieClient";

export const dynamic = "force-dynamic";

export default async function GlycemiePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <GlycemieClient />;
}
