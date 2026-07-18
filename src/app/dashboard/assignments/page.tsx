"use client";

import React, { useEffect, useRef, useState } from 'react';
import { Plus, Search, Edit3, Trash2, Eye, FileText, ClockAlert, Paperclip, X } from 'lucide-react';
import { toast } from 'sonner';
import PageHeader from '@/components/dashboard/PageHeader';
import StatCard from '@/components/dashboard/StatCard';
import { Modal } from '@/components/ui/Modal';
import { Drawer } from '@/components/ui/Drawer';

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
    const [formFile, setFormFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

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
        setFormFile(null);
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
        setFormFile(null);
        setShowModal(true);
    };

    const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 10 * 1024 * 1024) { toast.error('File must be less than 10MB.'); return; }
        setFormFile(file);
    };

    const handleSave = async () => {
        if (!formTitle || !formSubject || !formDueDate) return;
        setSaving(true);
        try {
            let fileUrl = formFileUrl;
            if (formFile) {
                setUploading(true);
                const fd = new FormData();
                fd.append('file', formFile);
                const uploadRes = await fetch('/api/school/upload', { method: 'POST', body: fd });
                const uploadJson = await uploadRes.json();
                setUploading(false);
                if (!uploadRes.ok || !uploadJson.url) {
                    toast.error(uploadJson.error || 'File upload failed');
                    setSaving(false);
                    return;
                }
                fileUrl = uploadJson.url;
            }

            const payload = JSON.stringify({
                title: formTitle,
                subject_id: formSubject,
                grade_stream_id: formStream || null,
                due_date: formDueDate,
                description: formDesc || null,
                file_url: fileUrl || null,
            });

            if (editing) {
                await fetch(`/api/school/assignments/${editing.id}`, {
                    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: payload,
                });
            } else {
                await fetch('/api/school/assignments', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload,
                });
            }
            setShowModal(false);
            await fetchAssignments();
        } catch (err) {
            console.error('Save failed:', err);
            toast.error('Failed to save assignment');
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
                action={
                    <div className="flex gap-2">
                        <button className="btn-secondary" onClick={openSubmissions}>
                            <Eye size={14} /> Submissions ({submissions.length})
                        </button>
                        <button className="btn-primary" onClick={openAdd}>
                            <Plus size={14} /> New Assignment
                        </button>
                    </div>
                }
            />

            {/* Stats Grid */}
            <div className="mb-6 grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                <StatCard label="Total" value={stats.total} sub="All assignments" icon={FileText} />
                <StatCard label="Upcoming" value={stats.upcoming} sub="Not yet due" icon={ClockAlert} iconClassName="bg-[color-mix(in_srgb,var(--viz-info)_10%,transparent)] text-[color:var(--viz-info)]" />
                <StatCard label="Overdue" value={stats.overdue} sub="Past due date" icon={ClockAlert} iconClassName="bg-destructive/10 text-destructive" />
            </div>

            {/* Search */}
            <div className="flex items-center input-field overflow-hidden px-0 mb-4" style={{ maxWidth: 400 }}>
                <span className="flex items-center justify-center pl-3 text-muted-foreground shrink-0">
                    <Search size={16} />
                </span>
                <input
                    type="text"
                    placeholder="Search assignments..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="flex-1 border-none outline-none bg-transparent py-1.5 pr-3 text-sm"
                />
            </div>

            {/* Table */}
            {loading ? (
                <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">Loading...</div>
            ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground text-sm gap-2">
                    {search ? 'No matching assignments.' : 'No assignments yet. Click "New Assignment" to create one.'}
                </div>
            ) : (
                <div style={{ overflowX: 'auto' }}>
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
                                        <td data-label="Title" className="font-semibold">
                                            <div className="flex items-center gap-1.5">
                                                {a.title}
                                                {a.fileUrl && (
                                                    <a href={a.fileUrl} target="_blank" rel="noopener noreferrer" title="View attachment" className="text-muted-foreground hover:text-primary">
                                                        <Paperclip size={12} />
                                                    </a>
                                                )}
                                            </div>
                                            {a.description && <div className="text-[11px] text-muted-foreground mt-0.5 truncate max-w-xs">{a.description}</div>}
                                        </td>
                                        <td data-label="Subject">{a.subject}</td>
                                        <td data-label="Stream" className="text-muted-foreground">{a.stream || 'All streams'}</td>
                                        <td data-label="Due Date" className={isOverdue ? 'font-semibold text-destructive' : ''}>
                                            {new Date(a.dueDate).toLocaleDateString('en-GB')}
                                        </td>
                                        <td data-label="Created By" className="text-muted-foreground text-xs">{a.createdBy}</td>
                                        <td data-label="Actions">
                                            <div className="flex gap-1">
                                                <button className="btn-icon" onClick={() => openEdit(a)} title="Edit"><Edit3 size={14} /></button>
                                                <button className="btn-icon text-destructive" onClick={() => handleDelete(a.id)} title="Delete"><Trash2 size={14} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Assignment panel — a side drawer rather than a centered popup, so
                the assignment list stays visible while a teacher writes. */}
            <Drawer
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                title={editing ? 'Edit Assignment' : 'New Assignment'}
                size="lg"
                footer={
                    <>
                        <button className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                        <button className="btn-primary" onClick={handleSave} disabled={saving}>
                            {uploading ? 'Uploading...' : saving ? 'Saving...' : editing ? 'Update' : 'Create'}
                        </button>
                    </>
                }
            >
                <div className="flex flex-col gap-4">
                    <div>
                        <label className="mb-1 block text-xs font-semibold text-muted-foreground">Title *</label>
                        <input type="text" value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="Assignment title" className="input-field w-full" />
                    </div>
                    <div>
                        <label className="mb-1 block text-xs font-semibold text-muted-foreground">Subject *</label>
                        <select value={formSubject} onChange={e => setFormSubject(e.target.value)} className="input-field w-full">
                            <option value="">Select subject...</option>
                            {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="mb-1 block text-xs font-semibold text-muted-foreground">Stream (optional)</label>
                        <select value={formStream} onChange={e => setFormStream(e.target.value)} className="input-field w-full">
                            <option value="">All streams</option>
                            {streams.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="mb-1 block text-xs font-semibold text-muted-foreground">Due Date *</label>
                        <input type="date" value={formDueDate} onChange={e => setFormDueDate(e.target.value)} className="input-field w-full" />
                    </div>
                    <div>
                        <label className="mb-1 block text-xs font-semibold text-muted-foreground">Description</label>
                        <textarea value={formDesc} onChange={e => setFormDesc(e.target.value)} rows={8} placeholder="Assignment description..." className="input-field w-full resize-y" />
                    </div>
                    <div>
                        <label className="mb-1 block text-xs font-semibold text-muted-foreground">Attachment (optional)</label>
                        <input ref={fileInputRef} type="file" onChange={handleFilePick} className="hidden" />
                        {formFile ? (
                            <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm">
                                <span className="flex min-w-0 items-center gap-2 truncate">
                                    <Paperclip size={14} className="shrink-0 text-muted-foreground" />
                                    <span className="truncate">{formFile.name}</span>
                                </span>
                                <button type="button" className="btn-icon shrink-0" onClick={() => { setFormFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }} title="Remove">
                                    <X size={14} />
                                </button>
                            </div>
                        ) : formFileUrl ? (
                            <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm">
                                <a href={formFileUrl} target="_blank" rel="noopener noreferrer" className="flex min-w-0 items-center gap-2 truncate text-primary hover:underline">
                                    <Paperclip size={14} className="shrink-0" />
                                    <span className="truncate">Current attachment</span>
                                </a>
                                <button type="button" className="btn-icon shrink-0" onClick={() => setFormFileUrl('')} title="Remove">
                                    <X size={14} />
                                </button>
                            </div>
                        ) : (
                            <button type="button" className="btn-secondary w-full justify-center" onClick={() => fileInputRef.current?.click()}>
                                <Paperclip size={14} /> Attach a file
                            </button>
                        )}
                        <p className="mt-1 text-[11px] text-muted-foreground">PDF, image, or document, up to 10MB.</p>
                    </div>
                </div>
            </Drawer>

            {/* Submissions Modal */}
            <Modal isOpen={showSubmissions} onClose={() => setShowSubmissions(false)} title="Assignment Submissions" size="xl">
                {submissions.length === 0 ? (
                    <div className="py-8 text-center text-muted-foreground text-sm">No submissions yet.</div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {submissions.map(sub => (
                            <div key={sub.id} className="rounded-xl border border-border/70 bg-card/50 p-4">
                                <div className="mb-2 flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="font-bold text-foreground text-sm">{sub.studentName || 'Unknown'}</div>
                                        <div className="text-xs text-muted-foreground">{sub.admissionNumber || ''} &middot; {sub.assignmentTitle}</div>
                                    </div>
                                    <div className="shrink-0 text-[11px] text-muted-foreground">
                                        {new Date(sub.submittedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                </div>
                                {sub.submissionText && (
                                    <p className="mb-2 rounded-lg border border-border/70 bg-card p-2 text-sm text-foreground">{sub.submissionText}</p>
                                )}
                                {sub.fileUrl && (
                                    <a href={sub.fileUrl} target="_blank" rel="noopener noreferrer" className="mb-2 inline-block text-xs text-primary">
                                        View Attachment
                                    </a>
                                )}
                                {sub.grade != null ? (
                                    <div className="mt-2 rounded-lg px-3 py-2 text-sm" style={{ background: 'color-mix(in srgb, var(--viz-good) 10%, transparent)' }}>
                                        <strong>Grade:</strong> {sub.grade}%{sub.feedback && <span> &middot; Feedback: {sub.feedback}</span>}
                                    </div>
                                ) : (
                                    <div className="mt-2">
                                        {gradingId === sub.id ? (
                                            <div className="mt-2 flex flex-col gap-2">
                                                <div className="flex flex-wrap gap-2">
                                                    <input type="number" placeholder="Grade (%)" value={gradeVal}
                                                        onChange={e => setGradeVal(e.target.value)}
                                                        className="input-field w-28" />
                                                    <input type="text" placeholder="Feedback" value={feedbackVal}
                                                        onChange={e => setFeedbackVal(e.target.value)}
                                                        className="input-field min-w-0 flex-1" />
                                                </div>
                                                <div className="flex gap-1">
                                                    <button className="btn-primary text-xs px-3 py-1.5" onClick={() => handleGrade(sub.id)}>Save</button>
                                                    <button className="btn-secondary text-xs px-3 py-1.5" onClick={() => setGradingId(null)}>Cancel</button>
                                                </div>
                                            </div>
                                        ) : (
                                            <button className="btn-secondary text-xs px-3 py-1.5" onClick={() => { setGradingId(sub.id); setGradeVal(''); setFeedbackVal(''); }}>
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
