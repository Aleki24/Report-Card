/**
 * Reading an M-Pesa or bank statement into payments: what came in, when,
 * under which code, from whom and against which account number.
 *
 * The M-Pesa organisation portal exports a Paybill or Till statement with a
 * title block, then "Receipt No., Completion Time, Details, Transaction
 * Status, Paid In, Withdrawn, Balance, ... Other Party Info, A/C No.". Bank
 * statements differ by bank, so their columns are found by name ("Value
 * Date", "Narration", "Credit", "Reference"...). Only money in is kept:
 * withdrawals, charges and failed transactions are not fee payments.
 *
 * Client-safe and shared with the app.
 */
import { normalizeHeading } from './import/parse-tabular-file';

export type StatementSource = 'MPESA' | 'BANK';

/** One payment in from a statement. */
export interface StatementRow {
    /** Its line in the file (1 = first data row), for the review list. */
    line: number;
    /** YYYY-MM-DD. */
    date: string;
    /** HH:MM:SS when the statement gives a time (M-Pesa does). */
    time: string | null;
    amount: number;
    /** The M-Pesa receipt (QAB12CD34E) or the bank's reference. */
    code: string | null;
    /** What the payer typed as the account number, if anything. */
    accountRef: string | null;
    payerName: string | null;
    /** Kenyan mobile number, possibly masked by the statement (2547******678). */
    phone: string | null;
    /** The statement's own description of the line. */
    details: string;
}

export interface ParsedStatement {
    source: StatementSource;
    rows: StatementRow[];
    /** Lines left out: money out, charges, failed or reversed transactions. */
    skipped: number;
    /** Columns it could not find, for a clear message when nothing reads. */
    missing: string[];
}

/** Headings of both statement kinds, so the heading row is found under any title block. */
export const STATEMENT_HEADINGS: ReadonlySet<string> = new Set([
    // M-Pesa organisation portal
    'receiptno', 'completiontime', 'initiationtime', 'details', 'transactionstatus', 'paidin', 'withdrawn', 'balance',
    'balanceconfirmed', 'reasontype', 'otherpartyinfo', 'linkedtransactionid', 'acno', 'accountno',
    // Banks
    'date', 'transactiondate', 'valuedate', 'postingdate', 'bookingdate', 'narration', 'narrative', 'description', 'particulars',
    'credit', 'credits', 'creditamount', 'deposit', 'deposits', 'moneyin', 'debit', 'debits', 'withdrawal', 'withdrawals', 'moneyout',
    'reference', 'referenceno', 'ref', 'refno', 'chequeno', 'transactionreference', 'customerreference', 'amount',
]);

/** Column names each field may go by, most specific first. */
const FIELDS = {
    code: ['receiptno', 'receipt', 'mpesareceipt', 'transactionid', 'transid', 'transactionreference', 'referenceno', 'reference', 'refno', 'ref', 'customerreference', 'chequeno'],
    date: ['completiontime', 'transactiondate', 'valuedate', 'postingdate', 'bookingdate', 'date', 'transactiontime', 'initiationtime'],
    moneyIn: ['paidin', 'credit', 'credits', 'creditamount', 'deposit', 'deposits', 'moneyin', 'amount'],
    moneyOut: ['withdrawn', 'debit', 'debits', 'withdrawal', 'withdrawals', 'moneyout'],
    status: ['transactionstatus', 'status'],
    account: ['acno', 'accountno', 'accountnumber', 'billrefnumber', 'billref', 'account'],
    details: ['details', 'narration', 'narrative', 'description', 'particulars', 'transactiondetails'],
    party: ['otherpartyinfo', 'otherparty', 'payer', 'payername', 'sender', 'sendername', 'customername', 'name'],
    phone: ['msisdn', 'phone', 'phonenumber', 'mobile'],
} as const;

type Field = keyof typeof FIELDS;

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const pad = (n: number) => String(n).padStart(2, '0');

/**
 * A statement's date as YYYY-MM-DD. Kenyan statements write the day first
 * (05/11/2026, 05-Nov-2026); ISO dates (2026-11-05 14:32:10) pass through.
 */
export function statementDate(raw: string): string | null {
    const value = raw.trim();
    let m = value.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (m) return `${m[1]}-${pad(Number(m[2]))}-${pad(Number(m[3]))}`;
    m = value.match(/^(\d{1,2})[-/. ]([A-Za-z]{3})[A-Za-z]*[-/. ,]+(\d{2,4})/);
    if (m && MONTHS[m[2].toLowerCase()]) {
        const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
        return `${year}-${pad(MONTHS[m[2].toLowerCase()])}-${pad(Number(m[1]))}`;
    }
    m = value.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
    if (m) {
        const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
        const [day, month] = Number(m[1]) > 12 || Number(m[2]) <= 12 ? [Number(m[1]), Number(m[2])] : [Number(m[2]), Number(m[1])];
        if (month < 1 || month > 12 || day < 1 || day > 31) return null;
        return `${year}-${pad(month)}-${pad(day)}`;
    }
    return null;
}

