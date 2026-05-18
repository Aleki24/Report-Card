"use client";

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Plus, Search, Edit3, Trash2, DollarSign, Grid3X3, List, Save, RotateCcw } from 'lucide-react';
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
            padding: '2px 8px',
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
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingFee, setEditingFee] = useState<FeeRecord | null>(null);
    const [students, setStudents] = useState<StudentOption[]>([]);
    const [terms, setTerms] = useState<TermOption[]>([]);
    const [saving, setSaving] = useState(false);

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

    const fetchFees = useCallback(async () => {
        try {
            const res = await fetch('/api/school/fees');
            const json = await res.json();
            if (json.data) setFees(json.data);
        } catch (err) {
            console.error('Failed to load fees:', err);
        }
        setLoading(false);
    }, []);

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
                setTerms(tData.data.map((t: any) => ({ id: t.id, name: t.name })));
            }
            if (gsData.data) {
                setGradeStreams(gsData.data);
            }
        })();
    }, []);

    const filtered = fees.filter(f =>
        !search || f.studentName?.toLowerCase().includes(search.toLowerCase())
    );

    const stats = useMemo(() => ({
        total: fees.length,
        pending: fees.filter(f => f.status === 'PENDING').length,
        paid: fees.filter(f => f.status === 'PAID' || f.status === 'OVERPAID').length,
        partial: fees.filter(f => f.status === 'PARTIAL').length,
    }), [fees]);

    const openAdd = () => {
        setEditingFee(null);
        setFormStudent('');
        setFormTerm('');
        setFormTotal('');
        setFormPaid('');
        setFormDueDate('');
        setFormNotes('');
        setShowAddModal(true);
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

            // Pre-fill existing fee records for this stream + term
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

    return (
        <div>
            <PageHeader
                title="Fees Management"
                description="Track student fee balances and payments"
                breadcrumbs={[{ label: 'Home', href: '/dashboard' }, { label: 'Fees' }]}
                action={
                    <div className="flex gap-2">
                        <button
                            className={mode === 'batch' ? 'btn-primary' : 'btn-secondary'}
                            onClick={() => setMode(mode === 'batch' ? 'list' : 'batch')}
                        >
                            {mode === 'batch' ? <List size={14} /> : <Grid3X3 size={14} />}
                            {mode === 'batch' ? 'List View' : 'Batch Entry'}
                        </button>
                        {mode === 'list' && (
                            <button className="btn-primary" onClick={openAdd}>
                                <Plus size={14} /> Add Fee Record
                            </button>
                        )}
                    </div>
                }
            />

            {/* ── Stats ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
                <StatCard label="Total Records" value={stats.total} sub="All fee records" icon={DollarSign} />
                <StatCard label="Pending" value={stats.pending} sub="No payments yet" icon={DollarSign} iconClassName="bg-amber-500/10 text-amber-500" />
                <StatCard label="Partial" value={stats.partial} sub="Partially paid" icon={DollarSign} iconClassName="bg-blue-500/10 text-blue-500" />
                <StatCard label="Paid" value={stats.paid} sub="Fully paid" icon={DollarSign} iconClassName="bg-primary/10 text-primary" />
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

                    {/* Batch entry grid */}
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
                    <div className="flex items-center input-field w-full overflow-hidden px-0 mb-4">
                        <span className="flex items-center justify-center pl-3 text-muted-foreground shrink-0">
                            <Search size={16} />
                        </span>
                        <input
                            type="text"
                            placeholder="Search by student name..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="flex-1 border-none outline-none bg-transparent py-1.5 pr-3 text-sm"
                        />
                    </div>

                    {loading ? (
                        <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>Loading...</div>
                    ) : filtered.length === 0 ? (
                        <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>
                            {search ? 'No matching records.' : 'No fee records yet. Click "Add Fee Record" to create one.'}
                        </div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Student</th>
                                        <th>Admission</th>
                                        <th>Term</th>
                                        <th>Total (KShs)</th>
                                        <th>Paid (KShs)</th>
                                        <th>Balance (KShs)</th>
                                        <th>Due Date</th>
                                        <th>Status</th>
                                        <th style={{ width: 100 }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map(fee => (
                                        <tr key={fee.id}>
                                            <td data-label="Student" style={{ fontWeight: 600 }}>{fee.studentName || '—'}</td>
                                            <td data-label="Admission" style={{ color: '#64748B' }}>{fee.admissionNumber || '—'}</td>
                                            <td data-label="Term">{fee.termName || '—'}</td>
                                            <td data-label="Total" style={{ fontFamily: 'monospace' }}>{fee.totalFee.toLocaleString()}</td>
                                            <td data-label="Paid" style={{ fontFamily: 'monospace' }}>{fee.paidAmount.toLocaleString()}</td>
                                            <td data-label="Balance" style={{ fontFamily: 'monospace', color: fee.balance > 0 ? '#EF4444' : '#10B981', fontWeight: 600 }}>
                                                {fee.balance.toLocaleString()}
                                            </td>
                                            <td data-label="Due Date" style={{ color: '#64748B', fontSize: 12 }}>
                                                {fee.dueDate ? new Date(fee.dueDate).toLocaleDateString('en-GB') : '—'}
                                            </td>
                                            <td data-label="Status">{statusBadge(fee.status)}</td>
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
