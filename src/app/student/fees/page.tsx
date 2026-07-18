"use client";

import React, { useEffect, useState } from 'react';
import { Wallet, CheckCircle2, Clock3, AlertTriangle } from 'lucide-react';
import PageHeader from '@/components/dashboard/PageHeader';
import StatCard from '@/components/dashboard/StatCard';
import EmptyState from '@/components/dashboard/EmptyState';
import { Badge } from '@/components/ui';
import DataTable, { type DataTableColumn } from '@/components/ui/DataTable';

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

    useEffect(() => {
        fetch('/api/school/fees').then(r => r.json()).then(j => setFees(j.data || [])).catch(() => {}).finally(() => setLoading(false));
    }, []);

    const totalBilled = fees.reduce((sum, f) => sum + f.totalFee, 0);
    const totalPaid = fees.reduce((sum, f) => sum + f.paidAmount, 0);
    const totalBalance = fees.reduce((sum, f) => sum + f.balance, 0);
    const overdueCount = fees.filter(f => f.balance > 0 && f.dueDate && new Date(f.dueDate) < new Date()).length;

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
                emptyState={<EmptyState icon={<Wallet className="h-6 w-6" />} title="No fee records yet" description="Your school hasn't billed any fees to your account yet." />}
            />
        </div>
    );
}