/** The time in a statement's date cell ("2026-11-05 14:32:10" → "14:32:10"), or null. */
export function statementTime(raw: string): string | null {
    const m = raw.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i);
    if (!m) return null;
    let hour = Number(m[1]);
    if (m[4]) hour = (hour % 12) + (m[4].toUpperCase() === 'PM' ? 12 : 0);
    if (hour > 23 || Number(m[2]) > 59) return null;
    return `${pad(hour)}:${m[2]}:${m[3] ?? '00'}`;
}

/** When a statement line was paid, in Kenyan time (noon when the statement gives no time). */
export const statementPaidAt = (row: Pick<StatementRow, 'date' | 'time'>): string => `${row.date}T${row.time ?? '12:00:00'}+03:00`;

/** "12,500.00", "KES 1,000", "(200.00)" → a number; blank or text → 0. */
export function statementAmount(raw: string): number {
    const value = raw.replace(/[^0-9.()-]/g, '');
    if (!value) return 0;
    const negative = value.startsWith('-') || value.startsWith('(');
    const n = Number(value.replace(/[()-]/g, ''));
    if (!Number.isFinite(n)) return 0;
    return negative ? -n : n;
}

/**
 * The payer in M-Pesa's "Other Party Info" or "Details": "254712***678 - JOHN
 * DOE", "Pay Bill from 254712345678 - JOHN DOE Acc. 1234", "Merchant
 * Payment from 2547******678 - JANE W".
 */
export function mpesaParty(text: string): { phone: string | null; name: string | null; account: string | null } {
    const account = text.match(/\bAcc(?:ount)?\.?\s*(?:No\.?)?\s*[:#]?\s*([A-Za-z0-9][^\n]*)$/i)?.[1]?.trim() || null;
    const withoutAccount = account ? text.slice(0, text.search(/\bAcc(?:ount)?\.?\s*(?:No\.?)?\s*[:#]?\s*/i)) : text;
    const m = withoutAccount.match(/(\+?\d[\d*]{6,13}\d)\s*-\s*([^\n]+?)\s*$/);
    if (m) return { phone: m[1].replace(/^\+/, ''), name: m[2].trim() || null, account };
    const phone = withoutAccount.match(/(\+?\d[\d*]{8,13}\d)/)?.[1]?.replace(/^\+/, '') ?? null;
    return { phone, name: null, account };
}

/**
 * The statement's payments in, from rows keyed by the file's own headings
 * (see `parseTabularData` with `STATEMENT_HEADINGS`).
 */
export function readStatement(rows: readonly Record<string, string>[], headers: readonly string[]): ParsedStatement {
    const keys = new Map(headers.map(h => [normalizeHeading(h), h]));
    const column = (field: Field): string | null => {
        for (const name of FIELDS[field]) {
            const heading = keys.get(name);
            if (heading) return heading;
        }
        return null;
    };
    const col = Object.fromEntries((Object.keys(FIELDS) as Field[]).map(f => [f, column(f)])) as Record<Field, string | null>;
    const source: StatementSource = keys.has('receiptno') || keys.has('paidin') || keys.has('otherpartyinfo') ? 'MPESA' : 'BANK';
    const missing = (['date', 'moneyIn'] as const).filter(f => !col[f]).map(f => (f === 'date' ? 'date' : 'money in'));
    if (missing.length > 0) return { source, rows: [], skipped: 0, missing };

    const out: StatementRow[] = [];
    let skipped = 0;
    rows.forEach((row, i) => {
        const get = (field: Field) => (col[field] ? (row[col[field]!] ?? '').trim() : '');
        const status = get('status').toLowerCase();
        if (status && status !== 'completed' && status !== 'success' && status !== 'successful') { skipped++; return; }
        // A single "Amount" column carries money out as negatives; "Paid In" and "Credit" are money in only.
        const amount = statementAmount(get('moneyIn'));
        const date = statementDate(get('date'));
        if (!date || amount <= 0) { skipped++; return; }

        const details = get('details');
        const partyText = get('party');
        const party = source === 'MPESA' ? mpesaParty(partyText || details) : { phone: null, name: partyText || null, account: null };
        const fromDetails = source === 'MPESA' && details ? mpesaParty(details) : null;
        out.push({
            line: i + 1,
            date,
            time: statementTime(get('date')),
            amount: Math.round(amount * 100) / 100,
            code: get('code') ? get('code').toUpperCase() : null,
            accountRef: get('account') || party.account || fromDetails?.account || null,
            payerName: party.name || fromDetails?.name || null,
            phone: get('phone') || party.phone || fromDetails?.phone || null,
            details: details || partyText,
        });
    });
    return { source, rows: out, skipped, missing: [] };
}

/** The first and last dates of a statement's payments. */
export function statementPeriod(rows: readonly Pick<StatementRow, 'date'>[]): { from: string | null; to: string | null } {
    if (rows.length === 0) return { from: null, to: null };
    const dates = rows.map(r => r.date).sort();
    return { from: dates[0], to: dates[dates.length - 1] };
}
