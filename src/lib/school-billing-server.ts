/**
 * Skulbase billing schools, on the server: each school's invoice for the
 * term it is in is made the first time anyone asks (no scheduled job), priced
 * by its active learners; its first invoice is free. Whether a school is
 * read-only is read from its unpaid invoices.
 */
import { createSupabaseAdmin } from '@/lib/supabase-admin';
import { schoolToday } from '@/lib/dates';
import { HttpError } from '@/lib/platform/access';
import { PER_LEARNER_ABOVE, cyclePrice, planFor, termPrice } from '@/lib/pricing';
import {
    DAYS_TO_PAY, READ_ONLY_MESSAGE, addIsoDays, billingState, lockDateOf, paymentInstructionsSchema,
    type InvoiceAction, type PaymentInstructions, type PlatformSchoolBilling, type SchoolInvoice,
} from '@/lib/school-billing';

const db = () => createSupabaseAdmin();

/** Postgres "relation does not exist": the migration has not been applied yet. */
const missingTable = (err: { code?: string } | null) => err?.code === '42P01' || err?.code === 'PGRST205';

const INVOICE_SELECT = 'id, label, cycle, period_start, period_end, learners, plan, amount, status, due_date, paid_amount, payment_ref, paid_at';

interface InvoiceRow {
    id: string; label: string; cycle: 'TERM' | 'YEAR'; period_start: string; period_end: string; learners: number; plan: string;
    amount: number; status: SchoolInvoice['status']; due_date: string; paid_amount: number | null; payment_ref: string | null; paid_at: string | null;
}

const toInvoice = (r: InvoiceRow): SchoolInvoice => ({
    id: r.id, label: r.label, cycle: r.cycle, periodStart: r.period_start, periodEnd: r.period_end, learners: r.learners, plan: r.plan,
    amount: r.amount, status: r.status, dueDate: r.due_date, paidAmount: r.paid_amount, paymentRef: r.payment_ref, paidAt: r.paid_at,
});

const planName = (learners: number) => planFor(learners)?.name ?? `Per learner (KES ${PER_LEARNER_ABOVE})`;

async function activeLearners(schoolId: string): Promise<number> {
    const { count, error } = await db().from('students').select('id', { count: 'exact', head: true }).eq('school_id', schoolId).eq('status', 'ACTIVE');
    if (error) throw error;
    return count ?? 0;
}

/** The term the school is in: the one marked current, else the latest that has started. */
async function currentTerm(schoolId: string): Promise<{ name: string; start: string; end: string; year: string | null } | null> {
    const today = schoolToday();
    const { data, error } = await db().from('terms')
        .select('name, start_date, end_date, is_current, year:academic_years(name)')
        .eq('school_id', schoolId)
        .order('start_date', { ascending: false });
    if (error) throw error;
    const rows = (data ?? []).filter(t => t.start_date && t.end_date);
    const term = rows.find(t => t.is_current) ?? rows.find(t => (t.start_date as string) <= today);
    if (!term) return null;
    const year = (Array.isArray(term.year) ? term.year[0] : term.year) as { name?: string } | null;
    return { name: term.name as string, start: term.start_date as string, end: term.end_date as string, year: year?.name ?? null };
}

async function listInvoices(schoolId: string): Promise<SchoolInvoice[]> {
    const { data, error } = await db().from('school_invoices').select(INVOICE_SELECT).eq('school_id', schoolId).order('period_start', { ascending: false });
    if (error) throw error;
    return ((data ?? []) as InvoiceRow[]).map(toInvoice);
}

/**
 * The invoice for the term the school is in, made if it has none: nothing
 * when a live invoice (a term's or a year's) already covers the term's first
 * day. The school's first invoice ever is free.
 */
export async function ensureCurrentInvoice(schoolId: string): Promise<void> {
    const term = await currentTerm(schoolId);
    if (!term) return;
    const { data: covering, error } = await db().from('school_invoices').select('id')
        .eq('school_id', schoolId).neq('status', 'VOID')
        .lte('period_start', term.start).gte('period_end', term.start).limit(1);
    if (error) {
        if (missingTable(error)) return;
        throw error;
    }
    if ((covering ?? []).length > 0) return;
    const { count, error: countError } = await db().from('school_invoices').select('id', { count: 'exact', head: true }).eq('school_id', schoolId).neq('status', 'VOID');
    if (countError) throw countError;
    const learners = await activeLearners(schoolId);
    const first = (count ?? 0) === 0;
    const today = schoolToday();
    const { error: insertError } = await db().from('school_invoices').insert({
        school_id: schoolId,
        label: [term.name, term.year].filter(Boolean).join(' '),
        cycle: 'TERM',
        period_start: term.start,
        period_end: term.end,
        learners,
        plan: planName(learners),
        amount: first ? 0 : termPrice(learners),
        status: first ? 'FREE' : 'DUE',
        due_date: addIsoDays(term.start > today ? term.start : today, DAYS_TO_PAY),
        note: first ? 'First term free' : null,
    });
    // Two requests at once: the second finds the live invoice the first made.
    if (insertError && insertError.code !== '23505') throw insertError;
}

