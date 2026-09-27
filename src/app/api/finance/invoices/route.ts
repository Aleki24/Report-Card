import { route, HttpError } from '@/lib/platform/access';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { STUDENT_JOIN } from '@/lib/ops/resource';

/** A term's invoices with their lines, newest first. */
export const GET = route('billing invoices', { module: 'fee_structures', permission: 'billing.view' }, async ({ access, request }) => {
    const termId = request.nextUrl.searchParams.get('term_id');
    if (!termId) throw new HttpError(400, 'Choose a term.');
    const { data, error } = await createSupabaseAdmin()
        .from('invoices')
        .select(`id, total, created_at, structure:fee_structures(name), ${STUDENT_JOIN}, lines:invoice_lines(id, description, amount)`)
        .eq('school_id', access.schoolId)
        .eq('term_id', termId)
        .order('created_at', { ascending: false })
        .limit(1000);
    if (error) throw error;
    return data ?? [];
});
