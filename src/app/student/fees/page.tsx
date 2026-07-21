"use client";

import React, { useEffect, useState, useRef } from 'react';
import { Wallet, CheckCircle2, Clock3, AlertTriangle, Receipt, Smartphone } from 'lucide-react';
import PageHeader from '@/components/dashboard/PageHeader';
import StatCard from '@/components/dashboard/StatCard';
import EmptyState from '@/components/dashboard/EmptyState';
import { Badge } from '@/components/ui';
import { Modal } from '@/components/ui/Modal';
import DataTable, { type DataTableColumn } from '@/components/ui/DataTable';
import { isOverdue, type FeePayment } from '@/lib/fees';

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
    OVERPAID: { label: 'Overpaid', variant: 'info' },
};

function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}

type PayState = 'form' | 'sending' | 'waiting' | 'success' | 'failed';

export default function StudentFeesPage() {
    const [fees, setFees] = useState<FeeRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [historyFee, setHistoryFee] = useState<FeeRecord | null>(null);
    const [historyPayments, setHistoryPayments] = useState<FeePayment[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [mpesaActive, setMpesaActive] = useState(false);

    const [payingFee, setPayingFee] = useState<FeeRecord | null>(null);
    const [payPhone, setPayPhone] = useState('');
    const [payAmount, setPayAmount] = useState('');
    const [payState, setPayState] = useState<PayState>('form');
    const [payError, setPayError] = useState('');
    const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
    const pollDeadline = useRef<number>(0);

    const fetchFees = () => fetch('/api/school/fees').then(r => r.json()).then(j => setFees(j.data || [])).catch(() => {});

    useEffect(() => {
        fetchFees().finally(() => setLoading(false));
        fetch('/api/school/payment-settings/status').then(r => r.json()).then(j => setMpesaActive(!!j.data?.active)).catch(() => {});
        return () => { if (pollTimer.current) clearInterval(pollTimer.current); };
    }, []);

    const openHistory = async (fee: FeeRecord) => {
        setHistoryFee(fee);
        setHistoryLoading(true);
        try {
            const res = await fetch(`/api/school/fees/${fee.id}/payments`);
            const json = await res.json();
            setHistoryPayments(json.data || []);
        } catch {
            setHistoryPayments([]);
        }
        setHistoryLoading(false);
    };

    const openPay = (fee: FeeRecord) => {
        setPayingFee(fee);
        setPayPhone('');
        setPayAmount(String(fee.balance));
        setPayState('form');
        setPayError('');
    };

    const closePay = () => {
        if (pollTimer.current) clearInterval(pollTimer.current);
        setPayingFee(null);
    };

    const submitStkPush = async () => {
        if (!payingFee) return;
        const amountValue = parseFloat(payAmount);
        if (!payPhone.trim()) { setPayError('Enter the M-Pesa phone number to pay from.'); return; }
        if (!payAmount || isNaN(amountValue) || amountValue <= 0) { setPayError('Enter a valid amount.'); return; }

        setPayState('sending');
        setPayError('');
        try {
            const res = await fetch('/api/mpesa/stkpush', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ student_fee_id: payingFee.id, phone_number: payPhone.trim(), amount: amountValue }),
            });
            const json = await res.json();
            if (!res.ok) {
                setPayState('failed');
                setPayError(json.error || 'Failed to send the M-Pesa prompt.');
                return;
            }

            setPayState('waiting');
            const checkoutRequestId = json.data.checkoutRequestId;
            pollDeadline.current = Date.now() + 90_000;
            pollTimer.current = setInterval(async () => {
                try {
                    const statusRes = await fetch(`/api/mpesa/stkpush/status?checkout_request_id=${checkoutRequestId}`);
                    const statusJson = await statusRes.json();
                    const status = statusJson.data?.status;
                    if (status === 'COMPLETED') {
                        if (pollTimer.current) clearInterval(pollTimer.current);
                        setPayState('success');
                        await fetchFees();
                    } else if (status === 'FAILED' || status === 'CANCELLED') {
                        if (pollTimer.current) clearInterval(pollTimer.current);
                        setPayState('failed');
                        setPayError(statusJson.data?.notes || 'The M-Pesa payment was not completed.');
                    } else if (Date.now() > pollDeadline.current) {
                        if (pollTimer.current) clearInterval(pollTimer.current);
                        setPayState('failed');
                        setPayError('Timed out waiting for confirmation. If you completed it on your phone, it will still be recorded shortly.');
                    }
                } catch {
                    // transient network hiccup — keep polling until the deadline
                }
            }, 3000);
        } catch (err) {
            setPayState('failed');
            setPayError(err instanceof Error ? err.message : 'Failed to send the M-Pesa prompt.');
        }
    };

    const totalBilled = fees.reduce((sum, f) => sum + f.totalFee, 0);
    const totalPaid = fees.reduce((sum, f) => sum + f.paidAmount, 0);
    const totalBalance = fees.reduce((sum, f) => sum + f.balance, 0);
    const overdueCount = fees.filter(f => isOverdue(f.dueDate, f.balance)).length;

    const columns: DataTableColumn<FeeRecord>[] = [
        { key: 'termName', header: 'Term', render: f => <span className="font-semibold text-foreground">{f.termName || '—'}</span> },
        { key: 'totalFee', header: 'Billed', numeric: true, render: f => <span className="text-muted-foreground">{formatCurrency(f.totalFee)}</span> },
        { key: 'paidAmount', header: 'Paid', numeric: true, render: f => <span className="text-muted-foreground">{formatCurrency(f.paidAmount)}</span> },
        {
            key: 'balance', header: 'Balance', numeric: true,
            render: f => <span className={`font-bold ${f.balance > 0 ? 'text-destructive' : 'text-emerald-600'}`}>{formatCurrency(f.balance)}</span>,
        },
        {
            key: 'dueDate', header: 'Due Date', hideOnMobile: true,
            render: f => <span className="text-muted-foreground">{f.dueDate ? new Date(f.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</span>,
        },
        { key: 'status', header: 'Status', render: f => <Badge variant={STATUS_META[f.status]?.variant ?? 'warning'}>{STATUS_META[f.status]?.label ?? f.status}</Badge> },
    ];

    return (
        <div className="w-full mx-auto max-w-[1100px] pb-10">
            <PageHeader title="Fees" description="Your fee balance and payment history, term by term." />

            <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <StatCard label="Total Billed" value={formatCurrency(totalBilled)} sub="This year" icon={Wallet} iconClassName="bg-primary/12 text-primary" />
                <StatCard label="Total Paid" value={formatCurrency(totalPaid)} sub="Settled so far" icon={CheckCircle2} iconClassName="bg-emerald-500/12 text-emerald-600" />
                <StatCard
                    label="Outstanding Balance"
                    value={formatCurrency(totalBalance)}
                    sub={overdueCount > 0 ? `${overdueCount} overdue` : totalBalance > 0 ? 'Not yet due' : 'All settled'}
                    icon={totalBalance > 0 ? AlertTriangle : Clock3}
                    iconClassName={totalBalance > 0 ? 'bg-red-500/12 text-red-600' : 'bg-emerald-500/12 text-emerald-600'}
                />
            </div>

            <DataTable
                columns={columns}
                rows={fees}
                rowKey={f => f.id}
                loading={loading}
                mobileTitleKey="termName"
                onRowClick={openHistory}
                rowActions={mpesaActive ? (fee => fee.balance > 0 ? (
                    <button className="btn-primary" style={{ height: 32, fontSize: 12 }} onClick={() => openPay(fee)}>
                        <Smartphone size={13} /> Pay
                    </button>
                ) : null) : undefined}
                emptyState={<EmptyState icon={<Wallet className="h-6 w-6" />} title="No fee records yet" description="Your school hasn't billed any fees to your account yet." />}
            />
            {fees.length > 0 && !loading && (
                <p className="mt-2 text-xs text-muted-foreground">Tap a row to see payment history and download receipts.</p>
            )}

            <Modal isOpen={!!historyFee} onClose={() => setHistoryFee(null)} title="Payment History" size="lg">
                {historyFee && (
                    <div>
                        <div className="mb-4 rounded-xl bg-muted/40 p-3 text-sm">
                            <div className="font-semibold">{historyFee.termName}</div>
                            <div className="text-xs text-muted-foreground">
                                {formatCurrency(historyFee.paidAmount)} of {formatCurrency(historyFee.totalFee)} paid
                            </div>
                        </div>
                        {historyLoading ? (
                            <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
                        ) : historyPayments.length === 0 ? (
                            <p className="py-8 text-center text-sm text-muted-foreground">No payments recorded yet.</p>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>Receipt</th>
                                            <th>Date</th>
                                            <th>Method</th>
                                            <th>Amount</th>
                                            <th />
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {historyPayments.filter(p => p.status !== 'CANCELLED').map(p => (
                                            <tr key={p.id}>
                                                <td data-label="Receipt" className="font-mono text-xs">{p.receiptNumber}</td>
                                                <td data-label="Date" className="text-xs">{new Date(p.paidAt).toLocaleDateString('en-GB')}</td>
                                                <td data-label="Method">{p.method === 'MPESA' ? 'M-Pesa' : p.method.charAt(0) + p.method.slice(1).toLowerCase()}</td>
                                                <td data-label="Amount" className="font-semibold">{formatCurrency(p.amount)}</td>
                                                <td data-label="" className="text-right">
                                                    <a
                                                        className="btn-icon text-muted-foreground hover:text-foreground"
                                                        href={`/api/school/fees/payments/${p.id}/receipt`}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        title="Download Receipt"
                                                    >
                                                        <Receipt size={14} />
                                                    </a>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </Modal>

            <Modal isOpen={!!payingFee} onClose={closePay} title="Pay with M-Pesa">
                {payingFee && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div className="rounded-xl bg-muted/40 p-3 text-sm">
                            <div className="font-semibold">{payingFee.termName}</div>
                            <div className="text-xs text-muted-foreground">Balance {formatCurrency(payingFee.balance)}</div>
                        </div>

                        {payState === 'form' || payState === 'sending' ? (
                            <>
                                <div>
                                    <label className="mb-1 block text-xs font-semibold text-muted-foreground">M-Pesa Phone Number</label>
                                    <input type="tel" value={payPhone} onChange={e => setPayPhone(e.target.value)} placeholder="07XXXXXXXX" className="input-field w-full" />
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs font-semibold text-muted-foreground">Amount (KShs)</label>
                                    <input type="number" min="0" step="0.01" value={payAmount} onChange={e => setPayAmount(e.target.value)} className="input-field w-full" />
                                </div>
                                {payError && <p className="text-sm text-destructive">{payError}</p>}
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                                    <button className="btn-secondary" onClick={closePay}>Cancel</button>
                                    <button className="btn-primary" onClick={submitStkPush} disabled={payState === 'sending'}>
                                        {payState === 'sending' ? 'Sending prompt...' : 'Send M-Pesa Prompt'}
                                    </button>
                                </div>
                            </>
                        ) : payState === 'waiting' ? (
                            <div className="py-6 text-center">
                                <p className="text-sm font-medium mb-1">Check your phone</p>
                                <p className="text-sm text-muted-foreground">Enter your M-Pesa PIN on the prompt sent to {payPhone} to complete the payment.</p>
                            </div>
                        ) : payState === 'success' ? (
                            <div className="py-6 text-center">
                                <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-emerald-600" />
                                <p className="text-sm font-medium mb-1">Payment received</p>
                                <p className="text-sm text-muted-foreground">Your balance has been updated.</p>
                                <button className="btn-primary mt-4" onClick={closePay}>Done</button>
                            </div>
                        ) : (
                            <div className="py-6 text-center">
                                <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-destructive" />
                                <p className="text-sm font-medium mb-1">Payment not completed</p>
                                <p className="text-sm text-muted-foreground">{payError}</p>
                                <div className="mt-4 flex justify-center gap-2">
                                    <button className="btn-secondary" onClick={closePay}>Close</button>
                                    <button className="btn-primary" onClick={() => setPayState('form')}>Try Again</button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </Modal>
        </div>
    );
}
