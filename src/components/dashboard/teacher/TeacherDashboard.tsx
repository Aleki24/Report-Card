"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight, BarChart3, BookOpen, CalendarCheck, CheckCircle2, ClipboardList, FileText,
  GraduationCap, Megaphone, NotebookPen, PenLine, Send, Users,
} from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { InfoGuide } from '@/components/ui/InfoGuide';
import { DashboardSkeleton } from '@/components/dashboard/LoadingSkeleton';
import KpiTile from '@/components/dashboard/KpiTile';
import SectionTitle from '@/components/dashboard/SectionTitle';
import UpcomingExamsCard, { type UpcomingExam } from '@/components/dashboard/UpcomingExamsCard';
import MarkingProgressPanel from './MarkingProgressPanel';
import { getCurrentTermName } from '@/lib/term-calendar';
import { markEntryHref, markingState, type MarkingProgressResponse } from '@/lib/marking-progress';

type Variant = 'class' | 'subject';

interface ClassStats { streamName: string; studentCount: number; streamAvg: string; reportsPending: number }
interface SubjectStats { examCount: number; avg: string; markCount: number }
interface DashboardSummary { upcomingExams: UpcomingExam[] }

interface QuickLink { label: string; desc: string; href: string; icon: React.ReactNode }

const QUICK_LINKS: Record<Variant, QuickLink[]> = {
  class: [
    { label: 'Enter or correct marks', desc: 'Type, fix or remove marks', href: '/dashboard/exams-marks', icon: <PenLine size={16} /> },
    { label: 'Class results', desc: 'Broadsheet and rankings', href: '/dashboard/exams-marks?tab=results', icon: <BarChart3 size={16} /> },
    { label: 'Report cards', desc: 'Generate and send to parents', href: '/dashboard/reports', icon: <FileText size={16} /> },
    { label: 'Attendance', desc: 'Mark today’s register', href: '/dashboard/attendance', icon: <CalendarCheck size={16} /> },
    { label: 'My learners', desc: 'Class roster', href: '/dashboard/people', icon: <Users size={16} /> },
  ],
  subject: [
    { label: 'Enter or correct marks', desc: 'Type, fix or remove marks', href: '/dashboard/exams-marks', icon: <PenLine size={16} /> },
    { label: 'Results', desc: 'Broadsheet and subject averages', href: '/dashboard/exams-marks?tab=results', icon: <BarChart3 size={16} /> },
    { label: 'Release results', desc: 'Let learners see their marks', href: '/dashboard/exams-marks?tab=publish', icon: <Send size={16} /> },
    { label: 'Assignments', desc: 'Set work for your classes', href: '/dashboard/assignments', icon: <NotebookPen size={16} /> },
    { label: 'Announcements', desc: 'Post to your classes', href: '/dashboard/announcements', icon: <Megaphone size={16} /> },
  ],
};

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

function greetingFor(hour: number): string {
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
}

/**
 * Home for class and subject teachers. It leads with the one job that matters
 * most in a term — getting marks in — and makes the next step one tap away.
 */
