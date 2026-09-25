"use client";

import PageHeader from '@/components/dashboard/PageHeader';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Check, Clock3, Copy, Info, Landmark, Receipt, RotateCcw, Smartphone, Wallet } from 'lucide-react';
import EmptyState from '@/components/dashboard/EmptyState';
import { Badge, StatTile } from '@/components/ui';
import { Modal } from '@/components/ui/Modal';
import DataTable, { type DataTableColumn } from '@/components/ui/DataTable';
import { isOverdue, type FeePayment, type PaymentProvider, type SchoolBankAccount } from '@/lib/fees';
import { normalizeMpesaPhone } from '@/lib/phone';
import { humanize } from '@/lib/text';
import { cn } from '@/lib/utils';

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
const receiptUrl = (paymentId: string) => `/api/school/fees/payments/${paymentId}/receipt`;

type PayState = 'form' | 'sending' | 'waiting' | 'success' | 'failed';
type LoadState = 'loading' | 'ready' | 'error';

/** How long to wait for M-Pesa / Pesapal to confirm before handing back to the student. */
const CONFIRM_TIMEOUT_MS = 90_000;
const POLL_EVERY_MS = 3_000;

export default function StudentFeesPage() {
    const [fees, setFees] = useState<FeeRecord[]>([]);
    const [loadState, setLoadState] = useState<LoadState>('loading');
    const [historyFee, setHistoryFee] = useState<FeeRecord | null>(null);
    const [historyPayments, setHistoryPayments] = useState<FeePayment[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [paymentProvider, setPaymentProvider] = useState<PaymentProvider>('NONE');
    const [bankAccounts, setBankAccounts] = useState<SchoolBankAccount[]>([]);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const [payingFee, setPayingFee] = useState<FeeRecord | null>(null);
    const [payPhone, setPayPhone] = useState('');
    const [payAmount, setPayAmount] = useState('');
    const [payState, setPayState] = useState<PayState>('form');
    const [payError, setPayError] = useState('');
    const [paidPaymentId, setPaidPaymentId] = useState<string | null>(null);
    const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
    const pesapalWindow = useRef<Window | null>(null);

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

    const stopPolling = () => {
        if (pollTimer.current) clearInterval(pollTimer.current);
        pollTimer.current = null;
    };

    useEffect(() => {
        fetchFees();
        fetch('/api/school/payment-settings/status')
            .then(r => r.json())
            .then((j: { data?: { provider?: PaymentProvider; bankAccounts?: SchoolBankAccount[] } }) => {
                setPaymentProvider(j.data?.provider || 'NONE');
                setBankAccounts(j.data?.bankAccounts || []);
            })
            .catch(() => {});
        return stopPolling;
    }, [fetchFees]);

    const openHistory = async (fee: FeeRecord) => {
        setHistoryFee(fee);
        setHistoryLoading(true);
        try {
            const res = await fetch(`/api/school/fees/${fee.id}/payments`, { cache: 'no-store' });
            const json: { data?: FeePayment[] } = await res.json();
            setHistoryPayments(json.data || []);
        } catch {
            setHistoryPayments([]);
        }
        setHistoryLoading(false);
    };

    const openPay = (fee: FeeRecord) => {
        stopPolling();
        setPayingFee(fee);
        setPayPhone('');
        // M-Pesa moves whole shillings; offer the balance rounded up.
        setPayAmount(String(Math.max(1, Math.ceil(fee.balance))));
        setPayState('form');
        setPayError('');
        setPaidPaymentId(null);
    };

    const closePay = () => {
        const wasWaiting = payState === 'waiting';
        stopPolling();
        if (pesapalWindow.current && !pesapalWindow.current.closed) pesapalWindow.current.close();
        setPayingFee(null);
        // A payment finished on the phone after the dialog closed still lands in
        // the ledger; refresh so the balance catches up without a reload.
        if (wasWaiting) window.setTimeout(fetchFees, 5_000);
    };

    const pollUntilResolved = (statusUrl: string) => {
        stopPolling();
        const deadline = Date.now() + CONFIRM_TIMEOUT_MS;
        pollTimer.current = setInterval(async () => {
            try {
                const statusRes = await fetch(statusUrl, { cache: 'no-store' });
                const statusJson: { data?: { status?: string; notes?: string | null; id?: string } } = await statusRes.json();
                const status = statusJson.data?.status;
                if (status === 'COMPLETED') {
                    stopPolling();
                    setPaidPaymentId(statusJson.data?.id ?? null);
                    setPayState('success');
                    await fetchFees();
                } else if (status === 'FAILED' || status === 'CANCELLED') {
                    stopPolling();
                    setPayState('failed');
                    setPayError(statusJson.data?.notes || 'The payment was not completed.');
                } else if (Date.now() > deadline) {
                    stopPolling();
                    setPayState('failed');
                    setPayError('We haven\'t had confirmation yet. If you completed the payment, it will still be recorded — check back in a few minutes before paying again.');
                    fetchFees();
                }
            } catch {
                // A network blip: keep polling until the deadline.
            }
        }, POLL_EVERY_MS);
    };

    /** Validates the form; returns the whole-shilling amount, or null after setting an error. */
    const validAmount = (): number | null => {
        const amountValue = Math.round(Number(payAmount));
        if (!payAmount || isNaN(amountValue) || amountValue < 1) {
            setPayError('Enter an amount of at least KSh 1.');
            return null;
        }
        return amountValue;
    };

    const submitStkPush = async () => {
        if (!payingFee) return;
        if (!normalizeMpesaPhone(payPhone)) {
            setPayError('Enter the Safaricom number to pay from, like 0712 345 678.');
            return;
        }
        const amountValue = validAmount();
        if (amountValue === null) return;

        setPayState('sending');
        setPayError('');
        try {
            const res = await fetch('/api/mpesa/stkpush', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ student_fee_id: payingFee.id, phone_number: payPhone.trim(), amount: amountValue }),
            });
            const json: { data?: { checkoutRequestId: string }; error?: string } = await res.json();
            if (!res.ok || !json.data) {
                setPayState('failed');
                setPayError(json.error || 'We couldn\'t send the M-Pesa prompt.');
                return;
            }
            setPayState('waiting');
            pollUntilResolved(`/api/mpesa/stkpush/status?checkout_request_id=${json.data.checkoutRequestId}`);
        } catch (err) {
            setPayState('failed');
            setPayError(err instanceof Error ? err.message : 'We couldn\'t send the M-Pesa prompt.');
        }
    };

    const submitPesapalCheckout = async () => {
        if (!payingFee) return;
        if (payPhone.trim() && !normalizeMpesaPhone(payPhone)) {
            setPayError('That phone number doesn\'t look right. Leave it empty or use a format like 0712 345 678.');
            return;
        }
        const amountValue = validAmount();
        if (amountValue === null) return;

        // Open the tab synchronously (within the click's user-gesture context) so
        // Safari/popup blockers don't swallow it once we're past the await below.
        const win = window.open('', '_blank');
        pesapalWindow.current = win;

        setPayState('sending');
        setPayError('');
        try {
            const res = await fetch('/api/pesapal/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ student_fee_id: payingFee.id, amount: amountValue, phone_number: payPhone.trim() || undefined }),
            });
            const json: { data?: { redirectUrl: string; orderTrackingId: string }; error?: string } = await res.json();
            if (!res.ok || !json.data) {
                if (win) win.close();
                setPayState('failed');
                setPayError(json.error || 'We couldn\'t start the Pesapal checkout.');
                return;
            }
            if (win) win.location.href = json.data.redirectUrl;
            else window.open(json.data.redirectUrl, '_blank');

            setPayState('waiting');
            pollUntilResolved(`/api/pesapal/status?order_tracking_id=${json.data.orderTrackingId}`);
        } catch (err) {
            if (win) win.close();
            setPayState('failed');
            setPayError(err instanceof Error ? err.message : 'We couldn\'t start the Pesapal checkout.');
        }
    };

    const submitPayment = paymentProvider === 'PESAPAL' ? submitPesapalCheckout : submitStkPush;

    const copyAccountNumber = (account: SchoolBankAccount) => {
        navigator.clipboard.writeText(account.accountNumber).then(() => {
            setCopiedId(account.id);
            setTimeout(() => setCopiedId(current => (current === account.id ? null : current)), 2000);
        }).catch(() => {});
    };

    const totalBilled = fees.reduce((sum, f) => sum + f.totalFee, 0);
    const totalPaid = fees.reduce((sum, f) => sum + f.paidAmount, 0);
    // Owed and credit are kept apart: an overpaid term must not hide a term still owing.
    const owed = fees.reduce((sum, f) => sum + Math.max(0, f.balance), 0);
    const credit = fees.reduce((sum, f) => sum + Math.max(0, -f.balance), 0);
    const overdueCount = fees.filter(f => isOverdue(f.dueDate, f.balance)).length;
    const termCount = fees.length;
    const canPayOnline = paymentProvider !== 'NONE';

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
            key: 'dueDate', header: 'Due', hideOnMobile: true,
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
              icon={Wallet}
              hue="emerald"
              description="Your fee balance and payment history, term by term. Tap a term for its receipts."
            />

            <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
                <StatTile
                    icon={owed > 0 ? AlertTriangle : CheckCircle2}
                    label="Balance to pay"
                    value={formatCurrency(owed)}
                    hint={owed === 0 ? (credit > 0 ? `${formatCurrency(credit)} in credit` : 'All settled') : overdueCount > 0 ? `${overdueCount} term${overdueCount === 1 ? '' : 's'} overdue` : 'Not yet overdue'}
                    tone={owed === 0 ? 'good' : overdueCount > 0 ? 'bad' : 'warn'}
                    className="col-span-2 lg:col-span-1"
                />
                <StatTile icon={Wallet} hue="blue" label="Total billed" value={formatCurrency(totalBilled)} hint={`${termCount} term${termCount === 1 ? '' : 's'} on record`} />
                <StatTile icon={Clock3} label="Total paid" value={formatCurrency(totalPaid)} hint="settled so far" tone="good" />
            </div>

            {/* How to pay: always answered, whether or not online payment is set up. */}
            {loadState === 'ready' && owed > 0 && !canPayOnline && bankAccounts.length === 0 && (
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
                        <button type="button" className="btn-primary h-8 rounded-lg px-3 text-xs" onClick={() => openPay(fee)} aria-label={`Pay ${fee.termName ?? 'this term'} fees`}>
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
                                <button type="button" className="btn-primary h-9 shrink-0 text-xs" onClick={() => { const fee = historyFee; setHistoryFee(null); openPay(fee); }}>
                                    <Smartphone className="size-3.5" aria-hidden="true" />Pay {formatCurrency(historyFee.balance)}
                                </button>
                            )}
                        </div>
                        {historyLoading ? (
                            <div className="space-y-2" aria-hidden="true">
                                {Array.from({ length: 3 }, (_, i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-muted/60" />)}
                            </div>
                        ) : historyPayments.filter(p => p.status === 'COMPLETED').length === 0 ? (
                            <p className="py-8 text-center text-sm text-muted-foreground">No payments recorded for this term yet.</p>
                        ) : (
                            <div className="overflow-hidden rounded-xl border border-border/70">
                                <div className="w-full overflow-x-auto">
                                    <table className="data-table">
                                        <thead>
                                            <tr>
                                                <th>Date</th>
                                                <th>Method</th>
                                                <th>Amount</th>
                                                <th>Reference</th>
                                                <th><span className="sr-only">Receipt</span></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {/* Only money that actually arrived: voided, failed and still-pending prompts are not payments. */}
                                            {historyPayments.filter(p => p.status === 'COMPLETED').map(p => (
                                                <tr key={p.id}>
                                                    <td data-label="Date" className="text-xs">{formatDay(p.paidAt)}</td>
                                                    <td data-label="Method">{methodLabel(p.method)}</td>
                                                    <td data-label="Amount" className="font-semibold">{formatCurrency(p.amount)}</td>
                                                    <td data-label="Reference" className="font-mono text-xs">{p.mpesaReceiptNumber || p.pesapalConfirmationCode || p.receiptNumber}</td>
                                                    <td data-label="" className="text-right">
                                                        <a className="btn-secondary h-8 rounded-lg px-3 text-xs" href={receiptUrl(p.id)} target="_blank" rel="noreferrer">
                                                            <Receipt className="size-3.5" aria-hidden="true" />Receipt
                                                        </a>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </Modal>

            <Modal isOpen={!!payingFee} onClose={closePay} title={paymentProvider === 'PESAPAL' ? 'Pay fees' : 'Pay with M-Pesa'}>
                {payingFee && (
                    <div className="flex flex-col gap-4">
                        <div className="rounded-xl bg-muted/40 p-3 text-sm">
                            <div className="font-semibold">{payingFee.termName}</div>
                            <div className="text-xs text-muted-foreground">Balance {formatCurrency(payingFee.balance)}</div>
                        </div>

                        {payState === 'form' || payState === 'sending' ? (
                            <>
                                <div>
                                    <label htmlFor="pay-phone" className="mb-2 block text-xs font-semibold text-muted-foreground">
                                        {paymentProvider === 'PESAPAL' ? 'Phone number (optional)' : 'M-Pesa phone number'}
                                    </label>
                                    <input id="pay-phone" type="tel" inputMode="tel" autoComplete="tel" value={payPhone} onChange={e => setPayPhone(e.target.value)} placeholder="0712 345 678" className="input-field w-full" />
                                    {paymentProvider !== 'PESAPAL' && (
                                        <p className="mt-1 text-[11px] text-muted-foreground">You&apos;ll get a prompt on this phone to enter your M-Pesa PIN.</p>
                                    )}
                                </div>
                                <div>
                                    <label htmlFor="pay-amount" className="mb-2 block text-xs font-semibold text-muted-foreground">Amount (KSh)</label>
                                    <input id="pay-amount" type="number" inputMode="numeric" min="1" step="1" value={payAmount} onChange={e => setPayAmount(e.target.value)} className="input-field w-full" />
                                    <p className="mt-1 text-[11px] text-muted-foreground">Whole shillings. You can pay part of the balance.</p>
                                </div>
                                {payError && <p role="alert" className="text-sm text-destructive">{payError}</p>}
                                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                                    <button type="button" className="btn-secondary" onClick={closePay}>Cancel</button>
                                    <button type="button" className="btn-primary" onClick={submitPayment} disabled={payState === 'sending'}>
                                        {payState === 'sending'
                                            ? (paymentProvider === 'PESAPAL' ? 'Opening checkout…' : 'Sending prompt…')
                                            : (paymentProvider === 'PESAPAL' ? 'Continue to checkout' : 'Send M-Pesa prompt')}
                                    </button>
                                </div>
                            </>
                        ) : payState === 'waiting' ? (
                            <div className="py-6 text-center" role="status">
                                <span className="mx-auto mb-3 block size-8 animate-spin rounded-full border-2 border-primary/30 border-t-primary" aria-hidden="true" />
                                {paymentProvider === 'PESAPAL' ? (
                                    <>
                                        <p className="mb-1 text-sm font-medium">Complete payment in the new tab</p>
                                        <p className="text-sm text-muted-foreground">Finish paying on the Pesapal page, then come back here. This updates automatically.</p>
                                    </>
                                ) : (
                                    <>
                                        <p className="mb-1 text-sm font-medium">Check your phone</p>
                                        <p className="text-sm text-muted-foreground">Enter your M-Pesa PIN on the prompt sent to {payPhone}. This updates automatically.</p>
                                    </>
                                )}
                            </div>
                        ) : payState === 'success' ? (
                            <div className="py-6 text-center" role="status">
                                <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-emerald-600" aria-hidden="true" />
                                <p className="mb-1 text-sm font-medium">Payment received</p>
                                <p className="text-sm text-muted-foreground">Your balance has been updated.</p>
                                <div className="mt-4 flex justify-center gap-2">
                                    {paidPaymentId && (
                                        <a className="btn-secondary" href={receiptUrl(paidPaymentId)} target="_blank" rel="noreferrer">
                                            <Receipt className="size-4" aria-hidden="true" />View receipt
                                        </a>
                                    )}
                                    <button type="button" className="btn-primary" onClick={closePay}>Done</button>
                                </div>
                            </div>
                        ) : (
                            <div className="py-6 text-center" role="alert">
                                <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-destructive" aria-hidden="true" />
                                <p className="mb-1 text-sm font-medium">Payment not completed</p>
                                <p className="text-sm text-muted-foreground">{payError}</p>
                                <div className="mt-4 flex justify-center gap-2">
                                    <button type="button" className="btn-secondary" onClick={closePay}>Close</button>
                                    <button type="button" className="btn-primary" onClick={() => setPayState('form')}>Try again</button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </Modal>
        </div>
    );
}
