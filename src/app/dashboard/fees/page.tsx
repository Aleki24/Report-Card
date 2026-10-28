"use client";

import PageHeader from '@/components/dashboard/PageHeader';
import React, { Suspense, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Plus, Search, Edit3, Trash2, Wallet, ArrowUpRight, Clock, AlertTriangle, Upload, FileText, CircleDollarSign, History, Download, Ban, Receipt, Layers, UsersRound, ChartColumn } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { toast } from 'sonner';
import { apiErrorMessage } from '@/lib/api-error-message';
import { requestJson, jsonBody } from '@/lib/api-error-message';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';
import { PageTabs, useUrlTab, type PageTab } from '@/components/ui/PageTabs';
import { DataTable, LoadError, StatTile, TermSelect, type TermSelectYear } from '@/components/ui';
import { FeeAccountDrawer } from '@/components/fees/FeeAccountDrawer';
import { DefaultersPanel } from '@/components/fees/DefaultersPanel';
import { CollectionsPanel } from '@/components/fees/CollectionsPanel';
import { BatchEntryPanel } from '@/components/fees/BatchEntryPanel';
import { PaymentsLogPanel } from '@/components/fees/PaymentsLogPanel';
import {
    balanceColor, formatCurrency, methodLabel, statusBadge, timeAgo, todayIso, toStudentOption,
    type FeeRecord, type PendingConfirm, type StreamOption, type StudentApiRow, type StudentOption, type TermOption,
} from '@/components/fees/feesShared';
import Link from 'next/link';
import { feeReceiptUrl, type FeeAccountLearner, type FeeAccountTerm } from '@/lib/fee-account';
import { cn } from '@/lib/utils';
import { findActiveTermId } from '@/lib/term-calendar';
import { isOverdue, totalOwed, FEE_PAYMENT_METHODS, type FeePayment, type FeePaymentMethod } from '@/lib/fees';
import { FEATURE_ICONS } from '@/components/ui/featureIcons';



type FeesMode = 'list' | 'payments' | 'batch' | 'defaulters' | 'collections';





const receiptUrl = feeReceiptUrl;



const FEES_TABS: readonly PageTab<FeesMode>[] = [
    { id: 'list', label: 'Fee records', shortLabel: 'Records', icon: FileText, hue: 'emerald' },
    // The school-wide log exposes every receipt; it is admin-only on the server.
    { id: 'payments', label: 'Payments', icon: Receipt, hue: 'blue' },
    { id: 'batch', label: 'Batch entry', shortLabel: 'Batch', icon: Layers, hue: 'violet' },
    { id: 'defaulters', label: 'Who owes', icon: UsersRound, hue: 'amber' },
    { id: 'collections', label: 'Collections', icon: ChartColumn, hue: 'teal' },
];

/** Tabs about the whole school rather than one term's records: no term KPIs over them. */
const REPORT_MODES: ReadonlySet<FeesMode> = new Set<FeesMode>(['defaulters', 'collections']);
/** Tabs only finance staff see (school-wide money). */
const FINANCE_ONLY_MODES: ReadonlySet<FeesMode> = new Set<FeesMode>(['payments', 'defaulters', 'collections']);



export default function FeesPage() {
    return (
        <Suspense fallback={<div className="mx-auto h-64 w-full max-w-7xl animate-pulse rounded-2xl bg-muted/40" aria-hidden="true" />}>
            <FeesPageInner />
        </Suspense>
    );
}

