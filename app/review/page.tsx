import { getSession } from "@/app/lib/session";
import { redirect } from "next/navigation";
import ReviewClient from "./ReviewClient";

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <ReviewClient />;
}
