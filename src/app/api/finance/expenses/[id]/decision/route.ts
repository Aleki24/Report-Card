import { z } from 'zod';
import { route, parseBody, HttpError } from '@/lib/platform/access';
import { audit } from '@/lib/platform/audit';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import type { ExpenseStatus } from '@/lib/ops/resources/finance';

type Params = { id: string };

const bodySchema = z.object({
    decision: z.enum(['APPROVE', 'REJECT', 'PAID']),
    note: z.string().trim().max(1000).optional(),
    payment_method: z.enum(['CASH', 'BANK', 'MPESA', 'CHEQUE']).optional(),
    reference: z.string().trim().max(100).optional(),
});

const NEXT: Record<z.infer<typeof bodySchema>['decision'], { from: ExpenseStatus; to: ExpenseStatus }> = {
    APPROVE: { from: 'PENDING', to: 'APPROVED' },
    REJECT: { from: 'PENDING', to: 'REJECTED' },
    PAID: { from: 'APPROVED', to: 'PAID' },
};

/** Approve or reject a payment voucher, or mark an approved one paid. Nobody approves their own. */
export const POST = route<Params>('expense decision', { module: 'expenses', permission: 'expenses.approve' }, async ({ access, params, request }) => {
    const body = await parseBody(request, bodySchema);
    const db = createSupabaseAdmin();
    const { data: expense, error } = await db.from('expenses').select('id, status, requested_by').eq('id', params.id).eq('school_id', access.schoolId).maybeSingle();
    if (error) throw error;
    if (!expense) throw new HttpError(404, 'Expense not found.');
    const step = NEXT[body.decision];
    if (expense.status !== step.from) throw new HttpError(409, `Only ${step.from.toLowerCase()} expenses can be ${step.to.toLowerCase()}.`);
    if (body.decision === 'APPROVE' && expense.requested_by === access.userId) throw new HttpError(403, 'Someone else must approve an expense you raised.');
    if (body.decision === 'PAID' && !body.payment_method) throw new HttpError(400, 'Say how it was paid.');

    const update: Record<string, unknown> = { status: step.to };
    if (body.decision !== 'PAID') Object.assign(update, { decided_by: access.userId, decided_at: new Date().toISOString(), decision_note: body.note ?? null });
    else Object.assign(update, { payment_method: body.payment_method, reference: body.reference ?? null });
    const { data, error: updateError } = await db.from('expenses').update(update).eq('id', expense.id).eq('status', step.from).select('id, status').maybeSingle();
    if (updateError) throw updateError;
    if (!data) throw new HttpError(409, 'Someone else changed this expense just now.');
    await audit(access, body.decision === 'REJECT' ? 'reject' : 'approve', 'expenses', expense.id as string, { decision: body.decision, note: body.note });
    return data;
});
