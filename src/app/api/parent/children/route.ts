import { route, HttpError } from '@/lib/platform/access';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { embedOne } from '@/lib/postgrest';

const childId = (l: { student: unknown }) => embedOne(l.student as { id: string } | { id: string }[] | null)?.id;

/** The signed-in parent's children in this school, each with their fee balance (null when never billed). */
export const GET = route('parent children', { module: 'parent_portal' }, async ({ access }) => {
    if (access.role !== 'PARENT') throw new HttpError(403, 'This page is for parents.');
    const { data, error } = await createSupabaseAdmin()
        .from('student_guardians')
        .select('relationship, student:students(id, admission_number, status, stream:grade_streams(full_name), user:users(first_name, last_name))')
        .eq('parent_user_id', access.userId)
        .eq('school_id', access.schoolId);
    if (error) throw error;
    const links = data ?? [];
    // Each child's balance across every term, so a family sees one total.
    const ids = links.map(childId).filter((id): id is string => !!id);
    const owed = new Map<string, number>();
    if (ids.length > 0) {
        const { data: fees, error: feesError } = await createSupabaseAdmin()
            .from('student_fees').select('student_id, total_fee, paid_amount').eq('school_id', access.schoolId).in('student_id', ids);
        if (feesError) throw feesError;
        for (const f of fees ?? []) owed.set(f.student_id as string, (owed.get(f.student_id as string) ?? 0) + Number(f.total_fee) - Number(f.paid_amount));
    }
    return links.map(l => {
        const id = childId(l);
        return { ...l, balance: id && owed.has(id) ? Math.round((owed.get(id) ?? 0) * 100) / 100 : null };
    });
});
