import type { SupabaseClient } from '@supabase/supabase-js';
import { embedOne, fetchAllRows } from '@/lib/postgrest';

/** Filters shared by the Payments log and its Excel export. */
export interface PaymentLogFilters {
    termId: string | null;
    method: string | null;
    status: string | null;
    source: 'AUTO' | 'MANUAL' | null;
    dateFrom: string | null;
    dateTo: string | null;
    /** Student name, admission number, receipt or transaction code. */
    search: string | null;
}

export interface PaymentLogEntry {
    id: string;
    studentFeeId: string | null;
    receiptNumber: string;
    amount: number;
    method: string;
    status: string;
    source: 'AUTO' | 'MANUAL';
    studentName: string | null;
    admissionNumber: string | null;
    unmatchedReference: string | null;
    termId: string | null;
    termName: string | null;
    phoneNumber: string | null;
    payerName: string | null;
    mpesaReceiptNumber: string | null;
    pesapalConfirmationCode: string | null;
    notes: string | null;
    recordedBy: string | null;
    paidAt: string;
    createdAt: string;
}

type Named = { first_name: string | null; last_name: string | null };
interface PaymentRow {
    id: string;
    student_fee_id: string | null;
    receipt_number: string;
    amount: number | string;
    method: string;
    status: string;
    phone_number: string | null;
    payer_name: string | null;
    mpesa_receipt_number: string | null;
    mpesa_checkout_request_id: string | null;
    pesapal_order_tracking_id: string | null;
    pesapal_confirmation_code: string | null;
    unmatched_account_reference: string | null;
    notes: string | null;
    recorded_by: string | null;
    paid_at: string;
    created_at: string;
    student_fees: {
        term_id: string | null;
        terms: { name: string | null } | { name: string | null }[] | null;
        students: { admission_number: string | null; users: Named | Named[] | null } | { admission_number: string | null; users: Named | Named[] | null }[] | null;
    } | null;
}

const text = (value: string | null) => {
    const v = value?.trim();
    return v ? v : null;
};

export function parsePaymentLogFilters(searchParams: URLSearchParams): PaymentLogFilters {
    const source = searchParams.get('source');
    return {
        termId: text(searchParams.get('term_id')),
        method: text(searchParams.get('method')),
        status: text(searchParams.get('status')),
        source: source === 'AUTO' || source === 'MANUAL' ? source : null,
        dateFrom: text(searchParams.get('date_from')),
        dateTo: text(searchParams.get('date_to')),
        search: text(searchParams.get('search'))?.toLowerCase() ?? null,
    };
}

/**
 * Every payment matching the filters, newest first.
 *
 * The log read the newest 500 payments and only then applied the term,
 * source and search filters, so searching for a learner whose last payment
 * was older than that, or picking last year's term, found nothing. The
 * export asked for 2,000 rows from a server that returns 1,000 at most. Now
 * the term, method, status and dates filter in the database, every page is
 * read, and source and search (which span joined columns) filter after.
 */
export async function loadPaymentLog(supabase: SupabaseClient, schoolId: string, filters: PaymentLogFilters) {
    // Filtering on the term goes through the fee record; the inner join keeps
    // it from also returning unmatched payments, which belong to no term.
    const feeEmbed = filters.termId ? 'student_fees!inner' : 'student_fees';
    const { rows, error, truncated } = await fetchAllRows<PaymentRow>(() => {
        let query = supabase
            .from('fee_payments')
            .select(`
                id, student_fee_id, receipt_number, amount, method, status, phone_number, payer_name,
                mpesa_receipt_number, mpesa_checkout_request_id, pesapal_order_tracking_id,
                pesapal_confirmation_code, unmatched_account_reference, notes, recorded_by,
                paid_at, created_at,
                ${feeEmbed} ( term_id, terms ( name ), students ( admission_number, users ( first_name, last_name ) ) )
            `)
            .eq('school_id', schoolId);
        if (filters.termId) query = query.eq('student_fees.term_id', filters.termId);
        if (filters.method) query = query.eq('method', filters.method);
        if (filters.status) query = query.eq('status', filters.status);
        if (filters.dateFrom) query = query.gte('paid_at', filters.dateFrom);
        if (filters.dateTo) query = query.lte('paid_at', `${filters.dateTo}T23:59:59.999Z`);
        return query.order('paid_at', { ascending: false }).order('id', { ascending: false }) as unknown as {
            range: (from: number, to: number) => PromiseLike<{ data: PaymentRow[] | null; error: unknown }>;
        };
    });
    if (error) throw error;

    let entries: PaymentLogEntry[] = rows.map(p => {
        const fee = p.student_fees;
        const student = embedOne(fee?.students);
        const user = embedOne(student?.users);
        const isAuto = Boolean(p.mpesa_checkout_request_id || p.pesapal_order_tracking_id || p.unmatched_account_reference);
        return {
            id: p.id,
            studentFeeId: p.student_fee_id,
            receiptNumber: p.receipt_number,
            amount: Number(p.amount),
            method: p.method,
            status: p.status,
            source: isAuto ? 'AUTO' : 'MANUAL',
            studentName: user ? `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() : (p.unmatched_account_reference ? null : '—'),
            admissionNumber: student?.admission_number ?? null,
            unmatchedReference: p.unmatched_account_reference,
            termId: fee?.term_id ?? null,
            termName: embedOne(fee?.terms)?.name ?? null,
            phoneNumber: p.phone_number,
            payerName: p.payer_name,
            mpesaReceiptNumber: p.mpesa_receipt_number,
            pesapalConfirmationCode: p.pesapal_confirmation_code,
            notes: p.notes,
            recordedBy: p.recorded_by,
            paidAt: p.paid_at,
            createdAt: p.created_at,
        };
    });

    if (filters.source) entries = entries.filter(p => p.source === filters.source);
    const q = filters.search;
    if (q) {
        entries = entries.filter(p =>
            p.studentName?.toLowerCase().includes(q)
            || p.admissionNumber?.toLowerCase().includes(q)
            || p.receiptNumber?.toLowerCase().includes(q)
            || p.mpesaReceiptNumber?.toLowerCase().includes(q)
            || p.pesapalConfirmationCode?.toLowerCase().includes(q)
            || p.unmatchedReference?.toLowerCase().includes(q));
    }
    return { entries, truncated };
}

/** Names of the staff who recorded these payments, by user id. */
export async function recorderNames(supabase: SupabaseClient, entries: readonly Pick<PaymentLogEntry, 'recordedBy'>[]): Promise<Record<string, string>> {
    const ids = [...new Set(entries.map(e => e.recordedBy).filter((id): id is string => Boolean(id)))];
    if (ids.length === 0) return {};
    const { data } = await supabase.from('users').select('id, first_name, last_name').in('id', ids);
    return Object.fromEntries((data ?? []).map((r: { id: string } & Named) => [r.id, `${r.first_name ?? ''} ${r.last_name ?? ''}`.trim()]));
}
