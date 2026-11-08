import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

function safeNext(raw: string | null): string {
  if (!raw) return '/app';
  // Only allow same-origin absolute paths; reject protocol-relative and external URLs.
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\') || raw.includes('://')) return '/app';
  return raw;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type');
  const next = safeNext(url.searchParams.get('next'));
  const errorDescription = url.searchParams.get('error_description');

  if (errorDescription) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(errorDescription)}`, url.origin));
  }

  const supabase = await createServerSupabaseClient();

  try {
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) throw error;
    } else if (tokenHash && type) {
      const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as never });
      if (error) throw error;
    } else {
      return NextResponse.redirect(new URL('/login?error=Missing%20authentication%20code', url.origin));
    }
  } catch {
    return NextResponse.redirect(new URL('/login?error=Could%20not%20complete%20sign-in', url.origin));
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
