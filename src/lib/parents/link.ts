import crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { HttpError, type Access } from '@/lib/platform/access';
import { audit } from '@/lib/platform/audit';
import { createInviteCode, notifyInviteCode } from '@/lib/invite-codes';
import { generateUsername } from '@/lib/generate-username';
import { placeholderEmailFor } from '@/lib/placeholder-email';
import { phoneVariants } from '@/lib/phone';
import type { GuardianRelationship } from '@/lib/ops/forms/platform';

export { GUARDIAN_RELATIONSHIPS } from '@/lib/ops/forms/platform';

export interface ParentLinkInput {
    student_id: string;
    first_name: string;
    last_name: string;
    phone: string;
    relationship: GuardianRelationship;
    is_primary: boolean;
}

export interface ParentLinkOutcome {
    parent_id: string;
    /** Set when a new parent account was made (its code went out by SMS). */
    invite_code: string | null;
    reused: boolean;
}

/**
 * Links a parent to a learner. A parent already in the school with the same
 * phone (however it was typed) is reused, so one login covers all their
 * children; otherwise a parent account is made and its invite code texted.
 * The caller checks the learner is in the school.
 */
export async function linkParent(db: SupabaseClient, access: Access, input: ParentLinkInput, schoolName: string): Promise<ParentLinkOutcome> {
    const { data: matches, error: findError } = await db
        .from('users')
        .select('id, role')
        .eq('school_id', access.schoolId)
        .in('phone', phoneVariants(input.phone))
        .limit(2);
    if (findError) throw findError;
    const existing = (matches ?? []).find(u => u.role === 'PARENT') ?? null;
    if (!existing && (matches ?? []).length > 0) throw new HttpError(409, 'That phone number belongs to a staff or learner account in your school.');

    let parentId = existing?.id as string | undefined;
    let inviteCode: string | null = null;
    if (!parentId) {
        const username = generateUsername(input.first_name, schoolName, Number.parseInt(crypto.randomBytes(3).toString('hex'), 16) % 100000);
        const newId = crypto.randomUUID();
        const { error: insertError } = await db.from('users').insert({
            id: newId, first_name: input.first_name, last_name: input.last_name, phone: input.phone.trim(),
            role: 'PARENT', school_id: access.schoolId, username, is_active: false,
            email: placeholderEmailFor(username, schoolName),
        });
        if (insertError) {
            if (insertError.code === '23505') throw new HttpError(409, 'Could not create a unique account for this parent. Try again.');
            throw insertError;
        }
        parentId = newId;
        try {
            inviteCode = await createInviteCode(db, newId, access.schoolId, 'PARENT');
        } catch (err) {
            await db.from('users').delete().eq('id', newId);
            throw err;
        }
        await notifyInviteCode({ phone: input.phone, email: null, firstName: input.first_name, schoolName, code: inviteCode });
    }

    const { error: linkError } = await db.from('student_guardians').upsert({
        school_id: access.schoolId, student_id: input.student_id, parent_user_id: parentId,
        relationship: input.relationship, is_primary: input.is_primary,
    }, { onConflict: 'student_id,parent_user_id' });
    if (linkError) throw linkError;
    await audit(access, 'create', 'student_guardians', input.student_id, { parent: parentId, new_account: !!inviteCode });
    return { parent_id: parentId, invite_code: inviteCode, reused: !inviteCode };
}

export async function schoolNameOf(db: SupabaseClient, schoolId: string): Promise<string> {
    const { data } = await db.from('schools').select('name').eq('id', schoolId).maybeSingle();
    return (data?.name as string | undefined) ?? 'school';
}
