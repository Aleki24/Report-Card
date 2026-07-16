import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { auth, createClerkClient } from '@clerk/nextjs/server';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { inviteCode } = body;

    if (!inviteCode) {
      return NextResponse.json({ error: 'Invite code is required' }, { status: 400 });
    }

    const supabaseAdmin = createSupabaseAdmin();

    // 1. Verify current user exists and is PENDING
    const { data: currentUser, error: currentUserError } = await supabaseAdmin
      .from('users')
      .select('id, role')
      .eq('id', userId)
      .maybeSingle();

    if (currentUserError || !currentUser || currentUser.role !== 'PENDING') {
      return NextResponse.json({ error: 'Invalid user state or already assigned a role' }, { status: 403 });
    }

    // 2. Look up the invite code in the new invite_codes table
    const { data: invite, error: inviteError } = await supabaseAdmin
        .from('invite_codes')
        .select('*')
        .eq('code', inviteCode.trim().toUpperCase())
        .maybeSingle();

    if (inviteError || !invite) {
        return NextResponse.json({ error: 'Invalid invite code. Please check and try again.' }, { status: 404 });
    }

    if (invite.is_used) {
        return NextResponse.json({ error: 'This invite code has already been used.' }, { status: 400 });
    }

    if (new Date(invite.expires_at) < new Date()) {
        return NextResponse.json({ error: 'This invite code has expired.' }, { status: 400 });
    }

    // 3. Get the pending user record created by the admin
    const { data: pendingUser, error: pendingUserError } = await supabaseAdmin
        .from('users')
        .select('id, first_name, last_name, username, email, role, school_id')
        .eq('id', invite.user_id)
        .maybeSingle();

    if (pendingUserError || !pendingUser) {
        return NextResponse.json({ error: 'User account not found for this invite code.' }, { status: 404 });
    }

    // 4. Swap user IDs in database.
    //
    // IMPORTANT ORDERING: students/class_teachers/subject_teachers all have
    // user_id (or id, for students) FOREIGN KEY ... REFERENCES users(id) ON
    // DELETE CASCADE. If any of these swap updates silently fails (e.g. a
    // constraint violation) and we still delete the old pending `users` row
    // afterward, Postgres cascades that delete and permanently destroys the
    // linked record — leaving a real, authenticated user with a `users` row
    // but no matching students/class_teachers/subject_teachers row at all.
    // So every swap must be verified BEFORE the old user row is deleted, and
    // the whole join must abort (leaving the pending row intact and
    // recoverable) if any swap doesn't affect the expected row.
    const oldUserId = pendingUser.id;

    if (pendingUser.role === 'STUDENT') {
        const { data: swapped, error: swapErr } = await supabaseAdmin
            .from('students')
            .update({ id: userId })
            .eq('id', oldUserId)
            .select('id');

        if (swapErr || !swapped || swapped.length === 0) {
            console.error('[join] students id-swap failed', { oldUserId, userId, swapErr });
            return NextResponse.json({ error: 'Failed to link your student record. Please contact your school admin.' }, { status: 500 });
        }
    } else if (pendingUser.role === 'CLASS_TEACHER') {
        // A class teacher may have been created as "Unassigned" (no class
        // picked yet), in which case there's no class_teachers row to swap.
        // Only treat a 0-row update as a failure if a row actually exists.
        const { count: existingCount, error: existErr } = await supabaseAdmin
            .from('class_teachers')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', oldUserId);

        if (existErr) {
            console.error('[join] class_teachers existence check failed', { oldUserId, userId, existErr });
            return NextResponse.json({ error: 'Failed to link your teacher record. Please contact your school admin.' }, { status: 500 });
        }

        if (existingCount && existingCount > 0) {
            const { data: swapped, error: swapErr } = await supabaseAdmin
                .from('class_teachers')
                .update({ user_id: userId })
                .eq('user_id', oldUserId)
                .select('id');

            if (swapErr || !swapped || swapped.length === 0) {
                console.error('[join] class_teachers id-swap failed', { oldUserId, userId, swapErr });
                return NextResponse.json({ error: 'Failed to link your teacher record. Please contact your school admin.' }, { status: 500 });
            }
        }
    } else if (pendingUser.role === 'SUBJECT_TEACHER') {
        // A subject teacher may have been created with no subjects assigned
        // yet, in which case there's no subject_teachers row to swap.
        const { count: existingCount, error: existErr } = await supabaseAdmin
            .from('subject_teachers')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', oldUserId);

        if (existErr) {
            console.error('[join] subject_teachers existence check failed', { oldUserId, userId, existErr });
            return NextResponse.json({ error: 'Failed to link your teacher record. Please contact your school admin.' }, { status: 500 });
        }

        if (existingCount && existingCount > 0) {
            const { data: swapped, error: swapErr } = await supabaseAdmin
                .from('subject_teachers')
                .update({ user_id: userId })
                .eq('user_id', oldUserId)
                .select('id');

            if (swapErr || !swapped || swapped.length === 0) {
                console.error('[join] subject_teachers id-swap failed', { oldUserId, userId, swapErr });
                return NextResponse.json({ error: 'Failed to link your teacher record. Please contact your school admin.' }, { status: 500 });
            }
        }
    }

    // Update the current (real) user record with the admin-provided details.
    // Do this before deleting the old row, so if it fails we haven't
    // destroyed the pending record yet either.
    const { error: updateErr } = await supabaseAdmin.from('users').update({
        first_name: pendingUser.first_name,
        last_name: pendingUser.last_name,
        username: pendingUser.username,
        role: pendingUser.role,
        school_id: pendingUser.school_id,
        is_active: true
    }).eq('id', userId);

    if (updateErr) {
        console.error('Failed to update user record:', updateErr);
        return NextResponse.json({ error: 'Account linked but failed to update records.' }, { status: 500 });
    }

    // Mark the invite code used, then finally delete the old pending user
    // record — only now that every swap above is confirmed to have
    // succeeded, so this delete's cascade has nothing left to destroy.
    await supabaseAdmin.from('invite_codes').update({
        user_id: userId,
        is_used: true,
        used_at: new Date().toISOString()
    }).eq('id', invite.id);

    await supabaseAdmin.from('users').delete().eq('id', oldUserId);

    // 5. Update Clerk Metadata
    const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
    try {
        await clerk.users.updateUser(userId, {
            publicMetadata: {
                role: pendingUser.role,
                school_id: pendingUser.school_id
            }
        });
    } catch (clerkErr) {
        console.error('Failed to update Clerk metadata:', clerkErr);
    }

    return NextResponse.json({ success: true, message: 'Successfully joined school!' });

  } catch (err: any) {
    console.error('Join Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

