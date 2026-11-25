import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Jesmond 2.0 Subdomain Routing Middleware
 *
 * Routes requests based on Host header:
 * - business.jesmond.com.au / business.localhost -> Business Portal routes
 * - jesmond.com.au / localhost -> Student & Customer Portal routes
 */
export function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  const host = (
    request.headers.get('x-forwarded-host') ||
    request.headers.get('host') ||
    ''
  ).toLowerCase().trim();

  const isBusinessSubdomain =
    host.startsWith('business.jesmond.com.au') ||
    host.startsWith('business.localhost') ||
    host.startsWith('business.');

  const pathname = url.pathname;

  // Add portal identification header for downstream components
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-portal', isBusinessSubdomain ? 'business' : 'student');

  if (isBusinessSubdomain) {
    // 1. Root path on business subdomain: rewrite to /portal or /business/login
    if (pathname === '/') {
      const hasBusinessSession =
        request.cookies.has('__Host-business-session') ||
        request.cookies.has('business-session') ||
        request.cookies.has('access_token');

      if (hasBusinessSession) {
        url.pathname = '/portal';
      } else {
        url.pathname = '/business/login';
      }
      return NextResponse.rewrite(url, { request: { headers: requestHeaders } });
    }

    // 2. Auth routes on business subdomain rewrite to dedicated business auth pages
    if (pathname === '/login') {
      url.pathname = '/business/login';
      return NextResponse.rewrite(url, { request: { headers: requestHeaders } });
    }

    if (pathname === '/register') {
      url.pathname = '/business/register';
      return NextResponse.rewrite(url, { request: { headers: requestHeaders } });
    }

    if (pathname === '/forgot-password') {
      url.pathname = '/business/forgot-password';
      return NextResponse.rewrite(url, { request: { headers: requestHeaders } });
    }

    if (pathname === '/verify') {
      url.pathname = '/business/verify';
      return NextResponse.rewrite(url, { request: { headers: requestHeaders } });
    }

    if (pathname === '/onboarding') {
      url.pathname = '/business/onboarding';
      return NextResponse.rewrite(url, { request: { headers: requestHeaders } });
    }
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public asset extensions (svg, png, jpg, jpeg, gif, webp, woff, woff2)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff|woff2)$).*)',
  ],
};
