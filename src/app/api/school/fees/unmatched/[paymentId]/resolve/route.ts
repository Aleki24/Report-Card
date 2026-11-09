import { z } from 'zod';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { HttpError, parseBody, route } from '@/lib/platform/access';
import { audit } from '@/lib/platform/audit';

const bodySchema = z.object({ reason: z.string().trim().min(3, 'Say why it is not school fees.').max(300) });

/**
 * Sets aside an unmatched payment that is not school fees (paid to the wrong
 * Paybill and refunded, a supplier's deposit): it leaves the unmatched list
 * and every total, and keeps who did it, when, and why.
 */
export const POST = route<{ paymentId: string }>('unmatched resolve', { module: 'fees', permission: 'fees.manage' }, async ({ access, request, params }) => {
    const { reason } = await parseBody(request, bodySchema);
    const db = createSupabaseAdmin();
    const { data, error } = await db
        .from('fee_payments')
        .update({ status: 'CANCELLED', voided_by: access.userId, voided_at: new Date().toISOString(), notes: `Not school fees: ${reason}`, updated_at: new Date().toISOString() })
        .eq('id', params.paymentId)
        .eq('school_id', access.schoolId)
        .is('student_fee_id', null)
        .eq('status', 'COMPLETED')
        .select('id, amount');
    if (error) throw error;
    if (!data || data.length === 0) throw new HttpError(409, 'That payment is no longer waiting to be matched.');
    await audit(access, 'update', 'fee_payments', params.paymentId, { set_aside: true, reason, amount: Number(data[0].amount) });
    return { ok: true };
});
