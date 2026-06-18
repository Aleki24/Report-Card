"use client";

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Plus, Search, Edit3, Trash2, Grid3X3, List, Save, RotateCcw, Wallet, ArrowUpRight, Clock, AlertTriangle, Upload, FileText, Percent, ChevronDown } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import PageHeader from '@/components/dashboard/PageHeader';
import StatCard from '@/components/dashboard/StatCard';
import { Modal } from '@/components/ui/Modal';

interface FeeRecord {
    id: string;
    totalFee: number;
    paidAmount: number;
    balance: number;
    dueDate: string;
    status: string;
    notes: string;
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
    const colors: Record<string, string> = {
        PENDING: '#F59E0B',
        PARTIAL: '#3B82F6',
        PAID: '#10B981',
        OVERPAID: '#8B5CF6',
    };
    return (
        <span style={{
            background: `${colors[status] || '#94A3B8'}20`,
            color: colors[status] || '#64748B',
            padding: '3px 10px',
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 600,
            whiteSpace: 'nowrap',
        }}>
            {status}
        </span>
    );
};

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
        Promise.all([
            fetchFees(),
            fetch('/api/school/data?type=grade_streams').then(r => r.json()).catch(() => ({})),
            fetch('/api/school/data?type=terms').then(r => r.json()).catch(() => ({})),
        ]);
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
                })));
            }
            if (tData.data) {
                const termsList = tData.data.map((t: any) => ({ id: t.id, name: t.name }));
                setTerms(termsList);
                // Auto-select first term
                if (!selectedTerm && termsList.length > 0) {
                    setSelectedTerm(termsList[0].id);
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
        return result;
    }, [fees, search, statusFilter]);

    const kpi = useMemo(() => {
        const expected = fees.reduce((s, f) => s + f.totalFee, 0);
        const collected = fees.reduce((s, f) => s + f.paidAmount, 0);
        const outstanding = fees.reduce((s, f) => s + f.balance, 0);
        const now = new Date();
        const overdue = fees.filter(f => f.balance > 0 && f.dueDate && new Date(f.dueDate) < now);
        const overdueAmount = overdue.reduce((s, f) => s + f.balance, 0);
        const collectionRate = expected > 0 ? Math.round((collected / expected) * 100) : 0;
        return { expected, collected, outstanding, overdueCount: overdue.length, overdueAmount, collectionRate };
    }, [fees]);

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
            const mapped: StudentOption[] = (json.data || []).map((s: any) => ({
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
                const existing = existingFees.find(f => f.studentName?.includes(s.name.split(' ')[0]));
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
            if (!entry.total || parseFloat(entry.total) <= 0) return;
            try {
                const res = await fetch('/api/school/fees', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        student_id: studentId,
                        term_id: batchTerm,
                        total_fee: parseFloat(entry.total),
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
                                            <Upload size={15} className="text-blue-500" />
                                            Batch Import
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 20 }}>
                <StatCard label="Expected" value={formatCurrency(kpi.expected)} sub={`${totalRecords} record(s)`} icon={Wallet} iconClassName="bg-primary/15 text-primary" />
                <StatCard label="Collected" value={formatCurrency(kpi.collected)} sub={`${kpi.collectionRate}% collection rate`} icon={ArrowUpRight} iconClassName="bg-emerald-500/15 text-emerald-500" />
                <StatCard label="Outstanding" value={formatCurrency(kpi.outstanding)} sub="Total unpaid balance" icon={Clock} iconClassName="bg-amber-500/15 text-amber-500" />
                <StatCard label="Overdue" value={formatCurrency(kpi.overdueAmount)} sub={`${kpi.overdueCount} overdue record(s)`} icon={AlertTriangle} iconClassName="bg-red-500/15 text-red-500" />
                <StatCard label="Collection Rate" value={`${kpi.collectionRate}%`} sub={kpi.collectionRate >= 80 ? 'Healthy' : kpi.collectionRate >= 50 ? 'Moderate' : 'Needs attention'} icon={Percent} iconClassName="bg-purple-500/15 text-purple-500" />
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
                                                const total = parseFloat(entry?.total || '0');
                                                const paid = parseFloat(entry?.paid || '0');
                                                const balance = total - paid;
                                                const status = paid <= 0 ? 'PENDING' : paid >= total ? (paid > total ? 'OVERPAID' : 'PAID') : 'PARTIAL';
                                                return (
                                                    <tr key={s.id}>
                                                        <td data-label="Student" className="font-semibold">{s.name}</td>
                                                        <td data-label="Admission" className="text-muted-foreground text-xs">{s.admission}</td>
                                                        <td data-label="Total Fee">
                                                            <input
                                                                type="number"
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
                                                                className="input-field w-full"
                                                                style={{ minWidth: 100, height: 32, fontSize: 12 }}
                                                                placeholder="0"
                                                                value={entry?.paid || ''}
                                                                onChange={e => updateBatchEntry(s.id, 'paid', e.target.value)}
                                                            />
                                                        </td>
                                                        <td data-label="Balance" style={{ fontFamily: 'monospace', color: balance > 0 ? '#EF4444' : '#10B981', fontWeight: 600 }}>
                                                            {total > 0 ? balance.toLocaleString() : '—'}
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
                                                        <td data-label="Status">{total > 0 ? statusBadge(status) : '—'}</td>
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
                        <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>Loading...</div>
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
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto">
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
                                    className="card p-5 text-left hover:border-blue-500/60 transition-all cursor-pointer"
                                    onClick={openBatch}
                                >
                                    <div className="w-10 h-10 rounded-xl bg-blue-500/15 text-blue-500 flex items-center justify-center mb-3">
                                        <Upload size={20} />
                                    </div>
                                    <h4 className="font-bold text-sm mb-1">Batch Import</h4>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        Select a class and term, then bulk-enter fees for multiple students at once.
                                    </p>
                                </button>
                                <button
                                    className="card p-5 text-left hover:border-purple-500/60 transition-all cursor-pointer"
                                    onClick={() => {}}
                                >
                                    <div className="w-10 h-10 rounded-xl bg-purple-500/15 text-purple-500 flex items-center justify-center mb-3">
                                        <Grid3X3 size={20} />
                                    </div>
                                    <h4 className="font-bold text-sm mb-1">Set Fee Structure</h4>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        Define standard fee amounts per class, term, and category for faster entry.
                                    </p>
                                </button>
                            </div>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>
                            No matching records found for the current filters.
                        </div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Student</th>
                                        <th>Expected Fee</th>
                                        <th>Paid</th>
                                        <th>Balance</th>
                                        <th>Status</th>
                                        <th>Last Payment Activity</th>
                                        <th style={{ width: 90 }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map(fee => (
                                        <tr key={fee.id}>
                                            <td data-label="Student">
                                                <div className="font-semibold text-sm">{fee.studentName || '—'}</div>
                                                <div className="text-[11px] text-muted-foreground">{fee.admissionNumber || ''}</div>
                                            </td>
                                            <td data-label="Expected" style={{ fontFamily: 'monospace' }}>
                                                {fee.totalFee.toLocaleString()}
                                            </td>
                                            <td data-label="Paid" style={{ fontFamily: 'monospace', color: fee.paidAmount > 0 ? '#10B981' : '#94A3B8' }}>
                                                {fee.paidAmount.toLocaleString()}
                                            </td>
                                            <td data-label="Balance" style={{ fontFamily: 'monospace', color: fee.balance > 0 ? '#EF4444' : '#10B981', fontWeight: 600 }}>
                                                {fee.balance.toLocaleString()}
                                            </td>
                                            <td data-label="Status">{statusBadge(fee.status)}</td>
                                            <td data-label="Activity" style={{ fontSize: 12, color: '#64748B' }}>
                                                <div>{fee.notes || '—'}</div>
                                                <div className="text-[11px] text-muted-foreground mt-0.5">
                                                    {fee.updatedAt ? timeAgo(fee.updatedAt) : ''}
                                                </div>
                                            </td>
                                            <td data-label="Actions">
                                                <div style={{ display: 'flex', gap: 4 }}>
                                                    <button className="btn-icon" onClick={() => openEdit(fee)} title="Edit">
                                                        <Edit3 size={14} />
                                                    </button>
                                                    <button className="btn-icon" onClick={() => handleDelete(fee.id)} title="Delete" style={{ color: '#EF4444' }}>
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title={editingFee ? 'Edit Fee Record' : 'Add Fee Record'}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            {!editingFee && (
                                <>
                                    <div>
                                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>Student *</label>
                                        <select
                                            value={formStudent}
                                            onChange={e => setFormStudent(e.target.value)}
                                            className="input-field w-full"
                                        >
                                            <option value="">Select student...</option>
                                            {students.map(s => (
                                                <option key={s.id} value={s.id}>{s.name} ({s.admission})</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>Term *</label>
                                        <select
                                            value={formTerm}
                                            onChange={e => setFormTerm(e.target.value)}
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
                                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>Total Fee (KShs) *</label>
                                <input type="number" value={formTotal} onChange={e => setFormTotal(e.target.value)} placeholder="e.g. 50000" className="input-field w-full" />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>Paid Amount (KShs)</label>
                                <input type="number" value={formPaid} onChange={e => setFormPaid(e.target.value)} placeholder="e.g. 20000" className="input-field w-full" />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>Due Date</label>
                                <input type="date" value={formDueDate} onChange={e => setFormDueDate(e.target.value)} className="input-field w-full" />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>Notes</label>
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
