"use client";

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Plus, Search, Edit3, Trash2, List, Save, RotateCcw, Wallet, ArrowUpRight, Clock, AlertTriangle, Upload, FileText, ChevronDown } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import PageHeader from '@/components/dashboard/PageHeader';
import StatCard from '@/components/dashboard/StatCard';
import { Modal } from '@/components/ui/Modal';
import { DataTable } from '@/components/ui';
import { findActiveTermId } from '@/lib/term-calendar';
import { computeFeeStatus, isOverdue } from '@/lib/fees';

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
}

interface StreamOption {
    id: string;
    full_name: string;
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

function formatCurrency(n: number): string {
    return `KSh ${n.toLocaleString()}`;
}

const statusBadge = (status: string) => {
    const classes: Record<string, string> = {
        PENDING: 'badge-warning',
        PARTIAL: 'badge-info',
        PAID: 'badge-success',
        OVERPAID: 'badge-info',
    };
    return <span className={`badge whitespace-nowrap ${classes[status] || 'badge-info'}`}>{status}</span>;
};

/** Balance figures: red when owing, green when settled (theme-aware viz tokens). */
const balanceColor = (balance: number) => (balance > 0 ? 'var(--viz-bad)' : 'var(--viz-good)');

export default function FeesPage() {
    const { profile } = useAuth();
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
    const [saving, setSaving] = useState(false);
    const [showActionsDropdown, setShowActionsDropdown] = useState(false);
    const actionsRef = useRef<HTMLDivElement>(null);

    // Form state
    const [formStudent, setFormStudent] = useState('');
    const [formTerm, setFormTerm] = useState('');
    const [formTotal, setFormTotal] = useState('');
    const [formPaid, setFormPaid] = useState('');
    const [formDueDate, setFormDueDate] = useState('');
    const [formNotes, setFormNotes] = useState('');

    // Batch entry state
    const [mode, setMode] = useState<'list' | 'batch'>('list');
    const [gradeStreams, setGradeStreams] = useState<StreamOption[]>([]);
    const [batchStream, setBatchStream] = useState('');
    const [batchTerm, setBatchTerm] = useState('');
    const [batchStudents, setBatchStudents] = useState<StudentOption[]>([]);
    const [batchEntries, setBatchEntries] = useState<Record<string, { total: string; paid: string; dueDate: string; notes: string; existing: FeeRecord | null }>>({});
    const [batchSaving, setBatchSaving] = useState(false);
    const [batchMsg, setBatchMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (actionsRef.current && !actionsRef.current.contains(e.target as Node)) {
                setShowActionsDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

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
            const [sRes, tRes, gsRes] = await Promise.all([
                fetch('/api/school/data?type=students'),
                fetch('/api/school/data?type=terms'),
                fetch('/api/school/data?type=grade_streams'),
            ]);
            const sData = await sRes.json();
            const tData = await tRes.json();
            const gsData = await gsRes.json();

            if (sData.data) {
                setStudents(sData.data.map((s: any) => ({
                    id: s.id,
                    name: `${s.users?.first_name || ''} ${s.users?.last_name || ''}`.trim(),
                    admission: s.admission_number,
                    gradeStreamId: s.current_grade_stream_id || null,
                    status: s.status,
                })));
            }
            if (tData.data) {
                setTerms(tData.data.map((t: any) => ({ id: t.id, name: t.name })));
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
        if (streamFilter) {
            // Fee records carry admission numbers; resolve class through the roster
            const admissionsInStream = new Set(
                students.filter(s => s.gradeStreamId === streamFilter).map(s => s.admission)
            );
            result = result.filter(f => f.admissionNumber && admissionsInStream.has(f.admissionNumber));
        }
        return result;
    }, [fees, search, statusFilter, streamFilter, students]);

    const kpi = useMemo(() => {
        const expected = fees.reduce((s, f) => s + f.totalFee, 0);
        const collected = fees.reduce((s, f) => s + f.paidAmount, 0);
        const outstanding = fees.reduce((s, f) => s + f.balance, 0);
        const overdue = fees.filter(f => isOverdue(f.dueDate, f.balance));
        const overdueAmount = overdue.reduce((s, f) => s + f.balance, 0);
        const collectionRate = expected > 0 ? Math.round((collected / expected) * 100) : 0;
        return { expected, collected, outstanding, overdueCount: overdue.length, overdueAmount, collectionRate };
    }, [fees]);

    // Students who've left the school shouldn't show up as billing targets for new records.
    const activeStudents = useMemo(() => students.filter(s => !s.status || s.status === 'ACTIVE'), [students]);

    // Students who already have a fee record for the term selected in the Add
    // modal — hidden from the picker so a fresh "Add" can't silently clobber
    // an existing balance via the upsert; only reliable when `fees` was
    // loaded for that same term (the common case, since formTerm defaults to
    // the page's selected term). Falls back to showing everyone otherwise.
    const billedAdmissionsForFormTerm = useMemo(() => {
        if (!formTerm || formTerm !== selectedTerm) return new Set<string>();
        return new Set(fees.filter(f => f.admissionNumber).map(f => f.admissionNumber as string));
    }, [fees, formTerm, selectedTerm]);

    const availableStudentsForAdd = useMemo(
        () => activeStudents.filter(s => !billedAdmissionsForFormTerm.has(s.admission)),
        [activeStudents, billedAdmissionsForFormTerm]
    );

    const openAdd = () => {
        setEditingFee(null);
        setFormStudent('');
        setFormTerm(selectedTerm);
        setFormTotal('');
        setFormPaid('');
        setFormDueDate('');
        setFormNotes('');
        setShowAddModal(true);
        setShowActionsDropdown(false);
    };

    const openBatch = () => {
        setMode('batch');
        setShowActionsDropdown(false);
    };

    const openEdit = (fee: FeeRecord) => {
        setEditingFee(fee);
        setFormTotal(String(fee.totalFee));
        setFormPaid(String(fee.paidAmount));
        setFormDueDate(fee.dueDate || '');
        setFormNotes(fee.notes || '');
        setShowAddModal(true);
    };

    const handleSave = async () => {
        if (!formTotal) return;
        setSaving(true);
        try {
            if (editingFee) {
                await fetch(`/api/school/fees/${editingFee.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        total_fee: parseFloat(formTotal),
                        paid_amount: parseFloat(formPaid) || 0,
                        due_date: formDueDate || null,
                        notes: formNotes || null,
                    }),
                });
            } else {
                if (!formStudent || !formTerm) return;
                await fetch('/api/school/fees', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        student_id: formStudent,
                        term_id: formTerm,
                        total_fee: parseFloat(formTotal),
                        paid_amount: parseFloat(formPaid) || 0,
                        due_date: formDueDate || null,
                        notes: formNotes || null,
                    }),
                });
            }
            setShowAddModal(false);
            await fetchFees();
        } catch (err) {
            console.error('Save failed:', err);
        }
        setSaving(false);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this fee record?')) return;
        try {
            await fetch(`/api/school/fees/${id}`, { method: 'DELETE' });
            await fetchFees();
        } catch (err) {
            console.error('Delete failed:', err);
        }
    };

    // ── Batch entry ──

    const loadBatchStudents = useCallback(async () => {
        if (!batchStream) return;
        setBatchMsg(null);
        try {
            const res = await fetch(`/api/school/data?type=students&grade_stream_id=${batchStream}`);
            const json = await res.json();
            const mapped: StudentOption[] = (json.data || [])
                .filter((s: any) => !s.status || s.status === 'ACTIVE')
                .map((s: any) => ({
                    id: s.id,
                    name: `${s.users?.first_name || ''} ${s.users?.last_name || ''}`.trim(),
                    admission: s.admission_number || '',
                }));
            setBatchStudents(mapped);

            const feeRes = await fetch(`/api/school/fees?term_id=${batchTerm || ''}`);
            const feeJson = await feeRes.json();
            const existingFees: FeeRecord[] = feeJson.data || [];

            const entries: Record<string, { total: string; paid: string; dueDate: string; notes: string; existing: FeeRecord | null }> = {};
            for (const s of mapped) {
                // Match existing records by admission number — names are ambiguous
                const existing = existingFees.find(f => f.admissionNumber && f.admissionNumber === s.admission);
                entries[s.id] = {
                    total: existing ? String(existing.totalFee) : '',
                    paid: existing ? String(existing.paidAmount) : '0',
                    dueDate: existing ? (existing.dueDate || '') : '',
                    notes: existing ? (existing.notes || '') : '',
                    existing: existing || null,
                };
            }
            setBatchEntries(entries);
        } catch (err) {
            console.error('Failed to load batch students:', err);
            setBatchMsg({ type: 'error', text: 'Failed to load students.' });
        }
    }, [batchStream, batchTerm]);

    useEffect(() => {
        if (mode === 'batch' && batchStream && batchTerm) {
            loadBatchStudents();
        }
    }, [mode, batchStream, batchTerm, loadBatchStudents]);

    const updateBatchEntry = (studentId: string, field: 'total' | 'paid' | 'dueDate' | 'notes', value: string) => {
        setBatchEntries(prev => ({
            ...prev,
            [studentId]: { ...prev[studentId], [field]: value },
        }));
    };

    const saveBatch = async () => {
        setBatchSaving(true);
        setBatchMsg(null);
        const errors: string[] = [];
        let saved = 0;

        const promises = Object.entries(batchEntries).map(async ([studentId, entry]) => {
            // Skip untouched rows, but let an explicit 0 through (fee waivers).
            if (entry.total === '' || entry.total == null) return;
            const totalValue = parseFloat(entry.total);
            if (isNaN(totalValue) || totalValue < 0) return;
            try {
                const res = await fetch('/api/school/fees', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        student_id: studentId,
                        term_id: batchTerm,
                        total_fee: totalValue,
                        paid_amount: parseFloat(entry.paid) || 0,
                        due_date: entry.dueDate || null,
                        notes: entry.notes || null,
                    }),
                });
                if (!res.ok) {
                    const errData = await res.json();
                    errors.push(`${batchStudents.find(s => s.id === studentId)?.name || studentId}: ${errData.error}`);
                } else {
                    saved++;
                }
            } catch {
                errors.push(batchStudents.find(s => s.id === studentId)?.name || studentId);
            }
        });

        await Promise.all(promises);
        setBatchSaving(false);

        if (errors.length === 0) {
            setBatchMsg({ type: 'success', text: `${saved} fee record(s) saved successfully.` });
            await fetchFees();
        } else {
            setBatchMsg({ type: 'error', text: `Saved ${saved}, but ${errors.length} failed. ${errors.slice(0, 3).join('; ')}` });
        }
    };

    const clearBatch = () => {
        setBatchEntries({});
        setBatchStudents([]);
        setBatchMsg(null);
        setBatchStream('');
        setBatchTerm('');
    };

    const switchToList = () => {
        setMode('list');
        clearBatch();
    };

    const totalRecords = fees.length;

    return (
        <div>
            <PageHeader
                title="Fees Management"
                description="Track student fee balances and payment collection"
                breadcrumbs={[{ label: 'Home', href: '/dashboard' }, { label: 'Fees' }]}
                action={
                    <div className="flex gap-2 items-center flex-wrap">
                        <select
                            className="input-field"
                            style={{ width: 'auto', minWidth: 140, height: 36 }}
                            value={selectedTerm}
                            onChange={e => { setSelectedTerm(e.target.value); setLoading(true); }}
                        >
                            <option value="">All Terms</option>
                            {terms.map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                        </select>

                        {mode === 'list' ? (
                            <div className="relative" ref={actionsRef}>
                                <button
                                    className="btn-primary"
                                    onClick={() => setShowActionsDropdown(!showActionsDropdown)}
                                >
                                    <Plus size={14} /> Add Record <ChevronDown size={12} />
                                </button>
                                {showActionsDropdown && (
                                    <div className="absolute right-0 top-full mt-1 w-52 bg-card border border-border rounded-xl shadow-lg z-50 py-1 animate-fade-in">
                                        <button
                                            className="flex items-center gap-3 w-full px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted/60 transition-colors text-left"
                                            onClick={openAdd}
                                        >
                                            <FileText size={15} className="text-primary" />
                                            Add Fee Record
                                        </button>
                                        <button
                                            className="flex items-center gap-3 w-full px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted/60 transition-colors text-left"
                                            onClick={openBatch}
                                        >
                                            <Upload size={15} className="text-primary" />
                                            Batch Entry
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <button className="btn-secondary" onClick={switchToList}>
                                <List size={14} /> List View
                            </button>
                        )}
                    </div>
                }
            />

            {/* ── KPI Cards ── */}
            <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
                <StatCard label="Expected" value={formatCurrency(kpi.expected)} sub={`${totalRecords} record(s)`} icon={Wallet} iconClassName="bg-primary/15 text-primary" />
                <StatCard label="Collected" value={formatCurrency(kpi.collected)} sub={`${kpi.collectionRate}% collection rate`} icon={ArrowUpRight} iconClassName="bg-primary/15 text-primary" />
                <StatCard label="Outstanding" value={formatCurrency(kpi.outstanding)} sub="Total unpaid balance" icon={Clock} iconClassName="bg-amber-500/15 text-amber-600" />
                <StatCard label="Overdue" value={formatCurrency(kpi.overdueAmount)} sub={`${kpi.overdueCount} overdue record(s)`} icon={AlertTriangle} iconClassName="bg-destructive/15 text-destructive" />
            </div>

            {/* ── Collection meter ── */}
            <div className="mb-5 rounded-2xl border border-border/60 bg-card/90 p-4 shadow-sm">
                <div className="mb-2 flex items-center justify-between text-xs">
                    <span className="font-semibold text-foreground">Term collection progress</span>
                    <span className="text-muted-foreground">
                        {kpi.collectionRate}% collected · {kpi.collectionRate >= 80 ? 'Healthy' : kpi.collectionRate >= 50 ? 'Moderate' : 'Needs attention'}
                    </span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-primary/15">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, kpi.collectionRate)}%` }} />
                </div>
            </div>

            {/* ════════════════════════════════════════════ */}
            {/* BATCH ENTRY MODE                           */}
            {/* ════════════════════════════════════════════ */}
            {mode === 'batch' && (
                <div>
                    <div className="card mb-4 p-5">
                        <h3 className="font-bold text-sm mb-3">Batch Fee Entry</h3>
                        <div className="flex flex-wrap gap-4 items-end">
                            <div className="flex-1 min-w-[200px]">
                                <label className="block text-xs text-muted-foreground mb-1 font-medium">Class/Stream</label>
                                <select className="input-field w-full" value={batchStream} onChange={e => setBatchStream(e.target.value)}>
                                    <option value="">Select class...</option>
                                    {gradeStreams.map(s => (
                                        <option key={s.id} value={s.id}>{s.full_name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex-1 min-w-[200px]">
                                <label className="block text-xs text-muted-foreground mb-1 font-medium">Term</label>
                                <select className="input-field w-full" value={batchTerm} onChange={e => setBatchTerm(e.target.value)}>
                                    <option value="">Select term...</option>
                                    {terms.map(t => (
                                        <option key={t.id} value={t.id}>{t.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex gap-2">
                                <button className="btn-primary" onClick={saveBatch} disabled={batchSaving || !batchStream || !batchTerm || batchStudents.length === 0}>
                                    <Save size={14} /> {batchSaving ? 'Saving...' : 'Save All'}
                                </button>
                                <button className="btn-secondary" onClick={clearBatch}>
                                    <RotateCcw size={14} /> Clear
                                </button>
                            </div>
                        </div>
                        {batchMsg && (
                            <div className={`mt-3 p-3 rounded-md text-sm ${batchMsg.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'}`}>
                                {batchMsg.text}
                            </div>
                        )}
                    </div>

                    {batchStream && batchTerm && (
                        <>
                            {batchStudents.length === 0 ? (
                                <div className="card py-12 text-center text-muted-foreground text-sm">
                                    Select a class and term, then students will load here.
                                </div>
                            ) : (
                                <div style={{ overflowX: 'auto' }}>
                                    <table className="data-table">
                                        <thead>
                                            <tr>
                                                <th style={{ minWidth: 180 }}>Student</th>
                                                <th>Admission</th>
                                                <th style={{ minWidth: 120 }}>Total Fee (KShs)</th>
                                                <th style={{ minWidth: 120 }}>Paid (KShs)</th>
                                                <th style={{ minWidth: 100 }}>Balance</th>
                                                <th style={{ minWidth: 140 }}>Due Date</th>
                                                <th>Notes</th>
                                                <th>Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {batchStudents.map(s => {
                                                const entry = batchEntries[s.id];
                                                const hasTotal = !!entry?.total && entry.total !== '';
                                                const total = parseFloat(entry?.total || '0');
                                                const paid = parseFloat(entry?.paid || '0');
                                                const balance = total - paid;
                                                const status = computeFeeStatus(total, paid);
                                                return (
                                                    <tr key={s.id}>
                                                        <td data-label="Student" className="font-semibold">{s.name}</td>
                                                        <td data-label="Admission" className="text-muted-foreground text-xs">{s.admission}</td>
                                                        <td data-label="Total Fee">
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                step="0.01"
                                                                className="input-field w-full"
                                                                style={{ minWidth: 100, height: 32, fontSize: 12 }}
                                                                placeholder="0"
                                                                value={entry?.total || ''}
                                                                onChange={e => updateBatchEntry(s.id, 'total', e.target.value)}
                                                            />
                                                        </td>
                                                        <td data-label="Paid">
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                step="0.01"
                                                                className="input-field w-full"
                                                                style={{ minWidth: 100, height: 32, fontSize: 12 }}
                                                                placeholder="0"
                                                                value={entry?.paid || ''}
                                                                onChange={e => updateBatchEntry(s.id, 'paid', e.target.value)}
                                                            />
                                                        </td>
                                                        <td data-label="Balance" style={{ fontFamily: 'monospace', color: balanceColor(balance), fontWeight: 600 }}>
                                                            {hasTotal ? balance.toLocaleString() : '—'}
                                                        </td>
                                                        <td data-label="Due Date">
                                                            <input
                                                                type="date"
                                                                className="input-field"
                                                                style={{ minWidth: 130, height: 32, fontSize: 12 }}
                                                                value={entry?.dueDate || ''}
                                                                onChange={e => updateBatchEntry(s.id, 'dueDate', e.target.value)}
                                                            />
                                                        </td>
                                                        <td data-label="Notes">
                                                            <input
                                                                type="text"
                                                                className="input-field"
                                                                style={{ minWidth: 100, height: 32, fontSize: 12 }}
                                                                placeholder="Notes"
                                                                value={entry?.notes || ''}
                                                                onChange={e => updateBatchEntry(s.id, 'notes', e.target.value)}
                                                            />
                                                        </td>
                                                        <td data-label="Status">{hasTotal ? statusBadge(status) : '—'}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* ════════════════════════════════════════════ */}
            {/* LIST VIEW                                    */}
            {/* ════════════════════════════════════════════ */}
            {mode === 'list' && (
                <>
                    {/* ── Smart Filters ── */}
                    <div className="card p-4 mb-4">
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="relative flex-1 min-w-[200px] max-w-xs">
                                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                <input
                                    type="text"
                                    placeholder="Search student or admission..."
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    className="input-field w-full pl-9"
                                />
                            </div>
                            <div className="min-w-[140px]">
                                <select
                                    className="input-field w-full"
                                    value={statusFilter}
                                    onChange={e => setStatusFilter(e.target.value)}
                                >
                                    <option value="">All Statuses</option>
                                    <option value="PENDING">Pending</option>
                                    <option value="PARTIAL">Partial</option>
                                    <option value="PAID">Paid</option>
                                    <option value="OVERPAID">Overpaid</option>
                                </select>
                            </div>
                            <div className="min-w-[180px]">
                                <select
                                    className="input-field w-full"
                                    value={streamFilter}
                                    onChange={e => setStreamFilter(e.target.value)}
                                >
                                    <option value="">All Classes</option>
                                    {gradeStreams.map(s => (
                                        <option key={s.id} value={s.id}>{s.full_name}</option>
                                    ))}
                                </select>
                            </div>
                            <span className="text-xs text-muted-foreground ml-auto">
                                {filtered.length} of {fees.length} record(s)
                            </span>
                        </div>
                    </div>

                    {/* ── Empty State / Table ── */}
                    {loading ? (
                        <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>
                    ) : fees.length === 0 ? (
                        /* ── Guided Onboarding Empty State ── */
                        <div className="card py-12 px-6 text-center">
                            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary/10 flex items-center justify-center">
                                <Wallet size={32} className="text-primary" />
                            </div>
                            <h3 className="text-lg font-bold mb-2">No Fee Records Yet</h3>
                            <p className="text-sm text-muted-foreground max-w-md mx-auto mb-8 leading-relaxed">
                                Get started by setting up fee structures, adding individual records, or importing data in bulk for your classes.
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl mx-auto">
                                <button
                                    className="card p-5 text-left hover:border-primary/60 transition-all cursor-pointer"
                                    onClick={openAdd}
                                >
                                    <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center mb-3">
                                        <FileText size={20} />
                                    </div>
                                    <h4 className="font-bold text-sm mb-1">Add Fee Record</h4>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        Create a fee record for an individual student with amount, due date, and notes.
                                    </p>
                                </button>
                                <button
                                    className="card p-5 text-left hover:border-primary/60 transition-all cursor-pointer"
                                    onClick={openBatch}
                                >
                                    <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center mb-3">
                                        <Upload size={20} />
                                    </div>
                                    <h4 className="font-bold text-sm mb-1">Batch Entry</h4>
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
                                        <div>
                                            <div className="font-semibold text-sm">{fee.studentName || '—'}</div>
                                            <div className="text-[11px] text-muted-foreground">{fee.admissionNumber || ''}</div>
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
                            rowActions={fee => (
                                <span className="whitespace-nowrap">
                                    <button className="btn-icon text-muted-foreground hover:text-foreground" onClick={() => openEdit(fee)} title="Edit"><Edit3 size={14} /></button>
                                    <button className="btn-icon text-destructive/80 hover:text-destructive" onClick={() => handleDelete(fee.id)} title="Delete"><Trash2 size={14} /></button>
                                </span>
                            )}
                            emptyState={<p className="text-sm">No matching records found for the current filters.</p>}
                        />
                    )}

                    <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title={editingFee ? 'Edit Fee Record' : 'Add Fee Record'}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            {!editingFee && (
                                <>
                                    <div>
                                        <label className="mb-1 block text-xs font-semibold text-muted-foreground">Student *</label>
                                        <select
                                            value={formStudent}
                                            onChange={e => setFormStudent(e.target.value)}
                                            className="input-field w-full"
                                        >
                                            <option value="">Select student...</option>
                                            {availableStudentsForAdd.map(s => (
                                                <option key={s.id} value={s.id}>{s.name} ({s.admission})</option>
                                            ))}
                                        </select>
                                        {billedAdmissionsForFormTerm.size > 0 && (
                                            <p className="mt-1 text-[11px] text-muted-foreground">
                                                {billedAdmissionsForFormTerm.size} student(s) already have a record for this term and are hidden here — edit them from the list instead.
                                            </p>
                                        )}
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-xs font-semibold text-muted-foreground">Term *</label>
                                        <select
                                            value={formTerm}
                                            onChange={e => { setFormTerm(e.target.value); setFormStudent(''); }}
                                            className="input-field w-full"
                                        >
                                            <option value="">Select term...</option>
                                            {terms.map(t => (
                                                <option key={t.id} value={t.id}>{t.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </>
                            )}
                            <div>
                                <label className="mb-1 block text-xs font-semibold text-muted-foreground">Total Fee (KShs) *</label>
                                <input type="number" min="0" step="0.01" value={formTotal} onChange={e => setFormTotal(e.target.value)} placeholder="e.g. 50000" className="input-field w-full" />
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-semibold text-muted-foreground">Paid Amount (KShs)</label>
                                <input type="number" min="0" step="0.01" value={formPaid} onChange={e => setFormPaid(e.target.value)} placeholder="e.g. 20000" className="input-field w-full" />
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-semibold text-muted-foreground">Due Date</label>
                                <input type="date" value={formDueDate} onChange={e => setFormDueDate(e.target.value)} className="input-field w-full" />
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-semibold text-muted-foreground">Notes</label>
                                <textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} rows={3} placeholder="Optional notes..." className="input-field w-full resize-y" />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                                <button className="btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                                <button className="btn-primary" onClick={handleSave} disabled={saving}>
                                    {saving ? 'Saving...' : editingFee ? 'Update' : 'Create'}
                                </button>
                            </div>
                        </div>
                    </Modal>
                </>
            )}
        </div>
    );
}
