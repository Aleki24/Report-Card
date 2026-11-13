import { z } from 'zod';
import { parseBody, route } from '@/lib/platform/access';
import { audit } from '@/lib/platform/audit';
import { switchToYear } from '@/lib/school-billing-server';

const bodySchema = z.object({ invoice_id: z.string().uuid() });

/** POST — pay the year instead of the term (three terms, less the yearly saving). */
export const POST = route('school billing year', { permission: 'school.manage', billingExempt: true }, async ({ access, request }) => {
    const { invoice_id } = await parseBody(request, bodySchema);
    await switchToYear(access.schoolId, invoice_id);
    await audit(access, 'update', 'school_invoices', invoice_id, { cycle: 'YEAR' });
    return { ok: true };
});
