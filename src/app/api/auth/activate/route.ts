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

        const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

        // Admin "Reset password" generates invite codes that point at an
        // ALREADY-ACTIVATED account (its users.id is its Clerk user ID). For
        // those the code must set a new password on the existing Clerk user —
        // creating a second Clerk account would be rejected as a duplicate
        // username/email, making reset codes unusable.
        let existingClerkUser = null;
        try {
            existingClerkUser = await clerkClient.users.getUser(user.id);
        } catch {
            // No Clerk account for this ID — first-time activation.
        }

        // ── STEP 1: Verify only — return user info for the form ──
        if (verify_only) {
            return NextResponse.json({
                success: true,
                username: user.username,
                name: `${user.first_name} ${user.last_name}`,
                role: user.role,
                reset: !!existingClerkUser
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

        // ── Password reset for an existing account ──
        if (existingClerkUser) {
            try {
                await clerkClient.users.updateUser(user.id, {
                    password,
                    ...(finalUsername !== user.username ? { username: finalUsername } : {}),
                });
            } catch (clerkErr) {
                console.error('Clerk password reset error:', clerkErr);
                const msg = (clerkErr as { errors?: { message?: string }[] })?.errors?.[0]?.message
                    || 'Failed to update the password. Please try a different one.';
                return NextResponse.json({ error: msg }, { status: 400 });
            }

            if (finalUsername !== user.username) {
                await supabaseAdmin.from('users').update({ username: finalUsername }).eq('id', user.id);
            }

            await supabaseAdmin.from('invite_codes').update({
                is_used: true,
                used_at: new Date().toISOString()
            }).eq('id', invite.id);

            return NextResponse.json({
                success: true,
                message: 'Password updated successfully! You can now log in.',
                username: finalUsername,
                role: user.role,
                reset: true
            });
        }

        // ── First-time activation ──
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

        // 5. Link the database records to the new Clerk account.
        //
        // ORDERING MATTERS: students.id / class_teachers.user_id /
        // subject_teachers.user_id all REFERENCE users(id) ON DELETE CASCADE.
        // The new users row must exist BEFORE the id-swaps (or the FK rejects
        // them silently), every swap must be verified BEFORE the old pending
        // row is deleted (or the delete cascades over the linked record), and
        // the invite code is only burnt once the account is fully linked — so
        // any failure leaves the code reusable instead of stranding the user.
        const oldUserId = user.id;

        // Free the unique email/username held by the pending row so the new
        // row can be inserted while the old one still exists.
        const { error: renameErr } = await supabaseAdmin.from('users').update({
            email: `pending+${oldUserId}@migrating.local`,
            username: null
        }).eq('id', oldUserId);

        if (renameErr) {
            console.error('[activate] Failed to stage pending row:', renameErr);
            return NextResponse.json({ error: 'Activation failed. Please try again or contact your administrator.' }, { status: 500 });
        }

        // Upsert: a users row may already exist for this Clerk ID (e.g.
        // auto-created by /api/auth/me) — overwrite it with the real details.
        const { error: upsertErr } = await supabaseAdmin.from('users').upsert({
            id: clerkUserId,
            first_name: user.first_name,
            last_name: user.last_name,
            email: userEmail,
            username: finalUsername,
            role: user.role,
            school_id: user.school_id,
            is_active: true
        }, { onConflict: 'id' });

        if (upsertErr) {
            console.error('[activate] Failed to create user record:', upsertErr);
            // Restore the pending row so the invite can be retried
            await supabaseAdmin.from('users').update({ email: user.email, username: user.username }).eq('id', oldUserId);
            return NextResponse.json({ error: 'Account created but failed to update records. Contact your administrator.' }, { status: 500 });
        }

        // Swap FK references over to the new users row, verifying each swap.
        if (user.role === 'STUDENT') {
            const { data: swapped, error: swapErr } = await supabaseAdmin
                .from('students')
                .update({ id: clerkUserId })
                .eq('id', oldUserId)
                .select('id');

            if (swapErr || !swapped || swapped.length === 0) {
                console.error('[activate] students id-swap failed', { oldUserId, clerkUserId, swapErr });
                return NextResponse.json({ error: 'Failed to link your student record. Please contact your school admin.' }, { status: 500 });
            }
        } else {
            const { error: ctErr } = await supabaseAdmin.from('class_teachers').update({ user_id: clerkUserId }).eq('user_id', oldUserId);
            const { error: stErr } = await supabaseAdmin.from('subject_teachers').update({ user_id: clerkUserId }).eq('user_id', oldUserId);
            if (ctErr || stErr) {
                console.error('[activate] teacher assignment swap failed', { oldUserId, clerkUserId, ctErr, stErr });
                return NextResponse.json({ error: 'Failed to link your teaching assignments. Please contact your school admin.' }, { status: 500 });
            }
        }

        // Everything is linked — only now burn the invite code and drop the
        // pending row (its cascade has nothing left to destroy).
        await supabaseAdmin.from('invite_codes').update({
            user_id: clerkUserId,
            is_used: true,
            used_at: new Date().toISOString()
        }).eq('id', invite.id);

        await supabaseAdmin.from('users').delete().eq('id', oldUserId);

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
