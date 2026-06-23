import { getSession } from "@/app/lib/session";
import Splash from "@/app/components/Splash";

export default async function Home() {
  const session = await getSession();
  const target  = session ? "/hub" : "/login";
  return <Splash target={target} />;
}
