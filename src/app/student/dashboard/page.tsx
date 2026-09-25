"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { toast } from 'sonner';
import {
    ArrowDownRight, ArrowUpRight, BookOpen, CalendarCheck, CalendarDays, Clock3, DownloadCloud,
    FileText, GraduationCap, Megaphone, Minus, RefreshCw, Send, TrendingUp, UploadCloud, Wallet,
} from 'lucide-react';
import type { StudentDashboardSummary } from '@/types';
import { PerformanceTrendChart } from '@/components/charts/PerformanceTrend';
import { Modal } from '@/components/ui';
import KpiTile from '@/components/dashboard/KpiTile';
import SectionTitle from '@/components/dashboard/SectionTitle';
import { Bone } from '@/components/dashboard/LoadingSkeleton';
import StudyGoalsCard from '@/components/student/StudyGoalsCard';
import LatestResultsCard from '@/components/student/dashboard/LatestResultsCard';
import { Panel, QuietEmpty, ScoreRing, daysUntil, relativeDay, timeAgo } from '@/components/student/dashboard/shared';
import { getCurrentTermName } from '@/lib/term-calendar';
import { cn } from '@/lib/utils';

interface Announcement { id: string; title: string; content: string; isImportant: boolean; createdAt: string }
interface Assignment { id: string; title: string; subjectName: string; dueDate: string; fileUrl: string | null }
interface LearningMaterial { id: string; title: string; subjectName: string; fileUrl: string | null; fileType: string | null; fileSizeBytes: number | null }
interface FeeRecord { balance: number }

type DashboardData = Partial<StudentDashboardSummary> & {
    announcements?: Announcement[];
    assignments?: Assignment[];
    materials?: LearningMaterial[];
};

