"use client";

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    ArrowLeft, BookOpen, FileText, UploadCloud,
    DownloadCloud, TrendingUp, Send
} from 'lucide-react';
import { toast } from 'sonner';
import { PerformanceTrendChart } from '@/components/charts/PerformanceTrend';
import DashboardCard from '@/components/dashboard/DashboardCard';
import InsightCard from '@/components/dashboard/InsightCard';
import EmptyState from '@/components/dashboard/EmptyState';
import { Badge, Modal } from '@/components/ui';

interface Subject {
    id: string;
    name: string;
    code: string | null;
    subject_type: 'CORE' | 'ESSENTIAL' | 'OPTIONAL' | null;
}

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

interface PerformanceTrendTerm {
    termName: string;
    yearName: string;
    subjects: { name: string; average: number }[];
}

function typeBadge(type: Subject['subject_type']) {
    if (type === 'CORE') return <Badge variant="success">Core</Badge>;
    if (type === 'ESSENTIAL') return <Badge variant="info">Essential</Badge>;
    return <Badge variant="default">Optional</Badge>;
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

    const [subject, setSubject] = useState<Subject | null>(null);
    const [performance, setPerformance] = useState<{ examName: string; average: number }[]>([]);
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
            const subs: Subject[] = subRes.data || [];
            const found = subs.find((s) => s.id === subjectId) ?? null;
            setSubject(found);

            if (found && perfRes.data) {
                const trends: PerformanceTrendTerm[] = perfRes.data;
                const trendData = trends
                    .map((term) => {
                        const subjectMark = term.subjects.find((s) => s.name === found.name);
                        return subjectMark ? { examName: `${term.termName} ${term.yearName}`.trim(), average: subjectMark.average } : null;
                    })
                    .filter((t): t is { examName: string; average: number } => t !== null);

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

    if (loading) {
        return (
            <div className="mx-auto max-w-[1100px] py-10">
                <div className="skeleton-spinner mx-auto" />
            </div>
        );
    }

    if (!subject) {
        return (
            <div className="mx-auto max-w-[1100px] py-24 text-center">
                <h2 className="mb-2 text-2xl font-bold text-foreground">Subject Not Found</h2>
                <p className="mb-6 text-muted-foreground">The subject you are looking for does not exist or you don&apos;t have access to it.</p>
                <button onClick={() => router.back()} className="btn-secondary">Go Back</button>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-[1100px] pb-10">
            {/* Header */}
            <div className="mb-8 flex items-center gap-4">
                <button
                    onClick={() => router.back()}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-muted/70"
                >
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h1 className="font-display text-2xl font-bold text-foreground">{subject.name}</h1>
                    <div className="mt-1 flex items-center gap-3">
                        <span className="text-[13px] font-semibold text-muted-foreground">{subject.code || 'No Code'}</span>
                        {typeBadge(subject.subject_type)}
                    </div>
                </div>
            </div>

            <div className="flex flex-col gap-5">
                {/* Performance Trend */}
                <InsightCard title="Performance Analysis">
                    <div className="mt-1 h-[300px] w-full">
                        {performance.length > 1 ? (
                            <PerformanceTrendChart data={performance} />
                        ) : (
                            <div className="flex h-full flex-col items-center justify-center px-5 text-center text-sm text-muted-foreground">
                                <TrendingUp size={48} className="mb-4 opacity-20" />
                                Need more than one term of results to show a performance trend for {subject.name}.
                            </div>
                        )}
                    </div>
                </InsightCard>

                {/* Assignments & Homework */}
                <InsightCard title="Active Assignments">
                    {assignments.length === 0 ? (
                        <EmptyState icon={<FileText className="h-6 w-6" />} title="No assignments" description={`No assignments for ${subject.name} right now.`} />
                    ) : (
                        <div className="flex flex-col gap-3">
                            {assignments.map(a => (
                                <div key={a.id} className="flex items-center gap-3 rounded-xl border border-border p-3">
                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
                                        <FileText size={16} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="truncate text-[13px] font-bold text-foreground">{a.title}</div>
                                        <div className="mt-0.5 text-[11px] font-semibold text-destructive">{getDueLabel(a.dueDate)}</div>
                                    </div>
                                    <button
                                        onClick={() => setSubmitModal({ open: true, assignment: a })}
                                        className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border bg-muted px-2.5 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-muted/70"
                                    >
                                        <UploadCloud size={14} /> Submit
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </InsightCard>

                {/* Learning Materials */}
                <InsightCard title="Learning Materials & Notes">
                    {materials.length === 0 ? (
                        <EmptyState icon={<BookOpen className="h-6 w-6" />} title="No materials" description={`No learning materials for ${subject.name} yet.`} />
                    ) : (
                        <div className="grid grid-cols-1 gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr))]">
                            {materials.map(m => {
                                const fileLabel = m.fileType
                                    ? `${m.fileType}${m.fileSizeBytes ? ` · ${formatFileSize(m.fileSizeBytes)}` : ''}`
                                    : m.fileSizeBytes ? formatFileSize(m.fileSizeBytes) : 'Resource';
                                return (
                                    <DashboardCard key={m.id} className="flex items-start gap-4 px-4 py-4">
                                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-primary/10 text-primary">
                                            <FileText size={20} />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="mb-1 text-sm font-bold text-foreground">{m.title}</div>
                                            {m.description && <div className="mb-2 text-xs text-muted-foreground">{m.description}</div>}
                                            <span className="text-[11px] font-semibold text-muted-foreground">{fileLabel}</span>
                                        </div>
                                        {m.fileUrl && (
                                            <a href={m.fileUrl} target="_blank" rel="noopener noreferrer" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-card text-primary no-underline">
                                                <DownloadCloud size={16} />
                                            </a>
                                        )}
                                    </DashboardCard>
                                );
                            })}
                        </div>
                    )}
                </InsightCard>
            </div>

            {/* Submission Modal */}
            <Modal
                isOpen={submitModal.open}
                onClose={() => setSubmitModal({ open: false, assignment: null })}
                title="Submit Assignment"
                footer={(
                    <>
                        <button onClick={() => setSubmitModal({ open: false, assignment: null })} className="btn-secondary">Cancel</button>
                        <button onClick={handleSubmitAssignment} disabled={submitting || (!subText && !subFile)} className="btn-primary inline-flex items-center gap-1.5">
                            <Send size={14} /> {submitting ? 'Submitting...' : 'Submit'}
                        </button>
                    </>
                )}
            >
                <div className="mb-4">
                    <div className="text-sm font-bold text-foreground">{submitModal.assignment?.title}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{subject.name}</div>
                    {submitModal.assignment && <div className="mt-0.5 text-xs text-destructive">{getDueLabel(submitModal.assignment.dueDate)}</div>}
                </div>
                <div className="mb-4">
                    <label className="mb-1 block text-xs font-semibold text-muted-foreground">Your Answer / Notes</label>
                    <textarea
                        value={subText}
                        onChange={e => setSubText(e.target.value)}
                        rows={5}
                        placeholder="Type your submission here..."
                        className="w-full resize-y rounded-lg border border-border px-3 py-2.5 text-sm"
                    />
                </div>
                <div>
                    <label className="mb-1 block text-xs font-semibold text-muted-foreground">Upload File (optional)</label>
                    <input type="file" onChange={e => setSubFile(e.target.files?.[0] || null)} className="w-full text-sm" />
                    <div className="mt-1 text-[11px] text-muted-foreground">Max 10MB. PDF, DOC, images accepted.</div>
                </div>
            </Modal>
        </div>
    );
}