export async function loadPaymentInstructions(): Promise<PaymentInstructions> {
    const { data, error } = await db().from('platform_settings').select('payment_instructions').eq('id', 1).maybeSingle();
    if (error) {
        if (missingTable(error)) return paymentInstructionsSchema.parse({});
        throw error;
    }
    return paymentInstructionsSchema.parse(data?.payment_instructions ?? {});
}

export async function savePaymentInstructions(instructions: PaymentInstructions, userId: string): Promise<PaymentInstructions> {
    const { error } = await db().from('platform_settings').upsert({ id: 1, payment_instructions: instructions, updated_at: new Date().toISOString(), updated_by: userId });
    if (error) throw error;
    return instructions;
}

/** A school's subscription: its invoices (the current term's made if missing) and where it stands. */
export async function schoolBilling(schoolId: string) {
    await ensureCurrentInvoice(schoolId);
    const invoices = await listInvoices(schoolId).catch((err: { code?: string }) => { if (missingTable(err)) return []; throw err; });
    return { invoices, state: billingState(invoices, schoolToday()) };
}

/**
 * Refuses a change while the school is read-only: an invoice unpaid past its
 * grace. Before the billing tables exist, nothing is refused.
 */
export async function assertSchoolWritable(schoolId: string): Promise<void> {
    const { data, error } = await db().from('school_invoices').select('due_date').eq('school_id', schoolId).eq('status', 'DUE');
    if (error) {
        if (missingTable(error)) return;
        throw error;
    }
    const today = schoolToday();
    if ((data ?? []).some(r => today >= lockDateOf({ dueDate: r.due_date as string }))) throw new HttpError(402, READ_ONLY_MESSAGE);
}

/** Pay the year instead of the term: the term's invoice is replaced by one for three terms, less the yearly saving. */
export async function switchToYear(schoolId: string, invoiceId: string): Promise<void> {
    const { data, error } = await db().from('school_invoices').select(INVOICE_SELECT).eq('id', invoiceId).eq('school_id', schoolId).maybeSingle();
    if (error) throw error;
    const invoice = data as InvoiceRow | null;
    if (!invoice || invoice.status !== 'DUE' || invoice.cycle !== 'TERM') throw new HttpError(400, 'Only an unpaid term can be changed to the year.');
    const { error: voidError } = await db().from('school_invoices').update({ status: 'VOID', note: 'Replaced by the year' }).eq('id', invoiceId);
    if (voidError) throw voidError;
    const { error: insertError } = await db().from('school_invoices').insert({
        school_id: schoolId,
        label: `Year from ${invoice.label}`,
        cycle: 'YEAR',
        period_start: invoice.period_start,
        period_end: addIsoDays(invoice.period_start, 364),
        learners: invoice.learners,
        plan: invoice.plan,
        amount: cyclePrice(invoice.learners, 'year'),
        status: 'DUE',
        due_date: invoice.due_date,
    });
    if (insertError) {
        await db().from('school_invoices').update({ status: 'DUE', note: null }).eq('id', invoiceId);
        throw insertError;
    }
}

/** Every approved school with its invoices, for the platform owner; current invoices made first. */
export async function allSchoolsBilling(): Promise<PlatformSchoolBilling[]> {
    const { data: schools, error } = await db().from('schools').select('id, name').eq('approval_status', 'APPROVED').order('name');
    if (error) throw error;
    const today = schoolToday();
    return Promise.all((schools ?? []).map(async s => {
        const id = s.id as string;
        const [{ invoices }, learners] = await Promise.all([schoolBilling(id), activeLearners(id)]);
        return { schoolId: id, schoolName: s.name as string, learners, invoices, state: billingState(invoices, today) };
    }));
}

/** The owner's decision on an invoice: paid (with the M-Pesa or bank reference), voided, or waived. */
export async function actOnInvoice(invoiceId: string, action: InvoiceAction, ownerId: string): Promise<void> {
    const { data, error } = await db().from('school_invoices').select('id, status').eq('id', invoiceId).maybeSingle();
    if (error) throw error;
    if (!data) throw new HttpError(404, 'No such invoice.');
    if (data.status === 'VOID') throw new HttpError(400, 'This invoice was voided.');
    const patch = action.action === 'paid'
        ? { status: 'PAID', payment_ref: action.payment_ref.toUpperCase(), paid_amount: action.amount, paid_at: new Date().toISOString(), confirmed_by: ownerId }
        : action.action === 'waive'
            ? { status: 'FREE', note: action.note ?? 'Waived', confirmed_by: ownerId }
            : { status: 'VOID', note: action.note ?? 'Voided', confirmed_by: ownerId };
    const { error: updateError } = await db().from('school_invoices').update(patch).eq('id', invoiceId);
    if (updateError) throw updateError;
}
