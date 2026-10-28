"use client";

import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Ban, Download, Receipt, Search } from 'lucide-react';
import { DataTable } from '@/components/ui';
import { UnmatchedPaymentsPanel } from './UnmatchedPaymentsPanel';
import { FEE_PAYMENT_METHODS } from '@/lib/fees';
import { feeReceiptUrl as receiptUrl } from '@/lib/fee-account';
import { formatCurrency, methodLabel, statusBadge, type PaymentLogRow } from './feesShared';

interface PaymentsLogPanelProps {
    /** The term chosen on the page; empty for every term. */
    termId: string;
    canCollect: boolean;
    canVoid: boolean;
    unmatchedCount: number;
    onUnmatchedCountChange: (count: number) => void;
    /** Reload the page's fee records after money moves. */
    onChanged: () => Promise<void>;
    /** The page's "void this payment?" confirmation, then `after`. */
    confirmVoid: (payment: { id: string; receiptNumber: string; amount: number }, feeId: string, after: () => Promise<unknown>) => void;
}

/** Every payment in the school, filterable and exportable, with Paybill money still to assign. */
export function PaymentsLogPanel({ termId, canCollect, canVoid, unmatchedCount, onUnmatchedCountChange, onChanged, confirmVoid }: PaymentsLogPanelProps) {
    const [paymentsLog, setPaymentsLog] = useState<PaymentLogRow[]>([]);
    /** How many payments match, when the log shows only the newest of them. */
    const [paymentsLogTotal, setPaymentsLogTotal] = useState<number | null>(null);
    const [paymentsLogLoading, setPaymentsLogLoading] = useState(false);
    const [plSearch, setPlSearch] = useState('');
    // What the log is actually filtered by: the search box, 300ms after typing stops.
    const [plSearchQuery, setPlSearchQuery] = useState('');
    const [plMethod, setPlMethod] = useState('');
    const [plStatus, setPlStatus] = useState('');
    const [plSource, setPlSource] = useState('');
    const [plDateFrom, setPlDateFrom] = useState('');
    const [plDateTo, setPlDateTo] = useState('');

    useEffect(() => {
        const timer = window.setTimeout(() => setPlSearchQuery(plSearch.trim()), 300);
        return () => window.clearTimeout(timer);
    }, [plSearch]);

    const fetchPaymentsLog = useCallback(async () => {
        setPaymentsLogLoading(true);
        try {
            const params = new URLSearchParams();
            if (termId) params.set('term_id', termId);
            if (plMethod) params.set('method', plMethod);
            if (plStatus) params.set('status', plStatus);
            if (plSource) params.set('source', plSource);
            if (plDateFrom) params.set('date_from', plDateFrom);
            if (plDateTo) params.set('date_to', plDateTo);
            if (plSearchQuery) params.set('search', plSearchQuery);
            const res = await fetch(`/api/school/fees/payments?${params}`);
            const json: { data?: PaymentLogRow[]; total?: number; truncated?: boolean; error?: string } = await res.json();
            if (!res.ok) throw new Error(json.error || 'Could not load payments.');
            setPaymentsLog(json.data ?? []);
            setPaymentsLogTotal(json.truncated ? json.total ?? null : null);
        } catch (err) {
            console.error('Failed to load payments log:', err);
            setPaymentsLog([]);
            setPaymentsLogTotal(null);
            toast.error(err instanceof Error ? err.message : 'Could not load payments.');
        }
        setPaymentsLogLoading(false);
    }, [termId, plMethod, plStatus, plSource, plDateFrom, plDateTo, plSearchQuery]);

    useEffect(() => {
        void fetchPaymentsLog();
    }, [fetchPaymentsLog]);


    // Unmatched payments have no fee to void against; they are assigned from
    // Settings > Payments, and the log offers no void button for them.
    const voidLogPayment = (payment: PaymentLogRow) => {
        if (!payment.studentFeeId) return;
        confirmVoid(payment, payment.studentFeeId, () => Promise.all([fetchPaymentsLog(), onChanged()]));
    };

    const exportPaymentsLog = () => {
        const params = new URLSearchParams();
        if (termId) params.set('term_id', termId);
        if (plMethod) params.set('method', plMethod);
        if (plStatus) params.set('status', plStatus);
        if (plSource) params.set('source', plSource);
        if (plDateFrom) params.set('date_from', plDateFrom);
        if (plDateTo) params.set('date_to', plDateTo);
        // The same rows as on screen: the search used to be left out.
        if (plSearchQuery) params.set('search', plSearchQuery);
        window.location.href = `/api/school/fees/payments/export?${params}`;
    };

    return (
        <div>
            {unmatchedCount > 0 && (
                <div className="mb-4">
                    <UnmatchedPaymentsPanel
                        canAssign={canCollect}
                        onCountChange={onUnmatchedCountChange}
                        // The money is now on the learner's record: refresh what shows it.
                        onAssigned={() => void Promise.all([onChanged(), fetchPaymentsLog()])}
                    />
                </div>
            )}
            <section aria-label="Payment filters" className="mb-4 rounded-2xl border border-border/70 bg-card p-3 shadow-sm sm:p-4">
                <div className="flex gap-2">
                    <div className="relative min-w-0 flex-1">
                        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                        <input
                            type="text"
                            placeholder="Search student, admission no. or receipt"
                            aria-label="Search payments"
                            value={plSearch}
                            onChange={e => setPlSearch(e.target.value)}
                            className="input-field input-icon-left w-full"
                        />
                    </div>
                    <button type="button" className="btn-secondary shrink-0" onClick={exportPaymentsLog} title="Export the payments log to Excel" aria-label="Export the payments log to Excel">
                        <Download className="size-4" aria-hidden="true" /><span className="hidden sm:inline">Export</span>
                    </button>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-5">
                    <select className="input-field" aria-label="Payment method" value={plMethod} onChange={e => setPlMethod(e.target.value)}>
                        <option value="">All methods</option>
                        {FEE_PAYMENT_METHODS.map(m => <option key={m} value={m}>{methodLabel(m)}</option>)}
                    </select>
                    <select className="input-field" aria-label="Payment source" value={plSource} onChange={e => setPlSource(e.target.value)}>
                        <option value="">Auto &amp; manual</option>
                        <option value="AUTO">Auto only</option>
                        <option value="MANUAL">Manual only</option>
                    </select>
                    <select className="input-field col-span-2 md:col-span-1" aria-label="Payment status" value={plStatus} onChange={e => setPlStatus(e.target.value)}>
                        <option value="">All statuses</option>
                        <option value="COMPLETED">Completed</option>
                        <option value="PENDING">Pending</option>
                        <option value="FAILED">Failed</option>
                        <option value="CANCELLED">Cancelled</option>
                    </select>
                    <label className="relative">
                        <span className="pointer-events-none absolute -top-2 left-3 bg-card px-1 text-[10px] font-medium text-muted-foreground">From</span>
                        <input type="date" className="input-field w-full" value={plDateFrom} onChange={e => setPlDateFrom(e.target.value)} aria-label="Paid from" />
                    </label>
                    <label className="relative">
                        <span className="pointer-events-none absolute -top-2 left-3 bg-card px-1 text-[10px] font-medium text-muted-foreground">To</span>
                        <input type="date" className="input-field w-full" value={plDateTo} min={plDateFrom || undefined} onChange={e => setPlDateTo(e.target.value)} aria-label="Paid to" />
                    </label>
                </div>
            </section>

            {paymentsLogTotal !== null && (
                <p role="status" className="mb-3 rounded-xl border border-border/70 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                    Showing the newest {paymentsLog.length.toLocaleString()} of {paymentsLogTotal.toLocaleString()} payments. Narrow the dates or search, or export to Excel for all of them.
                </p>
            )}
            <DataTable<PaymentLogRow>
                columns={[
                    {
                        key: 'paidAt', header: 'Date',
                        render: p => <span className="text-xs text-muted-foreground">{new Date(p.paidAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>,
                    },
                    {
                        key: 'student', header: 'Student',
                        render: p => (
                            <div>
                                <div className="font-semibold text-sm">{p.studentName || (p.unmatchedReference ? `Unmatched (${p.unmatchedReference})` : '—')}</div>
                                <div className="text-[11px] text-muted-foreground">{p.admissionNumber || ''} {p.termName ? `· ${p.termName}` : ''}</div>
                            </div>
                        ),
                    },
                    { key: 'receiptNumber', header: 'Receipt', render: p => <span className="font-mono text-xs">{p.receiptNumber}</span> },
                    { key: 'amount', header: 'Amount', numeric: true, render: p => <span className="font-semibold">{formatCurrency(p.amount)}</span> },
                    {
                        key: 'method', header: 'Method',
                        render: p => <span>{methodLabel(p.method)}</span>,
                    },
                    {
                        key: 'transactionCode', header: 'Transaction Code', hideOnMobile: true,
                        render: p => <span className="font-mono text-xs">{p.mpesaReceiptNumber || p.pesapalConfirmationCode || '—'}</span>,
                    },
                    {
                        key: 'source', header: 'Source', hideOnMobile: true,
                        render: p => (
                            <span className={`badge whitespace-nowrap ${p.source === 'AUTO' ? 'badge-success' : 'badge-info'}`}>
                                {p.source === 'AUTO' ? 'Auto' : 'Manual'}
                            </span>
                        ),
                    },
                    {
                        key: 'status', header: 'Status',
                        render: p => statusBadge(p.status),
                    },
                    {
                        key: 'recordedBy', header: 'Recorded By', hideOnMobile: true,
                        render: p => <span className="text-xs text-muted-foreground">{p.recordedByName || (p.source === 'AUTO' ? 'System' : '—')}</span>,
                    },
                ]}
                rows={paymentsLog}
                rowKey={p => p.id}
                loading={paymentsLogLoading}
                mobileTitleKey="student"
                rowActions={p => (
                    <span className="inline-flex items-center gap-1 whitespace-nowrap">
                        {p.status === 'COMPLETED' && (
                            <a
                                className="btn-icon text-muted-foreground hover:text-foreground"
                                href={receiptUrl(p.id)}
                                target="_blank"
                                rel="noreferrer"
                                title="Download Receipt"
                            >
                                <Receipt size={14} />
                            </a>
                        )}
                        {canVoid && p.status === 'COMPLETED' && p.studentFeeId && (
                            <button className="btn-icon text-destructive/80 hover:text-destructive" onClick={() => voidLogPayment(p)} title="Void Payment">
                                <Ban size={14} />
                            </button>
                        )}
                    </span>
                )}
                emptyState={<p className="py-6 text-sm">No payments match these filters.</p>}
            />
        </div>
    );
}