export default function TeacherDashboard({ variant }: { variant: Variant }) {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState<MarkingProgressResponse | null>(null);
  const [markingLoading, setMarkingLoading] = useState(true);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [classStats, setClassStats] = useState<ClassStats | null>(null);
  const [subjectStats, setSubjectStats] = useState<SubjectStats | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const [dash, stats] = await Promise.all([
        getJson<DashboardSummary>('/api/school/dashboard'),
        variant === 'class'
          ? getJson<ClassStats>('/api/school/stats?role=class_teacher')
          : getJson<SubjectStats>('/api/school/stats?role=subject_teacher'),
      ]);
      if (cancelled) return;
      setSummary(dash);
      if (variant === 'class') setClassStats(stats as ClassStats | null); else setSubjectStats(stats as SubjectStats | null);
      setLoading(false);
    })();
    // Marking progress is the slowest call; the page shows without it.
    (async () => {
      const progress = await getJson<MarkingProgressResponse>('/api/school/teacher/marking');
      if (cancelled) return;
      setMarking(progress);
      setMarkingLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user, variant]);

  const items = useMemo(() => marking?.items ?? [], [marking]);
  const progress = useMemo(() => {
    let left = 0, complete = 0;
    for (const i of items) {
      left += Math.max(0, i.expected - i.entered);
      if (markingState(i) === 'complete') complete++;
    }
    const next = items.find(i => markingState(i) === 'in-progress') ?? items.find(i => markingState(i) === 'not-started') ?? null;
    return { left, complete, next };
  }, [items]);

  if (loading) return <DashboardSkeleton />;

  const now = new Date();
  const firstName = profile?.first_name ?? '';
  const upcoming = summary?.upcomingExams ?? [];
  const termLabel = marking?.term?.name ?? getCurrentTermName();
  const avg = variant === 'class' ? classStats?.streamAvg : subjectStats?.avg;
  const avgText = avg && avg !== '—' ? `${avg}%` : '—';

  return (
    <div className="flex flex-col gap-5 px-1 pb-6 sm:px-2 lg:px-3">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 px-5 py-6 text-white shadow-sm sm:px-8 sm:py-8">
        <div className="pointer-events-none absolute -right-10 -top-14 h-48 w-48 rounded-full bg-white/10" aria-hidden />
        <div className="pointer-events-none absolute -bottom-16 right-24 h-40 w-40 rounded-full bg-white/5" aria-hidden />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium text-white/75 sm:text-sm">
              {now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })} · {termLabel}
            </p>
            <h1 className="mt-1 font-display text-2xl font-bold tracking-tight sm:text-3xl">
              {greetingFor(now.getHours())}{firstName ? `, ${firstName}` : ''}
            </h1>
            <p className="mt-1.5 max-w-xl text-sm text-white/85">
              {markingLoading
                ? (variant === 'class' ? `Here's how ${classStats?.streamName && classStats.streamName !== '—' ? classStats.streamName : 'your class'} is doing.` : 'Here is your marking for the term.')
                : progress.left > 0
                  ? `You have ${progress.left.toLocaleString()} mark${progress.left !== 1 ? 's' : ''} left to enter this term.`
                  : items.length > 0
                    ? 'All your marks are in for this term. Nice work.'
                    : variant === 'class' ? 'Your class at a glance.' : 'No exams to mark yet this term.'}
            </p>
          </div>
          <div className="flex flex-col gap-2 xs:flex-row">
            {progress.next ? (
              <Link
                href={markEntryHref(progress.next.termId, progress.next.examId)}
                className="inline-flex min-w-0 items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-indigo-700 shadow-sm transition-all hover:-translate-y-px hover:shadow-md"
              >
                <PenLine size={16} className="shrink-0" aria-hidden />
                <span className="truncate">Continue: {progress.next.subjectName} · {progress.next.className}</span>
              </Link>
            ) : (
              <Link href="/dashboard/exams-marks" className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-indigo-700 shadow-sm transition-all hover:-translate-y-px hover:shadow-md">
                <PenLine size={16} aria-hidden /> Enter or correct marks
              </Link>
            )}
            <Link
              href={variant === 'class' ? '/dashboard/reports' : '/dashboard/exams-marks?tab=results'}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/15 px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-inset ring-white/25 transition-colors hover:bg-white/20"
            >
              {variant === 'class' ? <><FileText size={16} aria-hidden /> Report cards</> : <><BarChart3 size={16} aria-hidden /> View results</>}
            </Link>
          </div>
        </div>
      </section>

      {/* At a glance */}
      <section>
        <SectionTitle>At a glance</SectionTitle>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiTile
            title="Marks to enter"
            value={markingLoading ? '…' : progress.left.toLocaleString()}
            icon={<ClipboardList size={17} />}
            href={progress.next ? markEntryHref(progress.next.termId, progress.next.examId) : '/dashboard/exams-marks'}
            tone={!markingLoading && progress.left > 0 ? 'amber' : undefined}
          />
          <KpiTile
            title="Exams fully marked"
            value={markingLoading ? '…' : `${progress.complete}/${items.length}`}
            icon={<CheckCircle2 size={17} />}
            href="/dashboard/exams-marks"
            tone={!markingLoading && items.length > 0 && progress.complete === items.length ? 'green' : undefined}
          />
          {variant === 'class' ? (
            <>
              <KpiTile title={classStats?.streamName && classStats.streamName !== '—' ? `Learners in ${classStats.streamName}` : 'Learners'} value={classStats?.studentCount ?? 0} icon={<GraduationCap size={17} />} href="/dashboard/people" />
              <KpiTile title="Class average" value={avgText} icon={<BarChart3 size={17} />} href="/dashboard/exams-marks?tab=results" />
            </>
          ) : (
            <>
              <KpiTile title="Subject average" value={avgText} icon={<BarChart3 size={17} />} href="/dashboard/exams-marks?tab=results" />
              <KpiTile title="Upcoming exams" value={upcoming.length} icon={<BookOpen size={17} />} href="/dashboard/exams-marks" />
            </>
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <MarkingProgressPanel items={items} termName={marking?.term?.name ?? null} loading={markingLoading} />
        </div>

        <div className="flex flex-col gap-5">
          <section className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm sm:p-5">
            <h2 className="mb-3 font-display text-base font-bold tracking-tight">Quick actions</h2>
            <ul className="flex flex-col gap-1">
              {QUICK_LINKS[variant].map(link => (
                <li key={link.href + link.label}>
                  <Link href={link.href} className="group flex items-center gap-3 rounded-xl px-2 py-2 no-underline transition-colors hover:bg-muted/60">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">{link.icon}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-foreground group-hover:text-primary">{link.label}</span>
                      <span className="block truncate text-xs text-muted-foreground">{link.desc}</span>
                    </span>
                    <ArrowRight size={14} className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <UpcomingExamsCard exams={upcoming} />

          {variant === 'class' && (classStats?.reportsPending ?? 0) > 0 && (
            <Link href="/dashboard/reports" className="flex items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 no-underline transition-colors hover:bg-amber-500/15">
              <FileText size={18} className="shrink-0 text-amber-600" aria-hidden />
              <span className="min-w-0 flex-1 text-sm">
                <strong className="text-foreground">{classStats?.reportsPending} report card{classStats?.reportsPending !== 1 ? 's' : ''}</strong>
                <span className="block text-xs text-muted-foreground">still to generate this year</span>
              </span>
              <ArrowRight size={16} className="shrink-0 text-amber-600" aria-hidden />
            </Link>
          )}
        </div>
      </div>

      <InfoGuide title={variant === 'class' ? 'How to run your class' : 'How to enter and correct marks'} className="mb-0">
        <ol className="list-decimal space-y-1.5 pl-5">
          <li><strong>Open an exam:</strong> tap it under <em>My marking</em>, or go to <strong>Exams &amp; Marks</strong> and pick the exam, class and subject.</li>
          <li><strong>Enter marks:</strong> type each learner&apos;s score — <em>Enter</em> jumps to the next learner — then press <strong>Save changes</strong>. Work is kept on your device if the network drops.</li>
          <li><strong>Correct a mistake:</strong> open the same exam; saved marks are already filled in. Find the learner, type over the wrong score and save. <em>Undo</em> puts it back; the bin removes a mark.</li>
          <li><strong>Release results:</strong> on <em>Release Results</em>, release a subject so learners can see it. You can still correct marks afterwards.</li>
          {variant === 'class' && <li><strong>Report cards:</strong> at term end, open <strong>Report Cards</strong> to generate your class&apos;s cards and send them to parents.</li>}
        </ol>
      </InfoGuide>
    </div>
  );
}
