import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { createInviteCode } from '@/lib/invite-codes';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { user_id } = await request.json();
    if (!user_id) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();

    // Verify the requester is an admin and get their school_id
    const { data: adminUser } = await supabase
      .from('users')
      .select('role, school_id')
      .eq('id', userId)
      .single();

    if (!adminUser || adminUser.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only admins can reset passwords' }, { status: 403 });
    }

    // Get the target user's role and verify same school
    const { data: targetUser, error: userError } = await supabase
      .from('users')
      .select('id, role, first_name, school_id')
      .eq('id', user_id)
      .maybeSingle();

    if (userError || !targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (targetUser.school_id !== adminUser.school_id) {
      return NextResponse.json({ error: 'User not found in your school' }, { status: 404 });
    }

    // Instead of setting a password, generate a new invite code
    const inviteCode = await createInviteCode(supabase, targetUser.id, targetUser.school_id, targetUser.role);

    // Optionally: We could delete their Clerk account here, forcing them to re-activate
    // This depends on whether we want to force them to use the code immediately
    // or just let them use the code to overwrite their password later.
    // For now, generating a code is enough. The /activate endpoint will update their password.

    return NextResponse.json({ 
      success: true, 
      password: inviteCode, // Keeping the key as "password" for now so the UI doesn't break entirely, but it's actually the code
      message: `Generated new invite code: ${inviteCode}`
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
