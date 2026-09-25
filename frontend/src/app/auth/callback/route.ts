import { NextResponse } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/server';

// this is where supabase sends people back to: after google sign-in, and from the
// links in auth emails (password reset). it turns what supabase hands us into an
// actual session, then bounces the user wherever they were trying to go.
//
// two shapes arrive here:
//   ?code=...                        pkce. only works in the browser that started the
//                                    flow (the verifier lives in a cookie there)
//   ?token_hash=...&type=recovery    email template link. works on any device,
//                                    which matters when the email opens on a phone
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;

  // "next" is where to send the user after login. defaulting to home if it's missing,
  // and rejecting anything that isn't a plain relative path so nobody can craft a link
  // that logs someone in and then redirects them off to some random external site
  // (open redirect attack basically)
  let next = searchParams.get('next') ?? '/';
  if (!next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) {
    next = '/';
  }

  // a failed reset link goes back to the "email me a link" form with a note,
  // not to a bare sign-in page that says nothing about what happened
  const isReset = type === 'recovery' || next.startsWith('/auth/reset');
  const failure = isReset ? '/login?mode=forgot&error=reset' : '/login?error=auth';

  // supabase itself reports expired / already-used links as ?error=...
  if (searchParams.get('error')) {
    console.error('[Auth Callback Error]:', searchParams.get('error_description'));
    return NextResponse.redirect(`${origin}${failure}`);
  }

  const supabase = await createClient();

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(`${origin}${type === 'recovery' ? '/auth/reset' : next}`);
    }
    console.error('[Auth Callback Error]:', error.message);
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // session cookie is set, send them on their way
      return NextResponse.redirect(`${origin}${next}`);
    }
    console.error('[Auth Callback Error]:', error.message);
  }

  return NextResponse.redirect(`${origin}${failure}`);
}
