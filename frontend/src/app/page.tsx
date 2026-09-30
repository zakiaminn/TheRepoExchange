import { Board } from "@/components/Board";
import { discoverySnapshot, hasSessionCookie } from "@/lib/snapshot";

// the home page: the landing page for visitors, the listings once you're signed in
export default async function Home() {
  const [initial, maybeSignedIn] = await Promise.all([discoverySnapshot(), hasSessionCookie()]);
  return <Board landing initial={initial} maybeSignedIn={maybeSignedIn} />;
}
