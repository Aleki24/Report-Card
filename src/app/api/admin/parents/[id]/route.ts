import { route, HttpError } from '@/lib/platform/access';
import { audit } from '@/lib/platform/audit';
import { createSupabaseAdmin } from '@/lib/supabase-admin';

type Params = { id: string };

/** Unlinks a parent from one learner (their account and other children stay). */
export const DELETE = route<Params>('parents unlink', { module: 'parent_portal', permission: 'school.manage' }, async ({ access, params }) => {
    const { data, error } = await createSupabaseAdmin().from('student_guardians').delete().eq('id', params.id).eq('school_id', access.schoolId).select('id');
    if (error) throw error;
    if (!data?.length) throw new HttpError(404, 'Link not found.');
    await audit(access, 'delete', 'student_guardians', params.id);
    return { deleted: true };
});
