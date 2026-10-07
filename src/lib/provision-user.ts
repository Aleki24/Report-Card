import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import { createClerkClient } from '@clerk/nextjs/server';
import { isUserRole } from '@/lib/roles';
import type { UserRole } from '@/types';

/** The parts of a Clerk account a users row is built from. */
export interface ClerkAccount {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    publicMetadata: Record<string, unknown>;
}

/**
 * The school id when that school still exists, otherwise null.
 *
 * Clerk metadata outlives the database: a school removed from Supabase takes
 * its users rows with it (ON DELETE CASCADE), but the accounts still carry its
 * id. Writing that id back fails the users_school_id_fkey check, which used to
 * lock those accounts out with "Failed to create user profile" on every launch.
 */
export async function existingSchoolId(supabase: SupabaseClient, schoolId: unknown): Promise<string | null> {
    if (typeof schoolId !== 'string' || !schoolId) return null;
    const { data } = await supabase.from('schools').select('id').eq('id', schoolId).maybeSingle();
    return data?.id ?? null;
}

const isUniqueViolationOn = (error: PostgrestError, key: RegExp) =>
    error.code === '23505' && key.test(`${error.message} ${error.details ?? ''}`);

/**
 * Creates the users row for a Clerk account that has none yet (the webhook
 * never fired, or the row went with a deleted school).
 *
 * A role tied to a school only stands while that school exists; otherwise the
 * account starts over as PENDING, so the app shows onboarding (join or
 * register a school) instead of failing. Clerk metadata is brought in line
 * with what was stored, so the stale school is not offered again.
 */
export async function provisionUserFromClerk(
    supabase: SupabaseClient,
    account: ClerkAccount,
): Promise<{ error: PostgrestError | null }> {
    const metadata = account.publicMetadata;
    const claimedRole: UserRole = isUserRole(metadata.role) ? metadata.role : 'PENDING';
    const claimedSchoolId = metadata.school_id ?? metadata.schoolId ?? null;
    let schoolId = await existingSchoolId(supabase, claimedSchoolId);

    // Only an explicit ADMIN with no school at all gets a school created; one
    // whose school was removed goes through onboarding like anyone else.
    if (claimedRole === 'ADMIN' && !claimedSchoolId) {
        const newSchoolId = crypto.randomUUID();
        const { error: schoolErr } = await supabase.from('schools').insert({
            id: newSchoolId,
            name: `${account.firstName || 'My'}'s School`,
        });
        if (!schoolErr) schoolId = newSchoolId;
    }

    const role: UserRole = schoolId ? claimedRole : 'PENDING';
    const row = {
        id: account.id,
        first_name: account.firstName,
        last_name: account.lastName,
        email: account.email,
        username: account.email.split('@')[0] || account.id,
        role,
        is_active: true,
        school_id: schoolId,
    };

    let { error } = await supabase.from('users').insert(row);
    // Another account already uses this email prefix as its username: the
    // Clerk id is unique, and the person can still sign in by email.
    if (error && isUniqueViolationOn(error, /users_username_key/)) {
        ({ error } = await supabase.from('users').insert({ ...row, username: account.id }));
    }
    // The webhook and the app's first /api/auth/me race to create the row on
    // a new sign-up; whichever loses finds it already there.
    if (error && isUniqueViolationOn(error, /users_pkey/)) return { error: null };
    if (error) return { error };

    if (role !== metadata.role || schoolId !== claimedSchoolId) {
        try {
            const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
            // Merge rather than replace, so unrelated metadata survives; the
            // legacy camelCase key is cleared so it cannot resurrect the old school.
            await clerk.users.updateUserMetadata(account.id, {
                publicMetadata: { role, school_id: schoolId, schoolId: null },
            });
        } catch (metaErr) {
            console.error('[provisionUserFromClerk] Failed to sync metadata:', metaErr);
        }
    }

    return { error: null };
}
