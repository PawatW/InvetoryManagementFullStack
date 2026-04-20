import { NextRequest, NextResponse } from 'next/server';

// Route protection is handled client-side by AuthContext (dashboard layout)
// and server-side by the Spring Boot JWT filter on every API request.
// Middleware is intentionally left as pass-through to avoid conflicts with
// Next.js prefetching — prefetch requests arrive before the auth cookie is
// set, causing middleware to cache a redirect and kick the user out after login.
export function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
