"use client";

import React, { useEffect, useState } from 'react';
import { Plus, Search, Edit3, Trash2, Briefcase, Eye } from 'lucide-react';
import PageHeader from '@/components/dashboard/PageHeader';
import StatCard from '@/components/dashboard/StatCard';
import { Modal } from '@/components/ui/Modal';

interface Assignment {
    id: string;
    title: string;
    description: string | null;
    dueDate: string;
    fileUrl: string | null;
    subject: string;
    subjectId: string;
    subjectCode: string;
    stream: string | null;
    streamId: string | null;
    createdBy: string;
    createdAt: string;
}

interface SubjectOption {
    id: string;
    name: string;
    code: string;
}

interface StreamOption {
    id: string;
    full_name: string;
}

interface Submission {
    id: string;
    fileUrl: string | null;
    submissionText: string | null;
    submittedAt: string;
    grade: number | null;
    feedback: string | null;
    studentName: string | null;
    admissionNumber: string | null;
    assignmentTitle: string;
}

export default function AssignmentsPage() {
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState<Assignment | null>(null);
    const [saving, setSaving] = useState(false);

    // Submissions
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [showSubmissions, setShowSubmissions] = useState(false);
    const [gradingId, setGradingId] = useState<string | null>(null);
    const [gradeVal, setGradeVal] = useState('');
    const [feedbackVal, setFeedbackVal] = useState('');

    const [subjects, setSubjects] = useState<SubjectOption[]>([]);
    const [streams, setStreams] = useState<StreamOption[]>([]);

    const [formTitle, setFormTitle] = useState('');
    const [formSubject, setFormSubject] = useState('');
    const [formStream, setFormStream] = useState('');
    const [formDueDate, setFormDueDate] = useState('');
    const [formDesc, setFormDesc] = useState('');
    const [formFileUrl, setFormFileUrl] = useState('');

    const fetchAssignments = async () => {
        try {
            const res = await fetch('/api/school/assignments');
            const json = await res.json();
            if (json.data) setAssignments(json.data);
        } catch (err) {
            console.error('Failed to load assignments:', err);
        }
        setLoading(false);
    };

    const fetchSubmissions = async () => {
        try {
            const res = await fetch('/api/school/submissions');
            const json = await res.json();
            if (json.data) setSubmissions(json.data);
        } catch (err) {
            console.error('Failed to load submissions:', err);
        }
    };

    useEffect(() => {
        Promise.all([
            fetchAssignments(),
            fetch('/api/school/data?type=grade_streams').then(r => r.json()).catch(() => ({})),
        ]);
        (async () => {
            const [subjRes, strRes] = await Promise.all([
                fetch('/api/school/data?type=my_subjects'),
                fetch('/api/school/data?type=grade_streams'),
            ]);
            const subjData = await subjRes.json();
            const strData = await strRes.json();
            if (subjData.data) setSubjects(subjData.data.map((s: any) => ({ id: s.id, name: s.name, code: s.code })));
            if (strData.data) setStreams(strData.data.map((s: any) => ({ id: s.id, full_name: s.full_name })));
        })();
    }, []);

    const filtered = assignments.filter(a =>
        !search || a.title.toLowerCase().includes(search.toLowerCase()) || a.subject.toLowerCase().includes(search.toLowerCase())
    );

    const stats = {
        total: assignments.length,
        upcoming: assignments.filter(a => new Date(a.dueDate) > new Date()).length,
        overdue: assignments.filter(a => new Date(a.dueDate) < new Date()).length,
    };

    const openAdd = () => {
        setEditing(null);
        setFormTitle('');
        setFormSubject('');
        setFormStream('');
        setFormDueDate('');
        setFormDesc('');
        setFormFileUrl('');
        setShowModal(true);
    };

    const openEdit = (a: Assignment) => {
        setEditing(a);
        setFormTitle(a.title);
        setFormSubject(a.subjectId);
        setFormStream(a.streamId || '');
        setFormDueDate(a.dueDate.split('T')[0]);
        setFormDesc(a.description || '');
        setFormFileUrl(a.fileUrl || '');
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!formTitle || !formSubject || !formDueDate) return;
        setSaving(true);
        try {
            if (editing) {
                await fetch(`/api/school/assignments/${editing.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        title: formTitle,
                        subject_id: formSubject,
                        grade_stream_id: formStream || null,
                        due_date: formDueDate,
                        description: formDesc || null,
                        file_url: formFileUrl || null,
                    }),
                });
            } else {
                await fetch('/api/school/assignments', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        title: formTitle,
                        subject_id: formSubject,
                        grade_stream_id: formStream || null,
                        due_date: formDueDate,
                        description: formDesc || null,
                        file_url: formFileUrl || null,
                    }),
                });
            }
            setShowModal(false);
            await fetchAssignments();
        } catch (err) {
            console.error('Save failed:', err);
        }
        setSaving(false);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this assignment?')) return;
        try {
            await fetch(`/api/school/assignments/${id}`, { method: 'DELETE' });
            await fetchAssignments();
        } catch (err) {
            console.error('Delete failed:', err);
        }
    };

    const openSubmissions = async () => {
        await fetchSubmissions();
        setShowSubmissions(true);
    };

    const handleGrade = async (submissionId: string) => {
        try {
            await fetch(`/api/school/submissions/${submissionId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    grade: parseFloat(gradeVal) || null,
                    feedback: feedbackVal || null,
                }),
            });
            setGradingId(null);
            setGradeVal('');
            setFeedbackVal('');
            await fetchSubmissions();
        } catch (err) {
            console.error('Grade failed:', err);
        }
    };

    return (
        <div>
            <PageHeader
                title="Assignments"
                description="Create and manage homework and assignments"
                breadcrumbs={[{ label: 'Home', href: '/dashboard' }, { label: 'Assignments' }]}
                action={<button className="btn-primary" onClick={openAdd} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Plus size={14} /> New Assignment</button>}
            />

            <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
                <StatCard label="Total" value={stats.total} sub="All assignments" icon={Briefcase} />
                <StatCard label="Upcoming" value={stats.upcoming} sub="Not yet due" icon={Briefcase} iconClassName="bg-blue-500/10 text-blue-500" />
                <StatCard label="Overdue" value={stats.overdue} sub="Past due date" icon={Briefcase} iconClassName="bg-destructive/10 text-destructive" />
                <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end' }}>
                    <button className="btn-secondary" onClick={openSubmissions} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Eye size={14} /> View Submissions ({submissions.length})
                    </button>
                </div>
            </div>

            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                <div style={{ flex: 1, position: 'relative' }}>
                    <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                    <input
                        type="text"
                        placeholder="Search assignments..."
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
                    {search ? 'No matching assignments.' : 'No assignments yet. Click "New Assignment" to create one.'}
                </div>
            ) : (
                <div className="table-wrapper">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Title</th>
                                <th>Subject</th>
                                <th>Stream</th>
                                <th>Due Date</th>
                                <th>Created By</th>
                                <th style={{ width: 100 }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(a => {
                                const isOverdue = new Date(a.dueDate) < new Date();
                                return (
                                    <tr key={a.id}>
                                        <td style={{ fontWeight: 600 }}>
                                            <div>{a.title}</div>
                                            {a.description && <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>{a.description}</div>}
                                        </td>
                                        <td>{a.subject}</td>
                                        <td style={{ color: '#64748B' }}>{a.stream || 'All streams'}</td>
                                        <td style={{ color: isOverdue ? '#EF4444' : '#1E293B', fontWeight: isOverdue ? 600 : 400 }}>
                                            {new Date(a.dueDate).toLocaleDateString('en-GB')}
                                        </td>
                                        <td style={{ color: '#64748B', fontSize: 12 }}>{a.createdBy}</td>
                                        <td>
                                            <div style={{ display: 'flex', gap: 4 }}>
                                                <button className="btn-icon" onClick={() => openEdit(a)} title="Edit"><Edit3 size={14} /></button>
                                                <button className="btn-icon" onClick={() => handleDelete(a.id)} title="Delete" style={{ color: '#EF4444' }}><Trash2 size={14} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Assignment Modal */}
            <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Assignment' : 'New Assignment'}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>Title *</label>
                        <input type="text" value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="Assignment title"
                            style={{ width: '100%', padding: '10px 12px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13 }} />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>Subject *</label>
                        <select value={formSubject} onChange={e => setFormSubject(e.target.value)}
                            style={{ width: '100%', padding: '10px 12px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13, background: '#fff' }}>
                            <option value="">Select subject...</option>
                            {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>Stream (optional)</label>
                        <select value={formStream} onChange={e => setFormStream(e.target.value)}
                            style={{ width: '100%', padding: '10px 12px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13, background: '#fff' }}>
                            <option value="">All streams</option>
                            {streams.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>Due Date *</label>
                        <input type="date" value={formDueDate} onChange={e => setFormDueDate(e.target.value)}
                            style={{ width: '100%', padding: '10px 12px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13 }} />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>Description</label>
                        <textarea value={formDesc} onChange={e => setFormDesc(e.target.value)} rows={3} placeholder="Assignment description..."
                            style={{ width: '100%', padding: '10px 12px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13, resize: 'vertical' }} />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>File URL (optional)</label>
                        <input type="url" value={formFileUrl} onChange={e => setFormFileUrl(e.target.value)} placeholder="https://..."
                            style={{ width: '100%', padding: '10px 12px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13 }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                        <button className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                        <button className="btn-primary" onClick={handleSave} disabled={saving}>
                            {saving ? 'Saving...' : editing ? 'Update' : 'Create'}
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Submissions Modal */}
            <Modal isOpen={showSubmissions} onClose={() => setShowSubmissions(false)} title="Assignment Submissions" size="xl">
                {submissions.length === 0 ? (
                    <div style={{ padding: 24, textAlign: 'center', color: '#94A3B8' }}>No submissions yet.</div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {submissions.map(sub => (
                            <div key={sub.id} style={{
                                padding: 16, border: '1px solid #E2E8F0', borderRadius: 12, background: '#FAFAFA'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                                    <div>
                                        <div style={{ fontWeight: 700, color: '#1E293B', fontSize: 14 }}>{sub.studentName || 'Unknown'}</div>
                                        <div style={{ fontSize: 12, color: '#64748B' }}>{sub.admissionNumber || ''} · {sub.assignmentTitle}</div>
                                    </div>
                                    <div style={{ fontSize: 11, color: '#94A3B8' }}>
                                        {new Date(sub.submittedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                </div>
                                {sub.submissionText && (
                                    <p style={{ fontSize: 13, color: '#475569', margin: '0 0 8px', background: '#fff', padding: 8, borderRadius: 8, border: '1px solid #E2E8F0' }}>
                                        {sub.submissionText}
                                    </p>
                                )}
                                {sub.fileUrl && (
                                    <a href={sub.fileUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: '#3B82F6', display: 'inline-block', marginBottom: 8 }}>
                                        📎 View Attachment
                                    </a>
                                )}
                                {sub.grade != null && (
                                    <div style={{ marginTop: 8, padding: '8px 12px', background: '#F0FDF4', borderRadius: 8, fontSize: 13 }}>
                                        <strong>Grade:</strong> {sub.grade}% {sub.feedback && <span>· Feedback: {sub.feedback}</span>}
                                    </div>
                                )}
                                {sub.grade == null && (
                                    <div>
                                        {gradingId === sub.id ? (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                                                <input type="number" placeholder="Grade (%)" value={gradeVal}
                                                    onChange={e => setGradeVal(e.target.value)}
                                                    style={{ padding: '8px 12px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13, width: 120 }} />
                                                <input type="text" placeholder="Feedback" value={feedbackVal}
                                                    onChange={e => setFeedbackVal(e.target.value)}
                                                    style={{ padding: '8px 12px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13, flex: 1 }} />
                                                <div style={{ display: 'flex', gap: 4 }}>
                                                    <button className="btn-primary" style={{ fontSize: 12, padding: '6px 12px' }} onClick={() => handleGrade(sub.id)}>Save</button>
                                                    <button className="btn-secondary" style={{ fontSize: 12, padding: '6px 12px' }} onClick={() => setGradingId(null)}>Cancel</button>
                                                </div>
                                            </div>
                                        ) : (
                                            <button className="btn-secondary" style={{ fontSize: 12, padding: '6px 12px', marginTop: 8 }}
                                                onClick={() => { setGradingId(sub.id); setGradeVal(''); setFeedbackVal(''); }}>
                                                Grade Submission
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </Modal>
        </div>
    );
}
