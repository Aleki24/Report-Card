"use client";

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import {
    CalendarCheck, TrendingUp, BookOpen, Wallet,
    Calendar, GraduationCap, X,
    FileText, UploadCloud, MessageSquare, Target, DownloadCloud, Send
} from 'lucide-react';
import { PerformanceTrendChart } from '@/components/charts/PerformanceTrend';

export default function StudentDashboardPage() {
    const { profile, loading: authLoading } = useAuth();
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [feesData, setFeesData] = useState<any[]>([]);
    const [submitModal, setSubmitModal] = useState<{ open: boolean; assignment: any }>({ open: false, assignment: null });
    const [subText, setSubText] = useState('');
    const [subFile, setSubFile] = useState<File | null>(null);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const [dashRes, perfRes, feesRes] = await Promise.all([
                    fetch('/api/school/student/dashboard'),
                    fetch('/api/school/student/performance'),
                    fetch('/api/school/fees'),
                ]);
                
                const dashData = dashRes.ok ? await dashRes.json() : null;
                const perfData = perfRes.ok ? await perfRes.json() : null;
                const feesJson = feesRes.ok ? await feesRes.json() : null;

                setData({
                    ...dashData?.data,
                    trends: perfData?.data || []
                });
                if (feesJson?.data) setFeesData(feesJson.data);
            } catch (err) {
                console.error('Dashboard fetch error:', err);
            }
            setLoading(false);
        })();
    }, []);

    if (authLoading || loading) {
        return <DashboardSkeleton />;
    }

    const stats = data?.stats;
    const upcomingExams = data?.upcomingExams ?? [];
    const latestResults = data?.latestResults ?? [];
    const announcements = data?.announcements ?? [];
    const assignments = data?.assignments ?? [];
    const materials = data?.materials ?? [];
    const trends = data?.trends ?? [];
    const feesBalance = feesData.reduce((sum: number, f: any) => sum + (f.balance || 0), 0);
    
    // Performance Overview chart data (mini version)
    const trendData = trends.map((t: any) => ({
        examName: `${t.termName} ${t.yearName}`.trim(),
        'Average': t.overallAverage
    }));

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
                if (uploadJson.url) fileUrl = uploadJson.url;
            }

            await fetch('/api/school/submissions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    assignment_id: submitModal.assignment.id,
                    file_url: fileUrl || null,
                    submission_text: subText || null,
                }),
            });

            setSubmitModal({ open: false, assignment: null });
            setSubText('');
            setSubFile(null);
        } catch (err) {
            console.error('Submission failed:', err);
        }
        setSubmitting(false);
    };

    return (
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            {/* Header */}
            <div style={{ marginBottom: 'var(--space-6)' }}>
                <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', fontWeight: 800, color: '#1E293B', marginBottom: 4 }}>
                    Good morning, {profile?.first_name}! 👋
                </h1>
                <p style={{ fontSize: 14, color: '#64748B' }}>
                    Here's what's happening today.
                </p>
            </div>

            {/* Top Stat Cards (4 cols) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
                {/* Attendance */}
                <div className="premium-card" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                    <div className="premium-icon-box" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10B981' }}>
                        <CalendarCheck size={22} />
                    </div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, color: '#64748B', fontWeight: 600, marginBottom: 2 }}>Attendance</div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                            <div style={{ fontSize: 24, fontWeight: 800, color: '#1E293B', fontFamily: 'var(--font-display)' }}>
                                {stats?.attendanceRate ? `${stats.attendanceRate}%` : '—'}
                            </div>
                        </div>
                        <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>
                            Overall
                        </div>
                    </div>
                </div>

                {/* Average Score */}
                <div className="premium-card" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                    <div className="premium-icon-box" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3B82F6' }}>
                        <TrendingUp size={22} />
                    </div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, color: '#64748B', fontWeight: 600, marginBottom: 2 }}>Average Score</div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                            <div style={{ fontSize: 24, fontWeight: 800, color: '#1E293B', fontFamily: 'var(--font-display)' }}>
                                {stats?.averageScore ? `${stats.averageScore}%` : '—'}
                            </div>
                        </div>
                        <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>
                            Overall
                        </div>
                    </div>
                </div>

                {/* Exams Taken */}
                <div className="premium-card" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                    <div className="premium-icon-box" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#F59E0B' }}>
                        <BookOpen size={22} />
                    </div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, color: '#64748B', fontWeight: 600, marginBottom: 2 }}>Exams Taken</div>
                        <div style={{ fontSize: 24, fontWeight: 800, color: '#1E293B', fontFamily: 'var(--font-display)' }}>
                            {stats?.examsTaken ?? 0}
                        </div>
                        <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>
                            This term
                        </div>
                    </div>
                </div>

                {/* Subjects */}
                <a href="/student/subjects" className="premium-card" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', textDecoration: 'none', color: 'inherit', cursor: 'pointer' }}>
                    <div className="premium-icon-box" style={{ background: 'rgba(139, 92, 246, 0.1)', color: '#8B5CF6' }}>
                        <BookOpen size={22} />
                    </div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, color: '#64748B', fontWeight: 600, marginBottom: 2 }}>Subjects</div>
                        <div style={{ fontSize: 24, fontWeight: 800, color: '#1E293B', fontFamily: 'var(--font-display)' }}>
                            {stats?.subjectsCount ?? 0}
                        </div>
                        <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>
                            Enrolled subjects
                        </div>
                    </div>
                </a>

                {/* Fees Balance */}
                <div className="premium-card" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                    <div className="premium-icon-box" style={{ background: 'rgba(139, 92, 246, 0.1)', color: '#8B5CF6' }}>
                        <Wallet size={22} />
                    </div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, color: '#64748B', fontWeight: 600, marginBottom: 2 }}>Fees Balance</div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: feesBalance > 0 ? '#EF4444' : '#10B981', fontFamily: 'var(--font-display)' }}>
                            {feesData.length > 0 ? `KShs ${feesBalance.toLocaleString()}` : 'KShs —'}
                        </div>
                        <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>
                            {feesData.length > 0 ? (feesBalance > 0 ? 'Outstanding balance' : 'Fully paid') : 'Awaiting data'}
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content Grid: 2 Columns */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 400px), 1fr))', gap: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>

                {/* Left: Upcoming Exams */}
                <div className="premium-card" style={{ gridColumn: 'span 1' }}>
                    <div className="premium-card-header">
                        <div className="premium-card-title">
                            <Calendar size={18} color="#3B82F6" />
                            Upcoming Exams
                        </div>
                        <a href="/student/results" className="premium-card-action">View All</a>
                    </div>

                    {upcomingExams.length === 0 ? (
                        <div style={{ padding: '24px 0', textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
                            No upcoming exams scheduled.
                        </div>
                    ) : (
                        <div>
                            {upcomingExams.map((exam: any) => {
                                const date = new Date(exam.exam_date);
                                const daysLeft = Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                                const pillClass = daysLeft <= 2 ? 'pill-ongoing' : daysLeft <= 7 ? 'pill-progress' : 'pill-upcoming';
                                const statusText = daysLeft <= 0 ? 'Today' : daysLeft === 1 ? 'Tomorrow' : `In ${daysLeft} days`;
                                return (
                                    <div key={exam.id} className="premium-list-item">
                                        <div style={{ width: 80, fontSize: 12, fontWeight: 600, color: '#64748B', textAlign: 'right' }}>
                                            {date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                        </div>
                                        <div style={{ flex: 1, paddingLeft: 16, borderLeft: '2px solid rgba(0,0,0,0.05)' }}>
                                            <div style={{ fontSize: 14, fontWeight: 700, color: '#1E293B', marginBottom: 2 }}>{exam.subject_name}</div>
                                            <div style={{ fontSize: 12, color: '#94A3B8' }}>{exam.name}</div>
                                        </div>
                                        <div><span className={pillClass}>{statusText}</span></div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Right: Recent Announcements */}
                <div className="premium-card">
                    <div className="premium-card-header">
                        <div className="premium-card-title">
                            <GraduationCap size={18} color="#8B5CF6" />
                            Recent Announcements
                        </div>
                        <button className="premium-card-action">View All</button>
                    </div>

                    {announcements.length === 0 ? (
                        <div style={{ padding: '24px 0', textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
                            No announcements yet.
                        </div>
                    ) : (
                        <div>
                            {announcements.map((a: any) => {
                                const timeAgo = getTimeAgo(a.createdAt);
                                return (
                                    <div key={a.id} className="premium-list-item">
                                        <div className="premium-icon-box" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10B981' }}>
                                            <BookOpen size={20} />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: 14, fontWeight: 700, color: '#1E293B' }}>{a.title}</div>
                                            <div style={{ fontSize: 12, color: '#64748B', marginTop: 2, display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                                {a.content}
                                            </div>
                                            <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>{timeAgo}</div>
                                        </div>
                                        {a.isImportant && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#EF4444' }} />}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom Row: 3 Columns for Academic Features */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
                
                {/* Assignments & Homework */}
                <div className="premium-card">
                    <div className="premium-card-header">
                        <div className="premium-card-title">
                            <FileText size={18} color="#F59E0B" />
                            Assignments & Homework
                        </div>
                        <button className="premium-card-action">View All</button>
                    </div>
                    
                    {assignments.length === 0 ? (
                        <div style={{ padding: '24px 0', textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
                            No assignments due.
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {assignments.map((a: any) => {
                                const dueLabel = getDueLabel(a.dueDate);
                                return (
                                    <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, border: '1px solid rgba(0,0,0,0.04)', borderRadius: 12 }}>
                                        <div style={{ width: 36, height: 36, background: '#FFF7ED', color: '#F59E0B', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <FileText size={16} />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: 13, fontWeight: 700, color: '#1E293B' }}>{a.title}</div>
                                            <div style={{ fontSize: 11, color: '#64748B', marginTop: 1 }}>{a.subjectName}</div>
                                            <div style={{ fontSize: 11, color: '#EF4444', marginTop: 2, fontWeight: 600 }}>{dueLabel}</div>
                                        </div>
                                        <button onClick={() => setSubmitModal({ open: true, assignment: a })} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, color: '#3B82F6', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                                            <UploadCloud size={14} /> Submit
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Performance Overview */}
                <div className="premium-card">
                    <div className="premium-card-header">
                        <div className="premium-card-title">
                            <TrendingUp size={18} color="#3B82F6" />
                            Performance Overview
                        </div>
                        <div style={{ fontSize: 12, padding: '4px 8px', background: '#F1F5F9', borderRadius: 6, fontWeight: 600, color: '#475569' }}>
                            All Terms ▾
                        </div>
                    </div>
                    <div style={{ height: 180, width: '100%', marginTop: 16 }}>
                        {trendData.length > 1 ? (
                            <PerformanceTrendChart data={trendData.map((d: any) => ({ examName: d.examName, average: d.Average }))} />
                        ) : (
                            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontSize: 13, textAlign: 'center', padding: 20 }}>
                                Need more than one term of data to show performance trend.
                            </div>
                        )}
                    </div>
                </div>

                {/* Learning Materials & Notes */}
                <div className="premium-card">
                    <div className="premium-card-header">
                        <div className="premium-card-title">
                            <BookOpen size={18} color="#10B981" />
                            Learning Materials & Notes
                        </div>
                        <button className="premium-card-action">View All</button>
                    </div>
                    
                    {materials.length === 0 ? (
                        <div style={{ padding: '24px 0', textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
                            No learning materials available.
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {materials.map((m: any) => {
                                const fileLabel = m.fileType
                                    ? `${m.fileType}${m.fileSizeBytes ? ` · ${formatFileSize(m.fileSizeBytes)}` : ''}`
                                    : m.fileSizeBytes ? formatFileSize(m.fileSizeBytes) : 'Resource';
                                return (
                                    <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, border: '1px solid rgba(0,0,0,0.04)', borderRadius: 12 }}>
                                        <div style={{ width: 36, height: 36, background: '#F0FDF4', color: '#10B981', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <FileText size={16} />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: 13, fontWeight: 700, color: '#1E293B' }}>{m.title}</div>
                                            <div style={{ fontSize: 11, color: '#64748B', marginTop: 1 }}>{m.subjectName}</div>
                                            <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 1 }}>{fileLabel}</div>
                                        </div>
                                        {m.fileUrl && (
                                            <a href={m.fileUrl} target="_blank" rel="noopener noreferrer" style={{ background: 'none', border: 'none', color: '#3B82F6', cursor: 'pointer', textDecoration: 'none' }}>
                                                <DownloadCloud size={18} />
                                            </a>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

            </div>

            {/* Interaction Tools */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 'var(--space-6)' }}>
                {/* Message Teachers */}
                <div className="premium-card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ width: 48, height: 48, background: '#EFF6FF', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3B82F6' }}>
                        <MessageSquare size={24} />
                    </div>
                    <div style={{ flex: 1 }}>
                        <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1E293B', marginBottom: 4 }}>Message Teachers</h3>
                        <p style={{ fontSize: 13, color: '#64748B' }}>Get help or ask questions directly.</p>
                    </div>
                    <button style={{ background: '#3B82F6', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                        Compose
                    </button>
                </div>

                {/* Set Study Goals */}
                <div className="premium-card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ width: 48, height: 48, background: '#F5F3FF', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8B5CF6' }}>
                        <Target size={24} />
                    </div>
                    <div style={{ flex: 1 }}>
                        <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1E293B', marginBottom: 4 }}>Study Goals</h3>
                        <p style={{ fontSize: 13, color: '#64748B' }}>Set reminders and track revision goals.</p>
                    </div>
                    <button style={{ background: '#8B5CF6', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                        Set Goal
                    </button>
                </div>
            </div>
            
            {/* Submission Modal */}
            {submitModal.open && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
                }} onClick={() => setSubmitModal({ open: false, assignment: null })}>
                    <div style={{
                        background: '#fff', borderRadius: 16, maxWidth: 500, width: '100%',
                        padding: 24, maxHeight: '90vh', overflow: 'auto'
                    }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#1E293B', margin: 0 }}>Submit Assignment</h3>
                            <button onClick={() => setSubmitModal({ open: false, assignment: null })}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}>
                                <X size={20} />
                            </button>
                        </div>
                        <div style={{ marginBottom: 16 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: '#1E293B' }}>{submitModal.assignment?.title}</div>
                            <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>{submitModal.assignment?.subjectName}</div>
                            <div style={{ fontSize: 12, color: '#EF4444', marginTop: 2 }}>{getDueLabel(submitModal.assignment?.dueDate)}</div>
                        </div>
                        <div style={{ marginBottom: 16 }}>
                            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>Your Answer / Notes</label>
                            <textarea value={subText} onChange={e => setSubText(e.target.value)}
                                rows={5} placeholder="Type your submission here..."
                                style={{ width: '100%', padding: '10px 12px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13, resize: 'vertical' }} />
                        </div>
                        <div style={{ marginBottom: 20 }}>
                            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>Upload File (optional)</label>
                            <input type="file" onChange={e => setSubFile(e.target.files?.[0] || null)}
                                style={{ fontSize: 13, width: '100%' }} />
                            <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>Max 10MB. PDF, DOC, images accepted.</div>
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

// ── Helpers ─────────────────────────────────────────────────

function getTimeAgo(dateStr: string): string {
    const now = Date.now();
    const date = new Date(dateStr).getTime();
    const diffMs = now - date;
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
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

function DashboardSkeleton() {
    return (
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            <div style={{ marginBottom: 'var(--space-6)' }}>
                <div className="skeleton-bone" style={{ width: 250, height: 32, borderRadius: 8, marginBottom: 8 }} />
                <div className="skeleton-bone" style={{ width: 180, height: 16, borderRadius: 6 }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
                {[1, 2, 3, 4].map(i => <div key={i} className="student-skeleton-card" style={{ height: 100 }} />)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 400px), 1fr))', gap: 'var(--space-6)' }}>
                <div className="student-skeleton-card" style={{ height: 300 }} />
                <div className="student-skeleton-card" style={{ height: 300 }} />
            </div>
        </div>
    );
}
