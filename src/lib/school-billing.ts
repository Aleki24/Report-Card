/**
 * Skulbase billing a school, client-safe: the shapes the screens use and the
 * rules for where a school stands. Server work is in school-billing-server.
 *
 * A term's invoice is due 14 days after it is made (or after the term opens,
 * whichever is later). Unpaid 14 days past that, the school goes read-only:
 * it can still see and download everything, but cannot add or change records
 * until it pays.
 */
import { z } from 'zod';

export const BILLING_URL = '/api/school/billing';
export const PLATFORM_BILLING_URL = '/api/platform/billing';
export const PLATFORM_BILLING_PATH = '/dashboard/platform-billing';

/** Days from the invoice to its due date. */
export const DAYS_TO_PAY = 14;
/** Days past the due date before the school goes read-only. */
export const GRACE_DAYS = 14;

export type InvoiceStatus = 'FREE' | 'DUE' | 'PAID' | 'VOID';
export type InvoiceCycle = 'TERM' | 'YEAR';

export interface SchoolInvoice {
    id: string;
    label: string;
    cycle: InvoiceCycle;
    periodStart: string;
    periodEnd: string;
    learners: number;
    plan: string;
    amount: number;
    status: InvoiceStatus;
    dueDate: string;
    paidAmount: number | null;
    paymentRef: string | null;
    paidAt: string | null;
}

/** Where schools send payment; set by the platform owner. */
export const paymentInstructionsSchema = z.object({
    paybill: z.string().trim().max(20).default(''),
    /** What to put as the account number, e.g. "Your school's name". */
    account: z.string().trim().max(80).default(''),
    till: z.string().trim().max(20).default(''),
    bank: z.string().trim().max(200).default(''),
    phone: z.string().trim().max(20).default(''),
});
export type PaymentInstructions = z.infer<typeof paymentInstructionsSchema>;
export const hasInstructions = (p: PaymentInstructions) => !!(p.paybill || p.till || p.bank);

/** Where a school stands with its subscription today. */
export type BillingState =
    | { kind: 'none' }
    | { kind: 'free'; invoice: SchoolInvoice }
    | { kind: 'paid'; invoice: SchoolInvoice }
    | { kind: 'due'; invoice: SchoolInvoice; lockOn: string }
    | { kind: 'overdue'; invoice: SchoolInvoice; lockOn: string }
    | { kind: 'locked'; invoice: SchoolInvoice };

/** "2026-11-27" plus days. */
export const addIsoDays = (iso: string, days: number): string => {
    const d = new Date(`${iso}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
};

/** The date an unpaid invoice puts the school in read-only. */
export const lockDateOf = (invoice: Pick<SchoolInvoice, 'dueDate'>) => addIsoDays(invoice.dueDate, GRACE_DAYS);

/**
 * Where the school stands: the oldest unpaid invoice decides (locked once
 * past its grace, overdue past its due date, else due); with nothing unpaid,
 * the latest invoice (free or paid).
 */
export function billingState(invoices: readonly SchoolInvoice[], today: string): BillingState {
    const unpaid = invoices.filter(i => i.status === 'DUE').sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
    if (unpaid) {
        const lockOn = lockDateOf(unpaid);
        if (today >= lockOn) return { kind: 'locked', invoice: unpaid };
        return today > unpaid.dueDate ? { kind: 'overdue', invoice: unpaid, lockOn } : { kind: 'due', invoice: unpaid, lockOn };
    }
    const latest = invoices.filter(i => i.status !== 'VOID').sort((a, b) => b.periodStart.localeCompare(a.periodStart))[0];
    if (!latest) return { kind: 'none' };
    return latest.status === 'FREE' ? { kind: 'free', invoice: latest } : { kind: 'paid', invoice: latest };
}

/** What the school sees: its invoices and where it stands; only admins get the invoices. */
export interface SchoolBilling {
    state: BillingState;
    invoices: SchoolInvoice[];
    instructions: PaymentInstructions | null;
    schoolName: string;
}

/** Read-only, in a line, for the refusal of a change and the banner. */
export const READ_ONLY_MESSAGE = 'Your Skulbase subscription is unpaid, so the school is read-only. Pay to add or change records.';

/** The owner's view of one school. */
export interface PlatformSchoolBilling {
    schoolId: string;
    schoolName: string;
    learners: number;
    state: BillingState;
    invoices: SchoolInvoice[];
}

export const markPaidSchema = z.object({
    action: z.literal('paid'),
    payment_ref: z.string().trim().min(3, 'Enter the M-Pesa code or bank reference').max(40),
    amount: z.number().int().min(0).max(10_000_000),
});
export const invoiceActionSchema = z.discriminatedUnion('action', [
    markPaidSchema,
    z.object({ action: z.literal('void'), note: z.string().trim().max(200).optional() }),
    z.object({ action: z.literal('waive'), note: z.string().trim().max(200).optional() }),
]);
export type InvoiceAction = z.infer<typeof invoiceActionSchema>;

export const STATE_COPY: Record<BillingState['kind'], { label: string; tone: 'good' | 'warn' | 'bad' | 'muted' }> = {
    none: { label: 'No invoice yet', tone: 'muted' },
    free: { label: 'Free term', tone: 'good' },
    paid: { label: 'Paid', tone: 'good' },
    due: { label: 'Due', tone: 'warn' },
    overdue: { label: 'Overdue', tone: 'bad' },
    locked: { label: 'Read-only', tone: 'bad' },
};
