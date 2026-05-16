import { getToken } from 'next-auth/jwt';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    const path = request.nextUrl.pathname;

    // If accessing a protected route without auth, redirect to login
    if (!token && (path.startsWith('/dashboard') || path.startsWith('/student'))) {
        const loginUrl = new URL('/login', request.url);
        return NextResponse.redirect(loginUrl);
    }

    // If logged in and trying to access login page, redirect based on role
    if (token && path === '/login') {
        const role = (token as any).role;
        const dest = role === 'STUDENT' ? '/student/dashboard' : '/dashboard';
        return NextResponse.redirect(new URL(dest, request.url));
    }

    // Role-based route protection
    if (token) {
        const role = (token as any).role;

        // Students accessing /dashboard → redirect to student portal
        if (role === 'STUDENT' && path.startsWith('/dashboard')) {
            return NextResponse.redirect(new URL('/student/dashboard', request.url));
        }

        // Non-students accessing /student/* → redirect to dashboard
        if (role !== 'STUDENT' && path.startsWith('/student')) {
            return NextResponse.redirect(new URL('/dashboard', request.url));
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/dashboard/:path*', '/student/:path*', '/login'],
};

