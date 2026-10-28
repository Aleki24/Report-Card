"use client";

import PageHeader from '@/components/dashboard/PageHeader';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Check, Clock3, Copy, Info, Landmark, Receipt, RotateCcw, Smartphone, Wallet } from 'lucide-react';
import EmptyState from '@/components/dashboard/EmptyState';
import { Badge, StatTile } from '@/components/ui';
import { Modal } from '@/components/ui/Modal';
import DataTable, { type DataTableColumn } from '@/components/ui/DataTable';
import { isOverdue, totalCredit, totalOwed, type FeePayment, type PaymentProvider, type SchoolBankAccount } from '@/lib/fees';
import { feeReceiptUrl } from '@/lib/fee-account';
import { PayOnlineDialog } from '@/components/fees/PayOnlineDialog';
import { humanize } from '@/lib/text';
import { cn } from '@/lib/utils';
import { FEATURE_ICONS } from '@/components/ui/featureIcons';

type FeeStatus = 'PENDING' | 'PARTIAL' | 'PAID' | 'OVERPAID';

interface FeeRecord {
    id: string;
    totalFee: number;
    paidAmount: number;
    balance: number;
    dueDate: string | null;
    status: FeeStatus;
    notes: string | null;
    termName: string | null;
}

const STATUS_META: Record<FeeStatus, { label: string; variant: 'success' | 'warning' | 'info' }> = {
    PENDING: { label: 'Pending', variant: 'warning' },
    PARTIAL: { label: 'Partial', variant: 'info' },
    PAID: { label: 'Paid', variant: 'success' },
    OVERPAID: { label: 'In credit', variant: 'info' },
};

function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}

