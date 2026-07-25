import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { createClerkClient } from '@clerk/nextjs/server';
import { rateLimit } from '@/lib/rate-limit';
import { isValidPortalToken } from '@/lib/student/portal-access';

/**
 * Claims the student account behind a report-card QR code.
 *
 * This is the invite-code activation flow (/api/auth/activate) keyed on a
 * learner's portal_token instead of a 6-character code, and hard-scoped to
 * STUDENT accounts. The record linking below is deliberately identical —
 * see the ordering comment there for why each step has to happen when it does.
 */
export async function POST(request: NextRequest) {
    try {
        // Unauthenticated endpoint. The token itself is unguessable, but the
        // limit still caps damage from a leaked token and stops the route
        // being used to probe Clerk for taken usernames.
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
        const limit = rateLimit(`portal-signup:${ip}`, { maxRequests: 10, windowMs: 60_000 });
        if (!limit.allowed) {
            return NextResponse.json(
                { error: 'Too many attempts. Please wait a minute and try again.' },
                { status: 429 }
            );
        }

        const body = await request.json();
        const { token, password, email, username: customUsername } = body;

        if (!isValidPortalToken(token)) {
            return NextResponse.json({ error: 'This QR code is not valid. Please ask your school for a new report card.' }, { status: 400 });
        }

        if (!password || password.length < 8) {
            return NextResponse.json({ error: 'Password must be at least 8 characters long.' }, { status: 400 });
        }

        const supabaseAdmin = createSupabaseAdmin();

        // 1. Resolve the token to a student record
        const { data: student, error: studentError } = await supabaseAdmin
            .from('students')
            .select('id, admission_number, status')
            .eq('portal_token', token)
            .maybeSingle();

        if (studentError || !student) {
            return NextResponse.json({ error: 'This QR code is not recognised. Please contact your school.' }, { status: 404 });
        }

        if (student.status && student.status !== 'ACTIVE') {
            return NextResponse.json({ error: 'This student record is no longer active. Please contact your school.' }, { status: 403 });
        }

        // 2. Load the account details attached to that student
        const { data: user, error: userError } = await supabaseAdmin
            .from('users')
            .select('id, first_name, last_name, username, email, role, school_id, is_active')
            .eq('id', student.id)
            .maybeSingle();

        if (userError || !user) {
            return NextResponse.json({ error: 'Student account not found. Contact your administrator.' }, { status: 404 });
        }

        // A portal token must never mint anything but a student login, no
        // matter what the linked row happens to say.
        if (user.role !== 'STUDENT') {
            return NextResponse.json({ error: 'This code cannot be used to create an account.' }, { status: 403 });
        }

        if (user.is_active === false) {
            return NextResponse.json({ error: 'This account has been deactivated. Please contact your school.' }, { status: 403 });
        }

        const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

        // 3. Refuse to re-claim an account that already exists. Without this a
        // second person scanning the same printed report card could overwrite
        // the real learner's credentials.
        try {
            await clerkClient.users.getUser(student.id);
            return NextResponse.json({
                error: 'You already have an account. Please sign in instead.',
                alreadyClaimed: true,
            }, { status: 409 });
        } catch {
            // No Clerk account yet — this is a genuine first-time sign-up.
        }

        // 4. Validate the chosen username
        const finalUsername = customUsername?.trim() || user.username;

        if (!finalUsername || finalUsername.length < 3) {
            return NextResponse.json({ error: 'Username must be at least 3 characters.' }, { status: 400 });
        }
        if (/[^a-zA-Z0-9._-]/.test(finalUsername)) {
            return NextResponse.json({ error: 'Username can only contain letters, numbers, dots, dashes, and underscores.' }, { status: 400 });
        }

        if (finalUsername !== user.username) {
            const { data: takenBy } = await supabaseAdmin
                .from('users')
                .select('id')
                .eq('username', finalUsername)
                .neq('id', user.id)
                .maybeSingle();

            if (takenBy) {
                return NextResponse.json({ error: 'That username is already taken. Please choose a different one.' }, { status: 409 });
            }
        }

        // 5. Work out the email to register. Learners often have none, so fall
        // back to the same school-scoped placeholder the invite flow uses.
        const { data: school } = await supabaseAdmin
            .from('schools')
            .select('name')
            .eq('id', user.school_id)
            .maybeSingle();

        const userEmail = email?.trim() ||
            `${finalUsername}@${(school?.name || 'school').toLowerCase().replace(/[^a-z0-9]/g, '')}.school.local`;

        // 6. Create the Clerk account
        let clerkUserId: string;
        try {
            const clerkUser = await clerkClient.users.createUser({
                username: finalUsername,
                emailAddress: [userEmail],
                password,
                firstName: user.first_name,
                lastName: user.last_name,
                publicMetadata: {
                    role: 'STUDENT',
                    school_id: user.school_id,
                },
            });
            clerkUserId = clerkUser.id;
        } catch (clerkErr) {
            console.error('[portal-signup] Clerk sign-up error:', clerkErr);
            const msg = (clerkErr as { errors?: { message?: string }[] })?.errors?.[0]?.message
                || 'Failed to create your account. Try a different password or username.';
            return NextResponse.json({ error: msg }, { status: 400 });
        }

        // 7. Re-point the database rows at the new Clerk id.
        //
        // ORDERING MATTERS, exactly as in /api/auth/activate: students.id
        // REFERENCES users(id) ON DELETE CASCADE, so the new users row has to
        // exist before the students id-swap, and the swap has to be verified
        // before the old pending row is deleted — otherwise the cascade takes
        // the student record with it.
        const oldUserId = user.id;

        // Free the unique email/username held by the pending row so the new
        // row can be inserted while the old one still exists.
        const { error: renameErr } = await supabaseAdmin.from('users').update({
            email: `pending+${oldUserId}@migrating.local`,
            username: null,
        }).eq('id', oldUserId);

        if (renameErr) {
            console.error('[portal-signup] Failed to stage pending row:', renameErr);
            return NextResponse.json({ error: 'Sign-up failed. Please try again or contact your school.' }, { status: 500 });
        }

        const { error: upsertErr } = await supabaseAdmin.from('users').upsert({
            id: clerkUserId,
            first_name: user.first_name,
            last_name: user.last_name,
            email: userEmail,
            username: finalUsername,
            role: 'STUDENT',
            school_id: user.school_id,
            is_active: true,
        }, { onConflict: 'id' });

        if (upsertErr) {
            console.error('[portal-signup] Failed to create user record:', upsertErr);
            // Restore the pending row so the QR can be scanned again.
            await supabaseAdmin.from('users').update({ email: user.email, username: user.username }).eq('id', oldUserId);
            return NextResponse.json({ error: 'Account created but failed to update records. Contact your school admin.' }, { status: 500 });
        }

        const { data: swapped, error: swapErr } = await supabaseAdmin
            .from('students')
            .update({ id: clerkUserId })
            .eq('id', oldUserId)
            .select('id');

        if (swapErr || !swapped || swapped.length === 0) {
            console.error('[portal-signup] students id-swap failed', { oldUserId, clerkUserId, swapErr });
            return NextResponse.json({ error: 'Failed to link your student record. Please contact your school admin.' }, { status: 500 });
        }

        // Any invite code issued for the old id would now dangle — move it
        // across and burn it, since this sign-up replaces that activation.
        await supabaseAdmin.from('invite_codes').update({
            user_id: clerkUserId,
            is_used: true,
            used_at: new Date().toISOString(),
        }).eq('user_id', oldUserId).eq('is_used', false);

        // Everything is linked — the pending row's cascade has nothing left to
        // destroy, so it is safe to drop.
        await supabaseAdmin.from('users').delete().eq('id', oldUserId);

        return NextResponse.json({
            success: true,
            message: 'Your portal is ready.',
            email: userEmail,
            username: finalUsername,
        });

    } catch (err: unknown) {
        console.error('[portal-signup] Unexpected error:', err);
        return NextResponse.json({ error: 'Sign-up failed. Please try again or contact your school.' }, { status: 500 });
    }
}
