import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { createClerkClient } from '@clerk/nextjs/server';
import { rateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
    try {
        // Must be the freshly-authenticated Google session, and the caller can
        // only activate their OWN account — never bind an invite to someone else's ID.
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'You must be signed in with Google to activate.' }, { status: 401 });
        }

        // Rate-limit invite-code attempts per user to prevent brute forcing.
        const rl = rateLimit(`activate-google:${userId}`, { maxRequests: 10, windowMs: 60_000 });
        if (!rl.allowed) {
            return NextResponse.json({ error: 'Too many attempts. Please wait a minute and try again.' }, { status: 429 });
        }

        const body = await request.json();
        const { code, clerk_user_id, username: customUsername } = body;

        if (!code?.trim() || !clerk_user_id) {
            return NextResponse.json({ error: 'Invite code and Clerk user ID are required.' }, { status: 400 });
        }

        if (clerk_user_id !== userId) {
            return NextResponse.json({ error: 'You can only activate your own account.' }, { status: 403 });
        }

        const supabaseAdmin = createSupabaseAdmin();

        // 1. Look up the invite code
        const { data: invite, error: inviteError } = await supabaseAdmin
            .from('invite_codes')
            .select('*')
            .eq('code', code.trim().toUpperCase())
            .maybeSingle();

        if (inviteError || !invite) {
            return NextResponse.json({ error: 'Invalid invite code.' }, { status: 404 });
        }

        if (invite.is_used) {
            return NextResponse.json({ error: 'This invite code has already been used.' }, { status: 400 });
        }

        if (new Date(invite.expires_at) < new Date()) {
            return NextResponse.json({ error: 'This invite code has expired.' }, { status: 400 });
        }

        // 2. Get the pending user
        const { data: user, error: userError } = await supabaseAdmin
            .from('users')
            .select('id, first_name, last_name, username, email, role, school_id')
            .eq('id', invite.user_id)
            .maybeSingle();

        if (userError || !user) {
            return NextResponse.json({ error: 'User account not found.' }, { status: 404 });
        }

        const finalUsername = customUsername?.trim() || user.username;

        // 3. Update the Clerk user's metadata to include role and school
        const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

        try {
            await clerkClient.users.updateUser(clerk_user_id, {
                username: finalUsername,
                publicMetadata: {
                    role: user.role,
                    school_id: user.school_id
                }
            });
        } catch (clerkErr: any) {
            console.error('Failed to update Clerk user:', clerkErr);
            const msg = clerkErr.errors?.[0]?.message || 'Failed to update account metadata.';
            return NextResponse.json({ error: msg }, { status: 400 });
        }

        // 4. Get the email from Clerk user
        let clerkEmail = user.email;
        try {
            const clerkUser = await clerkClient.users.getUser(clerk_user_id);
            clerkEmail = clerkUser.emailAddresses?.[0]?.emailAddress || user.email;
        } catch { /* use existing email */ }

        // 5. Link the database records to the Google Clerk account.
        //
        // ORDERING MATTERS: students.id / class_teachers.user_id /
        // subject_teachers.user_id all REFERENCE users(id) ON DELETE CASCADE.
        // The new users row must exist BEFORE the id-swaps, every swap must be
        // verified BEFORE the old pending row is deleted (or the delete
        // cascades over the linked record), and the invite code is only burnt
        // once the account is fully linked. Note that /api/auth/me may have
        // ALREADY auto-created a users row for this Clerk ID with role
        // 'PENDING' (AuthProvider fires it the moment the Google session goes
        // active), so this must upsert — a plain insert hits a duplicate key,
        // leaves the user stuck as PENDING, and sends them into the
        // onboarding wizard asking for the (now-used) invite code again.
        const oldUserId = user.id;

        // Free the unique email/username held by the pending row so the new
        // row can be written while the old one still exists.
        const { error: renameErr } = await supabaseAdmin.from('users').update({
            email: `pending+${oldUserId}@migrating.local`,
            username: null
        }).eq('id', oldUserId);

        if (renameErr) {
            console.error('[activate-google] Failed to stage pending row:', renameErr);
            return NextResponse.json({ error: 'Activation failed. Please try again or contact your administrator.' }, { status: 500 });
        }

        const { error: upsertErr } = await supabaseAdmin.from('users').upsert({
            id: clerk_user_id,
            first_name: user.first_name,
            last_name: user.last_name,
            email: clerkEmail,
            username: finalUsername,
            role: user.role,
            school_id: user.school_id,
            is_active: true
        }, { onConflict: 'id' });

        if (upsertErr) {
            console.error('[activate-google] Failed to create user record:', upsertErr);
            // Restore the pending row so the invite can be retried
            await supabaseAdmin.from('users').update({ email: user.email, username: user.username }).eq('id', oldUserId);
            return NextResponse.json({ error: 'Account linked but failed to update records.' }, { status: 500 });
        }

        // Swap FK references over to the new users row, verifying each swap.
        if (user.role === 'STUDENT') {
            const { data: swapped, error: swapErr } = await supabaseAdmin
                .from('students')
                .update({ id: clerk_user_id })
                .eq('id', oldUserId)
                .select('id');

            if (swapErr || !swapped || swapped.length === 0) {
                console.error('[activate-google] students id-swap failed', { oldUserId, clerk_user_id, swapErr });
                return NextResponse.json({ error: 'Failed to link your student record. Please contact your school admin.' }, { status: 500 });
            }
        } else {
            const { error: ctErr } = await supabaseAdmin.from('class_teachers').update({ user_id: clerk_user_id }).eq('user_id', oldUserId);
            const { error: stErr } = await supabaseAdmin.from('subject_teachers').update({ user_id: clerk_user_id }).eq('user_id', oldUserId);
            if (ctErr || stErr) {
                console.error('[activate-google] teacher assignment swap failed', { oldUserId, clerk_user_id, ctErr, stErr });
                return NextResponse.json({ error: 'Failed to link your teaching assignments. Please contact your school admin.' }, { status: 500 });
            }
        }

        // Everything is linked — only now burn the invite code and drop the
        // pending row (its cascade has nothing left to destroy).
        await supabaseAdmin.from('invite_codes').update({
            user_id: clerk_user_id,
            is_used: true,
            used_at: new Date().toISOString()
        }).eq('id', invite.id);

        await supabaseAdmin.from('users').delete().eq('id', oldUserId);

        return NextResponse.json({
            success: true,
            message: 'Account activated with Google successfully!',
            role: user.role
        });

    } catch (err: unknown) {
        console.error('Google activation error:', err);
        return NextResponse.json({ error: 'Activation failed. Please try again or contact your administrator.' }, { status: 500 });
    }
}
