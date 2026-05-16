import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  
  // Default redirect to the root trading terminal if no 'next' parameter is provided
  const next = searchParams.get('next') ?? '/';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    } else {
      console.error("[Auth Callback Error]:", error.message);
    }
  }

  // Fallback if the code exchange fails or no code is present
  return NextResponse.redirect(`${origin}/login?error=Could not authenticate user`);
}