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

    // 4. Swap user IDs in database
    const oldUserId = pendingUser.id;

    if (pendingUser.role === 'STUDENT') {
        await supabaseAdmin.from('students').update({ id: userId }).eq('id', oldUserId);
    }
    await supabaseAdmin.from('class_teachers').update({ user_id: userId }).eq('user_id', oldUserId);
    await supabaseAdmin.from('subject_teachers').update({ user_id: userId }).eq('user_id', oldUserId);

    // Update invite code
    await supabaseAdmin.from('invite_codes').update({
        user_id: userId,
        is_used: true,
        used_at: new Date().toISOString()
    }).eq('id', invite.id);

    // Delete the old pending user record
    await supabaseAdmin.from('users').delete().eq('id', oldUserId);

    // Update the current user record with the admin-provided details
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

