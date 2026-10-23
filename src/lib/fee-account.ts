/**
 * A learner's fee account: every term billed, every payment, and the
 * running balance across them, so Term 1 arrears show up in Term 2 as
 * "balance brought forward" instead of disappearing with the term.
 *
 * Client-safe and shared with the mobile app, so imports stay relative.
 */

export interface FeeAccountGuardian {
    linkId: string;
    name: string;
    phone: string | null;
    relationship: string | null;
    isPrimary: boolean;
    /** Has signed in to the parent portal. */
    hasAccount: boolean;
}

export interface FeeAccountLine {
    description: string;
    amount: number;
}

/** One term's bill. */
export interface FeeAccountTerm {
    feeId: string;
    termId: string;
    termName: string;
    yearName: string | null;
    /** YYYY-MM-DD the term starts, for ordering; null when the term has no dates. */
    startDate: string | null;
    dueDate: string | null;
    /** What the term's invoice came to before bursaries and waivers; equals `billed` without an invoice. */
    gross: number;
    /** Bursaries, scholarships and waivers taken off the invoice. */
    awards: number;
    /** What the learner owes for the term: gross less awards. */
    billed: number;
    paid: number;
    /** billed − paid for this term alone; negative is credit. */
    balance: number;
    status: string;
    /** The invoice's vote heads, when the term was billed from a fee structure. */
    lines: FeeAccountLine[];
    notes: string | null;
}

export interface FeeAccountPayment {
    id: string;
    feeId: string;
    termName: string;
    receiptNumber: string;
    amount: number;
    method: string;
    /** M-Pesa or Pesapal code, or the bank/cheque reference. */
    reference: string | null;
    payerName: string | null;
    paidAt: string;
    status: string;
}

export type FeeLedgerKind = 'charge' | 'award' | 'payment';

/** One line of the statement, oldest first. */
export interface FeeLedgerEntry {
    kind: FeeLedgerKind;
    /** ISO date (charges: the term start, else when billed). */
    date: string;
    description: string;
    termName: string;
    /** Money owed by this line (a charge). */
    debit: number;
    /** Money off what is owed (a payment, bursary or waiver). */
    credit: number;
    /** Owed after this line, across every term; negative is credit. */
    balance: number;
    receiptNumber?: string;
    paymentId?: string;
}

export interface FeeAccountLearner {
    id: string;
    name: string;
    admissionNumber: string | null;
    className: string | null;
    status: string;
    residence: string | null;
}

export interface FeeAccount {
    learner: FeeAccountLearner;
    guardians: FeeAccountGuardian[];
    /** Oldest first. */
    terms: FeeAccountTerm[];
    /** Completed payments, newest first. */
    payments: FeeAccountPayment[];
    ledger: FeeLedgerEntry[];
    totals: {
        billed: number;
        paid: number;
        /** Owed across every term; negative is credit. */
        balance: number;
    };
}

/** What a balance means, for a label: "Owes KSh 4,000" / "In credit" / "Cleared". */
export type BalanceState = 'owing' | 'credit' | 'clear';

export function balanceState(balance: number): BalanceState {
    if (balance > 0.005) return 'owing';
    if (balance < -0.005) return 'credit';
    return 'clear';
}

/**
 * The statement lines for an account: each term's charge (and any bursary
 * taken off it) on the term's start date, each payment on the day it was
 * paid, with the balance running across terms. Same-day lines put the
 * charge first, so a payment made on the first day reads as paying it.
 */
