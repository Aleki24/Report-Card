import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { createClerkClient } from '@clerk/nextjs/server';
import { rateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
    try {
        // Unauthenticated endpoint: throttle invite-code guessing per IP
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
        const limit = rateLimit(`activate:${ip}`, { maxRequests: 10, windowMs: 60_000 });
        if (!limit.allowed) {
            return NextResponse.json(
                { error: 'Too many attempts. Please wait a minute and try again.' },
                { status: 429 }
            );
        }

        const body = await request.json();
        const { code, password, email, username: customUsername, verify_only } = body;

        if (!code?.trim()) {
            return NextResponse.json({ error: 'Invite code is required.' }, { status: 400 });
        }

        const supabaseAdmin = createSupabaseAdmin();

        // 1. Look up the invite code
        const { data: invite, error: inviteError } = await supabaseAdmin
            .from('invite_codes')
            .select('*')
            .eq('code', code.trim().toUpperCase())
            .maybeSingle();

        if (inviteError || !invite) {
            return NextResponse.json({ error: 'Invalid invite code. Please check and try again.' }, { status: 404 });
        }

        if (invite.is_used) {
            return NextResponse.json({ error: 'This invite code has already been used.' }, { status: 400 });
        }

        if (new Date(invite.expires_at) < new Date()) {
            return NextResponse.json({ error: 'This invite code has expired. Please ask your admin for a new one.' }, { status: 400 });
        }

        // 2. Get the user associated with this invite code
        const { data: user, error: userError } = await supabaseAdmin
            .from('users')
            .select('id, first_name, last_name, username, email, role, school_id')
            .eq('id', invite.user_id)
            .maybeSingle();

        if (userError || !user) {
            return NextResponse.json({ error: 'User account not found. Contact your administrator.' }, { status: 404 });
        }

        // ── STEP 1: Verify only — return user info for the form ──
        if (verify_only) {
            return NextResponse.json({
                success: true,
                username: user.username,
                name: `${user.first_name} ${user.last_name}`,
                role: user.role
            });
        }

        // ── STEP 2: Full activation ──
        if (!password || password.length < 8) {
            return NextResponse.json({ error: 'Password must be at least 8 characters long.' }, { status: 400 });
        }

        // Use custom username if provided, otherwise keep the generated one
        const finalUsername = customUsername?.trim() || user.username;

        // Validate username format
        if (finalUsername.length < 3) {
            return NextResponse.json({ error: 'Username must be at least 3 characters.' }, { status: 400 });
        }
        if (/[^a-zA-Z0-9._-]/.test(finalUsername)) {
            return NextResponse.json({ error: 'Username can only contain letters, numbers, dots, dashes, and underscores.' }, { status: 400 });
        }

        // If username was changed, check it's not taken
        if (finalUsername !== user.username) {
            const { data: existingUser } = await supabaseAdmin
                .from('users')
                .select('id')
                .eq('username', finalUsername)
                .neq('id', user.id)
                .maybeSingle();

            if (existingUser) {
                return NextResponse.json({ error: 'That username is already taken. Please choose a different one.' }, { status: 409 });
            }
        }

        // Get school name for the email
        const { data: school } = await supabaseAdmin
            .from('schools')
            .select('name')
            .eq('id', user.school_id)
            .maybeSingle();

        // Use provided email or generate placeholder
        const userEmail = email?.trim() || 
            `${finalUsername}@${(school?.name || 'school').toLowerCase().replace(/[^a-z0-9]/g, '')}.school.local`;

        // 4. Create the Clerk account with the user's chosen password and username
        const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

        let clerkUserId: string;
        try {
            const clerkUser = await clerkClient.users.createUser({
                username: finalUsername,
                emailAddress: [userEmail],
                password: password,
                firstName: user.first_name,
                lastName: user.last_name,
                publicMetadata: {
                    role: user.role,
                    school_id: user.school_id
                }
            });
            clerkUserId = clerkUser.id;
        } catch (clerkErr: any) {
            console.error('Clerk activation error:', clerkErr);
            const msg = clerkErr.errors?.[0]?.message || 'Failed to create account. Try a different password or username.';
            return NextResponse.json({ error: msg }, { status: 400 });
        }

        // 5. Update the user's ID to the Clerk user ID and activate
        const oldUserId = user.id;

        // Update tables that reference users.id
        if (user.role === 'STUDENT') {
            await supabaseAdmin.from('students').update({ id: clerkUserId }).eq('id', oldUserId);
        }
        await supabaseAdmin.from('class_teachers').update({ user_id: clerkUserId }).eq('user_id', oldUserId);
        await supabaseAdmin.from('subject_teachers').update({ user_id: clerkUserId }).eq('user_id', oldUserId);

        // Update the invite code to point to new ID
        await supabaseAdmin.from('invite_codes').update({ 
            user_id: clerkUserId,
            is_used: true, 
            used_at: new Date().toISOString() 
        }).eq('id', invite.id);

        // Delete old user record + insert new with Clerk ID
        await supabaseAdmin.from('users').delete().eq('id', oldUserId);

        const { error: insertNew } = await supabaseAdmin.from('users').insert({
            id: clerkUserId,
            first_name: user.first_name,
            last_name: user.last_name,
            email: userEmail,
            username: finalUsername,
            role: user.role,
            school_id: user.school_id,
            is_active: true
        });

        if (insertNew) {
            console.error('Failed to insert new user record:', insertNew);
            return NextResponse.json({ error: 'Account created but failed to update records. Contact your administrator.' }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            message: 'Account activated successfully! You can now log in.',
            username: finalUsername,
            role: user.role
        });

    } catch (err: unknown) {
        console.error('Activation error:', err);
        return NextResponse.json({ error: 'Activation failed. Please try again or contact your administrator.' }, { status: 500 });
    }
}
