import type { SupabaseClient } from '@supabase/supabase-js';
import { embedOne, fetchAllRows } from '@/lib/postgrest';
import {
    buildLedger,
    type FeeAccount, type FeeAccountGuardian, type FeeAccountPayment, type FeeAccountTerm,
} from '@/lib/fee-account';

/** Database reads behind a learner's fee account (see fee-account.ts). */

type One<T> = T | T[] | null;

interface FeeRow {
    id: string;
    term_id: string;
    total_fee: number | string;
    paid_amount: number | string;
    due_date: string | null;
    status: string;
    notes: string | null;
    created_at: string;
    terms: One<{ name: string; start_date: string | null; academic_years: One<{ name: string }> }>;
}

interface InvoiceRow {
    term_id: string;
    total: number | string;
    lines: { description: string; amount: number | string }[] | null;
}

interface PaymentRow {
    id: string;
    student_fee_id: string;
    receipt_number: string;
    amount: number | string;
    method: string;
    status: string;
    payer_name: string | null;
    mpesa_receipt_number: string | null;
    pesapal_confirmation_code: string | null;
    paid_at: string;
}

interface GuardianRow {
    id: string;
    relationship: string | null;
    is_primary: boolean | null;
    parent: One<{ first_name: string | null; last_name: string | null; phone: string | null; is_active: boolean | null }>;
}

interface LearnerRow {
    id: string;
    admission_number: string | null;
    status: string;
    residence: string | null;
    guardian_name: string | null;
    guardian_phone: string | null;
    users: One<{ first_name: string | null; last_name: string | null; school_id: string }>;
    grade_streams: One<{ full_name: string }>;
}

const num = (v: number | string | null | undefined) => Number(v ?? 0);
const fullName = (p: { first_name: string | null; last_name: string | null } | null) => `${p?.first_name ?? ''} ${p?.last_name ?? ''}`.trim();

function throwOn(what: string, error: unknown): void {
    if (error) throw new Error(`Could not load ${what}`);
}

