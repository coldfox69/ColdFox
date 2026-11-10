import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { USER_ID_HEADERS, USER_ID_HEADER, USER_EMAIL_HEADER, USER_NAME_HEADER } from '@/lib/auth/headers';

const PROTECTED_PREFIXES = ['/app', '/admin', '/onboarding'];
const AUTH_PAGES = ['/login', '/signup', '/forgot-password'];

export async function updateSession(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return NextResponse.next({ request });

  // Cookies that the auth server refreshed during this request.
  const cookieUpdates: { name: string; value: string; options?: Parameters<NextResponse['cookies']['set']>[2] }[] = [];

  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const isAuthPage = AUTH_PAGES.includes(pathname);

  // A visitor only needs their session checked when there is something to
  // check: a protected page, an auth page, or a request that carries a
  // session cookie. Everyone else skips the round trip to the auth server
  // entirely, which is the common case for a first-time visitor.
  const hasSessionCookie = request.cookies
    .getAll()
    .some((cookie) => cookie.name.startsWith('sb-') && cookie.value.length > 0);

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const cookie of cookiesToSet) {
          cookieUpdates.push(cookie as (typeof cookieUpdates)[number]);
          try {
            request.cookies.set(cookie.name, cookie.value);
          } catch {
            // Called from a Server Component: the middleware refreshes the session.
          }
        }
      },
    },
  });

  // Do not await getUser between client creation and this call in a way that
  // drops refreshed cookies; @supabase/ssr writes them through setAll above.
  const { data: { user } } = isProtected || isAuthPage || hasSessionCookie
    ? await supabase.auth.getUser()
    : { data: { user: null } };

  // The identity is verified here, once. It is forwarded to the page and API
  // handlers so they do not have to validate the same token a second time.
  const requestHeaders = new Headers(request.headers);
  for (const header of USER_ID_HEADERS) requestHeaders.delete(header);
  if (user) {
    requestHeaders.set(USER_ID_HEADER, user.id);
    requestHeaders.set(USER_EMAIL_HEADER, user.email ?? '');
    requestHeaders.set(USER_NAME_HEADER, (user.user_metadata?.full_name as string | undefined) ?? '');
  }
  const forwardedCookie = request.cookies.toString();
  if (forwardedCookie) requestHeaders.set('cookie', forwardedCookie);

  const build = () => {
    const next = NextResponse.next({ request: { headers: requestHeaders } });
    for (const cookie of cookieUpdates) next.cookies.set(cookie.name, cookie.value, cookie.options);
    return next;
  };

  if (!user && isProtected) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = '/login';
    redirect.searchParams.set('next', pathname);
    const res = NextResponse.redirect(redirect);
    for (const cookie of cookieUpdates) res.cookies.set(cookie.name, cookie.value, cookie.options);
    return res;
  }

  if (user && isAuthPage) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = '/login';
    const next = redirect.searchParams.get('next');
    if (next && next.startsWith('/') && !next.startsWith('//') && !next.includes('://')) {
      redirect.pathname = next;
      redirect.search = '';
    } else {
      // Admin lands on /admin directly when they revisit auth pages.
      redirect.pathname = user.email?.toLowerCase() === 'coldfox6969@gmail.com' ? '/admin' : '/app';
      redirect.search = '';
    }
    const res = NextResponse.redirect(redirect);
    for (const cookie of cookieUpdates) res.cookies.set(cookie.name, cookie.value, cookie.options);
    return res;
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

  return build();
}
