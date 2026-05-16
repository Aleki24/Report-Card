"use client";

import React, { useEffect, useState } from 'react';
import { Plus, Search, Edit3, Trash2, DollarSign } from 'lucide-react';
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

    const fetchFees = async () => {
        try {
            const res = await fetch('/api/school/fees');
            const json = await res.json();
            if (json.data) setFees(json.data);
        } catch (err) {
            console.error('Failed to load fees:', err);
        }
        setLoading(false);
    };

    useEffect(() => {
        Promise.all([
            fetchFees(),
            fetch('/api/school/data?type=grade_streams').then(r => r.json()).catch(() => ({})),
            fetch('/api/school/data?type=terms').then(r => r.json()).catch(() => ({})),
        ]);
    }, []);

    useEffect(() => {
        (async () => {
            const [sRes, tRes] = await Promise.all([
                fetch('/api/school/data?type=students'),
                fetch('/api/school/data?type=terms'),
            ]);
            const sData = await sRes.json();
            const tData = await tRes.json();

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
        })();
    }, []);

    const filtered = fees.filter(f =>
        !search || f.studentName?.toLowerCase().includes(search.toLowerCase())
    );

    const stats = {
        total: fees.length,
        pending: fees.filter(f => f.status === 'PENDING').length,
        paid: fees.filter(f => f.status === 'PAID' || f.status === 'OVERPAID').length,
        partial: fees.filter(f => f.status === 'PARTIAL').length,
    };

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
            }}>
                {status}
            </span>
        );
    };

    return (
        <div>
            <PageHeader
                title="Fees Management"
                description="Track student fee balances and payments"
                breadcrumbs={[{ label: 'Home', href: '/dashboard' }, { label: 'Fees' }]}
                action={<button className="btn-primary" onClick={openAdd} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Plus size={14} /> Add Fee Record</button>}
            />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
                <StatCard label="Total Records" value={stats.total} sub="All fee records" icon={DollarSign} />
                <StatCard label="Pending" value={stats.pending} sub="No payments yet" icon={DollarSign} iconClassName="bg-amber-500/10 text-amber-500" />
                <StatCard label="Partial" value={stats.partial} sub="Partially paid" icon={DollarSign} iconClassName="bg-blue-500/10 text-blue-500" />
                <StatCard label="Paid" value={stats.paid} sub="Fully paid" icon={DollarSign} iconClassName="bg-primary/10 text-primary" />
            </div>

            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                <div style={{ flex: 1, position: 'relative' }}>
                    <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                    <input
                        type="text"
                        placeholder="Search by student name..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        style={{ width: '100%', padding: '10px 12px 10px 36px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13, outline: 'none' }}
                    />
                </div>
            </div>

            {loading ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>Loading...</div>
            ) : filtered.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>
                    {search ? 'No matching records.' : 'No fee records yet. Click "Add Fee Record" to create one.'}
                </div>
            ) : (
                <div className="table-wrapper">
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
                                    <td style={{ fontWeight: 600 }}>{fee.studentName || '—'}</td>
                                    <td style={{ color: '#64748B' }}>{fee.admissionNumber || '—'}</td>
                                    <td>{fee.termName || '—'}</td>
                                    <td style={{ fontFamily: 'monospace' }}>{fee.totalFee.toLocaleString()}</td>
                                    <td style={{ fontFamily: 'monospace' }}>{fee.paidAmount.toLocaleString()}</td>
                                    <td style={{ fontFamily: 'monospace', color: fee.balance > 0 ? '#EF4444' : '#10B981', fontWeight: 600 }}>
                                        {fee.balance.toLocaleString()}
                                    </td>
                                    <td style={{ color: '#64748B', fontSize: 12 }}>
                                        {fee.dueDate ? new Date(fee.dueDate).toLocaleDateString('en-GB') : '—'}
                                    </td>
                                    <td>{statusBadge(fee.status)}</td>
                                    <td>
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
                                    style={{ width: '100%', padding: '10px 12px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13, background: '#fff' }}
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
                                    style={{ width: '100%', padding: '10px 12px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13, background: '#fff' }}
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
                        <input
                            type="number"
                            value={formTotal}
                            onChange={e => setFormTotal(e.target.value)}
                            placeholder="e.g. 50000"
                            style={{ width: '100%', padding: '10px 12px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13 }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>Paid Amount (KShs)</label>
                        <input
                            type="number"
                            value={formPaid}
                            onChange={e => setFormPaid(e.target.value)}
                            placeholder="e.g. 20000"
                            style={{ width: '100%', padding: '10px 12px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13 }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>Due Date</label>
                        <input
                            type="date"
                            value={formDueDate}
                            onChange={e => setFormDueDate(e.target.value)}
                            style={{ width: '100%', padding: '10px 12px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13 }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>Notes</label>
                        <textarea
                            value={formNotes}
                            onChange={e => setFormNotes(e.target.value)}
                            rows={3}
                            placeholder="Optional notes..."
                            style={{ width: '100%', padding: '10px 12px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13, resize: 'vertical' }}
                        />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                        <button className="btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                        <button className="btn-primary" onClick={handleSave} disabled={saving}>
                            {saving ? 'Saving...' : editingFee ? 'Update' : 'Create'}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
