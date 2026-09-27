import { z } from 'zod';
import { route, parseBody, HttpError } from '@/lib/platform/access';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { RESIDENCES } from '@/lib/ops/resources/finance';

const bodySchema = z.object({
    student_ids: z.array(z.string().min(1).max(100)).min(1).max(2000),
    residence: z.enum(RESIDENCES),
});

/** Marks learners as day scholars or boarders (drives fee structures and boarding). */
export const POST = route('set residence', { permission: ['billing.manage', 'boarding.manage'] }, async ({ access, request }) => {
    const body = await parseBody(request, bodySchema);
    const { data, error } = await createSupabaseAdmin()
        .from('students')
        .update({ residence: body.residence })
        .eq('school_id', access.schoolId)
        .in('id', body.student_ids)
        .select('id');
    if (error) throw error;
    if ((data ?? []).length === 0) throw new HttpError(400, 'None of those learners are in your school.');
    return { updated: data?.length ?? 0 };
});

/** Learners of a class with their residence. */
export const GET = route('list residence', { permission: ['billing.view', 'boarding.view'] }, async ({ access, request }) => {
    const stream = request.nextUrl.searchParams.get('grade_stream_id');
    if (!stream) throw new HttpError(400, 'Choose a class.');
    const { data, error } = await createSupabaseAdmin()
        .from('students')
        .select('id, admission_number, residence, user:users(first_name, last_name)')
        .eq('school_id', access.schoolId)
        .eq('current_grade_stream_id', stream)
        .eq('status', 'ACTIVE')
        .order('admission_number');
    if (error) throw error;
    return data ?? [];
});
