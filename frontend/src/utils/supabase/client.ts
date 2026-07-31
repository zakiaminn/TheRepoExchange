import { createBrowserClient } from '@supabase/ssr'

// this is the supabase client for anything running in the browser (basically every
// component with "use client" at the top). it reads the session out of cookies/local
// storage automatically, so we don't have to pass tokens around manually most of the time
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
