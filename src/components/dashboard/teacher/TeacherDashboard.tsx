"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight, BarChart3, CalendarCheck, CheckCircle2, ClipboardList, FileText,
  GraduationCap, Hash, Megaphone, NotebookPen, PenLine, Send, Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/components/AuthProvider';
import { InfoGuide } from '@/components/ui/InfoGuide';
import { DashboardSkeleton } from '@/components/dashboard/LoadingSkeleton';
import KpiTile from '@/components/dashboard/KpiTile';
import SectionTitle from '@/components/dashboard/SectionTitle';
import InsightCard from '@/components/dashboard/InsightCard';
import UpcomingRounds from '@/components/dashboard/UpcomingRounds';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { OperationsOverview } from '@/components/dashboard/OperationsOverview';
import { QuickActions, type QuickActionItem } from '@/components/dashboard/QuickActions';
import { AUTO_FIT_GRID } from '@/components/dashboard/grid';
import type { TermSummary, UpcomingRound } from '@/lib/dashboard';
import MarkingProgressPanel from './MarkingProgressPanel';
import { markEntryHref, markingState, type MarkingProgressResponse } from '@/lib/marking-progress';

type Variant = 'class' | 'subject';

interface ClassStats { streamName: string; studentCount: number; streamAvg: string; reportsPending: number }
interface SubjectStats { examCount: number; avg: string; markCount: number }
interface DashboardSummary { term?: TermSummary; upcomingRounds?: UpcomingRound[] }

const QUICK_LINKS: Record<Variant, readonly QuickActionItem[]> = {
  class: [
    { label: 'Enter or correct marks', desc: 'Type, fix or remove marks', href: '/dashboard/exams-marks', icon: PenLine },
    { label: 'Class results', desc: 'Broadsheet and rankings', href: '/dashboard/exams-marks?tab=results', icon: BarChart3 },
    { label: 'Report cards', desc: 'Generate and send to parents', href: '/dashboard/reports', icon: FileText },
    { label: 'Attendance', desc: 'Mark today’s register', href: '/dashboard/attendance', icon: CalendarCheck },
    { label: 'My students', desc: 'Your class roster', href: '/dashboard/people', icon: Users },
  ],
  subject: [
    { label: 'Enter or correct marks', desc: 'Type, fix or remove marks', href: '/dashboard/exams-marks', icon: PenLine },
    { label: 'Results', desc: 'Broadsheet and subject averages', href: '/dashboard/exams-marks?tab=results', icon: BarChart3 },
    { label: 'Release results', desc: 'Let learners see their marks', href: '/dashboard/exams-marks?tab=publish', icon: Send },
    { label: 'Assignments', desc: 'Set work for your classes', href: '/dashboard/assignments', icon: NotebookPen },
    { label: 'Announcements', desc: 'Post to your classes', href: '/dashboard/announcements', icon: Megaphone },
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

  const firstName = profile?.first_name ?? '';
  const streamName = classStats?.streamName && classStats.streamName !== '—' ? classStats.streamName : null;
  const avg = variant === 'class' ? classStats?.streamAvg : subjectStats?.avg;
  const avgText = avg && avg !== '—' ? `${avg}%` : '—';
  const markingSummary = markingLoading
    ? null
    : progress.left > 0
      ? `You have ${progress.left.toLocaleString()} mark${progress.left !== 1 ? 's' : ''} left to enter this term.`
      : items.length > 0
        ? 'All your marks are in for this term. Nice work.'
        : 'No exams to mark yet this term.';

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-2 pb-8 sm:px-3 lg:px-4">
      <DashboardHeader name={firstName} term={summary?.term ?? null} canEditTerms={false} summary={markingSummary}>
        <div className="flex flex-col gap-2 sm:flex-row lg:flex-col xl:flex-row">
          {progress.next ? (
            <Link href={markEntryHref(progress.next.termId, progress.next.examId)} className="btn-primary min-w-0 no-underline">
              <PenLine size={16} className="shrink-0" aria-hidden />
              <span className="truncate">Continue: {progress.next.subjectName} · {progress.next.className}</span>
            </Link>
          ) : (
            <Link href="/dashboard/exams-marks" className="btn-primary no-underline">
              <PenLine size={16} aria-hidden /> Enter or correct marks
            </Link>
          )}
          <Link href={variant === 'class' ? '/dashboard/reports' : '/dashboard/exams-marks?tab=results'} className="btn-secondary no-underline">
            {variant === 'class' ? <><FileText size={16} aria-hidden /> Report cards</> : <><BarChart3 size={16} aria-hidden /> View results</>}
          </Link>
        </div>
      </DashboardHeader>

      <OperationsOverview />

      {/* At a glance */}
      <section>
        <SectionTitle>At a glance</SectionTitle>
        <div className={cn(AUTO_FIT_GRID.tile, 'gap-3')}>
          <KpiTile
            title="Marks to enter"
            value={markingLoading ? '…' : progress.left.toLocaleString()}
            icon={<ClipboardList size={17} />}
            hue="amber"
            href={progress.next ? markEntryHref(progress.next.termId, progress.next.examId) : '/dashboard/exams-marks'}
            tone={!markingLoading && progress.left > 0 ? 'amber' : undefined}
          />
          <KpiTile
            title="Exams fully marked"
            value={markingLoading ? '…' : `${progress.complete}/${items.length}`}
            icon={<CheckCircle2 size={17} />}
            hue="emerald"
            href="/dashboard/exams-marks"
            tone={!markingLoading && items.length > 0 && progress.complete === items.length ? 'green' : undefined}
          />
          {variant === 'class' ? (
            <>
              <KpiTile title={streamName ? `Learners in ${streamName}` : 'Learners'} value={classStats?.studentCount ?? 0} icon={<GraduationCap size={17} />} href="/dashboard/people" hue="orange" />
              <KpiTile title="Class average" value={avgText} icon={<BarChart3 size={17} />} href="/dashboard/exams-marks?tab=results" hue="violet" />
            </>
          ) : (
            <>
              <KpiTile title="Subject average" value={avgText} icon={<BarChart3 size={17} />} href="/dashboard/exams-marks?tab=results" hue="violet" />
              <KpiTile title="Marks entered" value={(subjectStats?.markCount ?? 0).toLocaleString()} icon={<Hash size={17} />} href="/dashboard/exams-marks" hue="sky" />
            </>
          )}
        </div>
      </section>

      <section aria-labelledby="teacher-actions-heading">
        <SectionTitle><span id="teacher-actions-heading">Quick actions</span></SectionTitle>
        <QuickActions items={QUICK_LINKS[variant]} />
      </section>

      {/* Quick actions sit in their own row above, so the side column is short
          and the marking list can fill its height. */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col lg:col-span-2">
          <MarkingProgressPanel className="flex-1" items={items} termName={marking?.term?.name ?? null} loading={markingLoading} />
        </div>

        <div className="flex flex-col gap-5">
          <InsightCard title="Coming up" meta="Next three weeks" action={{ label: 'Exams', href: '/dashboard/exams-marks' }} className="lg:flex-1">
            <UpcomingRounds rounds={summary?.upcomingRounds ?? []} />
          </InsightCard>

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
