import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

// this is the page google (or whatever oauth provider) redirects back to after the user
// logs in. supabase hands us a one-time "code" in the url, and this route trades it for
// an actual session, then bounces the user wherever they were trying to go
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  // "next" is where to send the user after login. defaulting to home if it's missing,
  // and rejecting anything that isn't a plain relative path so nobody can craft a link
  // that logs someone in and then redirects them off to some random external site
  // (open redirect attack basically)
  let next = searchParams.get('next') ?? '/';
  if (!next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) {
    next = '/';
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // session cookie is set, send them on their way
      return NextResponse.redirect(`${origin}${next}`);
    } else {
      console.error("[Auth Callback Error]:", error.message);
    }
  }

  // something went wrong with the oauth flow, send them back to login
  return NextResponse.redirect(`${origin}/login?error=Could not authenticate user`);
}
