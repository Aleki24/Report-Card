import { route } from '@/lib/platform/access';
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { loadPaymentInstructions, schoolBilling } from '@/lib/school-billing-server';
import type { SchoolBilling } from '@/lib/school-billing';

/**
 * GET — the school's Skulbase subscription: where it stands for everyone
 * (the read-only banner), and its invoices and where to pay for whoever
 * manages the school.
 */
export const GET = route('school billing', { billingExempt: true }, async ({ access }): Promise<SchoolBilling> => {
    const { invoices, state } = await schoolBilling(access.schoolId);
    if (!access.can('school.manage')) return { state, invoices: [], instructions: null, schoolName: '' };
    const [instructions, { data: school }] = await Promise.all([
        loadPaymentInstructions(),
        createSupabaseAdmin().from('schools').select('name').eq('id', access.schoolId).maybeSingle(),
    ]);
    return { state, invoices, instructions, schoolName: (school?.name as string | undefined) ?? '' };
});
