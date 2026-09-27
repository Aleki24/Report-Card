import { route, HttpError } from '@/lib/platform/access';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { STUDENT_JOIN } from '@/lib/ops/resource';

/** The gate looks up a pass code to see whose exeat it is and whether it is valid now. */
export const GET = route('exeat verify', { module: 'boarding', permission: ['boarding.view'] }, async ({ access, request }) => {
    const code = request.nextUrl.searchParams.get('code')?.trim().toUpperCase();
    if (!code || !/^[A-Z0-9]{6}$/.test(code)) throw new HttpError(400, 'Enter the 6-character pass code.');
    const { data, error } = await createSupabaseAdmin()
        .from('exeats')
        .select(`id, status, exeat_type, leave_at, return_by, left_at, ${STUDENT_JOIN}`)
        .eq('school_id', access.schoolId)
        .eq('pass_code', code)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
    if (error) throw error;
    if (!data) throw new HttpError(404, 'No exeat has that pass code.');
    const now = Date.now();
    const valid = (data.status === 'APPROVED' || data.status === 'OUT') && now <= Date.parse(data.return_by as string);
    return { ...data, valid };
});
