import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// server-side version of the supabase client, used inside route handlers / server
// components (right now just the oauth callback route). it reads and writes the session
// straight from next.js's cookie store instead of browser storage
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // the `setAll` method was called from a server component.
            // this can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}
