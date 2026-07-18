"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { toast } from 'sonner';
import {
    CalendarCheck, TrendingUp, BookOpen, Wallet,
    Calendar, GraduationCap, FileText, UploadCloud, MessageSquare,
    Target, DownloadCloud, Send, Bell,
} from 'lucide-react';
import { PerformanceTrendChart } from '@/components/charts/PerformanceTrend';
import { Badge, Modal } from '@/components/ui';
import KpiTile from '@/components/dashboard/KpiTile';
import KpiCarousel from '@/components/dashboard/KpiCarousel';
import SectionTitle from '@/components/dashboard/SectionTitle';
import ListPanel from '@/components/dashboard/ListPanel';
import EmptyState from '@/components/dashboard/EmptyState';
import InsightCard from '@/components/dashboard/InsightCard';
import { Bone } from '@/components/dashboard/LoadingSkeleton';
import { getCurrentTermName } from '@/lib/term-calendar';

interface UpcomingExam { id: string; name: string; exam_date: string; subject_name: string }
interface Announcement { id: string; title: string; content: string; isImportant: boolean; createdAt: string }
interface Assignment { id: string; title: string; subjectName: string; dueDate: string; fileUrl: string | null }
interface LearningMaterial { id: string; title: string; subjectName: string; fileUrl: string | null; fileType: string | null; fileSizeBytes: number | null }
interface PerformanceTrend { termId: string; termName: string; yearName: string; overallAverage: number }
interface FeeRecord { balance: number }

interface DashboardData {
    stats: { attendanceRate: number; averageScore: number; examsTaken: number; subjectsCount: number };
    upcomingExams: UpcomingExam[];
    announcements: Announcement[];
    assignments: Assignment[];
    materials: LearningMaterial[];
    trends: PerformanceTrend[];
}

