import NextAuth from 'next-auth';
import { authConfig } from '@/auth.config';
import { NextResponse } from 'next/server';

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;

  // Allow public static assets and public API routes
  if (
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/cron') ||
    pathname.startsWith('/api/health') ||
    pathname.startsWith('/_next') ||
    pathname === '/sw.js' ||
    pathname === '/manifest.json' ||
    pathname === '/favicon.ico' ||
    /\.(ico|png|jpg|jpeg|svg|css|js|webp|woff|woff2|ttf|map)$/i.test(pathname)
  ) {
    return NextResponse.next();
  }

  // Public auth pages: /login, /register
  if (pathname.startsWith('/login') || pathname.startsWith('/register')) {
    // If user is already authenticated, redirect them directly to the main dashboard
    if (isLoggedIn) {
      return NextResponse.redirect(new URL('/', req.url));
    }
    return NextResponse.next();
  }

  // Protected routes: require active authenticated session
  if (!isLoggedIn) {
    // 401 for unauthenticated API requests
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in.' },
        { status: 401 }
      );
    }

    // Redirect to login for page navigations with safe callback URL
    const loginUrl = new URL('/login', req.url);
    const fullPath = pathname + (req.nextUrl.search || '');
    loginUrl.searchParams.set('callbackUrl', fullPath);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
