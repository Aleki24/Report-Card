import { NextResponse } from 'next/server';
import { auth, createClerkClient } from '@clerk/nextjs/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { internalError } from '@/lib/api-errors';
import { deletionKindForRole, isDeleteConfirmation } from '@/lib/account-deletion';
import { revokeInviteCodes } from '@/lib/invite-codes';

/** A school must keep at least one admin, or nobody could run it. */
async function isLastAdmin(userId: string): Promise<boolean> {
  const supabase = createSupabaseAdmin();
  const { data: me } = await supabase.from('users').select('role, school_id').eq('id', userId).maybeSingle();
  if (!me || me.role !== 'ADMIN' || !me.school_id) return false;
  const { count } = await supabase
    .from('users')
    .select('id', { count: 'exact', head: true })
    .eq('school_id', me.school_id)
    .eq('role', 'ADMIN')
    .eq('is_active', true)
    .neq('id', userId);
  return (count ?? 0) === 0;
}

/**
 * Deletes the signed-in person's account (Google Play's account-deletion
 * requirement). The database goes first, then the Clerk sign-in; if that
 * fails the person can simply try again.
 *
 * Everyone but a learner: the user row is deleted. Every foreign key to it
 * cascades (records that are only theirs) or sets null (records they made for
 * the school), so one delete is all or nothing.
 *
 * A learner: the user row is the learner record too. Deleting it cascaded
 * through students into their marks, report cards, fee statements and the
 * payments recorded against them, receipts the school must keep. So the row
 * stays, switched off and stripped of the sign-in and contact details.
 */
export async function DELETE(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Sign in to delete your account.' }, { status: 401 });

    const body: unknown = await request.json().catch(() => null);
    const confirm = typeof body === 'object' && body !== null && 'confirm' in body ? String(body.confirm) : '';
    if (!isDeleteConfirmation(confirm)) {
      return NextResponse.json({ error: 'Type DELETE to confirm.' }, { status: 400 });
    }

    if (await isLastAdmin(userId)) {
      return NextResponse.json(
        { error: 'You are your school’s only admin. Make another staff member an admin first, or contact support to close the school’s account.' },
        { status: 409 },
      );
    }

    const supabase = createSupabaseAdmin();
    const { data: me, error: meError } = await supabase.from('users').select('role').eq('id', userId).maybeSingle();
    if (meError) return internalError('account-delete', meError);

    if (deletionKindForRole(me?.role) === 'learner') {
      const { error } = await supabase.from('users').update({
        is_active: false,
        // Email is required and unique: a .local placeholder (never mailed,
        // see isPlaceholderEmail) frees the real one.
        email: `deleted+${userId}@deleted.local`,
        username: null,
        password_hash: null,
        phone: null,
        avatar_url: null,
      }).eq('id', userId);
      if (error) return internalError('account-delete', error);
      await revokeInviteCodes(supabase, userId);
    } else {
      const { error } = await supabase.from('users').delete().eq('id', userId);
      if (error) return internalError('account-delete', error);
    }

    const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
    await clerk.users.deleteUser(userId);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return internalError('account-delete', err);
  }
}