function FeesPageInner() {
    const { can, hasModule } = useAuth();
    // Deleting a record and voiding receipts are admin-only on the server.
    // The admin, or staff with a finance duty (bursar, accountant).
    const canViewAll = can('fees.view');
    const canManageFees = can('fees.manage');
    // Recording payments (and matching unmatched Paybill money) is fees.collect:
    // an accountant can, without billing or editing fee records.
    const canCollect = can('fees.collect');
    const visibleTabs = useMemo(() => FEES_TABS.filter(t => !FINANCE_ONLY_MODES.has(t.id) || canViewAll), [canViewAll]);
    const [mode, selectMode] = useUrlTab(visibleTabs, 'view');
    const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);
    const [confirming, setConfirming] = useState(false);
    const [fees, setFees] = useState<FeeRecord[]>([]);
    const [loading, setLoading] = useState(true);
    // A failed load is not an empty school: it gets its own panel and a retry.
    const [feesError, setFeesError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [streamFilter, setStreamFilter] = useState('');
    const [selectedTerm, setSelectedTerm] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingFee, setEditingFee] = useState<FeeRecord | null>(null);
    const [students, setStudents] = useState<StudentOption[]>([]);
    const [terms, setTerms] = useState<TermOption[]>([]);
    const [years, setYears] = useState<TermSelectYear[]>([]);
    const [saving, setSaving] = useState(false);

    // Form state
    const [formStudent, setFormStudent] = useState('');
    // Narrows the student picker; hundreds of names in one list is unusable.
    const [formClass, setFormClass] = useState('');
    const [formTerm, setFormTerm] = useState('');
    const [formTotal, setFormTotal] = useState('');
    const [formDueDate, setFormDueDate] = useState('');
    const [formNotes, setFormNotes] = useState('');

    // Batch entry state
    const [gradeStreams, setGradeStreams] = useState<StreamOption[]>([]);

    // Record-payment modal
    const [payingFee, setPayingFee] = useState<FeeRecord | null>(null);
    const [payAmount, setPayAmount] = useState('');
    const [payMethod, setPayMethod] = useState<FeePaymentMethod>('CASH');
    const [payPayerName, setPayPayerName] = useState('');
    const [payPhone, setPayPhone] = useState('');
    const [payMpesaRef, setPayMpesaRef] = useState('');
    const [payNotes, setPayNotes] = useState('');
    const [payDate, setPayDate] = useState('');
    const [paySaving, setPaySaving] = useState(false);
    const [payError, setPayError] = useState('');

    // A learner's whole fee account (every term), opened from their row.
    const [account, setAccount] = useState<{ studentId: string; name: string | null } | null>(null);
    const [accountVersion, setAccountVersion] = useState(0);

    // Payment history modal
    const [historyFee, setHistoryFee] = useState<FeeRecord | null>(null);
    const [historyPayments, setHistoryPayments] = useState<FeePayment[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);

    // Paybill money that could not be matched to a student; assigned on the Payments tab.
    const [unmatchedCount, setUnmatchedCount] = useState(0);

    useEffect(() => {
        if (!canViewAll) return;
        const controller = new AbortController();
        fetch('/api/school/fees/unmatched', { cache: 'no-store', signal: controller.signal })
            .then(r => (r.ok ? r.json() : null))
            .then((j: { data?: unknown[] } | null) => setUnmatchedCount(j?.data?.length ?? 0))
            .catch(() => {});
        return () => controller.abort();
    }, [canViewAll]);


    // Only the latest request may fill the list: an earlier, slower one (all
    // terms, or the previous term) landing last showed another term's records
    // under this term's name.
    const feesRequest = useRef(0);
    const fetchFees = useCallback(async () => {
        const request = ++feesRequest.current;
        try {
            const params = new URLSearchParams();
            if (selectedTerm) params.set('term_id', selectedTerm);
            const res = await fetch(`/api/school/fees?${params}`, { cache: 'no-store' });
            const json: unknown = await res.json().catch(() => null);
            if (request !== feesRequest.current) return;
            if (!res.ok) {
                setFees([]);
                setFeesError(apiErrorMessage(json, 'Could not load fee records.'));
            } else {
                setFees((json as { data?: FeeRecord[] } | null)?.data ?? []);
                setFeesError(null);
            }
        } catch (err) {
            if (request !== feesRequest.current) return;
            console.error('Failed to load fees:', err);
            setFees([]);
            setFeesError('Could not load fee records. Check your connection.');
        }
        setLoading(false);
    }, [selectedTerm]);

    // Wait for the terms, which pick the current one: fetching before that
    // pulled every term's records first.
    const [termsReady, setTermsReady] = useState(false);
    useEffect(() => {
        if (termsReady) void fetchFees();
    }, [fetchFees, termsReady]);

    useEffect(() => {
        (async () => {
            const [tRes, gsRes, yRes] = await Promise.all([
                fetch('/api/school/data?type=terms'),
                fetch('/api/school/data?type=grade_streams'),
                fetch('/api/school/data?type=academic_years'),
            ]);
            const tData: { data?: (TermOption & { start_date: string; end_date: string })[] } = await tRes.json();
            const gsData: { data?: StreamOption[] } = await gsRes.json();
            const yData: { data?: TermSelectYear[] } = await yRes.json();

            if (yData.data) setYears(yData.data);
            if (tData.data) {
                setTerms(tData.data.map(t => ({ id: t.id, name: t.name, academic_year_id: t.academic_year_id })));
                // Auto-select the active term (Kenyan calendar), falling back to the first
                if (!selectedTerm && tData.data.length > 0) {
                    setSelectedTerm(findActiveTermId(tData.data) || tData.data[0].id);
                }
            }
            if (gsData.data) {
                setGradeStreams(gsData.data);
            }
        })()
            .catch(err => console.error('Failed to load terms:', err))
            .finally(() => setTermsReady(true));
    }, []);

    const filtered = useMemo(() => {
        let result = fees;
        if (search) {
            const q = search.toLowerCase();
            result = result.filter(f =>
                f.studentName?.toLowerCase().includes(q) ||
                f.admissionNumber?.toLowerCase().includes(q)
            );
        }
        if (statusFilter) {
            result = result.filter(f => f.status === statusFilter);
        }
        if (streamFilter) result = result.filter(f => f.gradeStreamId === streamFilter);
        return result;
    }, [fees, search, statusFilter, streamFilter]);

    // The totals follow the class filter, so a class's collection can be read
    // on its own; search and status only narrow the list.
    const kpiFees = useMemo(() => (streamFilter ? fees.filter(f => f.gradeStreamId === streamFilter) : fees), [fees, streamFilter]);
    const kpi = useMemo(() => {
        const expected = kpiFees.reduce((s, f) => s + f.totalFee, 0);
        const collected = kpiFees.reduce((s, f) => s + f.paidAmount, 0);
        const outstanding = totalOwed(kpiFees);
        const overdue = kpiFees.filter(f => isOverdue(f.dueDate, f.balance));
        const overdueAmount = overdue.reduce((s, f) => s + f.balance, 0);
        const collectionRate = expected > 0 ? Math.round((collected / expected) * 100) : 0;
        return { expected, collected, outstanding, overdueCount: overdue.length, overdueAmount, collectionRate, records: kpiFees.length };
    }, [kpiFees]);

    // Students who've left the school shouldn't show up as billing targets for new records.
    const activeStudents = useMemo(() => students.filter(s => !s.status || s.status === 'ACTIVE'), [students]);

    // Students who already have a fee record for the term selected in the Add
    // modal — hidden from the picker so a fresh "Add" can't silently clobber
    // an existing balance via the upsert; only reliable when `fees` was
    // loaded for that same term (the common case, since formTerm defaults to
    // the page's selected term). Falls back to showing everyone otherwise.
    const billedStudentsForFormTerm = useMemo(() => {
        if (!formTerm || formTerm !== selectedTerm) return new Set<string>();
        return new Set(fees.map(f => f.studentId).filter((id): id is string => !!id));
    }, [fees, formTerm, selectedTerm]);

    const availableStudentsForAdd = useMemo(
        () => activeStudents.filter(s => !billedStudentsForFormTerm.has(s.id) && (!formClass || s.gradeStreamId === formClass)),
        [activeStudents, billedStudentsForFormTerm, formClass]
    );

    /*
      Every learner in the school, for the Add dialog's picker. It used to load
      with the page, whatever tab was open; now it loads the first time the
      dialog opens.
    */
    const studentsRequested = useRef(false);
    const ensureStudents = () => {
        if (studentsRequested.current) return;
        studentsRequested.current = true;
        fetch('/api/school/data?type=students')
            .then(r => r.json())
            .then((json: { data?: StudentApiRow[] }) => setStudents((json.data ?? []).map(toStudentOption)))
            .catch(() => { studentsRequested.current = false; toast.error('Could not load the student list. Try again.'); });
    };

    const openAdd = () => {
        ensureStudents();
        setEditingFee(null);
        setFormStudent('');
        setFormClass(streamFilter);
        setFormTerm(selectedTerm);
        setFormTotal('');
        setFormDueDate('');
        setFormNotes('');
        setShowAddModal(true);
    };

    const openBatch = () => changeMode('batch');

    const openEdit = (fee: FeeRecord) => {
        setEditingFee(fee);
        setFormTotal(String(fee.totalFee));
        setFormDueDate(fee.dueDate || '');
        setFormNotes(fee.notes || '');
        setShowAddModal(true);
    };

    const handleSave = async () => {
        if (!formTotal) return;
        if (!editingFee && (!formStudent || !formTerm)) {
            toast.error('Choose a student and a term.');
            return;
        }
        setSaving(true);
        try {
            const details = {
                total_fee: parseFloat(formTotal),
                due_date: formDueDate || null,
                notes: formNotes || null,
            };
            if (editingFee) {
                await requestJson(`/api/school/fees/${editingFee.id}`, jsonBody('PATCH', details));
            } else {
                await requestJson('/api/school/fees', jsonBody('POST', { student_id: formStudent, term_id: formTerm, ...details }));
            }
            setShowAddModal(false);
            toast.success(editingFee ? 'Fee record updated' : 'Fee record added');
            await fetchFees();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to save the fee record');
        } finally {
            setSaving(false);
        }
    };

    const runConfirmed = async () => {
        if (!pendingConfirm) return;
        setConfirming(true);
        try {
            await pendingConfirm.run();
            setPendingConfirm(null);
        } finally {
            setConfirming(false);
        }
    };

    const handleDelete = (fee: FeeRecord) => setPendingConfirm({
        title: 'Delete fee record?',
        message: `${fee.studentName ?? 'This student'}'s ${fee.termName} fee record of ${formatCurrency(fee.totalFee)} will be removed.${fee.paidAmount > 0 ? ` ${formatCurrency(fee.paidAmount)} has been paid against it.` : ''}`,
        confirmText: 'Delete record',
        run: async () => {
            try {
                await requestJson(`/api/school/fees/${fee.id}`, { method: 'DELETE' });
                toast.success('Fee record deleted');
                await fetchFees();
            } catch (err) {
                toast.error(err instanceof Error ? err.message : 'Failed to delete the fee record');
            }
        },
    });

    /** Voids a receipt after confirmation, then refreshes what shows it. */
    const confirmVoid = (payment: { id: string; receiptNumber: string; amount: number }, feeId: string, after: () => Promise<unknown>) => setPendingConfirm({
        title: `Void receipt ${payment.receiptNumber}?`,
        message: `${formatCurrency(payment.amount)} will be taken off the balance it paid. This cannot be undone.`,
        confirmText: 'Void receipt',
        run: async () => {
            try {
                await requestJson(`/api/school/fees/${feeId}/payments/${payment.id}`, { method: 'DELETE' });
                toast.success(`Receipt ${payment.receiptNumber} voided`);
                await after();
            } catch (err) {
                toast.error(err instanceof Error ? err.message : 'Failed to void the payment');
            }
        },
    });

    // ── Record payment ──

    const openPay = (fee: FeeRecord) => {
        setPayingFee(fee);
        setPayAmount(fee.balance > 0 ? String(fee.balance) : '');
        setPayMethod('CASH');
        setPayPayerName('');
        setPayPhone('');
        setPayMpesaRef('');
        setPayNotes('');
        setPayDate(todayIso());
        setPayError('');
    };

    /** Pay a term picked in the fee account, which may not be the term on screen. */
    const payFromAccount = (term: FeeAccountTerm, learner: FeeAccountLearner) => {
        const onScreen = fees.find(f => f.id === term.feeId);
        openPay(onScreen ?? {
            id: term.feeId, totalFee: term.billed, paidAmount: term.paid, balance: term.balance, dueDate: term.dueDate ?? '',
            status: term.status, notes: term.notes ?? '', termId: term.termId, termName: term.termName,
            studentName: learner.name, admissionNumber: learner.admissionNumber, studentId: learner.id,
            gradeStreamId: null, className: learner.className, createdAt: '', updatedAt: '',
        });
    };

    const submitPayment = async () => {
        if (!payingFee) return;
        const amountValue = parseFloat(payAmount);
        if (!payAmount || isNaN(amountValue) || amountValue <= 0) {
            setPayError('Enter a valid amount greater than 0.');
            return;
        }
        setPaySaving(true);
        setPayError('');
        try {
            const res = await fetch(`/api/school/fees/${payingFee.id}/payments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount: amountValue,
                    method: payMethod,
                    payer_name: payPayerName || null,
                    phone_number: payPhone || null,
                    mpesa_receipt_number: payMethod === 'MPESA' ? (payMpesaRef || null) : null,
                    notes: payNotes || null,
                    // Only send a backdate; today's payments keep the exact time.
                    paid_at: payDate && payDate !== todayIso() ? payDate : undefined,
                }),
            });
            if (!res.ok) {
                const errData = await res.json();
                setPayError(errData.error || 'Failed to record payment.');
                setPaySaving(false);
                return;
            }
            const saved: { data?: { id?: string; receiptNumber?: string } } = await res.json();
            const paymentId = saved.data?.id;
            toast.success(`Payment of ${formatCurrency(amountValue)} recorded for ${payingFee.studentName ?? 'the student'}`, {
                description: saved.data?.receiptNumber ? `Receipt ${saved.data.receiptNumber}` : undefined,
                action: paymentId ? { label: 'Download receipt', onClick: () => window.open(receiptUrl(paymentId), '_blank', 'noopener') } : undefined,
                duration: 10000,
            });
            setPayingFee(null);
            setAccountVersion(v => v + 1);
            await fetchFees();
        } catch (err) {
            console.error('Record payment failed:', err);
            setPayError('Failed to record payment.');
        }
        setPaySaving(false);
    };

    // ── Payment history ──

    const openHistory = async (fee: FeeRecord) => {
        setHistoryFee(fee);
        setHistoryLoading(true);
        try {
            const res = await fetch(`/api/school/fees/${fee.id}/payments`);
            const json = await res.json();
            setHistoryPayments(json.data || []);
        } catch (err) {
            console.error('Failed to load payment history:', err);
            setHistoryPayments([]);
        }
        setHistoryLoading(false);
    };

    const voidPayment = (payment: FeePayment) => {
        const fee = historyFee;
        if (!fee) return;
        confirmVoid(payment, fee.id, () => Promise.all([openHistory(fee), fetchFees()]));
    };



    const exportExcel = () => {
        const params = new URLSearchParams();
        if (selectedTerm) params.set('term_id', selectedTerm);
        if (statusFilter) params.set('status', statusFilter);
        if (streamFilter) params.set('grade_stream_id', streamFilter);
        window.location.href = `/api/school/fees/export?${params}`;
    };

    function changeMode(next: FeesMode) {
        if (next !== mode) selectMode(next);
    }

    return (
        <div className="mx-auto w-full max-w-7xl pb-10">
            <PageHeader
                title="Fees"
                eyebrow="Finance"
                icon={FEATURE_ICONS.fees}
                hue="emerald"
                description="Bill students each term, record payments and track what is still owed."
                action={
                <div className="grid grid-cols-2 gap-2 sm:flex sm:items-end">
                    <label className="col-span-2 flex flex-col gap-1.5 sm:w-56">
                        <span className="text-xs font-medium text-muted-foreground">Term</span>
                        <TermSelect
                            terms={terms}
                            years={years}
                            value={selectedTerm}
                            onChange={v => { setSelectedTerm(v); setLoading(true); }}
                            emptyLabel="All terms"
                        />
                    </label>
                    {mode === 'list' && (
                        <button
                            className="btn-secondary h-11"
                            onClick={exportExcel}
                            title="Export the current view to Excel"
                        >
                            <Download className="size-4" aria-hidden="true" />Export
                        </button>
                    )}
                    {canManageFees && (
                        <button className={cn('btn-primary h-11', mode === 'batch' && 'col-span-2')} onClick={openAdd}>
                            <Plus className="size-4" aria-hidden="true" />Add record
                        </button>
                    )}
                </div>
                }
            />

            <PageTabs tabs={visibleTabs} active={mode} onSelect={changeMode} label="Fees views" idPrefix="fees" />

            {unmatchedCount > 0 && (
                <div role="status" className="mb-4 flex flex-col gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm">
                        <span className="font-semibold">{unmatchedCount} M-Pesa payment{unmatchedCount === 1 ? '' : 's'} not matched to a student.</span>{' '}
                        <span className="text-muted-foreground">The payer used an account number we couldn&apos;t recognise. Assign it so it counts towards the right balance.</span>
                    </p>
                    {mode !== 'payments' && (
                        <button
                            type="button"
                            className="btn-secondary w-full shrink-0 sm:w-auto"
                            onClick={() => {
                                changeMode('payments');
                                window.requestAnimationFrame(() => document.getElementById('unmatched-payments')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
                            }}
                        >
                            {canCollect ? 'Assign payments' : 'View payments'}
                        </button>
                    )}
                </div>
            )}

            {/* Fee structures and invoicing, and the payment channels, live on their own pages. */}
            {canManageFees && (
                <nav aria-label="Fee setup" className="-mt-1 mb-4 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                    {hasModule('fee_structures') && <Link href="/dashboard/billing" className="font-medium text-primary hover:underline">Fee structures, invoicing &amp; bursaries →</Link>}
                    <Link href="/dashboard/settings?tab=payments" className="font-medium text-primary hover:underline">M-Pesa, Pesapal &amp; bank accounts →</Link>
                    {hasModule('parent_portal') && <Link href="/dashboard/parent-accounts?tab=class" className="font-medium text-primary hover:underline">Link parents for a class →</Link>}
                </nav>
            )}

            {!REPORT_MODES.has(mode) && (<>
            {/* ── KPI Cards ── */}
            <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatTile icon={Wallet} hue="blue" label="Expected" value={feesError ? '—' : formatCurrency(kpi.expected)} hint={feesError ? undefined : `${kpi.records} record${kpi.records === 1 ? '' : 's'}${streamFilter ? ` · ${gradeStreams.find(g => g.id === streamFilter)?.full_name ?? 'this class'}` : ''}`} />
                <StatTile icon={ArrowUpRight} label="Collected" value={feesError ? '—' : formatCurrency(kpi.collected)} hint={feesError ? undefined : `${kpi.collectionRate}% collection rate`} tone="good" />
                <StatTile icon={Clock} label="Outstanding" value={feesError ? '—' : formatCurrency(kpi.outstanding)} hint={feesError ? undefined : 'unpaid balance'} tone={kpi.outstanding > 0 ? 'warn' : 'default'} />
                <StatTile icon={AlertTriangle} label="Overdue" value={feesError ? '—' : formatCurrency(kpi.overdueAmount)} hint={feesError ? undefined : `${kpi.overdueCount} overdue record(s)`} tone={kpi.overdueCount > 0 ? 'bad' : 'default'} />
            </div>

            {/* ── Collection meter ── */}
            <div className="mb-5 rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-1 text-xs">
                    <span className="font-semibold text-foreground">Collection progress</span>
                    <span className="text-muted-foreground">
                        {kpi.collectionRate}% collected · {kpi.collectionRate >= 80 ? 'Healthy' : kpi.collectionRate >= 50 ? 'Moderate' : 'Needs attention'}
                    </span>
                </div>
                <div
                    role="meter"
                    aria-label="Share of expected fees collected"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.min(100, kpi.collectionRate)}
                    className="h-2.5 w-full overflow-hidden rounded-full bg-primary/15"
                >
                    <div className={cn('h-full rounded-full transition-[width] duration-500', kpi.collectionRate >= 80 ? 'bg-emerald-500' : kpi.collectionRate >= 50 ? 'bg-primary' : 'bg-amber-500')} style={{ width: `${Math.min(100, kpi.collectionRate)}%` }} />
                </div>
            </div>

            </>)}

            <div role="tabpanel" id="fees-panel" aria-labelledby={`fees-tab-${mode}`}>
            {mode === 'defaulters' && (
                <DefaultersPanel
                    streams={gradeStreams}
                    termId={selectedTerm}
                    canRemind={canManageFees}
                    onOpenAccount={(studentId, name) => setAccount({ studentId, name })}
                />
            )}
            {mode === 'collections' && <CollectionsPanel />}

            {/* ════════════════════════════════════════════ */}
            {/* BATCH ENTRY MODE                           */}
            {/* ════════════════════════════════════════════ */}
            {mode === 'batch' && <BatchEntryPanel streams={gradeStreams} terms={terms} years={years} canManageFees={canManageFees} onSaved={fetchFees} />}

            {/* ════════════════════════════════════════════ */}
            {/* PAYMENTS LOG (school-wide transactions)       */}
            {/* ════════════════════════════════════════════ */}
            {mode === 'payments' && (
                <PaymentsLogPanel
                    termId={selectedTerm}
                    canCollect={canCollect}
                    canVoid={canManageFees}
                    unmatchedCount={unmatchedCount}
                    onUnmatchedCountChange={setUnmatchedCount}
                    onChanged={fetchFees}
                    confirmVoid={confirmVoid}
                />
            )}

            {/* ════════════════════════════════════════════ */}
            {/* LIST VIEW                                    */}
            {/* ════════════════════════════════════════════ */}
            {mode === 'list' && (
                <>
                    <section aria-label="Fee filters" className="mb-4 grid grid-cols-2 gap-2 rounded-2xl border border-border/70 bg-card p-3 shadow-sm sm:p-4 md:grid-cols-[minmax(0,1fr)_11rem_13rem]">
                        <div className="relative col-span-2 md:col-span-1">
                            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                            <input
                                type="text"
                                placeholder="Search student or admission no."
                                aria-label="Search fee records"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="input-field input-icon-left w-full"
                            />
                        </div>
                        <select className="input-field" aria-label="Filter by status" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                            <option value="">All statuses</option>
                            <option value="PENDING">Pending</option>
                            <option value="PARTIAL">Partial</option>
                            <option value="PAID">Paid</option>
                            <option value="OVERPAID">Overpaid</option>
                        </select>
                        <select className="input-field" aria-label="Filter by class" value={streamFilter} onChange={e => setStreamFilter(e.target.value)}>
                            <option value="">All classes</option>
                            {gradeStreams.map(gs => <option key={gs.id} value={gs.id}>{gs.full_name}</option>)}
                        </select>
                        <p className="col-span-2 text-xs text-muted-foreground md:col-span-3" aria-live="polite">
                            {filtered.length === fees.length ? `${fees.length} record(s)` : `${filtered.length} of ${fees.length} record(s)`}
                        </p>
                    </section>

                    {/* ── Empty State / Table ── */}
                    {loading ? (
                        <div className="space-y-2" aria-hidden="true">
                            {Array.from({ length: 6 }, (_, i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-muted/60" />)}
                        </div>
                    ) : feesError ? (
                        <LoadError
                            title="Fee records did not load"
                            message={feesError}
                            onRetry={() => { setLoading(true); void fetchFees(); }}
                        />
                    ) : fees.length === 0 ? (
                        /* ── Guided Onboarding Empty State ── */
                        <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center">
                            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary/10 flex items-center justify-center">
                                <Wallet size={32} className="text-primary" />
                            </div>
                            <h3 className="text-lg font-bold mb-2">No Fee Records Yet</h3>
                            <p className={cn('text-sm text-muted-foreground max-w-md mx-auto leading-relaxed', canManageFees && 'mb-8')}>
                                {canManageFees
                                    ? 'Get started by setting up fee structures, adding individual records, or importing data in bulk for your classes.'
                                    : 'The bursar or an admin bills learners first; payments can be recorded here once a learner has a fee record.'}
                            </p>
                            {canManageFees && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl mx-auto">
                                <button
                                    className="rounded-2xl border border-border/70 bg-card p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md"
                                    onClick={openAdd}
                                >
                                    <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center mb-3">
                                        <FileText size={20} />
                                    </div>
                                    <h4 className="font-bold text-sm mb-1">Add a fee record</h4>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        Create a fee record for an individual student with amount, due date, and notes.
                                    </p>
                                </button>
                                <button
                                    className="rounded-2xl border border-border/70 bg-card p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md"
                                    onClick={openBatch}
                                >
                                    <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center mb-3">
                                        <Upload size={20} />
                                    </div>
                                    <h4 className="font-bold text-sm mb-1">Batch entry</h4>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        Select a class and term, then bulk-enter fees for multiple students at once.
                                    </p>
                                </button>
                            </div>
                            )}
                        </div>
                    ) : (
                        <DataTable<FeeRecord>
                            columns={[
                                {
                                    key: 'student', header: 'Student',
                                    render: fee => (
                                        <div className="min-w-0">
                                            <div className="truncate text-sm font-semibold">{fee.studentName || '—'}</div>
                                            <div className="text-[11px] text-muted-foreground">{[fee.className, fee.admissionNumber, fee.termName].filter(Boolean).join(' · ')}</div>
                                        </div>
                                    ),
                                },
                                { key: 'expected', header: 'Expected Fee', numeric: true, render: fee => fee.totalFee.toLocaleString() },
                                {
                                    key: 'paid', header: 'Paid', numeric: true,
                                    render: fee => (
                                        <span style={{ color: fee.paidAmount > 0 ? 'var(--viz-good)' : undefined }} className={fee.paidAmount > 0 ? '' : 'text-muted-foreground'}>
                                            {fee.paidAmount.toLocaleString()}
                                        </span>
                                    ),
                                },
                                {
                                    key: 'balance', header: 'Balance', numeric: true,
                                    render: fee => (
                                        <span className="font-semibold" style={{ color: balanceColor(fee.balance) }}>
                                            {fee.balance.toLocaleString()}
                                        </span>
                                    ),
                                },
                                { key: 'status', header: 'Status', render: fee => statusBadge(fee.status) },
                                {
                                    key: 'activity', header: 'Last Payment Activity', hideOnMobile: true,
                                    render: fee => (
                                        <div className="text-xs text-muted-foreground">
                                            <div>{fee.notes || '—'}</div>
                                            <div className="mt-0.5 text-[11px] opacity-80">{fee.updatedAt ? timeAgo(fee.updatedAt) : ''}</div>
                                        </div>
                                    ),
                                },
                            ]}
                            rows={filtered}
                            rowKey={fee => fee.id}
                            onRowClick={fee => { if (fee.studentId) setAccount({ studentId: fee.studentId, name: fee.studentName }); }}
                            rowActions={fee => (
                                <span className="inline-flex items-center gap-1 whitespace-nowrap">
                                    <button className="btn-primary h-8 rounded-lg px-3 text-xs" onClick={() => openPay(fee)} title="Record a payment" aria-label={`Record payment for ${fee.studentName ?? 'student'}`}><CircleDollarSign className="size-3.5" aria-hidden="true" />Pay</button>
                                    <button className="btn-icon text-muted-foreground hover:text-foreground" onClick={() => openHistory(fee)} title="Payment history" aria-label={`Payment history for ${fee.studentName ?? 'student'}`}><History size={14} /></button>
                                    {canManageFees && <button className="btn-icon text-muted-foreground hover:text-foreground" onClick={() => openEdit(fee)} title="Edit" aria-label={`Edit fee record for ${fee.studentName ?? 'student'}`}><Edit3 size={14} /></button>}
                                    {canManageFees && <button className="btn-icon text-destructive/80 hover:text-destructive" onClick={() => handleDelete(fee)} title="Delete" aria-label={`Delete fee record for ${fee.studentName ?? 'student'}`}><Trash2 size={14} /></button>}
                                </span>
                            )}
                            emptyState={<p className="text-sm">No matching records found for the current filters.</p>}
                        />
                    )}
                </>
            )}
            </div>

            {/* Dialogs live outside the tabs: "Add record" is in the header on every tab. */}
                    <Modal
                        isOpen={showAddModal}
                        onClose={() => setShowAddModal(false)}
                        title={editingFee ? 'Edit fee record' : 'Add fee record'}
                        footer={<>
                            <button className="btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                            <button className="btn-primary" onClick={handleSave} disabled={saving || !formTotal}>
                                {saving ? 'Saving…' : editingFee ? 'Save changes' : 'Create record'}
                            </button>
                        </>}
                    >
                        <div className="flex flex-col gap-4">
                            {!editingFee && (
                                <>
                                    <div>
                                        <label htmlFor="fee-term" className="mb-2 block text-xs font-semibold text-muted-foreground">Term *</label>
                                        <TermSelect id="fee-term" terms={terms} years={years} value={formTerm} onChange={v => { setFormTerm(v); setFormStudent(''); }} emptyLabel="Select term…" />
                                    </div>
                                    <div>
                                        <label htmlFor="fee-class" className="mb-2 block text-xs font-semibold text-muted-foreground">Class</label>
                                        <select id="fee-class" value={formClass} onChange={e => { setFormClass(e.target.value); setFormStudent(''); }} className="input-field w-full">
                                            <option value="">All classes</option>
                                            {gradeStreams.map(gs => <option key={gs.id} value={gs.id}>{gs.full_name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label htmlFor="fee-student" className="mb-2 block text-xs font-semibold text-muted-foreground">Student *</label>
                                        <select
                                            id="fee-student"
                                            value={formStudent}
                                            onChange={e => setFormStudent(e.target.value)}
                                            className="input-field w-full"
                                        >
                                            <option value="">Select student...</option>
                                            {availableStudentsForAdd.map(s => (
                                                <option key={s.id} value={s.id}>{s.name}{s.admission ? ` (${s.admission})` : ''}</option>
                                            ))}
                                        </select>
                                        {billedStudentsForFormTerm.size > 0 && (
                                            <p className="mt-1 text-[11px] text-muted-foreground">
                                                {billedStudentsForFormTerm.size} student(s) already have a record for this term and are hidden here — edit them from the list instead.
                                            </p>
                                        )}
                                    </div>
                                </>
                            )}
                            <div>
                                <label htmlFor="fee-total" className="mb-2 block text-xs font-semibold text-muted-foreground">Total fee (KSh) *</label>
                                <input id="fee-total" type="number" min="0" step="0.01" value={formTotal} onChange={e => setFormTotal(e.target.value)} placeholder="e.g. 50000" className="input-field w-full" />
                                {editingFee && (
                                    <p className="mt-1 text-[11px] text-muted-foreground">
                                        {formatCurrency(editingFee.paidAmount)} paid to date — use <strong>Record Payment</strong> from the list to log a new payment.
                                    </p>
                                )}
                            </div>
                            <div>
                                <label htmlFor="fee-due" className="mb-2 block text-xs font-semibold text-muted-foreground">Due date</label>
                                <input id="fee-due" type="date" value={formDueDate} onChange={e => setFormDueDate(e.target.value)} className="input-field w-full" />
                            </div>
                            <div>
                                <label htmlFor="fee-notes" className="mb-2 block text-xs font-semibold text-muted-foreground">Notes</label>
                                <textarea id="fee-notes" value={formNotes} onChange={e => setFormNotes(e.target.value)} rows={3} placeholder="Optional notes..." className="input-field w-full resize-y" />
                            </div>
                        </div>
                    </Modal>

                    {/* ── A learner's account; before Record payment so that dialog opens over it ── */}
                    <FeeAccountDrawer
                        studentId={account?.studentId ?? null}
                        studentName={account?.name}
                        onClose={() => setAccount(null)}
                        onRecordPayment={canCollect ? payFromAccount : undefined}
                        version={accountVersion}
                        canLinkParents={can('school.manage')}
                    />

                    {/* ── Record Payment ── */}
                    <Modal
                        isOpen={!!payingFee}
                        onClose={() => setPayingFee(null)}
                        title="Record payment"
                        footer={<>
                            <button className="btn-secondary" onClick={() => setPayingFee(null)}>Cancel</button>
                            <button className="btn-primary" onClick={submitPayment} disabled={paySaving}>
                                {paySaving ? 'Saving…' : 'Record payment'}
                            </button>
                        </>}
                    >
                        {payingFee && (
                            <div className="flex flex-col gap-4">
                                <div className="rounded-xl bg-muted/40 p-3 text-sm">
                                    <div className="font-semibold">{payingFee.studentName}</div>
                                    <div className="text-xs text-muted-foreground">
                                        {payingFee.admissionNumber} · {payingFee.termName} · Balance {formatCurrency(payingFee.balance)}
                                    </div>
                                </div>
                                <div>
                                    <label htmlFor="pay-amount" className="mb-2 block text-xs font-semibold text-muted-foreground">Amount (KSh) *</label>
                                    <input id="pay-amount" type="number" inputMode="decimal" min="0" step="0.01" value={payAmount} onChange={e => setPayAmount(e.target.value)} className="input-field w-full" />
                                    {payingFee.balance > 0 && (
                                        <p className="mt-1 text-[11px] text-muted-foreground">
                                            Balance {formatCurrency(payingFee.balance)}
                                            {Number(payAmount) > payingFee.balance && ' · more than the balance; the extra is kept as credit (overpaid)'}
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <label htmlFor="pay-date" className="mb-2 block text-xs font-semibold text-muted-foreground">Date paid</label>
                                    <input id="pay-date" type="date" value={payDate} max={todayIso()} onChange={e => setPayDate(e.target.value)} className="input-field w-full" />
                                    <p className="mt-1 text-[11px] text-muted-foreground">Change it when recording an older deposit slip or M-Pesa message.</p>
                                </div>
                                <div>
                                    <label htmlFor="pay-method" className="mb-2 block text-xs font-semibold text-muted-foreground">Payment method</label>
                                    <select id="pay-method" value={payMethod} onChange={e => setPayMethod(e.target.value as FeePaymentMethod)} className="input-field w-full">
                                        {FEE_PAYMENT_METHODS.map(m => (
                                            <option key={m} value={m}>{methodLabel(m)}</option>
                                        ))}
                                    </select>
                                </div>
                                {payMethod === 'MPESA' && (
                                    <div>
                                        <label htmlFor="pay-ref" className="mb-2 block text-xs font-semibold text-muted-foreground">M-Pesa receipt code</label>
                                        <input id="pay-ref" type="text" value={payMpesaRef} onChange={e => setPayMpesaRef(e.target.value)} placeholder="e.g. QGX7ZZ99AA" className="input-field w-full" />
                                        <p className="mt-1 text-[11px] text-muted-foreground">For a paybill payment confirmed by SMS — enter it here until M-Pesa auto-reconciliation is set up.</p>
                                    </div>
                                )}
                                <div>
                                    <label htmlFor="pay-payer" className="mb-2 block text-xs font-semibold text-muted-foreground">Paid by (optional)</label>
                                    <input id="pay-payer" type="text" value={payPayerName} onChange={e => setPayPayerName(e.target.value)} placeholder="Guardian name" className="input-field w-full" />
                                </div>
                                <div>
                                    <label htmlFor="pay-phone" className="mb-2 block text-xs font-semibold text-muted-foreground">Phone (optional)</label>
                                    <input id="pay-phone" type="tel" inputMode="tel" value={payPhone} onChange={e => setPayPhone(e.target.value)} placeholder="07XXXXXXXX" className="input-field w-full" />
                                </div>
                                <div>
                                    <label htmlFor="pay-notes" className="mb-2 block text-xs font-semibold text-muted-foreground">Notes</label>
                                    <textarea id="pay-notes" value={payNotes} onChange={e => setPayNotes(e.target.value)} rows={2} className="input-field w-full resize-y" />
                                </div>
                                {payError && <p role="alert" className="text-sm text-destructive">{payError}</p>}
                            </div>
                        )}
                    </Modal>

                    {/* ── Payment History ── */}
                    <Modal isOpen={!!historyFee} onClose={() => setHistoryFee(null)} title="Payment history" size="lg">
                        {historyFee && (
                            <div>
                                <div className="mb-4 flex flex-col gap-3 rounded-xl bg-muted/40 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <div className="font-semibold">{historyFee.studentName}</div>
                                        <div className="text-xs text-muted-foreground">
                                            {[historyFee.className, historyFee.admissionNumber, historyFee.termName].filter(Boolean).join(' · ')} · {formatCurrency(historyFee.paidAmount)} of {formatCurrency(historyFee.totalFee)} paid
                                        </div>
                                    </div>
                                    <button className="btn-primary h-9 shrink-0 text-xs" onClick={() => { const fee = historyFee; setHistoryFee(null); openPay(fee); }}>
                                        <CircleDollarSign className="size-3.5" aria-hidden="true" />Record payment
                                    </button>
                                </div>
                                {historyLoading ? (
                                    <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
                                ) : historyPayments.length === 0 ? (
                                    <p className="py-8 text-center text-sm text-muted-foreground">No payments recorded yet.</p>
                                ) : (
                                    <div className="overflow-hidden rounded-xl border border-border/70">
                                        <div className="w-full overflow-x-auto">
                                          <table className="data-table">
                                              <thead>
                                                  <tr>
                                                      <th>Receipt</th>
                                                      <th>Date</th>
                                                      <th>Method</th>
                                                      <th>Transaction Code</th>
                                                      <th>Amount</th>
                                                      <th>Status</th>
                                                      <th />
                                                  </tr>
                                              </thead>
                                              <tbody>
                                                  {historyPayments.map(p => (
                                                      <tr key={p.id}>
                                                          <td data-label="Receipt" className="font-mono text-xs">{p.receiptNumber}</td>
                                                          <td data-label="Date" className="text-xs">{new Date(p.paidAt).toLocaleDateString('en-GB')}</td>
                                                          <td data-label="Method">{methodLabel(p.method)}</td>
                                                          <td data-label="Transaction Code" className="font-mono text-xs">{p.mpesaReceiptNumber || p.pesapalConfirmationCode || '—'}</td>
                                                          <td data-label="Amount" className="font-semibold">{formatCurrency(p.amount)}</td>
                                                          <td data-label="Status">
                                                              {statusBadge(p.status)}
                                                          </td>
                                                          <td data-label="" className="whitespace-nowrap text-right">
                                                              {p.status === 'COMPLETED' && (
                                                                  <>
                                                                      <a
                                                                          className="btn-icon text-muted-foreground hover:text-foreground"
                                                                          href={receiptUrl(p.id)}
                                                                          target="_blank"
                                                                          rel="noreferrer"
                                                                          title="Download Receipt"
                                                                      >
                                                                          <Receipt size={14} />
                                                                      </a>
                                                                      {canManageFees && (
                                                                          <button className="btn-icon text-destructive/80 hover:text-destructive" onClick={() => voidPayment(p)} title="Void Payment">
                                                                              <Ban size={14} />
                                                                          </button>
                                                                      )}
                                                                  </>
                                                              )}
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

            <ConfirmDialog
                isOpen={pendingConfirm !== null}
                onClose={() => { if (!confirming) setPendingConfirm(null); }}
                onConfirm={() => void runConfirmed()}
                title={pendingConfirm?.title ?? ''}
                message={pendingConfirm?.message ?? ''}
                confirmText={pendingConfirm?.confirmText}
                variant="danger"
                loading={confirming}
            />
        </div>
    );
}
