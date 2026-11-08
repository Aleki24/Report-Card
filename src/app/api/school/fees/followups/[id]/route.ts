import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { HttpError, route } from '@/lib/platform/access';
import { audit } from '@/lib/platform/audit';

/** DELETE: removes a follow-up written by mistake; its author, or the bursar or head. */
export const DELETE = route<{ id: string }>('fee follow-up delete', { module: 'fees', permission: 'fees.collect' }, async ({ access, params }) => {
    const db = createSupabaseAdmin();
    const { data: row, error } = await db.from('fee_followups').select('id, student_id, kind, created_by').eq('id', params.id).eq('school_id', access.schoolId).maybeSingle();
    if (error) throw error;
    if (!row) throw new HttpError(404, 'Follow-up not found.');
    if (row.created_by !== access.userId && !access.can('fees.manage')) throw new HttpError(403, 'Only whoever wrote it, or the bursar, can remove it.');
    const { error: deleteError } = await db.from('fee_followups').delete().eq('id', params.id).eq('school_id', access.schoolId);
    if (deleteError) throw deleteError;
    await audit(access, 'delete', 'fee_followups', params.id, { student_id: row.student_id, kind: row.kind });
    return { ok: true };
});
