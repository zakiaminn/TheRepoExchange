import { cookies } from "next/headers";
import type { DiscoveryResponse } from "@/lib/api";

// the listings as of the last minute, fetched on the server so the first html already has
// prices in it. next's data cache keeps the last good response and refreshes it in the
// background, so a slow or cold ledger only costs the timeout when there's nothing cached
export async function discoverySnapshot(): Promise<DiscoveryResponse | null> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/discovery`, {
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as DiscoveryResponse;
    return Object.keys(data).length > 0 ? data : null;
  } catch {
    return null;
  }
}

// whether the request carries a supabase session cookie. it's only a hint for the first
// render: the client still checks the session with supabase before showing anything private
export async function hasSessionCookie(): Promise<boolean> {
  const store = await cookies();
  return store.getAll().some((c) => c.name.startsWith("sb-") && c.name.includes("-auth-token"));
}
