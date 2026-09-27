import { z } from 'zod';
import { route, parseBody, HttpError } from '@/lib/platform/access';
import { audit } from '@/lib/platform/audit';
import { createSupabaseAdmin } from '@/lib/supabase-admin';

type Params = { id: string };
const bodySchema = z.object({ decision: z.enum(['APPROVED', 'REJECTED']) });

/** Approve or decline a leave request; nobody decides their own. */
export const POST = route<Params>('leave decision', { module: 'staff_hr', permission: 'hr.manage' }, async ({ access, params, request }) => {
    const { decision } = await parseBody(request, bodySchema);
    const db = createSupabaseAdmin();
    const { data: leave, error } = await db.from('leave_requests').select('id, status, staff_id').eq('id', params.id).eq('school_id', access.schoolId).maybeSingle();
    if (error) throw error;
    if (!leave) throw new HttpError(404, 'Leave request not found.');
    if (leave.staff_id === access.userId) throw new HttpError(403, 'Someone else must decide your own leave.');
    if (leave.status !== 'PENDING') throw new HttpError(409, 'This request has already been decided.');
    const { data, error: upError } = await db.from('leave_requests')
        .update({ status: decision, decided_by: access.userId, decided_at: new Date().toISOString() })
        .eq('id', leave.id).eq('status', 'PENDING').select('id, status').maybeSingle();
    if (upError) throw upError;
    if (!data) throw new HttpError(409, 'Someone else decided this just now.');
    await audit(access, decision === 'APPROVED' ? 'approve' : 'reject', 'leave_requests', leave.id as string);
    return data;
});
