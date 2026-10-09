import { getSession } from "@/app/lib/session";
import Splash from "@/app/components/Splash";

export default async function Home() {
  const session = await getSession();
  const target  = session ? "/log" : "/login";
  return <Splash target={target} />;
}
