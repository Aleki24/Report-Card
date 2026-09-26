"use client";

import PageHeader from '@/components/dashboard/PageHeader';
import React, { Suspense, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Plus, Search, Edit3, Trash2, Save, RotateCcw, Wallet, ArrowUpRight, Clock, AlertTriangle, Upload, FileText, CircleDollarSign, History, Download, Ban, Receipt, Layers } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { toast } from 'sonner';
import { requestJson, jsonBody } from '@/lib/api-error-message';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';
import { PageTabs, useUrlTab, type PageTab } from '@/components/ui/PageTabs';
import { DataTable, StatTile, TermSelect, type TermSelectYear } from '@/components/ui';
import { humanize } from '@/lib/text';
import { cn } from '@/lib/utils';
import { findActiveTermId } from '@/lib/term-calendar';
import { computeFeeStatus, isOverdue, FEE_PAYMENT_METHODS, type FeePayment, type FeePaymentMethod } from '@/lib/fees';

interface FeeRecord {
    id: string;
    totalFee: number;
    paidAmount: number;
    balance: number;
    dueDate: string;
    status: string;
    notes: string;
    termId: string | null;
    termName: string;
    studentName: string | null;
    admissionNumber: string | null;
    studentId: string | null;
    gradeStreamId: string | null;
    className: string | null;
    createdAt: string;
    updatedAt: string;
}

interface StudentOption {
    id: string;
    name: string;
    admission: string;
    gradeStreamId?: string | null;
    status?: string;
}

interface TermOption {
    id: string;
    name: string;
    academic_year_id: string | null;
}

/** Rows of /api/school/data?type=students, as far as this page reads them. */
interface StudentApiRow {
    id: string;
    admission_number: string | null;
    current_grade_stream_id: string | null;
    status: string;
    users: { first_name: string | null; last_name: string | null } | null;
}

const toStudentOption = (s: StudentApiRow): StudentOption => ({
    id: s.id,
    name: `${s.users?.first_name || ''} ${s.users?.last_name || ''}`.trim(),
    admission: s.admission_number ?? '',
    gradeStreamId: s.current_grade_stream_id || null,
    status: s.status,
});

type FeesMode = 'list' | 'payments' | 'batch';

/** One row of the batch screen. Money already paid is read from the ledger, never typed. */
interface BatchEntry {
    total: string;
    /** New money received now, recorded as a payment on save. */
    payNow: string;
    dueDate: string;
    notes: string;
    existing: FeeRecord | null;
}

const emptyBatchEntry = (existing: FeeRecord | null): BatchEntry => ({
    total: existing ? String(existing.totalFee) : '',
    payNow: '',
    dueDate: existing?.dueDate || '',
    notes: existing?.notes || '',
    existing,
});

/** Whether the fee part of a row differs from what is saved. */
const feeChanged = (e: BatchEntry) =>
    e.total !== '' && (
        !e.existing
        || Number(e.total) !== e.existing.totalFee
        || (e.dueDate || '') !== (e.existing.dueDate || '')
        || (e.notes || '') !== (e.existing.notes || '')
    );

const methodLabel = (m: string) => (m === 'MPESA' ? 'M-Pesa' : humanize(m));

interface StreamOption {
    id: string;
    full_name: string;
}

interface PaymentLogRow {
    id: string;
    studentFeeId: string | null;
    receiptNumber: string;
    amount: number;
    method: string;
    status: string;
    source: 'AUTO' | 'MANUAL';
    studentName: string | null;
    admissionNumber: string | null;
    unmatchedReference: string | null;
    termId: string | null;
    termName: string | null;
    mpesaReceiptNumber: string | null;
    pesapalConfirmationCode: string | null;
    notes: string | null;
    recordedByName: string | null;
    paidAt: string;
}

function timeAgo(dateStr: string): string {
    if (!dateStr) return '';
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diff = Math.max(0, now - then);
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString('en-GB');
}

