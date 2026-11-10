import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/session';

export async function proxy(request: NextRequest) {
  const started = Date.now();
  const response = await updateSession(request);
  try {
    response.headers.set('Server-Timing', `proxy;dur=${Date.now() - started}`);
  } catch {
    // ignore
  }
  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|api/diag-bare|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|txt|xml)$).*)',
  ],
};