/** Tailwind needs whole class names, so the tile grid picks from a fixed set. */
const KPI_GRID: Record<number, string> = {
    1: 'grid-cols-1',
    2: 'grid-cols-2',
    3: 'grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-2 lg:grid-cols-4',
    5: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-5',
};

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function StudentDashboardPage() {
    const { profile, loading: authLoading } = useAuth();
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [loadError, setLoadError] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [feesData, setFeesData] = useState<FeeRecord[]>([]);
    const [submitModal, setSubmitModal] = useState<Assignment | null>(null);
    const [subText, setSubText] = useState('');
    const [subFile, setSubFile] = useState<File | null>(null);
    const [submitting, setSubmitting] = useState(false);

    // Ticks so the greeting and countdowns stay right when the tab is left
    // open (or backgrounded) across the day.
    const [now, setNow] = useState(() => new Date());
    const fetchingRef = useRef(false);

    const fetchDashboard = useCallback(async (opts?: { silent?: boolean }) => {
        if (fetchingRef.current) return;
        fetchingRef.current = true;
        if (opts?.silent) setRefreshing(true); else setLoading(true);
        try {
            const [dashRes, feesRes] = await Promise.all([
                fetch('/api/school/student/dashboard'),
                fetch('/api/school/fees'),
            ]);
            if (!dashRes.ok) throw new Error('Failed to load dashboard');
            const dashJson = (await dashRes.json()) as { data?: DashboardData };
            const feesJson = feesRes.ok ? ((await feesRes.json()) as { data?: FeeRecord[] }) : null;
            setData(dashJson.data ?? {});
            setFeesData(feesJson?.data ?? []);
            setLastUpdated(new Date());
            setLoadError(false);
        } catch (err) {
            console.error('Dashboard fetch error:', err);
            setLoadError(true);
            if (opts?.silent) toast.error('Could not refresh your dashboard.');
        } finally {
            fetchingRef.current = false;
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => { void fetchDashboard(); }, [fetchDashboard]);

    // Mobile browsers suspend background tabs; refresh when the learner comes back.
    useEffect(() => {
        function onVisible() {
            if (document.visibilityState !== 'visible') return;
            setNow(new Date());
            void fetchDashboard({ silent: true });
        }
        document.addEventListener('visibilitychange', onVisible);
        window.addEventListener('focus', onVisible);
        return () => {
            document.removeEventListener('visibilitychange', onVisible);
            window.removeEventListener('focus', onVisible);
        };
    }, [fetchDashboard]);

    useEffect(() => {
        const id = setInterval(() => setNow(new Date()), 60_000);
        return () => clearInterval(id);
    }, []);

    if (authLoading || loading) return <DashboardSkeleton />;

    const stats = data?.stats;
    const upcomingExams = data?.upcomingExams ?? [];
    const announcements = data?.announcements ?? [];
    const assignments = data?.assignments ?? [];
    const materials = data?.materials ?? [];
    const trends = data?.trends ?? [];
    const latestResults = data?.latestResults ?? [];
    const latestReport = data?.latestReport ?? null;
    const feesBalance = feesData.reduce((sum, f) => sum + (f.balance || 0), 0);

    const hasResults = (stats?.examsTaken ?? 0) > 0;
    const average = hasResults ? stats?.averageScore ?? null : null;
    // Change since the previous term, from the term trend (oldest first).
    const current = trends.at(-1);
    const previous = trends.at(-2);
    const delta = current && previous ? Math.round((current.overallAverage - previous.overallAverage) * 10) / 10 : null;

    const hour = now.getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    const className = data?.profile?.grade_streams?.full_name ?? null;
    const termLabel = data?.currentTerm?.name ?? getCurrentTermName();
    const nextExam = upcomingExams
        .map(exam => ({ exam, days: daysUntil(exam.exam_date, now) }))
        .filter(e => e.days >= 0)
        .sort((a, b) => a.days - b.days)[0];
    const dueSoon = assignments.filter(a => daysUntil(a.dueDate, now) <= 2).length;

    const studentId = data?.profile?.id;
    const reportHref = latestReport && studentId
        ? `/api/reports/student/${studentId}?term=${latestReport.terms?.id ?? ''}&year=${latestReport.academic_years?.id ?? ''}`
        : null;

    const kpis: React.ReactNode[] = [
        <KpiTile key="avg" title={current ? `${current.termName} average` : 'Average score'} value={average != null ? `${average}%` : '—'} icon={<TrendingUp size={17} />} href="/student/results" tone="blue" />,
        <KpiTile key="subjects" title="Subjects" value={stats?.subjectsCount ?? 0} icon={<BookOpen size={17} />} href="/student/subjects" />,
        <KpiTile key="exams" title="Results released" value={stats?.examsTaken ?? 0} icon={<GraduationCap size={17} />} href="/student/results" />,
    ];
    // Attendance and fees only once the school uses them — a permanent "0%"
    // or "—" for a feature nobody switched on is noise, not information.
    if ((stats?.attendanceRecords ?? 0) > 0) {
        kpis.push(<KpiTile key="att" title="Attendance" value={`${stats?.attendanceRate ?? 0}%`} icon={<CalendarCheck size={17} />} href="/student/attendance" tone="green" />);
    }
    if (feesData.length > 0) {
        kpis.push(<KpiTile key="fees" title="Fees balance" value={`KShs ${feesBalance.toLocaleString()}`} icon={<Wallet size={17} />} href="/student/fees" alert={feesBalance > 0} tone={feesBalance > 0 ? 'red' : 'green'} />);
    }

    const handleSubmitAssignment = async () => {
        if (!submitModal) return;
        setSubmitting(true);
        try {
            let fileUrl = '';
            if (subFile) {
                const fd = new FormData();
                fd.append('file', subFile);
                const uploadRes = await fetch('/api/school/upload', { method: 'POST', body: fd });
                const uploadJson = (await uploadRes.json()) as { url?: string; error?: string };
                if (!uploadRes.ok) throw new Error(uploadJson.error || 'File upload failed');
                if (uploadJson.url) fileUrl = uploadJson.url;
            }
            const submitRes = await fetch('/api/school/submissions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ assignment_id: submitModal.id, file_url: fileUrl || null, submission_text: subText || null }),
            });
            if (!submitRes.ok) {
                const submitJson = (await submitRes.json().catch(() => ({}))) as { error?: string };
                throw new Error(submitJson.error || 'Submission failed');
            }
            setSubmitModal(null);
            setSubText('');
            setSubFile(null);
            toast.success('Assignment submitted');
        } catch (err) {
            console.error('Submission failed:', err);
            toast.error(err instanceof Error ? err.message : 'Submission failed. Please try again.');
        }
        setSubmitting(false);
    };

    return (
        <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-5 px-2 pb-6 sm:px-3">
            {/* ── Hero ── */}
            <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 px-5 py-6 text-white shadow-sm sm:px-8 sm:py-8">
                <div className="pointer-events-none absolute -right-10 -top-14 h-48 w-48 rounded-full bg-white/10" aria-hidden />
                <div className="pointer-events-none absolute -bottom-16 right-32 h-40 w-40 rounded-full bg-white/5" aria-hidden />
                <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                        <p className="text-xs font-medium text-white/75 sm:text-sm">
                            {now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })} · {termLabel}{className ? ` · ${className}` : ''}
                        </p>
                        <h1 className="mt-1 font-display text-2xl font-bold tracking-tight sm:text-3xl">
                            {greeting}{profile?.first_name ? `, ${profile.first_name}` : ''}
                        </h1>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                            {nextExam && (
                                <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 ring-1 ring-inset ring-white/25">
                                    <Clock3 size={14} aria-hidden /> {nextExam.exam.subject_name} exam {relativeDay(nextExam.days).toLowerCase()}
                                </span>
                            )}
                            {dueSoon > 0 && (
                                <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400/25 px-3 py-1.5 ring-1 ring-inset ring-amber-200/40">
                                    <FileText size={14} aria-hidden /> {dueSoon} assignment{dueSoon !== 1 ? 's' : ''} due soon
                                </span>
                            )}
                        </div>
                        <div className="mt-5 flex flex-col gap-2 xs:flex-row">
                            <Link href="/student/results" className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-indigo-700 shadow-sm transition-all hover:-translate-y-px hover:shadow-md">
                                <GraduationCap size={16} aria-hidden /> My results
                            </Link>
                            {reportHref ? (
                                <a href={reportHref} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/15 px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-inset ring-white/25 transition-colors hover:bg-white/20">
                                    <DownloadCloud size={16} aria-hidden /> {latestReport?.terms?.name ? `${latestReport.terms.name} report card` : 'Report card'}
                                </a>
                            ) : (
                                <Link href="/student/subjects" className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/15 px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-inset ring-white/25 transition-colors hover:bg-white/20">
                                    <BookOpen size={16} aria-hidden /> My subjects
                                </Link>
                            )}
                        </div>
                    </div>

                    {average != null && (
                        <div className="flex items-center gap-4 self-start rounded-2xl bg-white/10 p-3 pr-5 ring-1 ring-inset ring-white/15 md:self-auto">
                            <ScoreRing value={average} />
                            <div>
                                <p className="text-xs font-medium text-white/75">{current ? `${current.termName} ${current.yearName}`.trim() : 'This term'}</p>
                                {delta != null ? (
                                    <p className="mt-1 inline-flex items-center gap-1 text-sm font-semibold">
                                        {delta > 0 ? <ArrowUpRight size={16} aria-hidden /> : delta < 0 ? <ArrowDownRight size={16} aria-hidden /> : <Minus size={16} aria-hidden />}
                                        {delta > 0 ? `Up ${delta}` : delta < 0 ? `Down ${Math.abs(delta)}` : 'No change'}{delta !== 0 ? ' points' : ''}
                                    </p>
                                ) : (
                                    <p className="mt-1 text-sm font-semibold">Your first term on record</p>
                                )}
                                {previous && <p className="text-[11px] text-white/70">vs {previous.termName} {previous.yearName}</p>}
                            </div>
                        </div>
                    )}
                </div>
            </section>

            {loadError && (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    <span>Some of your data couldn&apos;t be loaded.</span>
                    <button type="button" onClick={() => void fetchDashboard({ silent: true })} className="shrink-0 font-semibold underline">Retry</button>
                </div>
            )}

            {/* ── At a glance ── */}
            <section>
                <div className="mb-3 flex items-center justify-between gap-3">
                    <SectionTitle>At a glance</SectionTitle>
                    <button
                        type="button"
                        onClick={() => void fetchDashboard({ silent: true })}
                        disabled={refreshing}
                        className="-mt-3 inline-flex shrink-0 items-center gap-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60"
                    >
                        <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} aria-hidden />
                        {refreshing ? 'Updating…' : lastUpdated ? `Updated ${timeAgo(lastUpdated.toISOString(), now)}` : 'Refresh'}
                    </button>
                </div>
                <div className={cn('grid gap-3', KPI_GRID[kpis.length] ?? KPI_GRID[4])}>{kpis}</div>
            </section>

            {/* ── Results + what's coming ── */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                <div className="flex flex-col gap-5 lg:col-span-2">
                    <LatestResultsCard results={latestResults} />

                    <Panel title="Progress over time" subtitle={trends.length > 1 ? 'Your average each term' : undefined}>
                        {trends.length > 1 ? (
                            <div className="h-[220px] w-full">
                                <PerformanceTrendChart data={trends.map(t => ({ examName: `${t.termName} ${t.yearName}`.trim(), average: t.overallAverage }))} />
                            </div>
                        ) : (
                            <QuietEmpty icon={<TrendingUp size={18} />}>Your progress chart appears after your second term of results.</QuietEmpty>
                        )}
                    </Panel>
                </div>

                <div className="flex flex-col gap-5">
                    <Panel title="Coming up" subtitle="Exams in the next 30 days">
                        {upcomingExams.length === 0 ? (
                            <QuietEmpty icon={<CalendarDays size={18} />}>No exams scheduled yet.</QuietEmpty>
                        ) : (
                            <ul className="flex flex-col gap-2">
                                {upcomingExams.slice(0, 5).map(exam => {
                                    const date = new Date(exam.exam_date);
                                    const days = daysUntil(exam.exam_date, now);
                                    const soon = days <= 3;
                                    return (
                                        <li key={exam.id} className={cn('flex items-center gap-3 rounded-xl border p-2', soon ? 'border-amber-500/30 bg-amber-500/10' : 'border-border/60')}>
                                            <div className={cn('flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg border bg-card', soon ? 'border-amber-500/30 text-amber-600' : 'border-border/60 text-muted-foreground')}>
                                                <span className="text-[9px] font-bold uppercase leading-none tracking-[0.12em]">{date.toLocaleDateString('en-GB', { month: 'short' })}</span>
                                                <span className="text-base font-bold leading-none">{date.toLocaleDateString('en-GB', { day: '2-digit' })}</span>
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="truncate text-sm font-semibold text-foreground">{exam.subject_name}</div>
                                                <div className="truncate text-xs text-muted-foreground">{exam.name}</div>
                                            </div>
                                            <span className={cn('shrink-0 text-[11px] font-semibold', soon ? 'text-amber-600' : 'text-muted-foreground')}>{relativeDay(days)}</span>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </Panel>

                    <Panel title="Homework" subtitle={assignments.length > 0 ? `${assignments.length} to hand in` : undefined}>
                        {assignments.length === 0 ? (
                            <QuietEmpty icon={<FileText size={18} />}>Nothing to hand in right now.</QuietEmpty>
                        ) : (
                            <ul className="flex flex-col gap-2">
                                {assignments.map(a => {
                                    const days = daysUntil(a.dueDate, now);
                                    return (
                                        <li key={a.id} className="flex items-center gap-3 rounded-xl border border-border/60 p-2.5">
                                            <div className="min-w-0 flex-1">
                                                <div className="truncate text-sm font-semibold text-foreground">{a.title}</div>
                                                <div className="truncate text-xs text-muted-foreground">
                                                    {a.subjectName} · <span className={cn('font-semibold', days < 0 ? 'text-red-600 dark:text-red-400' : days <= 2 ? 'text-amber-600' : '')}>{days < 0 ? 'Overdue' : `Due ${relativeDay(days).toLowerCase()}`}</span>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setSubmitModal(a)}
                                                className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/15"
                                            >
                                                <UploadCloud size={14} aria-hidden /> Submit
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </Panel>
                </div>
            </div>

            {/* ── School news, goals, notes ── */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                <Panel title="Announcements" className="lg:col-span-2">
                    {announcements.length === 0 ? (
                        <QuietEmpty icon={<Megaphone size={18} />}>No announcements from school yet.</QuietEmpty>
                    ) : (
                        <ul className="divide-y divide-border/60">
                            {announcements.slice(0, 4).map(a => (
                                <li key={a.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                                    <span className={cn('mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', a.isImportant ? 'bg-red-500/10 text-red-600' : 'bg-primary/10 text-primary')}>
                                        <Megaphone size={16} aria-hidden />
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                            <span className="text-sm font-semibold text-foreground">{a.title}</span>
                                            {a.isImportant && <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-red-600">Important</span>}
                                            <span className="text-[11px] text-muted-foreground">{timeAgo(a.createdAt, now)}</span>
                                        </div>
                                        <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{a.content}</p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </Panel>

                <StudyGoalsCard />
            </div>

            {materials.length > 0 && (
                <Panel title="Notes & learning materials" subtitle="Shared by your teachers">
                    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {materials.map(m => {
                            const fileLabel = [m.fileType, m.fileSizeBytes ? formatFileSize(m.fileSizeBytes) : null].filter(Boolean).join(' · ') || 'Resource';
                            const body = (
                                <>
                                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600"><FileText size={16} aria-hidden /></span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-sm font-semibold text-foreground">{m.title}</span>
                                        <span className="block truncate text-xs text-muted-foreground">{m.subjectName} · {fileLabel}</span>
                                    </span>
                                    {m.fileUrl && <DownloadCloud size={17} className="shrink-0 text-primary" aria-hidden />}
                                </>
                            );
                            return (
                                <li key={m.id}>
                                    {m.fileUrl ? (
                                        <a href={m.fileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-xl border border-border/60 p-2.5 no-underline transition-colors hover:border-primary/40">{body}</a>
                                    ) : (
                                        <div className="flex items-center gap-3 rounded-xl border border-border/60 p-2.5">{body}</div>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                </Panel>
            )}

            {/* ── Submit homework ── */}
            <Modal
                isOpen={!!submitModal}
                onClose={() => setSubmitModal(null)}
                title="Submit assignment"
                footer={(
                    <>
                        <button type="button" onClick={() => setSubmitModal(null)} className="btn-secondary">Cancel</button>
                        <button type="button" onClick={() => void handleSubmitAssignment()} disabled={submitting || (!subText && !subFile)} className="btn-primary inline-flex items-center gap-1.5">
                            <Send size={14} aria-hidden /> {submitting ? 'Submitting…' : 'Submit'}
                        </button>
                    </>
                )}
            >
                {submitModal && (
                    <div className="mb-4">
                        <div className="text-sm font-bold text-foreground">{submitModal.title}</div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                            {submitModal.subjectName} · {(() => { const d = daysUntil(submitModal.dueDate, now); return d < 0 ? 'Overdue' : `Due ${relativeDay(d).toLowerCase()}`; })()}
                        </div>
                    </div>
                )}
                <label className="mb-4 block">
                    <span className="mb-2 block text-xs font-semibold text-muted-foreground">Your answer / notes</span>
                    <textarea value={subText} onChange={e => setSubText(e.target.value)} rows={5} placeholder="Type your submission here…" className="input-field" />
                </label>
                <label className="block">
                    <span className="mb-2 block text-xs font-semibold text-muted-foreground">Upload a file (optional)</span>
                    <input type="file" onChange={e => setSubFile(e.target.files?.[0] ?? null)} className="w-full text-sm" />
                    <span className="mt-1 block text-[11px] text-muted-foreground">Max 10MB. PDF, DOC and images accepted.</span>
                </label>
            </Modal>
        </div>
    );
}

function DashboardSkeleton() {
    return (
        <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-5 px-2 sm:px-3">
            <div className="h-[184px] w-full animate-pulse rounded-2xl bg-muted/60" />
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="h-[96px] rounded-2xl border border-border/60 bg-card/60 p-3.5">
                        <Bone width={32} height={32} radius={8} />
                        <Bone width="60%" height={20} style={{ marginTop: 10 }} />
                    </div>
                ))}
            </div>
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                <div className="h-[280px] rounded-2xl border border-border/60 bg-card/60 lg:col-span-2" />
                <div className="h-[280px] rounded-2xl border border-border/60 bg-card/60" />
            </div>
        </div>
    );
}
