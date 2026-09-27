import crypto from 'crypto';
import { z } from 'zod';
import { route, parseBody, HttpError, assertInSchool } from '@/lib/platform/access';
import { audit } from '@/lib/platform/audit';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { createInviteCode, notifyInviteCode } from '@/lib/invite-codes';
import { generateUsername } from '@/lib/generate-username';
import { placeholderEmailFor } from '@/lib/placeholder-email';

const REQUIREMENT = { module: 'parent_portal' as const, permission: 'school.manage' as const };

/** Parents linked to a learner. */
export const GET = route('parents list', REQUIREMENT, async ({ access, request }) => {
    const studentId = request.nextUrl.searchParams.get('student_id');
    if (!studentId) throw new HttpError(400, 'Choose a learner.');
    await assertInSchool('students', [studentId], access.schoolId);
    const { data, error } = await createSupabaseAdmin()
        .from('student_guardians')
        .select('id, relationship, is_primary, parent:users!student_guardians_parent_user_id_fkey(id, first_name, last_name, phone, is_active)')
        .eq('student_id', studentId)
        .eq('school_id', access.schoolId);
    if (error) throw error;
    return data ?? [];
});

const bodySchema = z.object({
    student_id: z.string().min(1).max(100),
    first_name: z.string().trim().min(1).max(80),
    last_name: z.string().trim().min(1).max(80),
    phone: z.string().trim().min(9).max(20),
    relationship: z.enum(['MOTHER', 'FATHER', 'GUARDIAN', 'SPONSOR', 'OTHER']).default('GUARDIAN'),
    is_primary: z.boolean().default(false),
});

/**
 * Links a parent to a learner. A parent already in the school (same phone)
 * is reused, so one login covers all their children; otherwise a parent
 * account is created and its invite code sent by SMS.
 */
export const POST = route('parents link', REQUIREMENT, async ({ access, request }) => {
    const body = await parseBody(request, bodySchema);
    await assertInSchool('students', [body.student_id], access.schoolId);
    const db = createSupabaseAdmin();

    const { data: existing, error: findError } = await db.from('users').select('id, role').eq('school_id', access.schoolId).eq('phone', body.phone).maybeSingle();
    if (findError) throw findError;
    if (existing && existing.role !== 'PARENT') throw new HttpError(409, 'That phone number belongs to a non-parent account in your school.');

    let parentId = existing?.id as string | undefined;
    let inviteCode: string | null = null;
    if (!parentId) {
        const { data: school } = await db.from('schools').select('name').eq('id', access.schoolId).maybeSingle();
        const schoolName = (school?.name as string | undefined) ?? 'school';
        const username = generateUsername(body.first_name, schoolName, Number.parseInt(crypto.randomBytes(3).toString('hex'), 16) % 100000);
        const newId = crypto.randomUUID();
        const { error: insertError } = await db.from('users').insert({
            id: newId, first_name: body.first_name, last_name: body.last_name, phone: body.phone,
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
        await notifyInviteCode({ phone: body.phone, email: null, firstName: body.first_name, schoolName, code: inviteCode });
    }

    const { error: linkError } = await db.from('student_guardians').upsert({
        school_id: access.schoolId, student_id: body.student_id, parent_user_id: parentId,
        relationship: body.relationship, is_primary: body.is_primary,
    }, { onConflict: 'student_id,parent_user_id' });
    if (linkError) throw linkError;
    await audit(access, 'create', 'student_guardians', body.student_id, { parent: parentId, new_account: !!inviteCode });
    return { parent_id: parentId, invite_code: inviteCode, reused: !inviteCode };
});
