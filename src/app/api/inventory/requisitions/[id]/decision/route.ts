import { z } from 'zod';
import { route, parseBody, HttpError } from '@/lib/platform/access';
import { audit } from '@/lib/platform/audit';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import type { RequisitionStatus } from '@/lib/ops/resources/operations';

type Params = { id: string };
const bodySchema = z.object({ decision: z.enum(['APPROVE', 'REJECT', 'ISSUE']) });

const STEPS: Record<z.infer<typeof bodySchema>['decision'], { from: RequisitionStatus; to: RequisitionStatus }> = {
    APPROVE: { from: 'PENDING', to: 'APPROVED' },
    REJECT: { from: 'PENDING', to: 'REJECTED' },
    ISSUE: { from: 'APPROVED', to: 'ISSUED' },
};

/** The storekeeper approves or rejects a requisition, then issues it (taking it off stock). */
export const POST = route<Params>('requisition decision', { module: 'inventory', permission: 'inventory.manage' }, async ({ access, params, request }) => {
    const { decision } = await parseBody(request, bodySchema);
    const db = createSupabaseAdmin();
    const { data: req, error } = await db.from('store_requisitions').select('id, status, item_id, quantity').eq('id', params.id).eq('school_id', access.schoolId).maybeSingle();
    if (error) throw error;
    if (!req) throw new HttpError(404, 'Requisition not found.');
    const step = STEPS[decision];
    if (req.status !== step.from) throw new HttpError(409, `Only ${step.from.toLowerCase()} requisitions can be ${step.to.toLowerCase()}.`);

    if (decision === 'ISSUE') {
        const { data: item, error: itemError } = await db.from('inventory_items').select('quantity').eq('id', req.item_id).maybeSingle();
        if (itemError) throw itemError;
        const left = Number(item?.quantity ?? 0) - Number(req.quantity);
        if (left < 0) throw new HttpError(409, `Only ${item?.quantity ?? 0} in stock.`);
        // Guard on the quantity read, so two issues cannot both spend the same stock.
        const { data: moved, error: stockError } = await db.from('inventory_items').update({ quantity: left }).eq('id', req.item_id).eq('quantity', item?.quantity ?? 0).select('id');
        if (stockError) throw stockError;
        if (!moved?.length) throw new HttpError(409, 'Stock changed just now. Try again.');
    }
    const { data, error: upError } = await db.from('store_requisitions')
        .update({ status: step.to, ...(decision !== 'ISSUE' ? { decided_by: access.userId, decided_at: new Date().toISOString() } : {}) })
        .eq('id', req.id).eq('status', step.from).select('id, status').maybeSingle();
    if (upError) throw upError;
    if (!data) throw new HttpError(409, 'Someone else changed this requisition just now.');
    await audit(access, decision === 'REJECT' ? 'reject' : 'approve', 'store_requisitions', req.id as string, { decision });
    return data;
});