/** A learner's whole fee account, or null when they are not in this school. */
export async function loadFeeAccount(supabase: SupabaseClient, schoolId: string, studentId: string): Promise<FeeAccount | null> {
    const [learnerRes, feesRes, invoicesRes, guardiansRes] = await Promise.all([
        supabase
            .from('students')
            .select('id, admission_number, status, residence, guardian_name, guardian_phone, users!inner ( first_name, last_name, school_id ), grade_streams ( full_name )')
            .eq('id', studentId)
            .maybeSingle<LearnerRow>(),
        supabase
            .from('student_fees')
            .select('id, term_id, total_fee, paid_amount, due_date, status, notes, created_at, terms ( name, start_date, academic_years ( name ) )')
            .eq('school_id', schoolId)
            .eq('student_id', studentId)
            .returns<FeeRow[]>(),
        supabase
            .from('invoices')
            .select('term_id, total, lines:invoice_lines ( description, amount )')
            .eq('school_id', schoolId)
            .eq('student_id', studentId)
            .returns<InvoiceRow[]>(),
        supabase
            .from('student_guardians')
            .select('id, relationship, is_primary, parent:users!student_guardians_parent_user_id_fkey ( first_name, last_name, phone, is_active )')
            .eq('school_id', schoolId)
            .eq('student_id', studentId)
            .returns<GuardianRow[]>(),
    ]);
    throwOn('the learner', learnerRes.error);
    const learner = learnerRes.data;
    if (!learner || embedOne(learner.users)?.school_id !== schoolId) return null;
    throwOn('fee records', feesRes.error);
    throwOn('invoices', invoicesRes.error);
    throwOn('guardians', guardiansRes.error);

    const fees = feesRes.data ?? [];
    const feeIds = fees.map(f => f.id);
    const { rows: paymentRows, error: paymentsError } = feeIds.length === 0
        ? { rows: [] as PaymentRow[], error: null }
        : await fetchAllRows<PaymentRow>(() => supabase
            .from('fee_payments')
            .select('id, student_fee_id, receipt_number, amount, method, status, payer_name, mpesa_receipt_number, pesapal_confirmation_code, paid_at')
            .in('student_fee_id', feeIds)
            .eq('status', 'COMPLETED')
            .order('paid_at', { ascending: false }));
    throwOn('payments', paymentsError);

    const invoiceByTerm = new Map((invoicesRes.data ?? []).map(i => [i.term_id, i]));
    const terms: FeeAccountTerm[] = fees
        .map(f => {
            const term = embedOne(f.terms);
            const billed = num(f.total_fee);
            const paid = num(f.paid_amount);
            const invoice = invoiceByTerm.get(f.term_id);
            const gross = invoice ? Math.max(billed, num(invoice.total)) : billed;
            return {
                feeId: f.id,
                termId: f.term_id,
                termName: term?.name ?? 'Term',
                yearName: embedOne(term?.academic_years ?? null)?.name ?? null,
                startDate: term?.start_date ?? f.created_at.slice(0, 10),
                dueDate: f.due_date,
                gross,
                awards: Math.round((gross - billed) * 100) / 100,
                billed,
                paid,
                balance: Math.round((billed - paid) * 100) / 100,
                status: f.status,
                lines: (invoice?.lines ?? []).map(l => ({ description: l.description, amount: num(l.amount) })),
                notes: f.notes,
            };
        })
        .sort((a, b) => (a.startDate ?? '').localeCompare(b.startDate ?? ''));

    const termOfFee = new Map(terms.map(t => [t.feeId, t.termName]));
    const payments: FeeAccountPayment[] = paymentRows.map(p => ({
        id: p.id,
        feeId: p.student_fee_id,
        termName: termOfFee.get(p.student_fee_id) ?? 'Term',
        receiptNumber: p.receipt_number,
        amount: num(p.amount),
        method: p.method,
        reference: p.mpesa_receipt_number ?? p.pesapal_confirmation_code ?? null,
        payerName: p.payer_name,
        paidAt: p.paid_at,
        status: p.status,
    }));

    const guardians: FeeAccountGuardian[] = (guardiansRes.data ?? []).map(g => {
        const parent = embedOne(g.parent);
        return {
            linkId: g.id,
            name: fullName(parent) || 'Parent',
            phone: parent?.phone ?? null,
            relationship: g.relationship,
            isPrimary: !!g.is_primary,
            hasAccount: !!parent?.is_active,
        };
    });
    // The contact typed on the learner's record, until a parent is linked.
    if (guardians.length === 0 && (learner.guardian_name?.trim() || learner.guardian_phone?.trim())) {
        guardians.push({ linkId: '', name: learner.guardian_name?.trim() || 'Guardian', phone: learner.guardian_phone?.trim() || null, relationship: null, isPrimary: true, hasAccount: false });
    }

    const billed = terms.reduce((s, t) => s + t.billed, 0);
    const paid = terms.reduce((s, t) => s + t.paid, 0);
    return {
        learner: {
            id: learner.id,
            name: fullName(embedOne(learner.users)) || 'Learner',
            admissionNumber: learner.admission_number,
            className: embedOne(learner.grade_streams)?.full_name ?? null,
            status: learner.status,
            residence: learner.residence,
        },
        guardians,
        terms,
        payments,
        ledger: buildLedger(terms, payments),
        totals: { billed, paid, balance: Math.round((billed - paid) * 100) / 100 },
    };
}

/**
 * How to pay this school, as fee documents print it: the Paybill (the
 * admission number is the account, which is how M-Pesa payments are matched
 * to a learner) and any bank accounts. Never the API credentials.
 */
export async function payInstructions(supabase: SupabaseClient, schoolId: string, admissionNumber: string | null): Promise<string[]> {
    const [settingsRes, banksRes] = await Promise.all([
        supabase.from('school_payment_settings').select('active_provider, shortcode, bank_enabled').eq('school_id', schoolId).maybeSingle(),
        supabase.from('school_bank_accounts').select('bank_name, account_name, account_number, branch, is_primary').eq('school_id', schoolId).order('is_primary', { ascending: false }),
    ]);
    const settings = settingsRes.data;
    const reference = admissionNumber?.trim() || 'the learner’s admission number';
    const lines: string[] = [];
    if (settings?.active_provider === 'DARAJA' && settings.shortcode) {
        lines.push(`M-Pesa: Paybill ${settings.shortcode}, account number ${reference}.`);
    }
    if (settings?.bank_enabled) {
        for (const b of banksRes.data ?? []) {
            lines.push(`Bank: ${b.bank_name}${b.branch ? `, ${b.branch} branch` : ''} · ${b.account_name} · A/C ${b.account_number}. Use ${reference} as the reference.`);
        }
    }
    return lines;
}
