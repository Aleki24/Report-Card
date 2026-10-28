import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { embedOne, isUuid } from '@/lib/postgrest';

/**
 * What the public receipt check shows (the page a receipt's QR opens):
 * enough to tell a genuine receipt from a doctored one (school, number,
 * amount, date, and whether it still stands), and nothing a stranger with
 * the link shouldn't see: no balances, no phone, the learner's first name
 * and initial only.
 */
export interface VerifiedReceipt {
    school: { name: string; logoUrl: string | null };
    receiptNumber: string;
    amount: number;
    method: string;
    paidAt: string;
    termName: string | null;
    learner: string;
    /** `valid` once confirmed, `voided` when the school cancelled it, `pending` while an online payment waits. */
    standing: 'valid' | 'voided' | 'pending';
}

type One<T> = T | T[] | null;

interface Row {
    receipt_number: string;
    amount: number | string;
    method: string;
    status: string;
    paid_at: string;
    schools: One<{ name: string | null; logo_url: string | null }>;
    student_fees: One<{ terms: One<{ name: string }>; students: One<{ users: One<{ first_name: string | null; last_name: string | null }> }> }>;
}

export async function loadVerifiedReceipt(paymentId: string): Promise<VerifiedReceipt | null> {
    if (!isUuid(paymentId)) return null;
    const { data, error } = await createSupabaseAdmin()
        .from('fee_payments')
        .select('receipt_number, amount, method, status, paid_at, schools ( name, logo_url ), student_fees ( terms ( name ), students ( users ( first_name, last_name ) ) )')
        .eq('id', paymentId)
        .maybeSingle<Row>();
    if (error) throw new Error('Could not check this receipt');
    const fee = embedOne(data?.student_fees ?? null);
    if (!data || !fee) return null;
    const user = embedOne(embedOne(fee.students)?.users ?? null);
    const initial = user?.last_name?.trim().charAt(0);
    return {
        school: { name: embedOne(data.schools)?.name ?? 'School', logoUrl: embedOne(data.schools)?.logo_url ?? null },
        receiptNumber: data.receipt_number,
        amount: Number(data.amount),
        method: data.method,
        paidAt: data.paid_at,
        termName: embedOne(fee.terms)?.name ?? null,
        learner: `${user?.first_name?.trim() || 'Learner'}${initial ? ` ${initial}.` : ''}`,
        standing: data.status === 'COMPLETED' ? 'valid' : data.status === 'CANCELLED' ? 'voided' : 'pending',
    };
}
