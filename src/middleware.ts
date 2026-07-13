import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isProtected = createRouteMatcher(['/dashboard(.*)', '/student(.*)']);

export default clerkMiddleware(async (auth, request) => {
  const { userId, sessionClaims } = await auth();

  if (!userId && isProtected(request)) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect_url', request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (userId) {
    const role = (sessionClaims as any)?.role;

    // Only redirect on the exact /login, /signup, or /activate page, NOT on sub-paths
    // like /login/factor-one, /login/sso-callback, /activate/callback, or /activate/process that need processing
    const pathname = request.nextUrl.pathname;
    if (pathname === '/login' || pathname === '/signup' || pathname === '/activate') {
      const dest = role === 'STUDENT'
        ? '/student/dashboard'
        : '/dashboard';
      return NextResponse.redirect(new URL(dest, request.url));
    }

    // No further role-based redirects here: sessionClaims.role comes from the
    // Clerk JWT, which can lag behind the real role in the database (the same
    // reason auth-server.ts refuses to trust session claims alone). Bouncing
    // requests between /dashboard and /student based on a stale claim created
    // an infinite redirect loop against DashboardPage's client-side redirect
    // (which reads the DB-backed role and is authoritative). Each page/API
    // route already enforces its own role check server-side, so this is safe
    // to leave to the client.
  }

  return NextResponse.next();
}, {
  clockSkewInMs: 120000,
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/__clerk/(.*)',
    '/(api|trpc)(.*)',
  ],
};
