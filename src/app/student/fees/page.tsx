"use client";

import React, { useEffect, useState } from 'react';
import { Wallet, CheckCircle2, Clock3, AlertTriangle, Receipt } from 'lucide-react';
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

export default function StudentFeesPage() {
    const [fees, setFees] = useState<FeeRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [historyFee, setHistoryFee] = useState<FeeRecord | null>(null);
    const [historyPayments, setHistoryPayments] = useState<FeePayment[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);

    useEffect(() => {
        fetch('/api/school/fees').then(r => r.json()).then(j => setFees(j.data || [])).catch(() => {}).finally(() => setLoading(false));
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
        </div>
    );
}
