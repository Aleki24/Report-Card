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
    // like /login/factor-one or /login/sso-callback that Clerk needs
    const pathname = request.nextUrl.pathname;
    if (pathname === '/login' || pathname === '/signup' || pathname === '/activate') {
      const dest = role === 'STUDENT'
        ? '/student/dashboard'
        : '/dashboard';
      return NextResponse.redirect(new URL(dest, request.url));
    }

    if (role === 'STUDENT' && pathname.startsWith('/dashboard')) {
      return NextResponse.redirect(new URL('/student/dashboard', request.url));
    }

    if (role !== 'STUDENT' && pathname.startsWith('/student')) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
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
