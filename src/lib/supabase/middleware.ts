import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const PROTECTED_PREFIXES = ['/app', '/admin', '/onboarding'];
const AUTH_PAGES = ['/login', '/signup', '/forgot-password'];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return response;

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Do not await getUser between client creation and this call in a way that
  // drops refreshed cookies; @supabase/ssr writes them through setAll above.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!user && isProtected) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = '/login';
    redirect.searchParams.set('next', pathname);
    return NextResponse.redirect(redirect);
  }

  if (user && AUTH_PAGES.includes(pathname)) {
    const redirect = request.nextUrl.clone();
    const next = request.nextUrl.searchParams.get('next');
    if (next && next.startsWith('/') && !next.startsWith('//') && !next.includes('://')) {
      redirect.pathname = next;
      redirect.search = '';
    } else {
      // Admin lands on /admin directly when they revisit auth pages.
      redirect.pathname = user.email?.toLowerCase() === 'coldfox6969@gmail.com' ? '/admin' : '/app';
      redirect.search = '';
    }
    return NextResponse.redirect(redirect);
  }

  // CSRF hardening for state-changing API requests: browsers always send Origin
  // on cross-origin POSTs, and Supabase auth uses SameSite cookies.
  if (pathname.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    const origin = request.headers.get('origin');
    const host = request.headers.get('host');
    if (origin && host) {
      try {
        if (new URL(origin).host !== host) {
          return new NextResponse(JSON.stringify({ error: 'Cross-origin request rejected' }), {
            status: 403,
            headers: { 'content-type': 'application/json' },
          });
        }
      } catch {
        return new NextResponse(JSON.stringify({ error: 'Invalid origin' }), { status: 403 });
      }
    }
  }

  return response;
}
