import { z } from 'zod';
import { route, parseBody, HttpError } from '@/lib/platform/access';
import { audit } from '@/lib/platform/audit';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { loadScheme, type SchemeStatus } from '@/lib/academics/schemes-server';

type Params = { id: string };

const bodySchema = z.object({ action: z.enum(['SUBMIT', 'APPROVE', 'RETURN']), comment: z.string().trim().max(2000).optional() });

const STEPS: Record<z.infer<typeof bodySchema>['action'], { from: SchemeStatus[]; to: SchemeStatus; reviewer: boolean }> = {
    SUBMIT: { from: ['DRAFT', 'RETURNED'], to: 'SUBMITTED', reviewer: false },
    APPROVE: { from: ['SUBMITTED'], to: 'APPROVED', reviewer: true },
    RETURN: { from: ['SUBMITTED', 'APPROVED'], to: 'RETURNED', reviewer: true },
};

/** Teacher submits; HOD or DOS approves or returns with a comment. */
export const POST = route<Params>('scheme transition', { module: 'lesson_records', permission: ['lesson_records.write', 'lesson_records.review'] }, async ({ access, params, request }) => {
    const { action, comment } = await parseBody(request, bodySchema);
    const scheme = await loadScheme(params.id, access);
    const step = STEPS[action];
    if (step.reviewer ? !scheme.isReviewer : !scheme.isOwner) throw new HttpError(403, 'You cannot do that with this scheme.');
    if (!step.from.includes(scheme.status)) throw new HttpError(409, `A ${scheme.status.toLowerCase()} scheme cannot be ${step.to.toLowerCase()}.`);
    if (action === 'RETURN' && !comment) throw new HttpError(400, 'Say what needs changing.');

    const db = createSupabaseAdmin();
    if (action === 'SUBMIT') {
        const { count } = await db.from('scheme_entries').select('id', { count: 'exact', head: true }).eq('scheme_id', scheme.id);
        if (!count) throw new HttpError(400, 'Add the weekly entries before submitting.');
    }
    const review = step.reviewer ? { reviewed_by: access.userId, reviewed_at: new Date().toISOString(), review_comment: comment ?? null } : {};
    const { data, error } = await db.from('schemes_of_work').update({ status: step.to, ...review }).eq('id', scheme.id).eq('status', scheme.status).select('id, status').maybeSingle();
    if (error) throw error;
    if (!data) throw new HttpError(409, 'Someone else changed this scheme just now.');
    await audit(access, action === 'APPROVE' ? 'approve' : action === 'RETURN' ? 'reject' : 'update', 'schemes_of_work', scheme.id, { action, comment });
    return data;
});
