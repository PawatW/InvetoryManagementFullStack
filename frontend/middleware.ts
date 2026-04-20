import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/', '/_next', '/favicon.ico', '/images'];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublic(pathname)) return NextResponse.next();

  // Token is stored in sessionStorage (client-side only), so the middleware
  // checks a lightweight cookie set by AuthContext after login for edge-side routing.
  // The real auth gate is still enforced by AuthContext + the backend JWT filter.
  const hasSession = request.cookies.has('inventory-auth-session');

  if (!hasSession) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
