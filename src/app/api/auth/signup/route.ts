import { NextRequest, NextResponse } from 'next/server';
import { createClerkClient } from '@clerk/nextjs/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { rateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
    try {
        // Unauthenticated endpoint: throttle account creation per IP to
        // prevent account/DB flooding and email enumeration.
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
            || request.headers.get('x-real-ip')?.trim()
            || 'unknown';
        const limit = rateLimit(`signup:${ip}`, { maxRequests: 5, windowMs: 60_000 });
        if (!limit.allowed) {
            return NextResponse.json(
                { error: 'Too many attempts. Please wait a minute and try again.' },
                { status: 429 }
            );
        }

        const body = await request.json();
        const { email, password, first_name, last_name } = body;

        if (!email || !password || !first_name || !last_name) {
            return NextResponse.json(
                { error: 'All fields are required: email, password, first_name, last_name' },
                { status: 400 }
            );
        }

        if (password.length < 6) {
            return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
        }

        const supabaseAdmin = createSupabaseAdmin();

        const { data: existingUser } = await supabaseAdmin
            .from('users')
            .select('id')
            .eq('email', email.trim())
            .maybeSingle();

        if (existingUser) {
            return NextResponse.json(
                { error: 'An account with this email already exists. Please sign in instead.' },
                { status: 409 }
            );
        }

        const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
        let clerkUser;
        try {
            clerkUser = await clerk.users.createUser({
                emailAddress: [email.trim()],
                password,
                firstName: first_name,
                lastName: last_name,
                publicMetadata: { role: 'PENDING', school_id: null },
                skipPasswordChecks: true,
            });
        } catch (clerkErr: any) {
            const msg = clerkErr.errors?.[0]?.longMessage || clerkErr.errors?.[0]?.message || clerkErr.message || 'Failed to create user in Clerk';
            return NextResponse.json({ error: `Clerk error: ${msg}` }, { status: 400 });
        }

        const userId = clerkUser.id;

        const { error: profileError } = await supabaseAdmin.from('users').insert({
            id: userId,
            first_name,
            last_name,
            email: email.trim(),
            username: email.trim().split('@')[0],
            role: 'PENDING',
            is_active: true,
            school_id: null,
        });

        if (profileError) {
            await clerk.users.deleteUser(userId).catch(() => {});
            return NextResponse.json({ error: `Profile error: ${profileError.message}` }, { status: 400 });
        }

        return NextResponse.json({
            success: true,
            message: 'Account created! You can now sign in.',
        });
    } catch (err: unknown) {
        console.error('Signup error:', err);
        return NextResponse.json({ error: 'Signup failed. Please try again.' }, { status: 500 });
    }
}
