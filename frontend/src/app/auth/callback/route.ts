import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  
  let next = searchParams.get('next') ?? '/';
  if (!next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) {
    next = '/';
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    } else {
      console.error("[Auth Callback Error]:", error.message);
    }
  }

  // something went wrong with the oauth flow, send them back to login
  return NextResponse.redirect(`${origin}/login?error=Could not authenticate user`);
}