export default function StudentDashboardPage() {
    const { profile, loading: authLoading } = useAuth();
    const [data, setData] = useState<Partial<DashboardData> | null>(null);
    const [loading, setLoading] = useState(true);
    const [feesData, setFeesData] = useState<FeeRecord[]>([]);
    const [submitModal, setSubmitModal] = useState<{ open: boolean; assignment: Assignment | null }>({ open: false, assignment: null });
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
    const announcements = data?.announcements ?? [];
    const assignments = data?.assignments ?? [];
    const materials = data?.materials ?? [];
    const trends = data?.trends ?? [];
    const feesBalance = feesData.reduce((sum, f) => sum + (f.balance || 0), 0);

    // Performance Overview chart data (mini version)
    const trendData = trends.map((t) => ({
        examName: `${t.termName} ${t.yearName}`.trim(),
        average: t.overallAverage,
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
            console.error('Submission failed:', err);
            toast.error(err instanceof Error ? err.message : 'Submission failed. Please try again.');
        }
        setSubmitting(false);
    };

    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    const todayLabel = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    return (
        <div className="mx-auto max-w-[1200px] px-2 pb-4 sm:px-3">
            {/* Hero Banner */}
            <div className="relative mb-5 overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600 px-5 py-5 shadow-sm sm:px-8 sm:py-7">
                <div className="pointer-events-none absolute -right-8 -top-12 h-44 w-44 rounded-full bg-white/10" aria-hidden />
                <div className="pointer-events-none absolute -right-16 bottom-[-48px] h-40 w-40 rounded-full bg-white/10" aria-hidden />
                <div className="relative min-w-0">
                    <h1 className="font-display text-lg font-bold tracking-tight text-white sm:text-2xl">
                        {greeting}, {profile?.first_name} <span aria-hidden>{hour < 12 ? '☀️' : hour < 17 ? '🌤️' : '🌙'}</span>
                    </h1>
                    <p className="mt-0.5 text-xs text-white/80 sm:text-[13px]">
                        {todayLabel} &middot; {getCurrentTermName()}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                        <Link href="/student/results" className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-xs font-semibold text-blue-700 shadow-sm transition-all duration-200 hover:-translate-y-px hover:shadow-md sm:text-sm">
                            <GraduationCap size={15} /> View My Results
                        </Link>
                        <Link href="/student/subjects" className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 px-4 py-2 text-xs font-semibold text-white ring-1 ring-inset ring-white/25 transition-colors duration-200 hover:bg-white/20 sm:text-sm">
                            <BookOpen size={15} /> My Subjects
                        </Link>
                    </div>
                </div>
            </div>

            {/* At a glance */}
            <section className="mb-5">
                <SectionTitle>At a glance</SectionTitle>
                <KpiCarousel>
                    <KpiTile title="Attendance" value={stats?.attendanceRate ? `${stats.attendanceRate}%` : '—'} icon={<CalendarCheck size={17} />} href="/student/attendance" tone="green" />
                    <KpiTile title="Average score" value={stats?.averageScore ? `${stats.averageScore}%` : '—'} icon={<TrendingUp size={17} />} href="/student/results" tone="blue" />
                    <KpiTile title="Exams taken" value={stats?.examsTaken ?? 0} icon={<FileText size={17} />} href="/student/results" tone="purple" />
                    <KpiTile title="Subjects" value={stats?.subjectsCount ?? 0} icon={<BookOpen size={17} />} href="/student/subjects" />
                    <KpiTile
                        title="Fees balance"
                        value={feesData.length > 0 ? `KShs ${feesBalance.toLocaleString()}` : '—'}
                        icon={<Wallet size={17} />}
                        href="/student/profile"
                        alert={feesBalance > 0}
                        tone={feesBalance > 0 ? 'red' : undefined}
                    />
                </KpiCarousel>
            </section>

            {/* Upcoming exams + Announcements */}
            <section className="mb-5">
                <SectionTitle>Today&apos;s picture</SectionTitle>
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xs:gap-4">
                    <ListPanel title="Upcoming Exams" actionLabel="View all" actionHref="/student/results">
                        {upcomingExams.length === 0 ? (
                            <EmptyState icon={<Calendar className="h-6 w-6" />} title="No upcoming exams" description="Scheduled exams will appear here with clear date blocks." />
                        ) : (
                            <div className="flex flex-col gap-3">
                                {upcomingExams.slice(0, 5).map((exam) => {
                                    const date = new Date(exam.exam_date);
                                    const { variant, statusText } = getExamCountdown(exam.exam_date);
                                    return (
                                        <div key={exam.id} className="flex items-center gap-3 rounded-xl border border-border/55 bg-muted/35 p-[5px] transition-colors hover:bg-muted/55">
                                            <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl border border-border/60 bg-card/80 text-muted-foreground">
                                                <span className="text-[10px] font-bold leading-none tracking-[0.12em]">{date.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase()}</span>
                                                <span className="text-base font-bold leading-none tracking-tight">{date.toLocaleDateString('en-GB', { day: '2-digit' })}</span>
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="truncate text-sm font-semibold tracking-tight text-foreground">{exam.subject_name}</div>
                                                <div className="truncate text-xs leading-relaxed text-muted-foreground">{exam.name}</div>
                                            </div>
                                            <Badge variant={variant}>{statusText}</Badge>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </ListPanel>

                    <ListPanel title="Recent Announcements">
                        {announcements.length === 0 ? (
                            <EmptyState icon={<Bell className="h-6 w-6" />} title="No announcements yet" description="School announcements will show up here." />
                        ) : (
                            <div className="flex flex-col gap-3">
                                {announcements.slice(0, 5).map((a) => (
                                    <div key={a.id} className="flex items-start gap-3 rounded-xl border border-border/55 bg-muted/35 p-[5px] transition-colors hover:bg-muted/55">
                                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                            <BookOpen size={16} />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="truncate text-sm font-semibold tracking-tight text-foreground">{a.title}</div>
                                            <div className="truncate text-xs leading-relaxed text-muted-foreground">{a.content}</div>
                                            <div className="mt-0.5 text-[11px] text-muted-foreground">{getTimeAgo(a.createdAt)}</div>
                                        </div>
                                        {a.isImportant && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-destructive" />}
                                    </div>
                                ))}
                            </div>
                        )}
                    </ListPanel>
                </div>
            </section>

            {/* Assignments / Performance / Materials */}
            <section className="mb-5">
                <SectionTitle>Academics</SectionTitle>
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-3 xs:gap-4">
                    <InsightCard title="Assignments & Homework">
                        {assignments.length === 0 ? (
                            <EmptyState icon={<FileText className="h-6 w-6" />} title="No assignments due" description="New homework and assignments will appear here." />
                        ) : (
                            <div className="flex flex-col gap-3">
                                {assignments.map((a) => (
                                    <div key={a.id} className="flex items-center gap-3 rounded-xl border border-border/60 p-3">
                                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
                                            <FileText size={16} />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="truncate text-[13px] font-semibold text-foreground">{a.title}</div>
                                            <div className="truncate text-[11px] text-muted-foreground">{a.subjectName}</div>
                                            <div className="text-[11px] font-semibold text-destructive">{getDueLabel(a.dueDate)}</div>
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

                    <InsightCard title="Performance Overview" meta="All terms">
                        <div className="mt-1 h-[180px] w-full">
                            {trendData.length > 1 ? (
                                <PerformanceTrendChart data={trendData} />
                            ) : (
                                <div className="flex h-full items-center justify-center px-5 text-center text-[13px] text-muted-foreground">
                                    Need more than one term of data to show performance trend.
                                </div>
                            )}
                        </div>
                    </InsightCard>

                    <InsightCard title="Learning Materials & Notes">
                        {materials.length === 0 ? (
                            <EmptyState icon={<BookOpen className="h-6 w-6" />} title="No materials yet" description="Notes and resources shared by teachers will appear here." />
                        ) : (
                            <div className="flex flex-col gap-3">
                                {materials.map((m) => {
                                    const fileLabel = m.fileType
                                        ? `${m.fileType}${m.fileSizeBytes ? ` · ${formatFileSize(m.fileSizeBytes)}` : ''}`
                                        : m.fileSizeBytes ? formatFileSize(m.fileSizeBytes) : 'Resource';
                                    return (
                                        <div key={m.id} className="flex items-center gap-3 rounded-xl border border-border/60 p-3">
                                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
                                                <FileText size={16} />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="truncate text-[13px] font-semibold text-foreground">{m.title}</div>
                                                <div className="truncate text-[11px] text-muted-foreground">{m.subjectName}</div>
                                                <div className="truncate text-[11px] text-muted-foreground">{fileLabel}</div>
                                            </div>
                                            {m.fileUrl && (
                                                <a href={m.fileUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 text-primary">
                                                    <DownloadCloud size={18} />
                                                </a>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </InsightCard>
                </div>
            </section>

            {/* Interaction Tools */}
            <section className="grid grid-cols-1 gap-3 lg:grid-cols-2 xs:gap-4">
                <ComingSoonCard icon={<MessageSquare size={22} />} title="Message Teachers" desc="Get help or ask questions directly." tone="blue" />
                <ComingSoonCard icon={<Target size={22} />} title="Study Goals" desc="Set reminders and track revision goals." tone="primary" />
            </section>

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
                    <div className="mt-0.5 text-xs text-muted-foreground">{submitModal.assignment?.subjectName}</div>
                    <div className="mt-0.5 text-xs text-destructive">{getDueLabel(submitModal.assignment?.dueDate)}</div>
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

// ── Helpers ─────────────────────────────────────────────────

function ComingSoonCard({ icon, title, desc, tone }: { icon: React.ReactNode; title: string; desc: string; tone: 'blue' | 'primary' }) {
    return (
        <div className="flex items-center gap-4 rounded-2xl border border-border/60 bg-card/90 p-4 shadow-sm">
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${tone === 'blue' ? 'bg-blue-500/10 text-blue-600' : 'bg-primary/10 text-primary'}`}>
                {icon}
            </div>
            <div className="min-w-0 flex-1">
                <h3 className="text-[15px] font-semibold text-foreground">{title}</h3>
                <p className="text-xs text-muted-foreground">{desc}</p>
            </div>
            <button disabled title="Coming soon" className="shrink-0 cursor-not-allowed rounded-lg bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                Coming soon
            </button>
        </div>
    );
}

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

function getExamCountdown(examDate: string): { variant: 'ongoing' | 'progress' | 'upcoming'; statusText: string } {
    const date = new Date(examDate);
    const daysLeft = Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    const variant = daysLeft <= 2 ? 'ongoing' : daysLeft <= 7 ? 'progress' : 'upcoming';
    const statusText = daysLeft <= 0 ? 'Today' : daysLeft === 1 ? 'Tomorrow' : `In ${daysLeft} days`;
    return { variant, statusText };
}

function getDueLabel(dateStr: string | undefined): string {
    if (!dateStr) return '';
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
        <div className="mx-auto max-w-[1200px] px-2 sm:px-3">
            <div className="mb-5 h-[128px] w-full rounded-2xl bg-muted/50" />
            <div className="mb-5 flex gap-3">
                {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="h-[92px] w-[calc((100%-3rem)/5)] shrink-0 rounded-2xl border border-border/60 bg-card/60 p-3.5">
                        <Bone width={32} height={32} radius={8} />
                        <Bone width="60%" height={20} style={{ marginTop: 10 }} />
                        <Bone width="80%" height={10} style={{ marginTop: 8 }} />
                    </div>
                ))}
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="h-[260px] rounded-2xl border border-border/60 bg-card/60" />
                <div className="h-[260px] rounded-2xl border border-border/60 bg-card/60" />
            </div>
        </div>
    );
}