/** Today as YYYY-MM-DD in the viewer's time zone (what a date input shows). */
function todayIso(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const receiptUrl = (paymentId: string) => `/api/school/fees/payments/${paymentId}/receipt`;

/** Runs `task` over `items`, at most `limit` at a time. */
async function runLimited<T>(items: readonly T[], limit: number, task: (item: T) => Promise<void>): Promise<void> {
    let next = 0;
    const worker = async () => {
        while (next < items.length) {
            const item = items[next++];
            await task(item);
        }
    };
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

/** A destructive action waiting for the user to confirm it. */
interface PendingConfirm {
    title: string;
    message: string;
    confirmText: string;
    run: () => Promise<void>;
}

const FEES_TABS: readonly PageTab<FeesMode>[] = [
    { id: 'list', label: 'Fee records', shortLabel: 'Records', icon: FileText, hue: 'emerald' },
    // The school-wide log exposes every receipt; it is admin-only on the server.
    { id: 'payments', label: 'Payments', icon: Receipt, hue: 'blue' },
    { id: 'batch', label: 'Batch entry', shortLabel: 'Batch', icon: Layers, hue: 'violet' },
];

/** Requests in flight at once while a batch saves. */
const BATCH_CONCURRENCY = 6;

function formatCurrency(n: number): string {
    return `KSh ${n.toLocaleString()}`;
}

const STATUS_BADGE: Record<string, string> = {
    PENDING: 'badge-warning',
    PARTIAL: 'badge-info',
    PAID: 'badge-success',
    OVERPAID: 'badge-info',
    COMPLETED: 'badge-success',
    FAILED: 'badge-danger',
    CANCELLED: 'badge-danger',
};

const statusBadge = (status: string) => (
    <span className={`badge whitespace-nowrap ${STATUS_BADGE[status] || 'badge-warning'}`}>{humanize(status)}</span>
);

/** Balance figures: red when owing, green when settled (theme-aware viz tokens). */
const balanceColor = (balance: number) => (balance > 0 ? 'var(--viz-bad)' : 'var(--viz-good)');

export default function FeesPage() {
    return (
        <Suspense fallback={<div className="mx-auto h-64 w-full max-w-7xl animate-pulse rounded-2xl bg-muted/40" aria-hidden="true" />}>
            <FeesPageInner />
        </Suspense>
    );
}

function FeesPageInner() {
    const { role } = useAuth();
    // Deleting a record and voiding receipts are admin-only on the server.
    const isAdmin = role === 'ADMIN';
    const visibleTabs = useMemo(() => FEES_TABS.filter(t => t.id !== 'payments' || isAdmin), [isAdmin]);
    const [mode, selectMode] = useUrlTab(visibleTabs, 'view');
    const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);
    const [confirming, setConfirming] = useState(false);
    const [fees, setFees] = useState<FeeRecord[]>([]);
    const [loading, setLoading] = useState(true);
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
    const [batchStream, setBatchStream] = useState('');
    const [batchTerm, setBatchTerm] = useState('');
    const [batchStudents, setBatchStudents] = useState<StudentOption[]>([]);
    const [batchEntries, setBatchEntries] = useState<Record<string, BatchEntry>>({});
    const [batchMethod, setBatchMethod] = useState<FeePaymentMethod>('CASH');
    const [bulkFee, setBulkFee] = useState('');
    const [bulkDue, setBulkDue] = useState('');
    const [batchSaving, setBatchSaving] = useState(false);
    const [batchMsg, setBatchMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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

    // Payment history modal
    const [historyFee, setHistoryFee] = useState<FeeRecord | null>(null);
    const [historyPayments, setHistoryPayments] = useState<FeePayment[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);

    // Payments log (school-wide transactions view)
    const [paymentsLog, setPaymentsLog] = useState<PaymentLogRow[]>([]);
    /** How many payments match, when the log shows only the newest of them. */
    const [paymentsLogTotal, setPaymentsLogTotal] = useState<number | null>(null);
    const [paymentsLogLoading, setPaymentsLogLoading] = useState(false);
    // Paybill money that could not be matched to a student; assigned in Settings > Payments.
    const [unmatchedCount, setUnmatchedCount] = useState(0);
    const [plSearch, setPlSearch] = useState('');
    // What the log is actually filtered by: the search box, 300ms after typing stops.
    const [plSearchQuery, setPlSearchQuery] = useState('');
    const [plMethod, setPlMethod] = useState('');
    const [plStatus, setPlStatus] = useState('');
    const [plSource, setPlSource] = useState('');
    const [plDateFrom, setPlDateFrom] = useState('');
    const [plDateTo, setPlDateTo] = useState('');

    useEffect(() => {
        if (!isAdmin) return;
        const controller = new AbortController();
        fetch('/api/school/fees/unmatched', { cache: 'no-store', signal: controller.signal })
            .then(r => (r.ok ? r.json() : null))
            .then((j: { data?: unknown[] } | null) => setUnmatchedCount(j?.data?.length ?? 0))
            .catch(() => {});
        return () => controller.abort();
    }, [isAdmin]);

    useEffect(() => {
        const timer = window.setTimeout(() => setPlSearchQuery(plSearch.trim()), 300);
        return () => window.clearTimeout(timer);
    }, [plSearch]);

    const fetchFees = useCallback(async () => {
        try {
            const params = new URLSearchParams();
            if (selectedTerm) params.set('term_id', selectedTerm);
            const res = await fetch(`/api/school/fees?${params}`);
            const json = await res.json();
            if (json.data) setFees(json.data);
        } catch (err) {
            console.error('Failed to load fees:', err);
        }
        setLoading(false);
    }, [selectedTerm]);

    useEffect(() => {
        fetchFees();
    }, [fetchFees]);

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
        })();
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
        const outstanding = kpiFees.reduce((s, f) => s + f.balance, 0);
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

    // ── Payments log (school-wide transactions view) ──

    const fetchPaymentsLog = useCallback(async () => {
        setPaymentsLogLoading(true);
        try {
            const params = new URLSearchParams();
            if (selectedTerm) params.set('term_id', selectedTerm);
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
    }, [selectedTerm, plMethod, plStatus, plSource, plDateFrom, plDateTo, plSearchQuery]);

    useEffect(() => {
        if (mode === 'payments') fetchPaymentsLog();
    }, [mode, fetchPaymentsLog]);


    // Unmatched payments have no fee to void against; they are assigned from
    // Settings > Payments, and the log offers no void button for them.
    const voidLogPayment = (payment: PaymentLogRow) => {
        if (!payment.studentFeeId) return;
        confirmVoid(payment, payment.studentFeeId, () => Promise.all([fetchPaymentsLog(), fetchFees()]));
    };

    const exportPaymentsLog = () => {
        const params = new URLSearchParams();
        if (selectedTerm) params.set('term_id', selectedTerm);
        if (plMethod) params.set('method', plMethod);
        if (plStatus) params.set('status', plStatus);
        if (plSource) params.set('source', plSource);
        if (plDateFrom) params.set('date_from', plDateFrom);
        if (plDateTo) params.set('date_to', plDateTo);
        // The same rows as on screen: the search used to be left out.
        if (plSearchQuery) params.set('search', plSearchQuery);
        window.location.href = `/api/school/fees/payments/export?${params}`;
    };

    // ── Batch entry ──

    const loadBatchStudents = useCallback(async () => {
        if (!batchStream || !batchTerm) return;
        try {
            const [res, feeRes] = await Promise.all([
                fetch(`/api/school/data?type=students&grade_stream_id=${batchStream}`, { cache: 'no-store' }),
                fetch(`/api/school/fees?term_id=${batchTerm}`, { cache: 'no-store' }),
            ]);
            const json: { data?: StudentApiRow[] } = await res.json();
            const feeJson: { data?: FeeRecord[] } = await feeRes.json();
            const mapped = (json.data || [])
                .filter(s => !s.status || s.status === 'ACTIVE')
                .map(toStudentOption)
                .sort((a, b) => a.name.localeCompare(b.name));
            // Matched by student id: admission numbers are optional.
            const byStudent = new Map((feeJson.data || []).filter(f => f.studentId).map(f => [f.studentId as string, f]));
            setBatchStudents(mapped);
            setBatchEntries(Object.fromEntries(mapped.map(s => [s.id, emptyBatchEntry(byStudent.get(s.id) ?? null)])));
        } catch (err) {
            console.error('Failed to load batch students:', err);
            setBatchMsg({ type: 'error', text: 'Failed to load students.' });
        }
    }, [batchStream, batchTerm]);

    useEffect(() => {
        if (mode === 'batch' && batchStream && batchTerm) {
            setBatchMsg(null);
            loadBatchStudents();
        }
    }, [mode, batchStream, batchTerm, loadBatchStudents]);

    const updateBatchEntry = (studentId: string, field: 'total' | 'payNow' | 'dueDate' | 'notes', value: string) => {
        setBatchEntries(prev => ({
            ...prev,
            [studentId]: { ...prev[studentId], [field]: value },
        }));
    };

    const applyToAll = (field: 'total' | 'dueDate', value: string) => {
        if (!value) return;
        setBatchEntries(prev => Object.fromEntries(Object.entries(prev).map(([id, e]) => [id, { ...e, [field]: value }])));
    };

    const batchChanges = useMemo(() => {
        const rows = Object.values(batchEntries);
        const fees = rows.filter(feeChanged).length;
        const payments = rows.filter(e => Number(e.payNow) > 0);
        return { fees, payments: payments.length, paymentTotal: payments.reduce((sum, e) => sum + Number(e.payNow), 0) };
    }, [batchEntries]);

    const saveBatch = async () => {
        setBatchSaving(true);
        setBatchMsg(null);
        const errors: string[] = [];
        let savedFees = 0;
        let savedPayments = 0;
        const nameOf = (id: string) => batchStudents.find(s => s.id === id)?.name || 'A student';

        // A few at a time: a class of fifty used to send up to a hundred requests at once.
        await runLimited(Object.entries(batchEntries), BATCH_CONCURRENCY, async ([studentId, entry]) => {
            const payNow = Number(entry.payNow) || 0;
            const saveFee = feeChanged(entry);
            if (!saveFee && payNow <= 0) return;

            const total = Number(entry.total);
            if (entry.total !== '' && (isNaN(total) || total < 0)) {
                errors.push(`${nameOf(studentId)}: the fee must be 0 or more`);
                return;
            }
            if (payNow < 0) {
                errors.push(`${nameOf(studentId)}: a payment can't be negative. Void a receipt from Payment history instead.`);
                return;
            }

            let feeId = entry.existing?.id ?? null;
            if (saveFee) {
                try {
                    const res = await fetch('/api/school/fees', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ student_id: studentId, term_id: batchTerm, total_fee: total, due_date: entry.dueDate || null, notes: entry.notes || null }),
                    });
                    const body: { data?: { id: string }; error?: string } = await res.json();
                    if (!res.ok || !body.data) {
                        errors.push(`${nameOf(studentId)}: ${body.error || 'fee not saved'}`);
                        return;
                    }
                    feeId = body.data.id;
                    savedFees++;
                } catch {
                    errors.push(`${nameOf(studentId)}: fee not saved`);
                    return;
                }
            }

            if (payNow > 0) {
                if (!feeId) {
                    errors.push(`${nameOf(studentId)}: set a fee before recording a payment`);
                    return;
                }
                try {
                    const res = await fetch(`/api/school/fees/${feeId}/payments`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ amount: payNow, method: batchMethod, notes: 'Batch entry' }),
                    });
                    if (!res.ok) {
                        const body: { error?: string } = await res.json().catch(() => ({}));
                        errors.push(`${nameOf(studentId)}: payment not recorded (${body.error || res.status})`);
                        return;
                    }
                    savedPayments++;
                } catch {
                    errors.push(`${nameOf(studentId)}: payment not recorded`);
                }
            }
        });

        // Always reload: rows that did save now have a new "paid so far", and a
        // stale screen is what let a second save record the same money twice.
        await Promise.all([fetchFees(), loadBatchStudents()]);
        setBatchSaving(false);

        const summary = `${savedFees} fee record(s) saved, ${savedPayments} payment(s) recorded.`;
        setBatchMsg(errors.length === 0
            ? { type: 'success', text: summary }
            : { type: 'error', text: `${summary} ${errors.length} problem(s): ${errors.slice(0, 4).join('; ')}${errors.length > 4 ? '…' : ''}` });
    };

    const clearBatch = () => {
        setBulkFee('');
        setBulkDue('');
        setBatchEntries({});
        setBatchStudents([]);
        setBatchMsg(null);
        setBatchStream('');
        setBatchTerm('');
    };

    const exportExcel = () => {
        const params = new URLSearchParams();
        if (selectedTerm) params.set('term_id', selectedTerm);
        if (statusFilter) params.set('status', statusFilter);
        if (streamFilter) params.set('grade_stream_id', streamFilter);
        window.location.href = `/api/school/fees/export?${params}`;
    };

    function changeMode(next: FeesMode) {
        if (next === mode) return;
        if (mode === 'batch') clearBatch();
        selectMode(next);
    }

    return (
        <div className="mx-auto w-full max-w-7xl pb-10">
            <PageHeader
                title="Fees"
                eyebrow="Finance"
                icon={Wallet}
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
                    {mode !== 'batch' && (
                        <button
                            className="btn-secondary h-11"
                            onClick={mode === 'payments' ? exportPaymentsLog : exportExcel}
                            title={mode === 'payments' ? 'Export the payments log to Excel' : 'Export the current view to Excel'}
                        >
                            <Download className="size-4" aria-hidden="true" />Export
                        </button>
                    )}
                    <button className={cn('btn-primary h-11', mode === 'batch' && 'col-span-2')} onClick={openAdd}>
                        <Plus className="size-4" aria-hidden="true" />Add record
                    </button>
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
                    <a href="/dashboard/settings?tab=payments" className="btn-secondary w-full shrink-0 sm:w-auto">Assign payments</a>
                </div>
            )}

            {/* ── KPI Cards ── */}
            <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatTile icon={Wallet} hue="blue" label="Expected" value={formatCurrency(kpi.expected)} hint={`${kpi.records} record${kpi.records === 1 ? '' : 's'}${streamFilter ? ` · ${gradeStreams.find(g => g.id === streamFilter)?.full_name ?? 'this class'}` : ''}`} />
                <StatTile icon={ArrowUpRight} label="Collected" value={formatCurrency(kpi.collected)} hint={`${kpi.collectionRate}% collection rate`} tone="good" />
                <StatTile icon={Clock} label="Outstanding" value={formatCurrency(kpi.outstanding)} hint="unpaid balance" tone={kpi.outstanding > 0 ? 'warn' : 'default'} />
                <StatTile icon={AlertTriangle} label="Overdue" value={formatCurrency(kpi.overdueAmount)} hint={`${kpi.overdueCount} overdue record(s)`} tone={kpi.overdueCount > 0 ? 'bad' : 'default'} />
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

            <div role="tabpanel" id="fees-panel" aria-labelledby={`fees-tab-${mode}`}>
            {/* ════════════════════════════════════════════ */}
            {/* BATCH ENTRY MODE                           */}
            {/* ════════════════════════════════════════════ */}
            {mode === 'batch' && (
                <div>
                    <div className="mb-4 rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
                        <h2 className="font-semibold">Batch fee entry</h2>
                        <p className="mt-0.5 mb-4 text-xs text-muted-foreground">
                            Pick a class and term, set each student&apos;s fee, and enter any money received now. Payments already on record are shown, not re-entered.
                        </p>
                        <div className="grid gap-3 md:grid-cols-2">
                            <div>
                                <label htmlFor="batch-class" className="mb-2 block text-xs font-medium text-muted-foreground">Class</label>
                                <select id="batch-class" className="input-field w-full" value={batchStream} onChange={e => setBatchStream(e.target.value)}>
                                    <option value="">Select class…</option>
                                    {gradeStreams.map(gs => <option key={gs.id} value={gs.id}>{gs.full_name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label htmlFor="batch-term" className="mb-2 block text-xs font-medium text-muted-foreground">Term</label>
                                <TermSelect id="batch-term" terms={terms} years={years} value={batchTerm} onChange={setBatchTerm} emptyLabel="Select term…" />
                            </div>
                        </div>

                        {batchStream && batchTerm && batchStudents.length > 0 && (
                            <div className="mt-4 grid gap-3 border-t border-border/60 pt-4 md:grid-cols-3">
                                <div>
                                    <label htmlFor="bulk-fee" className="mb-2 block text-xs font-medium text-muted-foreground">Same fee for everyone (KSh)</label>
                                    <div className="flex gap-2">
                                        <input id="bulk-fee" type="number" inputMode="decimal" min="0" step="0.01" className="input-field min-w-0 flex-1" placeholder="e.g. 45000" value={bulkFee} onChange={e => setBulkFee(e.target.value)} />
                                        <button type="button" className="btn-secondary h-11 shrink-0" onClick={() => applyToAll('total', bulkFee)} disabled={!bulkFee}>Apply</button>
                                    </div>
                                </div>
                                <div>
                                    <label htmlFor="bulk-due" className="mb-2 block text-xs font-medium text-muted-foreground">Same due date for everyone</label>
                                    <div className="flex gap-2">
                                        <input id="bulk-due" type="date" className="input-field min-w-0 flex-1" value={bulkDue} onChange={e => setBulkDue(e.target.value)} />
                                        <button type="button" className="btn-secondary h-11 shrink-0" onClick={() => applyToAll('dueDate', bulkDue)} disabled={!bulkDue}>Apply</button>
                                    </div>
                                </div>
                                <div>
                                    <label htmlFor="batch-method" className="mb-2 block text-xs font-medium text-muted-foreground">Payments below were received by</label>
                                    <select id="batch-method" className="input-field w-full" value={batchMethod} onChange={e => setBatchMethod(e.target.value as FeePaymentMethod)}>
                                        {FEE_PAYMENT_METHODS.filter(m => m !== 'PESAPAL').map(m => <option key={m} value={m}>{methodLabel(m)}</option>)}
                                    </select>
                                </div>
                            </div>
                        )}

                        {batchMsg && (
                            <div role={batchMsg.type === 'error' ? 'alert' : 'status'} className={cn('mt-4 rounded-xl border p-3 text-sm', batchMsg.type === 'success' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'border-destructive/30 bg-destructive/5 text-destructive')}>
                                {batchMsg.text}
                            </div>
                        )}
                    </div>

                    {!batchStream || !batchTerm ? (
                        <div className="rounded-2xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
                            Choose a class and a term to load its students.
                        </div>
                    ) : batchStudents.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
                            No active students in this class.
                        </div>
                    ) : (
                        <>
                            <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
                                <div className="w-full overflow-x-auto">
                                    <table className="data-table">
                                        <thead>
                                            <tr>
                                                <th className="min-w-44">Student</th>
                                                <th className="min-w-32">Fee (KSh)</th>
                                                <th className="min-w-28 text-right">Paid so far</th>
                                                <th className="min-w-32">Payment now (KSh)</th>
                                                <th className="min-w-28 text-right">Balance after</th>
                                                <th className="min-w-36">Due date</th>
                                                <th className="min-w-32">Notes</th>
                                                <th>Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {batchStudents.map(s => {
                                                const entry = batchEntries[s.id];
                                                if (!entry) return null;
                                                const hasTotal = entry.total !== '';
                                                const total = Number(entry.total) || 0;
                                                const paidSoFar = entry.existing?.paidAmount ?? 0;
                                                const paidAfter = paidSoFar + (Number(entry.payNow) || 0);
                                                const balance = total - paidAfter;
                                                const dirty = feeChanged(entry) || Number(entry.payNow) > 0;
                                                return (
                                                    <tr key={s.id} className={cn(dirty && 'bg-primary/[0.04]')}>
                                                        <td data-label="Student">
                                                            <div className="font-semibold">{s.name}</div>
                                                            <div className="text-[11px] text-muted-foreground">{s.admission || 'No admission no.'}{entry.existing ? '' : ' · not billed yet'}</div>
                                                        </td>
                                                        <td data-label="Fee (KSh)">
                                                            <input type="number" inputMode="decimal" min="0" step="0.01" className="input-field input-field-sm w-full min-w-24" placeholder="0" aria-label={`Fee for ${s.name}`} value={entry.total} onChange={e => updateBatchEntry(s.id, 'total', e.target.value)} />
                                                        </td>
                                                        <td data-label="Paid so far" className="text-right tabular-nums text-muted-foreground">{paidSoFar.toLocaleString()}</td>
                                                        <td data-label="Payment now">
                                                            <input type="number" inputMode="decimal" min="0" step="0.01" className="input-field input-field-sm w-full min-w-24" placeholder="0" aria-label={`Payment received now for ${s.name}`} value={entry.payNow} onChange={e => updateBatchEntry(s.id, 'payNow', e.target.value)} />
                                                        </td>
                                                        <td data-label="Balance after" className="text-right font-mono font-semibold tabular-nums" style={{ color: hasTotal ? balanceColor(balance) : undefined }}>
                                                            {hasTotal ? balance.toLocaleString() : '—'}
                                                        </td>
                                                        <td data-label="Due date">
                                                            <input type="date" className="input-field input-field-sm min-w-32" aria-label={`Due date for ${s.name}`} value={entry.dueDate} onChange={e => updateBatchEntry(s.id, 'dueDate', e.target.value)} />
                                                        </td>
                                                        <td data-label="Notes">
                                                            <input type="text" className="input-field input-field-sm w-full min-w-24" placeholder="Notes" aria-label={`Notes for ${s.name}`} value={entry.notes} onChange={e => updateBatchEntry(s.id, 'notes', e.target.value)} />
                                                        </td>
                                                        <td data-label="Status">{hasTotal ? statusBadge(computeFeeStatus(total, paidAfter)) : '—'}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Sticky save bar: the table can be long, the button must stay reachable. */}
                            <div className="sticky bottom-20 z-10 mt-4 flex flex-col gap-3 rounded-2xl border border-border/70 bg-card/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between md:bottom-4">
                                <p className="text-sm text-muted-foreground" aria-live="polite">
                                    {batchChanges.fees === 0 && batchChanges.payments === 0
                                        ? 'No changes yet.'
                                        : `${batchChanges.fees} fee change(s) · ${batchChanges.payments} payment(s) totalling ${formatCurrency(batchChanges.paymentTotal)}`}
                                </p>
                                <div className="grid grid-cols-2 gap-2">
                                    <button className="btn-secondary" onClick={loadBatchStudents} disabled={batchSaving}>
                                        <RotateCcw className="size-4" aria-hidden="true" />Discard
                                    </button>
                                    <button className="btn-primary" onClick={saveBatch} disabled={batchSaving || (batchChanges.fees === 0 && batchChanges.payments === 0)}>
                                        <Save className="size-4" aria-hidden="true" />{batchSaving ? 'Saving…' : 'Save all'}
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* ════════════════════════════════════════════ */}
            {/* PAYMENTS LOG (school-wide transactions)       */}
            {/* ════════════════════════════════════════════ */}
            {mode === 'payments' && (
                <div>
                    <section aria-label="Payment filters" className="mb-4 rounded-2xl border border-border/70 bg-card p-3 shadow-sm sm:p-4">
                        <div className="relative">
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
                                {p.status !== 'CANCELLED' && (
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
                                {p.status === 'COMPLETED' && p.studentFeeId && (
                                    <button className="btn-icon text-destructive/80 hover:text-destructive" onClick={() => voidLogPayment(p)} title="Void Payment">
                                        <Ban size={14} />
                                    </button>
                                )}
                            </span>
                        )}
                        emptyState={<p className="py-6 text-sm">No payments match these filters.</p>}
                    />
                </div>
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
                    ) : fees.length === 0 ? (
                        /* ── Guided Onboarding Empty State ── */
                        <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center">
                            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary/10 flex items-center justify-center">
                                <Wallet size={32} className="text-primary" />
                            </div>
                            <h3 className="text-lg font-bold mb-2">No Fee Records Yet</h3>
                            <p className="text-sm text-muted-foreground max-w-md mx-auto mb-8 leading-relaxed">
                                Get started by setting up fee structures, adding individual records, or importing data in bulk for your classes.
                            </p>
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
                            onRowClick={openHistory}
                            rowActions={fee => (
                                <span className="inline-flex items-center gap-1 whitespace-nowrap">
                                    <button className="btn-primary h-8 rounded-lg px-3 text-xs" onClick={() => openPay(fee)} title="Record a payment" aria-label={`Record payment for ${fee.studentName ?? 'student'}`}><CircleDollarSign className="size-3.5" aria-hidden="true" />Pay</button>
                                    <button className="btn-icon text-muted-foreground hover:text-foreground" onClick={() => openHistory(fee)} title="Payment history" aria-label={`Payment history for ${fee.studentName ?? 'student'}`}><History size={14} /></button>
                                    <button className="btn-icon text-muted-foreground hover:text-foreground" onClick={() => openEdit(fee)} title="Edit" aria-label={`Edit fee record for ${fee.studentName ?? 'student'}`}><Edit3 size={14} /></button>
                                    {isAdmin && <button className="btn-icon text-destructive/80 hover:text-destructive" onClick={() => handleDelete(fee)} title="Delete" aria-label={`Delete fee record for ${fee.studentName ?? 'student'}`}><Trash2 size={14} /></button>}
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
                                                              {p.status !== 'CANCELLED' && (
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
                                                                      {isAdmin && (
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
