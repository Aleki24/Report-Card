"use client";

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    ArrowLeft, BookOpen, FileText, UploadCloud,
    DownloadCloud, TrendingUp, X, Send
} from 'lucide-react';
import { toast } from 'sonner';
import { PerformanceTrendChart } from '@/components/charts/PerformanceTrend';

interface AssignmentItem {
    id: string;
    title: string;
    dueDate: string;
    subjectName: string;
}

interface MaterialItem {
    id: string;
    title: string;
    description: string | null;
    fileUrl: string | null;
    fileSizeBytes: number | null;
    fileType: string | null;
    subjectName: string;
    createdAt: string;
}

function getDueLabel(dateStr: string): string {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const due = new Date(dateStr);
    due.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return 'Overdue';
    if (diffDays === 0) return 'Due Today';
    if (diffDays === 1) return 'Due Tomorrow';
    return `Due in ${diffDays} days`;
}

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function SubjectAnalysisPage() {
    const params = useParams();
    const router = useRouter();
    const subjectId = params.subjectId as string;

    const [subject, setSubject] = useState<any>(null);
    const [performance, setPerformance] = useState<any[]>([]);
    const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
    const [materials, setMaterials] = useState<MaterialItem[]>([]);
    const [loading, setLoading] = useState(true);

    const [submitModal, setSubmitModal] = useState<{ open: boolean; assignment: AssignmentItem | null }>({ open: false, assignment: null });
    const [subText, setSubText] = useState('');
    const [subFile, setSubFile] = useState<File | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const handleSubmitAssignment = async () => {
        if (!submitModal.assignment) return;
        setSubmitting(true);
        try {
            let fileUrl = '';
            if (subFile) {
                const fd = new FormData();
                fd.append('file', subFile);
                const uploadRes = await fetch('/api/school/upload', { method: 'POST', body: fd });
                const uploadJson = await uploadRes.json();
                if (!uploadRes.ok) throw new Error(uploadJson.error || 'File upload failed');
                if (uploadJson.url) fileUrl = uploadJson.url;
            }

            const submitRes = await fetch('/api/school/submissions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    assignment_id: submitModal.assignment.id,
                    file_url: fileUrl || null,
                    submission_text: subText || null,
                }),
            });
            if (!submitRes.ok) {
                const submitJson = await submitRes.json().catch(() => ({}));
                throw new Error(submitJson.error || 'Submission failed');
            }

            setSubmitModal({ open: false, assignment: null });
            setSubText('');
            setSubFile(null);
            toast.success('Assignment submitted');
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Submission failed. Please try again.');
        }
        setSubmitting(false);
    };

    useEffect(() => {
        Promise.all([
            fetch('/api/school/student/subjects').then(r => r.json()),
            fetch('/api/school/student/performance').then(r => r.json()),
            fetch('/api/school/student/dashboard').then(r => r.json()),
        ]).then(([subRes, perfRes, dashRes]) => {
            const subs = subRes.data || [];
            const found = subs.find((s: any) => s.id === subjectId);
            setSubject(found);

            if (found && perfRes.data) {
                // Map the performance data to only include this subject
                const trendData = perfRes.data.map((term: any) => {
                    const subjectMark = term.subjects.find((s: any) => s.subjectName === found.name);
                    return {
                        examName: `${term.termName} ${term.yearName}`.trim(),
                        [found.name]: subjectMark ? subjectMark.percentage : null
                    };
                }).filter((t: any) => t[found.name] !== null);

                setPerformance(trendData);
            }

            if (found && dashRes.data) {
                const allAssignments: AssignmentItem[] = dashRes.data.assignments || [];
                const allMaterials: MaterialItem[] = dashRes.data.materials || [];
                setAssignments(allAssignments.filter(a => a.subjectName === found.name));
                setMaterials(allMaterials.filter(m => m.subjectName === found.name));
            }

            setLoading(false);
        }).catch(() => {
            setLoading(false);
        });
    }, [subjectId]);

    if (loading) return (
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 0' }}>
            <div className="skeleton-spinner" style={{ margin: '0 auto' }} />
        </div>
    );

    if (!subject) return (
        <div style={{ maxWidth: 1100, margin: '0 auto', textAlign: 'center', padding: '100px 0' }}>
            <h2 style={{ fontSize: 24, fontWeight: 700, color: 'var(--foreground)', marginBottom: 8 }}>Subject Not Found</h2>
            <p style={{ color: 'var(--muted-foreground)', marginBottom: 24 }}>The subject you are looking for does not exist or you don&apos;t have access to it.</p>
            <button onClick={() => router.back()} className="btn-secondary">Go Back</button>
        </div>
    );

    return (
        <div style={{ maxWidth: 1100, margin: '0 auto', paddingBottom: 'var(--space-10)' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
                <button
                    onClick={() => router.back()}
                    style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--muted)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--muted-foreground)' }}
                >
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 800, color: 'var(--foreground)', marginBottom: 4 }}>
                        {subject.name}
                    </h1>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <span style={{ fontSize: 13, color: 'var(--muted-foreground)', fontWeight: 600 }}>{subject.code || 'No Code'}</span>
                        <span style={{
                            padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700,
                            background: subject.subject_type === 'CORE' ? 'color-mix(in srgb, var(--viz-good) 10%, transparent)' : subject.subject_type === 'ESSENTIAL' ? 'color-mix(in srgb, var(--viz-info) 10%, transparent)' : 'color-mix(in srgb, var(--viz-warn) 10%, transparent)',
                            color: subject.subject_type === 'CORE' ? 'var(--viz-good)' : subject.subject_type === 'ESSENTIAL' ? 'var(--viz-info)' : 'var(--viz-warn)'
                        }}>
                            {subject.subject_type === 'CORE' ? 'Core' : subject.subject_type === 'ESSENTIAL' ? 'Essential' : 'Optional'}
                        </span>
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
                {/* Performance Trend */}
                <div className="premium-card" style={{ gridColumn: '1 / -1' }}>
                    <div className="premium-card-header">
                        <div className="premium-card-title">
                            <TrendingUp size={18} color="var(--viz-info)" />
                            Performance Analysis
                        </div>
                    </div>
                    <div style={{ height: 300, width: '100%', marginTop: 16 }}>
                        {performance.length > 1 ? (
                            <PerformanceTrendChart data={performance.map((d: any) => ({ examName: d.examName, average: d[subject.name] }))} />
                        ) : (
                            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)', fontSize: 14, textAlign: 'center', padding: 20 }}>
                                <TrendingUp size={48} style={{ opacity: 0.2, marginBottom: 16 }} />
                                Need more than one term of results to show a performance trend for {subject.name}.
                            </div>
                        )}
                    </div>
                </div>

                {/* Assignments & Homework */}
                <div className="premium-card" style={{ display: 'flex', flexDirection: 'column', gridColumn: '1 / -1' }}>
                    <div className="premium-card-header">
                        <div className="premium-card-title">
                            <FileText size={18} color="var(--viz-warn)" />
                            Active Assignments
                        </div>
                    </div>
                    {assignments.length === 0 ? (
                        <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 13 }}>
                            No assignments for {subject.name} right now.
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
                            {assignments.map(a => (
                                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, border: '1px solid var(--border)', borderRadius: 12 }}>
                                    <div style={{ width: 36, height: 36, background: 'color-mix(in srgb, var(--viz-warn) 10%, transparent)', color: 'var(--viz-warn)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <FileText size={16} />
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)' }}>{a.title}</div>
                                        <div style={{ fontSize: 11, color: 'var(--viz-bad)', marginTop: 2, fontWeight: 600 }}>{getDueLabel(a.dueDate)}</div>
                                    </div>
                                    <button
                                        onClick={() => setSubmitModal({ open: true, assignment: a })}
                                        style={{ background: 'var(--muted)', border: '1px solid var(--border)', padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, color: 'var(--viz-info)', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', flexShrink: 0 }}
                                    >
                                        <UploadCloud size={14} /> Submit
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Learning Materials */}
                <div className="premium-card" style={{ display: 'flex', flexDirection: 'column', gridColumn: '1 / -1' }}>
                    <div className="premium-card-header">
                        <div className="premium-card-title">
                            <BookOpen size={18} color="var(--primary)" />
                            Learning Materials & Notes
                        </div>
                    </div>
                    {materials.length === 0 ? (
                        <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 13 }}>
                            No learning materials for {subject.name} yet.
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: 16, marginTop: 16 }}>
                            {materials.map(m => {
                                const fileLabel = m.fileType
                                    ? `${m.fileType}${m.fileSizeBytes ? ` · ${formatFileSize(m.fileSizeBytes)}` : ''}`
                                    : m.fileSizeBytes ? formatFileSize(m.fileSizeBytes) : 'Resource';
                                return (
                                    <div key={m.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 16, padding: 16, background: 'var(--muted)', borderRadius: 12, border: '1px solid var(--border)' }}>
                                        <div style={{ width: 44, height: 44, background: 'color-mix(in srgb, var(--primary) 10%, transparent)', color: 'var(--primary)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <FileText size={20} />
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--foreground)', marginBottom: 4 }}>{m.title}</div>
                                            {m.description && <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 8 }}>{m.description}</div>}
                                            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16 }}>
                                                <span style={{ fontSize: 11, color: 'var(--muted-foreground)', fontWeight: 600 }}>{fileLabel}</span>
                                            </div>
                                        </div>
                                        {m.fileUrl && (
                                            <a href={m.fileUrl} target="_blank" rel="noopener noreferrer" style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--viz-info)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, textDecoration: 'none' }}>
                                                <DownloadCloud size={16} />
                                            </a>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Submission Modal */}
            {submitModal.open && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
                }} onClick={() => setSubmitModal({ open: false, assignment: null })}>
                    <div style={{
                        background: 'var(--card)', borderRadius: 16, maxWidth: 500, width: '100%',
                        padding: 24, maxHeight: '90vh', overflow: 'auto'
                    }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>Submit Assignment</h3>
                            <button onClick={() => setSubmitModal({ open: false, assignment: null })}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)' }}>
                                <X size={20} />
                            </button>
                        </div>
                        <div style={{ marginBottom: 16 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--foreground)' }}>{submitModal.assignment?.title}</div>
                            <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 2 }}>{subject.name}</div>
                            {submitModal.assignment && <div style={{ fontSize: 12, color: 'var(--viz-bad)', marginTop: 2 }}>{getDueLabel(submitModal.assignment.dueDate)}</div>}
                        </div>
                        <div style={{ marginBottom: 16 }}>
                            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--muted-foreground)', marginBottom: 4 }}>Your Answer / Notes</label>
                            <textarea value={subText} onChange={e => setSubText(e.target.value)}
                                rows={5} placeholder="Type your submission here..."
                                style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, resize: 'vertical' }} />
                        </div>
                        <div style={{ marginBottom: 20 }}>
                            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--muted-foreground)', marginBottom: 4 }}>Upload File (optional)</label>
                            <input type="file" onChange={e => setSubFile(e.target.files?.[0] || null)}
                                style={{ fontSize: 13, width: '100%' }} />
                            <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 4 }}>Max 10MB. PDF, DOC, images accepted.</div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                            <button onClick={() => setSubmitModal({ open: false, assignment: null })}
                                className="btn-secondary">Cancel</button>
                            <button onClick={handleSubmitAssignment} disabled={submitting || (!subText && !subFile)}
                                className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Send size={14} /> {submitting ? 'Submitting...' : 'Submit'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
