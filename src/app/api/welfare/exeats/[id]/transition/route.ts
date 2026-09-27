import crypto from 'crypto';
import { z } from 'zod';
import { route, parseBody, HttpError } from '@/lib/platform/access';
import { audit } from '@/lib/platform/audit';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { notifyGuardian, smsTime } from '@/lib/ops/notify';
import type { ExeatStatus } from '@/lib/ops/resources/welfare';

type Params = { id: string };

const ACTIONS = {
    APPROVE: { from: ['PENDING'], to: 'APPROVED', manage: true },
    REJECT: { from: ['PENDING', 'APPROVED'], to: 'REJECTED', manage: true },
    CHECK_OUT: { from: ['APPROVED'], to: 'OUT', manage: false },
    CHECK_IN: { from: ['OUT'], to: 'RETURNED', manage: false },
} as const satisfies Record<string, { from: readonly ExeatStatus[]; to: ExeatStatus; manage: boolean }>;

const bodySchema = z.object({ action: z.enum(['APPROVE', 'REJECT', 'CHECK_OUT', 'CHECK_IN']) });

/** A gate pass code: short, unambiguous, unguessable enough for one weekend. */
const passCode = () => Array.from(crypto.randomBytes(6), b => 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[b % 31]).join('');

/**
 * Approve or reject an exeat (matron, deputy), or record the learner leaving
 * and returning at the gate. The guardian gets an SMS at both gate moments.
 */
export const POST = route<Params>('exeat transition', { module: 'boarding', permission: ['boarding.manage', 'boarding.rollcall'] }, async ({ access, params, request }) => {
    const { action } = await parseBody(request, bodySchema);
    const step = ACTIONS[action];
    if (step.manage && !access.can('boarding.manage')) throw new HttpError(403, 'Only the matron or deputy approves exeats.');
    const db = createSupabaseAdmin();
    const { data: exeat, error } = await db.from('exeats').select('id, status, student_id, return_by').eq('id', params.id).eq('school_id', access.schoolId).maybeSingle();
    if (error) throw error;
    if (!exeat) throw new HttpError(404, 'Exeat not found.');
    if (!(step.from as readonly string[]).includes(exeat.status as string)) throw new HttpError(409, `This exeat is ${String(exeat.status).toLowerCase()}.`);

    const now = new Date().toISOString();
    const update: Record<string, unknown> = { status: step.to };
    if (action === 'APPROVE') Object.assign(update, { decided_by: access.userId, pass_code: passCode() });
    if (action === 'REJECT') Object.assign(update, { decided_by: access.userId, pass_code: null });
    if (action === 'CHECK_OUT') update.left_at = now;
    if (action === 'CHECK_IN') update.returned_at = now;
    const { data, error: upError } = await db.from('exeats').update(update).eq('id', exeat.id).eq('status', exeat.status).select('id, status, pass_code').maybeSingle();
    if (upError) throw upError;
    if (!data) throw new HttpError(409, 'Someone else changed this exeat just now.');

    let notified = false;
    if (action === 'CHECK_OUT') notified = await notifyGuardian(exeat.student_id as string, access.schoolId, c => `${c.schoolName}: ${c.firstName} left school at ${smsTime(now)} on exeat, due back by ${smsTime(exeat.return_by as string)}.`);
    if (action === 'CHECK_IN') notified = await notifyGuardian(exeat.student_id as string, access.schoolId, c => `${c.schoolName}: ${c.firstName} is back in school (${smsTime(now)}).`);
    await audit(access, action === 'APPROVE' ? 'approve' : action === 'REJECT' ? 'reject' : 'update', 'exeats', exeat.id as string, { action, notified });
    return { ...data, notified };
});
