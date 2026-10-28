import { z } from 'zod';
import { route, parseBody, HttpError, assertInSchool } from '@/lib/platform/access';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { GUARDIAN_RELATIONSHIPS, linkParent, schoolNameOf } from '@/lib/parents/link';

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
    relationship: z.enum(GUARDIAN_RELATIONSHIPS).default('GUARDIAN'),
    is_primary: z.boolean().default(false),
});

/** Links a parent to a learner (see linkParent). */
export const POST = route('parents link', REQUIREMENT, async ({ access, request }) => {
    const body = await parseBody(request, bodySchema);
    await assertInSchool('students', [body.student_id], access.schoolId);
    const db = createSupabaseAdmin();
    return linkParent(db, access, body, await schoolNameOf(db, access.schoolId));
});