/** "1 Sept 2025" from a YYYY-MM-DD date, read as a local calendar day. */
function formatDay(value: string | null): string {
    if (!value) return '—';
    const [y, m, d] = value.slice(0, 10).split('-').map(Number);
    if (!y || !m || !d) return '—';
    return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const methodLabel = (m: string) => (m === 'MPESA' ? 'M-Pesa' : humanize(m));
const receiptUrl = feeReceiptUrl;

type LoadState = 'loading' | 'ready' | 'error';


export default function StudentFeesPage() {
    const [fees, setFees] = useState<FeeRecord[]>([]);
    const [loadState, setLoadState] = useState<LoadState>('loading');
    const [historyFee, setHistoryFee] = useState<FeeRecord | null>(null);
    const [historyPayments, setHistoryPayments] = useState<FeePayment[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyError, setHistoryError] = useState(false);
    const historyRequest = useRef(0);
    const [paymentProvider, setPaymentProvider] = useState<PaymentProvider>('NONE');
    const [bankAccounts, setBankAccounts] = useState<SchoolBankAccount[]>([]);
    // Until the school's payment options are known, the page must not say
    // "your school hasn't set up online payment".
    const [settingsKnown, setSettingsKnown] = useState(false);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const [payingFee, setPayingFee] = useState<FeeRecord | null>(null);

    const fetchFees = useCallback(async () => {
        try {
            const res = await fetch('/api/school/fees', { cache: 'no-store' });
            if (!res.ok) throw new Error(String(res.status));
            const json: { data?: FeeRecord[] } = await res.json();
            setFees(json.data || []);
            setLoadState('ready');
        } catch {
            setLoadState(state => (state === 'ready' ? 'ready' : 'error'));
        }
    }, []);

    useEffect(() => {
        fetchFees();
        fetch('/api/school/payment-settings/status')
            .then(r => r.json())
            .then((j: { data?: { provider?: PaymentProvider; bankAccounts?: SchoolBankAccount[] } }) => {
                setPaymentProvider(j.data?.provider || 'NONE');
                setBankAccounts(j.data?.bankAccounts || []);
                setSettingsKnown(true);
            })
            .catch(() => {});
    }, [fetchFees]);

    // Only the term opened last may fill the list: a slow answer for an
    // earlier term used to show its receipts under this term's name.
    const openHistory = async (fee: FeeRecord) => {
        const request = ++historyRequest.current;
        setHistoryFee(fee);
        setHistoryLoading(true);
        setHistoryError(false);
        setHistoryPayments([]);
        try {
            const res = await fetch(`/api/school/fees/${fee.id}/payments`, { cache: 'no-store' });
            if (!res.ok) throw new Error(String(res.status));
            const json: { data?: FeePayment[] } = await res.json();
            if (request !== historyRequest.current) return;
            setHistoryPayments(json.data || []);
        } catch {
            if (request !== historyRequest.current) return;
            setHistoryError(true);
        }
        setHistoryLoading(false);
    };


    const copyAccountNumber = (account: SchoolBankAccount) => {
        navigator.clipboard.writeText(account.accountNumber).then(() => {
            setCopiedId(account.id);
            setTimeout(() => setCopiedId(current => (current === account.id ? null : current)), 2000);
        }).catch(() => {});
    };

    const totalBilled = fees.reduce((sum, f) => sum + f.totalFee, 0);
    const totalPaid = fees.reduce((sum, f) => sum + f.paidAmount, 0);
    // Owed and credit are kept apart: an overpaid term must not hide a term still owing.
    const owed = totalOwed(fees);
    const credit = totalCredit(fees);
    const overdueCount = fees.filter(f => isOverdue(f.dueDate, f.balance)).length;
    const termCount = fees.length;
    const canPayOnline = paymentProvider !== 'NONE';
    // Until the fees have loaded the totals are unknown, not zero: "KES 0 · All
    // settled" told learners who owe that they owed nothing.
    const ready = loadState === 'ready';
    const amount = (n: number) => (ready ? formatCurrency(n) : '—');
    const pendingHint = loadState === 'loading' ? 'Loading…' : 'Not loaded';

    const columns: DataTableColumn<FeeRecord>[] = [
        { key: 'termName', header: 'Term', render: f => <span className="font-semibold text-foreground">{f.termName || '—'}</span> },
        { key: 'totalFee', header: 'Billed', numeric: true, render: f => <span className="text-muted-foreground">{formatCurrency(f.totalFee)}</span> },
        { key: 'paidAmount', header: 'Paid', numeric: true, render: f => <span className="text-muted-foreground">{formatCurrency(f.paidAmount)}</span> },
        {
            key: 'balance', header: 'Balance', numeric: true,
            render: f => (
                <span className={cn('font-bold', f.balance > 0 ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400')}>
                    {f.balance < 0 ? `${formatCurrency(-f.balance)} credit` : formatCurrency(f.balance)}
                </span>
            ),
        },
        {
            key: 'dueDate', header: 'Due',
            render: f => (
                <span className={cn(isOverdue(f.dueDate, f.balance) ? 'font-semibold text-destructive' : 'text-muted-foreground')}>
                    {formatDay(f.dueDate)}{isOverdue(f.dueDate, f.balance) ? ' · overdue' : ''}
                </span>
            ),
        },
        { key: 'status', header: 'Status', render: f => <Badge variant={STATUS_META[f.status]?.variant ?? 'warning'}>{STATUS_META[f.status]?.label ?? f.status}</Badge> },
    ];

    return (
        <div className="mx-auto w-full max-w-[1100px] pb-10">
            <PageHeader
              title="Fees"
              eyebrow="Finance"
              icon={FEATURE_ICONS.fees}
              hue="emerald"
              description="Your fee balance and payment history, term by term. Tap a term for its receipts."
            />

            <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
                <StatTile
                    icon={!ready ? Wallet : owed > 0 ? AlertTriangle : CheckCircle2}
                    label="Balance to pay"
                    value={amount(owed)}
                    hint={!ready ? pendingHint : owed === 0 ? (credit > 0 ? `${formatCurrency(credit)} in credit` : 'All settled') : overdueCount > 0 ? `${overdueCount} term${overdueCount === 1 ? '' : 's'} overdue` : 'Not yet overdue'}
                    tone={!ready ? 'default' : owed === 0 ? 'good' : overdueCount > 0 ? 'bad' : 'warn'}
                    className="col-span-2 lg:col-span-1"
                />
                <StatTile icon={Wallet} hue="blue" label="Total billed" value={amount(totalBilled)} hint={ready ? `${termCount} term${termCount === 1 ? '' : 's'} on record` : pendingHint} />
                <StatTile icon={Clock3} label="Total paid" value={amount(totalPaid)} hint={ready ? 'settled so far' : pendingHint} tone={ready ? 'good' : 'default'} />
            </div>

            {/* How to pay: always answered, whether or not online payment is set up. */}
            {loadState === 'ready' && settingsKnown && owed > 0 && !canPayOnline && bankAccounts.length === 0 && (
                <div className="mb-5 flex items-start gap-3 rounded-2xl border border-border/70 bg-card p-4 text-sm shadow-sm">
                    <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                    <p>
                        <span className="font-semibold">How to pay:</span>{' '}
                        <span className="text-muted-foreground">your school hasn&apos;t set up online payment yet. Pay at the school office or bursar, and your balance here updates once they record it.</span>
                    </p>
                </div>
            )}

            {bankAccounts.length > 0 && (
                <section className="mb-5 rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
                    <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold">
                        <Landmark className="size-4 text-primary" aria-hidden="true" />Pay by bank transfer
                    </h2>
                    <p className="mb-3 text-xs text-muted-foreground">
                        Deposit or transfer into one of these accounts and keep the slip or reference. Your school records it once it clears.
                    </p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {bankAccounts.map(a => (
                            <div key={a.id} className="rounded-xl border border-border/60 p-3">
                                <div className="text-sm font-semibold">{a.bankName}{a.isPrimary && bankAccounts.length > 1 ? ' (preferred)' : ''}</div>
                                <div className="mt-1 text-xs text-muted-foreground">{a.accountName}{a.branch ? ` · ${a.branch}` : ''}</div>
                                <div className="mt-2 flex items-center gap-2">
                                    <span className="font-mono text-sm font-bold">{a.accountNumber}</span>
                                    <button
                                        type="button"
                                        className="btn-icon text-muted-foreground hover:text-foreground"
                                        onClick={() => copyAccountNumber(a)}
                                        title="Copy account number"
                                        aria-label={copiedId === a.id ? 'Account number copied' : `Copy ${a.bankName} account number`}
                                    >
                                        {copiedId === a.id ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {loadState === 'error' ? (
                <div role="alert" className="flex flex-col items-center rounded-2xl border border-dashed border-border px-6 py-12 text-center">
                    <AlertTriangle className="mb-3 size-6 text-destructive" aria-hidden="true" />
                    <p className="font-semibold">We couldn&apos;t load your fees</p>
                    <p className="mt-1 text-sm text-muted-foreground">Check your connection and try again.</p>
                    <button type="button" className="btn-secondary mt-4" onClick={() => { setLoadState('loading'); fetchFees(); }}>
                        <RotateCcw className="size-4" aria-hidden="true" />Try again
                    </button>
                </div>
            ) : (
                <DataTable
                    columns={columns}
                    rows={fees}
                    rowKey={f => f.id}
                    loading={loadState === 'loading'}
                    mobileTitleKey="termName"
                    onRowClick={openHistory}
                    rowActions={canPayOnline ? (fee => fee.balance > 0 ? (
                        <button type="button" className="btn-primary h-10 rounded-lg px-3 text-xs sm:h-8" onClick={() => setPayingFee(fee)} aria-label={`Pay ${fee.termName ?? 'this term'} fees`}>
                            <Smartphone className="size-3.5" aria-hidden="true" />Pay
                        </button>
                    ) : null) : undefined}
                    emptyState={<EmptyState icon={<Wallet className="h-6 w-6" />} title="No fee records yet" description="Your school hasn't billed any fees to your account yet." />}
                />
            )}

            <Modal isOpen={!!historyFee} onClose={() => setHistoryFee(null)} title="Payment history" size="lg">
                {historyFee && (
                    <div>
                        <div className="mb-4 flex flex-col gap-3 rounded-xl bg-muted/40 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <div className="font-semibold">{historyFee.termName}</div>
                                <div className="text-xs text-muted-foreground">
                                    {formatCurrency(historyFee.paidAmount)} of {formatCurrency(historyFee.totalFee)} paid
                                    {historyFee.dueDate ? ` · due ${formatDay(historyFee.dueDate)}` : ''}
                                </div>
                            </div>
                            {canPayOnline && historyFee.balance > 0 && (
                                <button type="button" className="btn-primary h-9 shrink-0 text-xs" onClick={() => { const fee = historyFee; setHistoryFee(null); setPayingFee(fee); }}>
                                    <Smartphone className="size-3.5" aria-hidden="true" />Pay {formatCurrency(historyFee.balance)}
                                </button>
                            )}
                        </div>
                        {historyLoading ? (
                            <div className="space-y-2" aria-hidden="true">
                                {Array.from({ length: 3 }, (_, i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-muted/60" />)}
                            </div>
                        ) : historyError ? (
                            <div role="alert" className="flex flex-col items-center gap-3 py-8 text-center text-sm">
                                <p className="text-muted-foreground">We couldn&apos;t load the payments for this term.</p>
                                <button type="button" className="btn-secondary" onClick={() => void openHistory(historyFee)}>
                                    <RotateCcw className="size-4" aria-hidden="true" />Try again
                                </button>
                            </div>
                        ) : historyPayments.filter(p => p.status === 'COMPLETED').length === 0 ? (
                            <p className="py-8 text-center text-sm text-muted-foreground">No payments recorded for this term yet.</p>
                        ) : (
                            // A list, not a five-column table: on phones the Receipt button sat off-screen.
                            <ul className="flex flex-col divide-y divide-border/60 overflow-hidden rounded-xl border border-border/70">
                                {/* Only money that actually arrived: voided, failed and still-pending prompts are not payments. */}
                                {historyPayments.filter(p => p.status === 'COMPLETED').map(p => (
                                    <li key={p.id} className="flex items-center gap-3 px-3 py-3 sm:px-4">
                                        <div className="min-w-0 flex-1">
                                            <p className="font-semibold tabular-nums">{formatCurrency(p.amount)}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {formatDay(p.paidAt)} · {methodLabel(p.method)}
                                                <span className="block font-mono wrap-anywhere">{p.mpesaReceiptNumber || p.pesapalConfirmationCode || p.receiptNumber}</span>
                                            </p>
                                        </div>
                                        <a className="btn-secondary h-10 shrink-0 rounded-lg px-3 text-xs" href={receiptUrl(p.id)} target="_blank" rel="noreferrer">
                                            <Receipt className="size-3.5" aria-hidden="true" />Receipt
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}
            </Modal>

            <PayOnlineDialog
                fee={payingFee}
                provider={paymentProvider}
                onClose={() => setPayingFee(null)}
                onSettled={() => void fetchFees()}
            />
        </div>
    );
}