export function buildLedger(terms: readonly FeeAccountTerm[], payments: readonly FeeAccountPayment[]): FeeLedgerEntry[] {
    type Draft = Omit<FeeLedgerEntry, 'balance'> & { order: number };
    const drafts: Draft[] = [];
    for (const t of terms) {
        const date = t.startDate ?? t.dueDate ?? '';
        drafts.push({ kind: 'charge', date, description: `${t.termName}${t.yearName ? ` ${t.yearName}` : ''} fees`, termName: t.termName, debit: t.gross, credit: 0, order: 0 });
        if (t.awards > 0) drafts.push({ kind: 'award', date, description: 'Bursary / waiver', termName: t.termName, debit: 0, credit: t.awards, order: 1 });
    }
    for (const p of payments) {
        drafts.push({
            kind: 'payment',
            date: p.paidAt,
            description: `Payment · ${methodLabel(p.method)}${p.reference ? ` ${p.reference}` : ''}`,
            termName: p.termName,
            debit: 0,
            credit: p.amount,
            receiptNumber: p.receiptNumber,
            paymentId: p.id,
            order: 2,
        });
    }
    drafts.sort((a, b) => a.date.slice(0, 10).localeCompare(b.date.slice(0, 10)) || a.order - b.order || a.date.localeCompare(b.date));
    let running = 0;
    return drafts.map(d => {
        running = Math.round((running + d.debit - d.credit) * 100) / 100;
        const entry: FeeLedgerEntry = {
            kind: d.kind, date: d.date, description: d.description, termName: d.termName,
            debit: d.debit, credit: d.credit, balance: running,
        };
        if (d.receiptNumber) entry.receiptNumber = d.receiptNumber;
        if (d.paymentId) entry.paymentId = d.paymentId;
        return entry;
    });
}

const METHOD_LABELS: Record<string, string> = {
    MPESA: 'M-Pesa',
    PESAPAL: 'Pesapal',
    CASH: 'Cash',
    BANK: 'Bank',
    CHEQUE: 'Cheque',
    OTHER: 'Other',
};

export function methodLabel(method: string): string {
    return METHOD_LABELS[method] ?? method;
}

/** "KSh 12,500" (whole shillings unless there are cents). */
export function formatKsh(amount: number): string {
    const cents = Math.round(amount * 100) % 100 !== 0;
    return `KSh ${amount.toLocaleString('en-KE', { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: 2 })}`;
}

const ONES = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

function underThousand(n: number): string {
    const parts: string[] = [];
    if (n >= 100) {
        parts.push(`${ONES[Math.floor(n / 100)]} hundred`);
        n %= 100;
        if (n > 0) parts.push('and');
    }
    if (n >= 20) parts.push(TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : ''));
    else if (n > 0) parts.push(ONES[n]);
    return parts.join(' ');
}

/**
 * An amount in words, as receipts print it: "Twelve thousand five hundred
 * shillings only". Cents, when there are any, follow.
 */
export function amountInWords(amount: number): string {
    const whole = Math.floor(Math.abs(amount));
    const cents = Math.round((Math.abs(amount) - whole) * 100);
    const scales: [number, string][] = [[1_000_000_000, 'billion'], [1_000_000, 'million'], [1_000, 'thousand']];
    let rest = whole;
    const parts: string[] = [];
    for (const [size, name] of scales) {
        if (rest >= size) {
            parts.push(`${underThousand(Math.floor(rest / size))} ${name}`);
            rest %= size;
        }
    }
    if (rest > 0) parts.push(rest < 100 && parts.length > 0 ? `and ${underThousand(rest)}` : underThousand(rest));
    const words = parts.length > 0 ? parts.join(' ') : 'zero';
    const text = `${words} shilling${whole === 1 ? '' : 's'}${cents > 0 ? ` and ${underThousand(cents)} cent${cents === 1 ? '' : 's'}` : ''} only`;
    return text.charAt(0).toUpperCase() + text.slice(1);
}

/** A payment's receipt (PDF). */
export const feeReceiptUrl = (paymentId: string) => `/api/school/fees/payments/${paymentId}/receipt`;

/** A learner's fee statement (PDF). */
export const feeStatementUrl = (studentId: string) => `/api/school/fees/accounts/${studentId}/statement`;

/** A learner's fee account (JSON). */
export const feeAccountUrl = (studentId: string) => `/api/school/fees/accounts/${studentId}`;
