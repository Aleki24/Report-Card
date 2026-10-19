import type { SupabaseClient } from '@supabase/supabase-js';
import { deletionKindForRole } from './account-deletion';
import { revokeInviteCodes } from './invite-codes';

/** Where a public `photos` URL keeps the object's path. */
const PHOTO_URL_MARKER = '/storage/v1/object/public/photos/';

function photoPath(url: string | null | undefined): string | null {
    const at = url?.indexOf(PHOTO_URL_MARKER) ?? -1;
    return url && at >= 0 ? decodeURIComponent(url.slice(at + PHOTO_URL_MARKER.length).split('?')[0]) : null;
}

/**
 * Closes an account in our database, the same way whichever door it went
 * through: the person's own request (/api/account) or a deletion in the
 * Clerk dashboard (the user.deleted webhook). See lib/account-deletion for
 * what each kind promises.
 *
 * - A pending account holds nothing: its row goes.
 * - A learner's row is the school's learner record (marks, fees, report
 *   cards), so it stays, switched off, with the sign-in and contact details
 *   removed, the photo included (a learner's lives on students.avatar_url),
 *   and the real email freed for a new account.
 * - Anyone else's row goes; their school records stay, unlinked.
 *
 * Safe to run twice: our own deletion triggers the webhook afterwards.
 */
export async function closeAccount(supabase: SupabaseClient, userId: string, role: string | null | undefined): Promise<{ error: unknown }> {
    if (role !== 'PENDING' && deletionKindForRole(role) === 'learner') {
        const { data: learner } = await supabase.from('students').select('avatar_url').eq('id', userId).maybeSingle();
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
        if (error) return { error };
        const { error: photoError } = await supabase.from('students').update({ avatar_url: null }).eq('id', userId);
        if (photoError) return { error: photoError };
        const path = photoPath(learner?.avatar_url as string | null | undefined);
        if (path) {
            const { error: removeError } = await supabase.storage.from('photos').remove([path]);
            if (removeError) console.error('[closeAccount] photo not removed', userId, removeError);
        }
        await revokeInviteCodes(supabase, userId);
        return { error: null };
    }
    const { error } = await supabase.from('users').delete().eq('id', userId);
    return { error };
}
